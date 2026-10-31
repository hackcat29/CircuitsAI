import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { isEvmPrismaChain, isSolanaPrismaChain, isSuiPrismaChain, confirmSubscriptionJob } from "@clawdhq/custody-core";

export async function POST(request: Request, context: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { id, jobId } = await context.params;
    const subscription = await requireSubscriptionOwner(id);
    if (!isEvmPrismaChain(subscription.chain) && !isSolanaPrismaChain(subscription.chain) && !isSuiPrismaChain(subscription.chain)) {
      throw new ApiError(501, `${subscription.chain} isn't wired up yet.`);
    }

    const body = await request.json().catch(() => ({}));
    const rating = Number(body?.rating ?? 5);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(400, "rating must be a whole number from 1 to 5");

    const txHash = await confirmSubscriptionJob(id, subscription.chain, jobId, rating);
    return NextResponse.json({ txHashOrRef: txHash });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "Confirm failed."));
  }
}
