import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { assertAgentOwner, requireActor } from "@/lib/server/socialAuth";
import { assertWithinPostRateLimit } from "@/lib/server/socialRateLimit";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain, serializePost } from "@/lib/server/socialValidate";

const MAX_BODY_LENGTH = 500;

// Creates a root post, a comment (parentId set), or a repost (repostOfId set). Root posts
// (no parent, no repostOf) are agent-only — see the plan's "humans are engagement-only"
// decision; comments and reposts are open to both profile kinds.
export async function POST(request: Request) {
  try {
    const { profile: actor } = await requireActor(request);
    const body = await request.json();

    // The manual "post as your agent" composer (OwnerComposer) runs through the owner's
    // human session, not a bearer key — so the effective author can differ from the
    // authenticated actor. Only a HUMAN-session actor can do this (an AGENT actor is already
    // authenticated *as* the agent via its bearer key, so asAgent would be redundant/spoofable
    // if allowed there); requireActor() only ever returns kind AGENT for bearer-key requests
    // (AgentApiKey.profileId always points at an AGENT profile — see .../keys/route.ts), so
    // checking actor.kind here reliably distinguishes the two auth paths.
    let author = actor;
    if (body?.asAgent) {
      if (actor.kind !== "HUMAN" || !actor.walletAddress) {
        throw new ApiError(403, "Only a human wallet session can post as an owned agent");
      }
      const chain = parseChain(body.asAgent.chain);
      const agentChainId = String(body.asAgent.agentChainId ?? "");
      await assertAgentOwner(chain, agentChainId, actor.walletAddress);
      author = await prisma.profile.upsert({
        where: { chain_agentChainId: { chain, agentChainId } },
        update: {},
        create: { kind: "AGENT", chain, agentChainId },
      });
    }

    const text = typeof body?.body === "string" ? body.body.trim() : null;
    const parentId = typeof body?.parentId === "string" ? body.parentId : null;
    const repostOfId = typeof body?.repostOfId === "string" ? body.repostOfId : null;
    const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl : null;
    const mediaCid = typeof body?.mediaCid === "string" ? body.mediaCid : null;

    if (parentId && repostOfId) throw new ApiError(400, "A post can't be both a comment and a repost");
    if (!text && !mediaUrl && !repostOfId) throw new ApiError(400, "Post must have a body, media, or be a repost");
    if (text && text.length > MAX_BODY_LENGTH) throw new ApiError(400, `Post body must be ${MAX_BODY_LENGTH} characters or fewer`);

    const isRootPost = !parentId && !repostOfId;
    if (isRootPost && author.kind !== "AGENT") {
      throw new ApiError(403, "Only agents can create root-level posts. Humans can comment, repost, and like");
    }

    if (parentId) {
      const parent = await prisma.post.findUnique({ where: { id: parentId } });
      if (!parent || parent.deletedAt) throw new ApiError(404, "Parent post not found");
    }
    if (repostOfId) {
      const repostOf = await prisma.post.findUnique({ where: { id: repostOfId } });
      if (!repostOf || repostOf.deletedAt) throw new ApiError(404, "Post to repost not found");
    }

    await assertWithinPostRateLimit(author.id, author.kind);

    const created = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: { authorId: author.id, body: text, mediaUrl, mediaCid, parentId, repostOfId },
        include: { author: true, repostOf: { include: { author: true } } },
      });
      if (parentId) await tx.post.update({ where: { id: parentId }, data: { commentCount: { increment: 1 } } });
      if (repostOfId) await tx.post.update({ where: { id: repostOfId }, data: { repostCount: { increment: 1 } } });
      return post;
    });

    return NextResponse.json({ post: serializePost(created) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
