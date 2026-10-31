import { randomBytes } from "node:crypto";
import { prisma, Prisma, Mode, OrderStatus, type Chain, type Venue, type TradingOrder } from "@clawdhq/degen-db";
import { VENUE_ADAPTERS } from "@/lib/server/degen/venues/registry";
import { updatePositionForFill } from "@/lib/server/degen/positionLedger";

// The reason PAPER mode needs zero custody/signing code at all: calls the venue's real,
// read-only, keyless getQuote() (live market data — no testnet needed, which matters since
// Pump.fun and Jupiter Predict have no real testnet to begin with) and simulates the fill locally,
// writing the exact same TradingOrder/Position rows LIVE mode would (mode: PAPER). See the
// plan's "paperEngine.ts" section. Position math itself lives in positionLedger.ts, shared with
// liveEngine.ts — a fill is a fill regardless of where the price came from.

export interface SimulateOrderInput {
  chain: Chain;
  agentChainId: string;
  venue: Venue;
  action: string;
  market: string;
  sizeUsdc: Prisma.Decimal;
  clientOrderId: string;
}

export async function simulatePaperOrder(input: SimulateOrderInput): Promise<TradingOrder> {
  const { chain, agentChainId, venue, action, market, sizeUsdc, clientOrderId } = input;

  const existing = await prisma.tradingOrder.findUnique({
    where: { chain_agentChainId_venue_mode_clientOrderId: { chain, agentChainId, venue, mode: Mode.PAPER, clientOrderId } },
  });
  if (existing) return existing; // idempotent retry — same key returns the original result, no double-fill

  const adapter = VENUE_ADAPTERS[venue];
  const quote = await adapter.getQuote(market);

  return prisma.$transaction(async (tx) => {
    await updatePositionForFill(tx, { chain, agentChainId, venue, mode: Mode.PAPER, market }, action, quote.price, sizeUsdc);

    return tx.tradingOrder.create({
      data: {
        chain,
        agentChainId,
        venue,
        mode: Mode.PAPER,
        clientOrderId,
        action,
        market,
        requestedUsdc: sizeUsdc,
        status: OrderStatus.FILLED,
        fillPrice: quote.price,
        txHashOrRef: `paper-${randomBytes(12).toString("hex")}`,
      },
    });
  });
}
