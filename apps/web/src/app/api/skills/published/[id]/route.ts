import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const skill = await prisma.publishedSkill.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            username: true,
            walletAddress: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!skill) throw new ApiError(404, "Skill not found");
    return NextResponse.json({ skill });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { profile } = await requireActor(request);

    const skill = await prisma.publishedSkill.findUnique({ where: { id } });
    if (!skill) throw new ApiError(404, "Skill not found");
    if (skill.creatorId !== profile.id) throw new ApiError(403, "Only the publisher can remove this skill");

    await prisma.publishedSkill.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
