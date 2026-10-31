import { prisma, type Subscription } from "@clawdhq/custody-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError } from "@/lib/server/socialErrors";

// Owner-only control for a subscription — always the human wallet session that created it,
// never a bearer agent key (see degenAuth.ts's requireOwnerSession for the same reasoning
// applied to Degen: a subscription is a human's recurring-task plan, not an agent's own
// delegated credential to act with). Unlike an on-chain agent's owner (which can transfer, so
// assertAgentOwner re-derives it fresh from chain every call), a Subscription row has no
// on-chain identity of its own — ownership is just whichever wallet created it, checked by
// plain equality against what was recorded then. Simpler than Degen's check, but also weaker in
// one sense: there's no on-chain source of truth to fall back on if the DB row is ever wrong.
// Don't try to make this fancier than it needs to be.

function normalizeForCompare(_chain: Subscription["chain"], address: string): string {
  return address.trim().toLowerCase();
}

/** Fetches the subscription and asserts the current session is its owner — throws 404 if the
 * subscription doesn't exist, 401 if not signed in, 403 if signed in as the wrong wallet (or a
 * non-human/bearer-key actor). Returns the subscription row so callers don't need a second
 * fetch. */
export async function requireSubscriptionOwner(subscriptionId: string): Promise<Subscription> {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new ApiError(404, "Subscription not found");

  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage a subscription");
  }

  const ownerKey = normalizeForCompare(subscription.chain, subscription.ownerAddress);
  const sessionKey = normalizeForCompare(subscription.chain, session.walletAddress);
  if (ownerKey !== sessionKey) throw new ApiError(403, "You are not the owner of this subscription");

  return subscription;
}
