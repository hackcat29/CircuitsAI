import { NextResponse } from "next/server";
import { type Chain as CustodyChain } from "@clawdhq/custody-db";
import { payFromAgentWallet, SpendRejection } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-triggered manual exercise of the X402_PAYMENT spend action — same
// checkAgentSpendPolicy/executeAgentSpend path the tick loop calls unattended, same "reviewable
// before anything can trigger it without a human in the loop" reasoning as the post-job route.
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
    const recipient = typeof body?.recipient === "string" ? body.recipient.trim() : "";
    const amountUsdc = typeof body?.amountUsdc === "string" ? body.amountUsdc.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!recipient) throw new ApiError(400, "Missing recipient.");
    if (!amountUsdc) throw new ApiError(400, "Missing amountUsdc.");

    const result = await payFromAgentWallet(custodyChain, agentChainId, recipient, amountUsdc, reason);
    return NextResponse.json({ ok: true, txHashOrRef: result.txHashOrRef });
  } catch (error) {
    if (error instanceof SpendRejection) return NextResponse.json({ error: error.message }, { status: 403 });
    return errorResponse(error);
  }
}
