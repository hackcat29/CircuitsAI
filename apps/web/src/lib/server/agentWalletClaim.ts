import { Chain as SocialChain } from "@clawdhq/social-db";
import {
  claimAgentWallet,
  readAgentWalletBalance,
  getAgentWalletAddress,
  isEvmPrismaChain,
  isSolanaPrismaChain,
  isSuiPrismaChain,
  type Erc20WithdrawResult,
} from "@clawdhq/custody-core";
import { getSessionProfile, assertAgentOwner } from "@/lib/server/socialAuth";
import { ApiError } from "@/lib/server/socialErrors";

// Owner-claims-from-agent-wallet: the AgentWallet custody domain (see packages/custody-core/src/
// agentWalletCustody.ts) accumulates job payouts and launchpad creator allocations for an
// agent. This lets the agent's *current* on-chain owner sweep that balance out to their own
// wallet at any time — resolved the same "destination comes from a verified source, never
// request input" way Degen's withdrawal path (degenWithdraw.ts) already does, except the
// verified source here is a live on-chain owner read (assertAgentOwner), not a stored value,
// so claim rights follow an Agent Exchange sale automatically: the moment `owner` changes
// on-chain, the previous owner's session stops passing this check.

/** Chains the AgentWallet claim path is wired up for today — mirrors custody-core's own
 * internal `ClaimableChain` union (agentWalletClaim.ts) exactly, now that all three chains are
 * ported. */
function isClaimableChain(chain: SocialChain): boolean {
  return isEvmPrismaChain(chain) || isSolanaPrismaChain(chain) || isSuiPrismaChain(chain);
}

/** Verifies the signed-in wallet session is this agent's *current* on-chain owner, then sweeps
 * its AgentWallet balance to that same address. Throws ApiError on any auth/ownership/unwired-
 * chain failure — callers should let it propagate to socialErrors.errorResponse. */
export async function claimForOwner(chain: SocialChain, agentChainId: string, amountUsdc?: string): Promise<Erc20WithdrawResult> {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage agent accounts");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);

  // Agent operating treasuries are permanently dedicated to autonomous execution
  // (token buybacks on bonding curves, LLM token credits, gas fees, and tool invocation payments).
  // Note: Degen trading/prediction funds are deposited directly as collateral into on-chain vaults.
  throw new ApiError(
    403,
    "Agent operational treasuries are dedicated for autonomous agentic operations (token buybacks, gas, tool fees, and LLM credits) and cannot be withdrawn by human owners. Creator revenues are already automatically transferred to your personal wallet upon task completion.",
  );
}

export interface AgentWalletInfo {
  address: string;
  claimableUsdc: bigint;
}

/** Live wallet address + claimable balance for the Wallet tab — null if no wallet has been
 * provisioned for this agent yet (e.g. the indexer hasn't processed its AgentRegistered event,
 * or this chain has no AgentWalletRegistry deployed), rather than a zero balance, so the UI can
 * distinguish "provisioning in progress" from "provisioned but empty." */
export async function getAgentWalletInfo(chain: SocialChain, agentChainId: string): Promise<AgentWalletInfo | null> {
  if (!isClaimableChain(chain)) return null;

  const address = await getAgentWalletAddress(chain, agentChainId);
  if (!address) return null;

  const claimableUsdc = await readAgentWalletBalance(chain, address);
  return { address, claimableUsdc: claimableUsdc ?? 0n };
}
