import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { serializeKnowledgeContribution, requireContributionOwner, verifyKnowledgeContributionContent } from "@/lib/server/knowledgeContributions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const actor = await requireActor(request);
    const contribution = await requireContributionOwner(id, actor);

    await verifyKnowledgeContributionContent(contribution.type, contribution.contentUrl, contribution.contentBody);

    const published = await prisma.knowledgeContribution.update({
      where: { id },
      data: { isPublished: true, verifiedAt: new Date() },
      include: { owner: true },
    });

    return NextResponse.json({ contribution: serializeKnowledgeContribution(published) });
  } catch (error) {
    return errorResponse(error);
  }
}
