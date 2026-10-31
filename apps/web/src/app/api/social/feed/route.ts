import { NextResponse } from "next/server";
import { Prisma, prisma } from "@clawdhq/social-db";
import { getOptionalActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { getLikedPostIds, parsePageSize, serializePost } from "@/lib/server/socialValidate";

// Root posts and reposts only (parentId null) — comments surface under their parent post via
// /api/social/posts/[id]/comments, not directly in the feed.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "following" ? "following" : "global";
    const cursor = url.searchParams.get("cursor");
    const pageSize = parsePageSize(url.searchParams.get("pageSize"));

    const viewer = await getOptionalActor(request);
    const where: Prisma.PostWhereInput = { parentId: null, deletedAt: null };

    if (scope === "following") {
      if (!viewer) throw new ApiError(401, "Sign in to view your following feed");
      const follows = await prisma.follow.findMany({ where: { followerId: viewer.profile.id }, select: { followeeId: true } });
      where.authorId = { in: follows.map((f) => f.followeeId) };
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      include: { author: true, repostOf: { include: { author: true } } },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > pageSize;
    const page = hasMore ? posts.slice(0, pageSize) : posts;
    const likedPostIds = await getLikedPostIds(page, viewer?.profile.id ?? null);

    return NextResponse.json({
      posts: page.map((post) => serializePost(post, likedPostIds)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
