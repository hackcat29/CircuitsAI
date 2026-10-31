import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { getOptionalActor } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { getProfileCounts, parseChain, serializeProfile } from "@/lib/server/socialValidate";

// Read-only on purpose (findUnique, not upsert) — this is an unauthenticated GET, and letting
// it create rows would let anyone flood the Profile table by probing agentChainId values.
// An agent's social Profile is only ever created by an authenticated action: minting an API
// key (see .../keys/route.ts) or being followed (see /api/social/follows) — both requireActor-
// gated and therefore attributable/rate-limitable. Before that, this returns null + zero
// counts rather than 404, so the UI can still render a Follow button against the (chain,
// agentChainId) pair alone.
export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);

    const profile = await prisma.profile.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    if (!profile) {
      return NextResponse.json({ profile: null, followerCount: 0, followingCount: 0, postCount: 0, viewerIsFollowing: false });
    }

    const viewer = await getOptionalActor(request);
    const [counts, viewerFollow] = await Promise.all([
      getProfileCounts(profile.id),
      viewer
        ? prisma.follow.findUnique({ where: { followerId_followeeId: { followerId: viewer.profile.id, followeeId: profile.id } } })
        : null,
    ]);

    return NextResponse.json({ profile: serializeProfile(profile), ...counts, viewerIsFollowing: Boolean(viewerFollow) });
  } catch (error) {
    return errorResponse(error);
  }
}
