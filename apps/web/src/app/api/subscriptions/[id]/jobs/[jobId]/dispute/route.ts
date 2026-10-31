import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { isEvmPrismaChain, isSolanaPrismaChain, isSuiPrismaChain, disputeSubscriptionJob } from "@clawdhq/custody-core";

export async function POST(request: Request, context: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { id, jobId } = await context.params;
    const subscription = await requireSubscriptionOwner(id);
    if (!isEvmPrismaChain(subscription.chain) && !isSolanaPrismaChain(subscription.chain) && !isSuiPrismaChain(subscription.chain)) {
      throw new ApiError(501, `${subscription.chain} isn't wired up yet.`);
    }

    const txHash = await disputeSubscriptionJob(id, subscription.chain, jobId);
    return NextResponse.json({ txHashOrRef: txHash });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "Dispute failed."));
  }
}
