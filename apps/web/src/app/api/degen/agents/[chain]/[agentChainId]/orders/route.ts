import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/degen-db";
import { requireOwnerOrTradingActor } from "@/lib/server/degen/degenAuth";
import { parseChain } from "@/lib/server/degen/degenValidate";
import { errorResponse } from "@/lib/server/socialErrors";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerOrTradingActor(request, chain, agentChainId);

    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(PAGE_SIZE_MAX, Math.floor(limitParam)) : PAGE_SIZE_DEFAULT;

    const orders = await prisma.tradingOrder.findMany({
      where: { chain, agentChainId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        venue: o.venue,
        mode: o.mode,
        action: o.action,
        market: o.market,
        requestedUsdc: o.requestedUsdc.toString(),
        status: o.status,
        fillPrice: o.fillPrice?.toString() ?? null,
        txHashOrRef: o.txHashOrRef,
        rejectReason: o.rejectReason,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
