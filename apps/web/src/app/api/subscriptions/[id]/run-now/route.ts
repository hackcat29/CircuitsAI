import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { runSubscription } from "@clawdhq/custody-core";

// Owner-triggered, synchronous run of the full decrypt -> sign -> postJob -> record pipeline —
// this is the manual-trigger route; the autonomous scheduler (apps/indexer/src/scheduler.ts)
// calls the exact same runSubscription() unattended.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscription = await requireSubscriptionOwner(id);

    const result = await runSubscription(subscription);
    return NextResponse.json(result);
  } catch (error) {
    // runSubscription already recorded the real message on the SubscriptionRun row (see
    // runJob.ts) — surface that same message here too rather than a generic 500, so the
    // immediate response is useful without a second request to fetch run history.
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "The run failed. See run history for details."));
  }
}
