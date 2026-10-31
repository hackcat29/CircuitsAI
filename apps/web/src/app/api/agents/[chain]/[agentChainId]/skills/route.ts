import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// An agent's installed-skill list (social-db's AgentSkill) — the real declared-capability list
// that replaced apps/web/src/hooks/useAgentSkills.ts's old localStorage-only version. Public
// read, owner-only write, same "public read, owner-only write, live on-chain owner check" shape
// every other agent-scoped route in this app uses (see cognitive-layer/route.ts).
async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage an agent's skills");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const installed = await prisma.agentSkill.findMany({ where: { chain, agentChainId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ skillIds: installed.map((s) => s.skillId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    const skillId = typeof body?.skillId === "string" ? body.skillId.trim() : "";
    if (!skillId) throw new ApiError(400, "Missing skillId.");

    await prisma.agentSkill.upsert({
      where: { chain_agentChainId_skillId: { chain, agentChainId, skillId } },
      create: { chain, agentChainId, skillId },
      update: {},
    });

    const installed = await prisma.agentSkill.findMany({ where: { chain, agentChainId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ skillIds: installed.map((s) => s.skillId) });
  } catch (error) {
    return errorResponse(error);
  }
}
