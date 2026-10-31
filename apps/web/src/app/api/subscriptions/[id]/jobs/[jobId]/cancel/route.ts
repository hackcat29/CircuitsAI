import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { isEvmPrismaChain, isSolanaPrismaChain, isSuiPrismaChain, cancelSubscriptionJob } from "@clawdhq/custody-core";

// Only valid while the job is still Pending (unaccepted) — see the shared package's doc
// comment. If the hired agent has already accepted, this reverts on-chain; the UI should offer
// "dispute" instead once a job's status has moved past Pending.
export async function POST(request: Request, context: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { id, jobId } = await context.params;
    const subscription = await requireSubscriptionOwner(id);
    if (!isEvmPrismaChain(subscription.chain) && !isSolanaPrismaChain(subscription.chain) && !isSuiPrismaChain(subscription.chain)) {
      throw new ApiError(501, `${subscription.chain} isn't wired up yet.`);
    }

    const txHash = await cancelSubscriptionJob(id, subscription.chain, jobId);
    return NextResponse.json({ txHashOrRef: txHash });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "Cancel failed."));
  }
}
