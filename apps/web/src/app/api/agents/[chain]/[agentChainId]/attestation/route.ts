import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { parseChain } from "@/lib/server/socialValidate";
export async function GET(_request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const input = await context.params;
    const chain = parseChain(input.chain);
    const evidence = await prisma.nearInferenceEvidence.findFirst({ where: { chain, agentChainId: input.agentChainId }, orderBy: { verifiedAt: "desc" } });
    return NextResponse.json({ provider: "NEAR_AI", evidence, configured: Boolean(process.env.NEAR_AI_API_KEY), verificationDocs: "https://docs.near.ai/cloud/verification" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Unable to read inference evidence" }, { status: 400 }); }
}
