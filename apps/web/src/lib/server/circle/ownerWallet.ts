import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError } from "@/lib/server/socialErrors";

/** Resolves the signed-in human's wallet address for session-gated routes (CCTP self-bridge,
 * service listings) — always a human wallet session, never a bearer agent key, same reasoning as
 * subscriptionAuth.ts's equivalent check. */
export async function requireHumanSession(): Promise<string> {
  const session = await getSessionProfile();
  if (!session || session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(401, "Sign in with your wallet first");
  }
  return session.walletAddress;
}
