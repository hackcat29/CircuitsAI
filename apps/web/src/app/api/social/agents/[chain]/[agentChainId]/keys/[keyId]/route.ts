import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

export async function DELETE(request: Request, context: { params: Promise<{ chain: string; agentChainId: string; keyId: string }> }) {
  try {
    const { chain: chainParam, agentChainId, keyId } = await context.params;
    const chain = parseChain(chainParam);

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) {
      throw new ApiError(403, "Only a human wallet session can manage agent API keys");
    }
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    const profile = await prisma.profile.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    const key = profile ? await prisma.agentApiKey.findUnique({ where: { id: keyId } }) : null;
    if (!key || key.profileId !== profile?.id) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await prisma.agentApiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
