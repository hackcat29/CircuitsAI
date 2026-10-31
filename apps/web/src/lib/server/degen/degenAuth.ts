import { Chain as DegenChain } from "@clawdhq/degen-db";
import { Chain as SocialChain, ApiKeyScope, type Profile } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile, requireActor, requireTradingActor, type Actor } from "@/lib/server/socialAuth";
import { ApiError } from "@/lib/server/socialErrors";

// @clawdhq/degen-db's Chain is a deliberate duplicate of @clawdhq/social-db's/marketplace-db's
// (see packages/degen-db/prisma/schema.prisma) — same string values, different generated TS
// types, hence the casts below, same pattern socialAuth.ts's getOnChainAgentOwner already uses.
export function toSocialChain(chain: DegenChain): SocialChain {
  return chain as unknown as SocialChain;
}

export function toDegenChain(chain: SocialChain): DegenChain {
  return chain as unknown as DegenChain;
}

/** POST /api/degen/orders resolves "which agent" from the bearer key itself (never a request
 * body field) rather than trusting a caller-supplied chain/agentChainId — a TRADING key can
 * only ever place orders for the agent it was minted for. */
export function agentFromTradingActor(actor: Actor): { chain: DegenChain; agentChainId: string } {
  if (!actor.profile.chain || !actor.profile.agentChainId) {
    throw new ApiError(400, "This API key is not linked to an on-chain agent");
  }
  return { chain: toDegenChain(actor.profile.chain), agentChainId: actor.profile.agentChainId };
}

/** Owner-only control-plane actions (risk config, disengaging the kill switch, minting
 * deposit addresses) — always the human wallet session, never a bearer agent key, same
 * reasoning the social layer's key-management routes use: a leaked agent key alone shouldn't
 * be able to change that same agent's own risk limits. */
export async function requireOwnerSession(chain: DegenChain, agentChainId: string): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage this agent's trading configuration");
  }
  await assertAgentOwner(toSocialChain(chain), agentChainId, session.walletAddress);
  return session;
}

/** For read routes (positions, order history) an agent's own TRADING-scope key can read its
 * own data, or the owner can read via their session — either credential works, unlike the
 * owner-only write routes above. */
export async function requireOwnerOrTradingActor(request: Request, chain: DegenChain, agentChainId: string): Promise<void> {
  const session = await getSessionProfile();
  if (session?.kind === "HUMAN" && session.walletAddress) {
    await assertAgentOwner(toSocialChain(chain), agentChainId, session.walletAddress);
    return;
  }

  const actor = await requireActor(request);
  if (actor.apiKeyScope !== ApiKeyScope.TRADING || actor.profile.chain !== toSocialChain(chain) || actor.profile.agentChainId !== agentChainId) {
    throw new ApiError(403, "This key does not belong to this agent");
  }
}

/** POST /api/degen/orders' auth: strictly a TRADING-scope bearer key — see
 * requireTradingActor's own doc comment for why a human owner session is deliberately rejected
 * here too. Re-exported from this module so degen routes have one import surface. */
export { requireTradingActor };
