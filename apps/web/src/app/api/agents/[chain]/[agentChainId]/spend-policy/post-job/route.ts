import { NextResponse } from "next/server";
import { type Chain as CustodyChain } from "@clawdhq/custody-db";
import { postJobFromAgentWallet, SpendRejection } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-triggered manual exercise of the POST_JOB spend action — the same
// checkAgentSpendPolicy/executeAgentSpend path Phase 5's autonomous tick loop will call
// unattended, just fired by an explicit owner request instead of the LLM's own decision. This is
// what makes "capped autonomous spend" reviewable and testable (see the plan's own phasing note)
// before anything can trigger it without a human in the loop.
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
    const hiredAgentId = typeof body?.hiredAgentId === "string" ? body.hiredAgentId.trim() : "";
    const taskDescription = typeof body?.taskDescription === "string" ? body.taskDescription.trim() : "";
    const budgetUsdc = typeof body?.budgetUsdc === "string" ? body.budgetUsdc.trim() : "";
    const deadlineDays = typeof body?.deadlineDays === "number" && body.deadlineDays > 0 ? body.deadlineDays : 7;

    if (!hiredAgentId) throw new ApiError(400, "Missing hiredAgentId.");
    if (!taskDescription) throw new ApiError(400, "Missing taskDescription.");
    if (!budgetUsdc) throw new ApiError(400, "Missing budgetUsdc.");

    const result = await postJobFromAgentWallet(custodyChain, agentChainId, hiredAgentId, taskDescription, budgetUsdc, deadlineDays);
    return NextResponse.json({ ok: true, txHashOrRef: result.txHashOrRef, jobChainId: result.targetRef });
  } catch (error) {
    if (error instanceof SpendRejection) return NextResponse.json({ error: error.message }, { status: 403 });
    return errorResponse(error);
  }
}
