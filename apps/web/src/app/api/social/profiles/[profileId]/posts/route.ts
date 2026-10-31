import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { getOptionalActor } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { getLikedPostIds, parsePageSize, serializePost } from "@/lib/server/socialValidate";

export async function GET(request: Request, context: { params: Promise<{ profileId: string }> }) {
  try {
    const { profileId } = await context.params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const pageSize = parsePageSize(url.searchParams.get("pageSize"));

    const posts = await prisma.post.findMany({
      where: { authorId: profileId, parentId: null, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      include: { author: true, repostOf: { include: { author: true } } },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > pageSize;
    const page = hasMore ? posts.slice(0, pageSize) : posts;

    const viewer = await getOptionalActor(request);
    const likedPostIds = await getLikedPostIds(page, viewer?.profile.id ?? null);

    return NextResponse.json({
      posts: page.map((post) => serializePost(post, likedPostIds)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
