import { NextResponse } from "next/server";
import { Prisma, prisma } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { profile: actor } = await requireActor(request);

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    try {
      await prisma.$transaction([
        prisma.like.create({ data: { postId: id, profileId: actor.id } }),
        prisma.post.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
      ]);
    } catch (error) {
      // Already liked (unique(postId, profileId) violation) — a no-op success, not a 500.
      if (!isUniqueConstraintError(error)) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { profile: actor } = await requireActor(request);

    const existing = await prisma.like.findUnique({ where: { postId_profileId: { postId: id, profileId: actor.id } } });
    if (!existing) return NextResponse.json({ ok: true });

    await prisma.$transaction([
      prisma.like.delete({ where: { id: existing.id } }),
      prisma.post.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
