import { NextResponse } from "next/server";
import { isEvmPrismaChain, savePendingCircleAgentWalletIntent, type EvmPrismaChain } from "@clawdhq/custody-core";
import { CircleAgentWalletError } from "@clawdhq/circle";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// The Register Agent wizard's "bring your own Circle Agent Wallet" step calls this *before*
// submitting the on-chain registerAgent transaction — see PendingCircleAgentWalletIntent's own
// schema doc comment for why this has to happen first: the agent's on-chain wallet binding is
// one-time-settable, so there's no later "link an existing wallet" action once an agent is
// already registered. ownerAddress always comes from the verified session, never the request
// body — accepting a client-supplied ownerAddress here would let anyone redirect a *different*
// owner's next-registered agent to credentials the attacker controls.

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) {
      throw new ApiError(403, "Only a human wallet session can onboard a Circle Agent Wallet");
    }

    const body = await request.json().catch(() => ({}));
    const chainParam = typeof body?.chain === "string" ? body.chain : "";
    if (!isEvmPrismaChain(chainParam)) throw new ApiError(400, `"${chainParam}" isn't a chain Circuits Protocol supports.`);
    const chain: EvmPrismaChain = chainParam;

    const circleApiKey = typeof body?.circleApiKey === "string" ? body.circleApiKey.trim() : "";
    const circleEntitySecret = typeof body?.circleEntitySecret === "string" ? body.circleEntitySecret.trim() : "";
    const circleWalletId = typeof body?.circleWalletId === "string" ? body.circleWalletId.trim() : "";
    if (!circleApiKey || !circleEntitySecret || !circleWalletId) {
      throw new ApiError(400, "Missing circleApiKey, circleEntitySecret, or circleWalletId.");
    }

    await savePendingCircleAgentWalletIntent(chain, session.walletAddress, circleWalletId, { apiKey: circleApiKey, entitySecret: circleEntitySecret });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CircleAgentWalletError) return NextResponse.json({ error: error.message }, { status: 400 });
    return errorResponse(error);
  }
}
