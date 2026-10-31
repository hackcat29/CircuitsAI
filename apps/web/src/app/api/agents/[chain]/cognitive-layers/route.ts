import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { parseChain, serializeCognitiveLayer } from "@/lib/server/socialValidate";

// Every persona for one chain, for the Agent Directory's "which agents have a persona" split
// (see apps/web/src/app/agents/page.tsx) — a bounded read for a testnet-scale agent count, same
// "just fetch everything for the active chain" shape useRankings() already uses.
export async function GET(request: Request, context: { params: Promise<{ chain: string }> }) {
  try {
    const { chain: chainParam } = await context.params;
    const chain = parseChain(chainParam);
    const candidateChains = [chain];
    const layers = await prisma.cognitiveLayer.findMany({
      where: { chain: { in: candidateChains as any } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ layers: layers.map(serializeCognitiveLayer) });
  } catch (error) {
    return errorResponse(error);
  }
}
