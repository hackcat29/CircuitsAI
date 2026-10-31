import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { provisionSubscriptionWallet } from "@clawdhq/custody-core";
import { parseSubscriptionChain, parseFrequency, parsePositiveDecimal, parseNonEmptyString, parseAgentId, parsePositiveInt, serializeSubscription } from "@/lib/server/subscriptions/validate";

// Always the human wallet session — a subscription is a human's recurring-task plan, never a
// bearer agent key's own credential (see subscriptionAuth.ts).

export async function GET(request: Request) {
  try {
    const session = await getSessionProfile();
    const url = new URL(request.url);
    const mineOnly = url.searchParams.get("mine") === "true";

    if (mineOnly && session && session.kind === "HUMAN" && session.walletAddress) {
      const userSubs = await prisma.subscription.findMany({
        where: { ownerAddress: session.walletAddress },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ subscriptions: userSubs.map(serializeSubscription) });
    }

    // Default: Return all active subscriptions (with user's own subscriptions sorted to top if logged in)
    const subscriptions = await prisma.subscription.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (session && session.kind === "HUMAN" && session.walletAddress) {
      const sorted = [...subscriptions].sort((a, b) => {
        const aIsMine = a.ownerAddress.toLowerCase() === session.walletAddress!.toLowerCase();
        const bIsMine = b.ownerAddress.toLowerCase() === session.walletAddress!.toLowerCase();
        if (aIsMine && !bIsMine) return -1;
        if (!aIsMine && bIsMine) return 1;
        return 0;
      });
      return NextResponse.json({ subscriptions: sorted.map(serializeSubscription) });
    }

    return NextResponse.json({ subscriptions: subscriptions.map(serializeSubscription) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session || session.kind !== "HUMAN" || !session.walletAddress) {
      throw new ApiError(401, "Sign in with your wallet first");
    }

    const body = await request.json().catch(() => null);
    const chain = parseSubscriptionChain(body?.chain);
    const hiredAgentId = parseAgentId(body?.hiredAgentId);
    const taskDescription = parseNonEmptyString(body?.taskDescription, "taskDescription");
    const budgetUsdc = parsePositiveDecimal(body?.budgetUsdc, "budgetUsdc");
    const deadlineDays = parsePositiveInt(body?.deadlineDays, "deadlineDays", 7);
    const frequency = parseFrequency(body?.frequency);
    const maxConcurrentOpenJobs = parsePositiveInt(body?.maxConcurrentOpenJobs, "maxConcurrentOpenJobs", 1);

    const subscription = await prisma.subscription.create({
      data: {
        chain,
        ownerAddress: session.walletAddress,
        hiredAgentId,
        taskDescription,
        budgetUsdc,
        deadlineDays,
        frequency,
        maxConcurrentOpenJobs,
        nextRunAt: new Date(),
      },
    });

    // Provision the custodied wallet immediately — a subscription with nowhere to deposit funds
    // isn't useful, and there's no separate "choose a venue first" step here unlike Degen.
    const wallet = await provisionSubscriptionWallet(subscription.id, chain);

    return NextResponse.json({ subscription: serializeSubscription(subscription), wallet: { address: wallet.address, status: wallet.status } });
  } catch (error) {
    return errorResponse(error);
  }
}
