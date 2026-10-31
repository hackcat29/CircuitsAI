import { prisma, Mode, OrderStatus, type Chain, type Prisma, type Venue, type TradingOrder } from "@clawdhq/degen-db";
import { VENUE_ADAPTERS } from "@/lib/server/degen/venues/registry";
import { updatePositionForFill } from "@/lib/server/degen/positionLedger";
import { getDecryptedTradingWallet } from "@/lib/server/degen/custody";
import { VenueError } from "@/lib/server/degen/venues/types";

// LIVE-mode counterpart to paperEngine.ts — same idempotency contract, same TradingOrder/
// Position ledger shape (mode: LIVE instead of PAPER), same position math (positionLedger.ts),
// but placeOrder() actually signs and submits using the agent's own custodied key rather than
// simulating a fill against a read-only quote. The one meaningful difference in the write path:
// a REJECTED/ERROR row here reflects a real venue response or a real submission failure, not a
// risk-engine decision (that already happened before this is ever called — see
// /api/degen/orders' route, which runs checkRisk() first regardless of mode).

export interface PlaceLiveOrderInput {
  chain: Chain;
  agentChainId: string;
  venue: Venue;
  action: string;
  market: string;
  sizeUsdc: Prisma.Decimal;
  clientOrderId: string;
}

export async function placeLiveOrder(input: PlaceLiveOrderInput): Promise<TradingOrder> {
  const { chain, agentChainId, venue, action, market, sizeUsdc, clientOrderId } = input;

  const existing = await prisma.tradingOrder.findUnique({
    where: { chain_agentChainId_venue_mode_clientOrderId: { chain, agentChainId, venue, mode: Mode.LIVE, clientOrderId } },
  });
  if (existing) return existing; // idempotent retry — never re-submit a real order for a repeated key

  const wallet = await getDecryptedTradingWallet(chain, agentChainId, venue);
  if (!wallet) {
    return prisma.tradingOrder.create({
      data: {
        chain,
        agentChainId,
        venue,
        mode: Mode.LIVE,
        clientOrderId,
        action,
        market,
        requestedUsdc: sizeUsdc,
        status: OrderStatus.ERROR,
        rejectReason: "No LIVE-mode wallet has been provisioned for this agent on this venue yet",
      },
    });
  }

  const adapter = VENUE_ADAPTERS[venue];
  try {
    const fill = await adapter.placeOrder(wallet, { action, market, sizeUsdc });

    return await prisma.$transaction(async (tx) => {
      await updatePositionForFill(tx, { chain, agentChainId, venue, mode: Mode.LIVE, market }, action, fill.fillPrice, sizeUsdc);
      const order = await tx.tradingOrder.create({
        data: {
          chain,
          agentChainId,
          venue,
          mode: Mode.LIVE,
          clientOrderId,
          action,
          market,
          requestedUsdc: sizeUsdc,
          status: OrderStatus.FILLED,
          fillPrice: fill.fillPrice,
          txHashOrRef: fill.txHashOrRef,
        },
      });
      if (fill.pendingSettlement) {
        await tx.pendingBetSettlement.create({
          data: {
            chain,
            agentChainId,
            venue,
            tradingOrderId: order.id,
            market,
            betId: fill.pendingSettlement.betId,
            stakeUsdc: fill.pendingSettlement.stakeUsdc,
            oddsAtEntry: fill.pendingSettlement.oddsAtEntry,
            metadata: fill.pendingSettlement.metadata,
          },
        });
      }
      return order;
    });
  } catch (err) {
    // A real venue rejection or submission failure — recorded as ERROR (not REJECTED, which is
    // reserved for the risk engine's own pre-trade decisions) so the two failure sources stay
    // distinguishable in the order history.
    const message = err instanceof VenueError ? err.message : err instanceof Error ? err.message : String(err);
    return prisma.tradingOrder.create({
      data: {
        chain,
        agentChainId,
        venue,
        mode: Mode.LIVE,
        clientOrderId,
        action,
        market,
        requestedUsdc: sizeUsdc,
        status: OrderStatus.ERROR,
        rejectReason: message,
      },
    });
  }
}
