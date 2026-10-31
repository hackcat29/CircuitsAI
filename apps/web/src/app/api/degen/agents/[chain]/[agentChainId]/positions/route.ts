import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/degen-db";
import { requireOwnerOrTradingActor } from "@/lib/server/degen/degenAuth";
import { parseChain } from "@/lib/server/degen/degenValidate";
import { errorResponse } from "@/lib/server/socialErrors";

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerOrTradingActor(request, chain, agentChainId);

    const positions = await prisma.position.findMany({
      where: { chain, agentChainId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      positions: positions.map((p) => ({
        venue: p.venue,
        mode: p.mode,
        market: p.market,
        netSizeUsdc: p.netSizeUsdc.toString(),
        avgEntryPrice: p.avgEntryPrice?.toString() ?? null,
        realizedPnlUsdc: p.realizedPnlUsdc.toString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
