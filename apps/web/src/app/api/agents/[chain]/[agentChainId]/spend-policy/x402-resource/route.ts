import { NextResponse } from "next/server";
import { type Chain as CustodyChain } from "@clawdhq/custody-db";
import { payX402ResourceFromAgentWallet, SpendRejection } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-triggered manual exercise of the negotiated X402_PAYMENT spend action — same
// checkAgentSpendPolicy/executeAgentSpend path x402-payment/route.ts's blind-transfer version
// uses, but this one fetches `url` itself and pays whatever it actually advertises (up to
// maxAmountUsdc), instead of the caller declaring the amount upfront. Deliberately NOT wired
// into the hosted-runtime tick loop's autonomous LLM decision yet — letting an LLM fetch
// arbitrary URLs of its own choosing on an unattended schedule is a materially different (and
// larger) risk surface than picking from an already-resolved skill/knowledge shortlist the way
// USE_SKILL/USE_KNOWLEDGE do, and deserves its own explicit decision rather than riding in on
// this route's coattails.
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
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const maxAmountUsdc = typeof body?.maxAmountUsdc === "string" ? body.maxAmountUsdc.trim() : "";

    if (!url) throw new ApiError(400, "Missing url.");
    if (!maxAmountUsdc) throw new ApiError(400, "Missing maxAmountUsdc.");

    const result = await payX402ResourceFromAgentWallet(custodyChain, agentChainId, url, maxAmountUsdc);
    return NextResponse.json({ ok: true, txHashOrRef: result.txHashOrRef, data: result.data });
  } catch (error) {
    if (error instanceof SpendRejection) return NextResponse.json({ error: error.message }, { status: 403 });
    return errorResponse(error);
  }
}
