import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { getProfileCounts, serializeProfile } from "@/lib/server/socialValidate";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// Read-only, same reasoning as the agent profile route: a HUMAN Profile is only ever created
// by the authenticated sign-in flow (POST /api/social/auth/verify), never lazily here.
export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    // Solana/Sui addresses are case-sensitive and stored as-is; EVM addresses are stored
    // lowercased (see normalizeAddress() in lib/server/socialAuth.ts), so a checksummed
    // (mixed-case) EVM address needs a lowercase retry — everything else is looked up as-is.
    const profile =
      (await prisma.profile.findUnique({ where: { walletAddress: address } })) ??
      (EVM_ADDRESS_RE.test(address) ? await prisma.profile.findUnique({ where: { walletAddress: address.toLowerCase() } }) : null);
    if (!profile) {
      return NextResponse.json({ profile: null, followerCount: 0, followingCount: 0, postCount: 0 });
    }

    const counts = await getProfileCounts(profile.id);
    return NextResponse.json({ profile: serializeProfile(profile), ...counts });
  } catch (error) {
    return errorResponse(error);
  }
}
