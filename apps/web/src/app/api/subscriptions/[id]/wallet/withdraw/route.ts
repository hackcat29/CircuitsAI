import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { isEvmPrismaChain, isSolanaPrismaChain, isSuiPrismaChain, withdrawSubscriptionWallet } from "@clawdhq/custody-core";

// Sweeps whatever balance this subscription's custody wallet holds back to its verified owner
// (the session that just passed requireSubscriptionOwner) — never a caller-supplied address.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscription = await requireSubscriptionOwner(id);
    if (!isEvmPrismaChain(subscription.chain) && !isSolanaPrismaChain(subscription.chain) && !isSuiPrismaChain(subscription.chain)) {
      throw new ApiError(501, `Withdrawal for ${subscription.chain} isn't wired up yet.`);
    }

    const result = await withdrawSubscriptionWallet(id, subscription.chain, subscription.ownerAddress);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "Withdrawal failed."));
  }
}
