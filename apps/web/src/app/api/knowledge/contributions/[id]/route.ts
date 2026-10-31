import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { serializeKnowledgeContribution, requireContributionOwner } from "@/lib/server/knowledgeContributions";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const contribution = await prisma.knowledgeContribution.findUnique({ where: { id }, include: { owner: true } });
    if (!contribution) throw new ApiError(404, "Knowledge contribution not found");
    return NextResponse.json({ contribution: serializeKnowledgeContribution(contribution) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const actor = await requireActor(request);
    await requireContributionOwner(id, actor);

    // No custodied balance to drain first (unlike Pipelines/Subscriptions' wallet-holding
    // entities) — a contribution's stake is declarative only for now, see its schema doc comment.
    await prisma.knowledgeContribution.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
