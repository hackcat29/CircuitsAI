import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireHumanSession } from "@/lib/server/circle/ownerWallet";

const SOURCE_CHAINS = new Set<string>([Chain.BASE_SEPOLIA, Chain.ETH_SEPOLIA]);

/** Hands a just-submitted CCTP `depositForBurn` transaction (from the signed-in owner's own
 * Circle wallet — see useCctpSelfBridge.ts) off to the same relay queue
 * ClawdHQCrossChainIdentity's messages already use: apps/indexer's `runCrossChainIdentityRelayer`
 * polls Iris for *any* tracked (chain, txHash), regardless of which contract produced the
 * message, and submits `receiveMessage` on whichever destination domain Iris says it targeted.
 * This route's only job is the same `recordPendingRelay` upsert that listener already does for
 * `LinkRegistered` events — reimplemented here rather than imported because apps/indexer and
 * apps/web are separate packages that don't depend on each other, both already talking to the
 * same `@clawdhq/marketplace-db`. The user only ever signs the burn; this makes the mint on the
 * destination chain the relayer's problem, not another PIN-approval popup. */
export async function POST(request: Request) {
  try {
    const ownerAddress = await requireHumanSession();

    const body = await request.json().catch(() => null);
    const sourceChain = typeof body?.sourceChain === "string" ? body.sourceChain : undefined;
    const txHash = typeof body?.txHash === "string" ? body.txHash : undefined;
    if (!sourceChain || !txHash) throw new ApiError(400, "sourceChain and txHash are required");
    if (!SOURCE_CHAINS.has(sourceChain)) throw new ApiError(400, `${sourceChain} isn't a supported CCTP source chain`);

    await prisma.crossChainRelay.upsert({
      where: { sourceChain_sourceTxHash: { sourceChain: sourceChain as Chain, sourceTxHash: txHash } },
      create: { sourceChain: sourceChain as Chain, sourceTxHash: txHash },
      update: {},
    });

    return NextResponse.json({ ok: true, ownerAddress });
  } catch (error) {
    return errorResponse(error);
  }
}
