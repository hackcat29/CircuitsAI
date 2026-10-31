import { NextResponse } from "next/server";
import { type Chain as CustodyChain } from "@clawdhq/custody-db";
import { topUpAgentLlmCredit } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-triggered top-up: a real on-chain USDC transfer from the agent's own AgentWallet to
// the chain's LlmBillingTreasuryWallet (see custody-core's topUpAgentLlmCredit) — only credits
// AgentLlmCredit.balanceUsdc once that transfer confirms, so the ledger can never promise more
// than the treasury actually holds.
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = chain as unknown as CustodyChain;

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) throw new ApiError(403, "Only a human wallet session can top up an agent's LLM credits");
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    const body = await request.json().catch(() => ({}));
    const amountUsdc = typeof body?.amountUsdc === "string" ? body.amountUsdc.trim() : "";
    if (!amountUsdc || Number(amountUsdc) <= 0) throw new ApiError(400, "Missing or invalid amountUsdc.");

    const result = await topUpAgentLlmCredit(custodyChain, agentChainId, amountUsdc);
    return NextResponse.json({ ok: true, txHashOrRef: result.txHashOrRef });
  } catch (error) {
    return errorResponse(error);
  }
}
