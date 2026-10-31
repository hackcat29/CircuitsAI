import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await requireSubscriptionOwner(id);

    const runs = await prisma.subscriptionRun.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        jobChainId: r.jobChainId,
        txHashOrRef: r.txHashOrRef,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
