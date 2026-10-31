import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { getProfileCounts, serializeProfile } from "@/lib/server/socialValidate";
import { getSessionProfile } from "@/lib/server/socialAuth";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const { username: rawUsername } = await context.params;
    const cleanUsername = decodeURIComponent(rawUsername).replace(/^@/, "").trim().toLowerCase();

    if (!cleanUsername) {
      return NextResponse.json({ profile: null, followerCount: 0, followingCount: 0, postCount: 0 });
    }

    // 1. Lookup by username
    let profile = await prisma.profile.findUnique({
      where: { username: cleanUsername },
    });

    // 2. If not found by username, check if the query was a wallet address
    if (!profile) {
      if (EVM_ADDRESS_RE.test(cleanUsername)) {
        profile = await prisma.profile.findUnique({
          where: { walletAddress: cleanUsername },
        });
      } else {
        profile = await prisma.profile.findUnique({
          where: { walletAddress: rawUsername },
        });
      }
    }

    if (!profile) {
      return NextResponse.json({ profile: null, followerCount: 0, followingCount: 0, postCount: 0 });
    }

    const viewer = await getSessionProfile().catch(() => null);
    const isOwner = Boolean(viewer && viewer.id === profile.id);

    const counts = await getProfileCounts(profile.id);
    const serialized = serializeProfile(profile);
    if (!isOwner) {
      serialized.email = null;
    }

    return NextResponse.json({ profile: serialized, ...counts });
  } catch (error) {
    return errorResponse(error);
  }
}

