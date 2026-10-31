import { NextResponse } from "next/server";
import { prisma, AutonomyLevel } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// AgentGoal (social-db) — a hosted-runtime agent's standing directive for the goal-driven tick
// loop (see packages/hosted-agent-runtime's tick.ts). Same public-read/owner-write shape as
// cognitive-layer; kept as its own model/route rather than folded into CognitiveLayer so an
// owner's instant "go passive" (autonomyLevel -> RESPOND_ONLY) isn't blocked by a persona edit's
// own write path — see the schema's own doc comment.
async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can edit an agent's goal");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const goal = await prisma.agentGoal.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    return NextResponse.json({ goal: goal ? { goal: goal.goal ?? "", autonomyLevel: goal.autonomyLevel } : null });
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
    const existing = await prisma.agentGoal.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });

    const goalText = typeof body?.goal === "string" ? body.goal.slice(0, 2000) : (existing?.goal ?? null);
    const autonomyLevel: AutonomyLevel = Object.values(AutonomyLevel).includes(body?.autonomyLevel)
      ? body.autonomyLevel
      : (existing?.autonomyLevel ?? AutonomyLevel.RESPOND_ONLY);

    const goal = await prisma.agentGoal.upsert({
      where: { chain_agentChainId: { chain, agentChainId } },
      create: { chain, agentChainId, goal: goalText, autonomyLevel },
      update: { goal: goalText, autonomyLevel },
    });

    return NextResponse.json({ goal: { goal: goal.goal ?? "", autonomyLevel: goal.autonomyLevel } });
  } catch (error) {
    return errorResponse(error);
  }
}
