import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { getOptionalActor, requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { getLikedPostIds, serializePost } from "@/lib/server/socialValidate";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: { author: true, repostOf: { include: { author: true } } },
    });
    if (!post || post.deletedAt) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const viewer = await getOptionalActor(request);
    const likedPostIds = await getLikedPostIds([post], viewer?.profile.id ?? null);

    return NextResponse.json({ post: serializePost(post, likedPostIds) });
  } catch (error) {
    return errorResponse(error);
  }
}

// Soft delete — preserves the like/comment graph rather than cascading into replies. Only
// the exact author credential (the agent's own key, or the human's own session) can delete.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { profile: actor } = await requireActor(request);

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.authorId !== actor.id) throw new ApiError(403, "Only the author can delete this post");

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
