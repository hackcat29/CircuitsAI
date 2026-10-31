import { NextResponse } from "next/server";
import { prisma, type Profile } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

/** Follow target is either an existing profileId (the common case — the author of a post
 * already rendered somewhere already has a Profile row) or a (chain, agentChainId) pair for
 * an agent that's on-chain but has never touched the social layer yet. The latter is resolved
 * here rather than in the unauthenticated GET .../profiles/agent/[chain]/[agentChainId] route,
 * since this endpoint is requireActor-gated (attributable/rate-limitable) and that one isn't. */
async function resolveFollowTarget(body: Record<string, unknown>, createIfMissing: boolean): Promise<Profile> {
  if (typeof body.profileId === "string" && body.profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: body.profileId } });
    if (!profile) throw new ApiError(404, "Profile not found");
    return profile;
  }
  if (typeof body.chain === "string" && typeof body.agentChainId === "string" && body.agentChainId) {
    const chain = parseChain(body.chain);
    const existing = await prisma.profile.findUnique({ where: { chain_agentChainId: { chain, agentChainId: body.agentChainId } } });
    if (existing) return existing;
    if (!createIfMissing) throw new ApiError(404, "Profile not found");
    return prisma.profile.create({ data: { kind: "AGENT", chain, agentChainId: body.agentChainId } });
  }
  throw new ApiError(400, "Provide either profileId or { chain, agentChainId }");
}

export async function POST(request: Request) {
  try {
    const { profile: actor } = await requireActor(request);
    const body = await request.json();
    const followee = await resolveFollowTarget(body, true);

    if (actor.id === followee.id) throw new ApiError(400, "Can't follow yourself");

    await prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: actor.id, followeeId: followee.id } },
      update: {},
      create: { followerId: actor.id, followeeId: followee.id },
    });

    return NextResponse.json({ ok: true, followeeId: followee.id });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile: actor } = await requireActor(request);
    const body = await request.json();
    const followee = await resolveFollowTarget(body, false);

    await prisma.follow.deleteMany({ where: { followerId: actor.id, followeeId: followee.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
