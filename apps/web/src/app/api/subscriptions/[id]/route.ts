import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import { parseFrequency, parsePositiveDecimal, parseNonEmptyString, parsePositiveInt, serializeSubscription } from "@/lib/server/subscriptions/validate";
import {
  isEvmPrismaChain,
  viemChainFor,
  rpcUrlFor,
  usdcAddressFor,
  readUsdcBalance,
  isSolanaPrismaChain,
  readSolanaUsdcBalance,
  isSuiPrismaChain,
  readSuiUsdcBalance,
} from "@clawdhq/custody-core";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscription = await requireSubscriptionOwner(id);
    return NextResponse.json({ subscription: serializeSubscription(subscription) });
  } catch (error) {
    return errorResponse(error);
  }
}

// Partial update — every field optional, only what's present in the body changes. Used for
// pause/resume (isActive) as well as editing the plan's terms.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await requireSubscriptionOwner(id);

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body?.taskDescription !== undefined) data.taskDescription = parseNonEmptyString(body.taskDescription, "taskDescription");
    if (body?.budgetUsdc !== undefined) data.budgetUsdc = parsePositiveDecimal(body.budgetUsdc, "budgetUsdc");
    if (body?.deadlineDays !== undefined) data.deadlineDays = parsePositiveInt(body.deadlineDays, "deadlineDays");
    if (body?.frequency !== undefined) data.frequency = parseFrequency(body.frequency);
    if (body?.maxConcurrentOpenJobs !== undefined) data.maxConcurrentOpenJobs = parsePositiveInt(body.maxConcurrentOpenJobs, "maxConcurrentOpenJobs");

    const subscription = await prisma.subscription.update({ where: { id }, data });
    return NextResponse.json({ subscription: serializeSubscription(subscription) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscription = await requireSubscriptionOwner(id);

    // Deleting cascades to SubscriptionWallet, destroying its encrypted key — refuse while it
    // still holds a balance, or that balance becomes permanently unrecoverable. Withdraw first.
    const wallet = await prisma.subscriptionWallet.findUnique({ where: { subscriptionId: id } });
    if (wallet) {
      let balance: bigint;
      if (isEvmPrismaChain(subscription.chain)) {
        const chain = subscription.chain;
        try {
          balance = await readUsdcBalance(wallet.address as `0x${string}`, viemChainFor(chain), rpcUrlFor(chain), usdcAddressFor(chain));
        } catch {
          // Fail closed: if we can't verify the balance is zero, refuse rather than risk
          // destroying an encrypted key that might still guard real funds.
          throw new ApiError(502, `Couldn't reach ${chain} to verify the wallet balance before deleting. Try again shortly.`);
        }
      } else if (isSolanaPrismaChain(subscription.chain)) {
        const chain = subscription.chain;
        try {
          balance = await readSolanaUsdcBalance(chain, wallet.address);
        } catch {
          throw new ApiError(502, `Couldn't reach ${chain} to verify the wallet balance before deleting. Try again shortly.`);
        }
      } else if (isSuiPrismaChain(subscription.chain)) {
        const chain = subscription.chain;
        try {
          balance = await readSuiUsdcBalance(chain, wallet.address);
        } catch {
          throw new ApiError(502, `Couldn't reach ${chain} to verify the wallet balance before deleting. Try again shortly.`);
        }
      } else {
        // Fail closed (refuse) rather than silently skip the check and risk destroying an
        // encrypted key that might still guard real funds.
        throw new ApiError(501, `Balance verification for ${subscription.chain} isn't wired up yet, so this subscription can't be safely deleted yet.`);
      }
      if (balance > 0n) {
        throw new ApiError(409, "This subscription's wallet still holds a balance. Withdraw it first, then delete.");
      }
    }

    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
