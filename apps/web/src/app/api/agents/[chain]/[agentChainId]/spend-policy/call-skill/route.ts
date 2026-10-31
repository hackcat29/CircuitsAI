import { NextResponse } from "next/server";
import { type Chain as CustodyChain } from "@clawdhq/custody-db";
import { prisma as socialPrisma } from "@clawdhq/social-db";
import { resolveSkillInvocation, callResolvedAgentSkill, SpendRejection } from "@clawdhq/custody-core";
import { publishedSkillToInvocation } from "@clawdhq/hosted-agent-runtime";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-triggered manual exercise of the CALL_SKILL spend action — same reasoning post-job's own
// doc comment gives: the identical checkAgentSpendPolicy/executeAgentSpend path the tick loop's
// USE_SKILL action and the reactive .../a2a route's tool-calling both exercise unattended, just
// fired here by an explicit owner request, so an owner can verify a skill actually works (and
// see what it costs) before ever letting the LLM decide to call it on its own.
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = chain as unknown as CustodyChain;

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) throw new ApiError(403, "Only a human wallet session can trigger a spend");
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    const body = await request.json().catch(() => ({}));
    const skillId = typeof body?.skillId === "string" ? body.skillId.trim() : "";
    if (!skillId) throw new ApiError(400, "Missing skillId.");
    const input = body?.input ?? {};

    // Same merged resolution loadResolvedAgentSkills (hosted-agent-runtime's persona.ts) does:
    // custody-core's static registry first (built-in + operator-configured), then social-db's
    // PublishedSkill table for anything it doesn't recognize — this route predates
    // PublishedSkill and only ever checked the former.
    let invocation = resolveSkillInvocation(skillId);
    if (!invocation) {
      const published = await socialPrisma.publishedSkill.findUnique({ where: { id: skillId } });
      if (published) invocation = publishedSkillToInvocation(published);
    }
    if (!invocation) throw new ApiError(404, `No invocation is registered for skill "${skillId}".`);

    const result = await callResolvedAgentSkill(custodyChain, agentChainId, skillId, invocation, input);
    return NextResponse.json({ ok: true, txHashOrRef: result.txHashOrRef, result: result.result });
  } catch (error) {
    if (error instanceof SpendRejection) return NextResponse.json({ error: error.message }, { status: 403 });
    return errorResponse(error);
  }
}
