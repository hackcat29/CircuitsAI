import { NextResponse } from "next/server";
import { prisma, Mode, OrderStatus } from "@clawdhq/degen-db";
import { requireTradingActor, agentFromTradingActor } from "@/lib/server/degen/degenAuth";
import { parseVenue, parsePositiveDecimal } from "@/lib/server/degen/degenValidate";
import { assertWithinOrderRateLimit } from "@/lib/server/degen/degenRateLimit";
import { checkRisk } from "@/lib/server/degen/riskEngine";
import { simulatePaperOrder } from "@/lib/server/degen/paperEngine";
import { placeLiveOrder } from "@/lib/server/degen/liveEngine";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// The one endpoint an agent's own external "brain" calls to actually trade — see the plan's
// "external brain, ClawdHQ executes" decision. Auth is strictly a TRADING-scope bearer key
// (requireTradingActor), and the agent being traded for is derived from that key, never from a
// request body field, so a key can only ever place orders for the agent it was minted for.
export async function POST(request: Request) {
  try {
    const actor = await requireTradingActor(request);
    const { chain, agentChainId } = agentFromTradingActor(actor);

    const body = await request.json();
    const venue = parseVenue(body?.venue);
    const action = typeof body?.action === "string" ? body.action : "";
    const market = typeof body?.market === "string" ? body.market : "";
    const clientOrderId = typeof body?.clientOrderId === "string" ? body.clientOrderId : "";
    if (!action) throw new ApiError(400, "action is required");
    if (!market) throw new ApiError(400, "market is required");
    if (!clientOrderId) throw new ApiError(400, "clientOrderId is required (idempotency key: a retried request with the same value returns the original result)");
    const sizeUsdc = parsePositiveDecimal(body?.sizeUsdc, "sizeUsdc");

    // Idempotency check up front: covers the rejected/error paths below too, not just the
    // paper-fill path (simulatePaperOrder has its own equivalent check for its own path).
    const existing = await prisma.tradingOrder.findMany({ where: { chain, agentChainId, venue, clientOrderId }, take: 1 });
    if (existing[0]) return NextResponse.json(serializeOrderResult(existing[0]));

    await assertWithinOrderRateLimit(chain, agentChainId);

    const risk = await checkRisk({ chain, agentChainId, venue, action, market, sizeUsdc });
    if (!risk.allowed) {
      const rejected = await prisma.tradingOrder.create({
        data: {
          chain,
          agentChainId,
          venue,
          mode: Mode.PAPER, // best-known mode at rejection time; rejection isn't mode-specific execution
          clientOrderId,
          action,
          market,
          requestedUsdc: sizeUsdc,
          status: OrderStatus.REJECTED,
          rejectReason: risk.reason,
        },
      });
      return NextResponse.json(serializeOrderResult(rejected), { status: 422 });
    }

    const order =
      risk.config.mode === Mode.LIVE
        ? await placeLiveOrder({ chain, agentChainId, venue, action, market, sizeUsdc, clientOrderId })
        : await simulatePaperOrder({ chain, agentChainId, venue, action, market, sizeUsdc, clientOrderId });

    return NextResponse.json(serializeOrderResult(order), { status: order.status === OrderStatus.ERROR ? 502 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

function serializeOrderResult(order: {
  id: string;
  status: OrderStatus;
  mode: Mode;
  fillPrice: { toString(): string } | null;
  txHashOrRef: string | null;
  rejectReason: string | null;
}) {
  return {
    id: order.id,
    status: order.status,
    mode: order.mode,
    fillPrice: order.fillPrice?.toString() ?? null,
    txHashOrRef: order.txHashOrRef,
    rejectReason: order.rejectReason,
  };
}
