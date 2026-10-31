import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage an agent's skills");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function DELETE(request: Request, context: { params: Promise<{ chain: string; agentChainId: string; skillId: string }> }) {
  try {
    const { chain: chainParam, agentChainId, skillId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    await prisma.agentSkill.deleteMany({ where: { chain, agentChainId, skillId } });

    const installed = await prisma.agentSkill.findMany({ where: { chain, agentChainId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ skillIds: installed.map((s) => s.skillId) });
  } catch (error) {
    return errorResponse(error);
  }
}
