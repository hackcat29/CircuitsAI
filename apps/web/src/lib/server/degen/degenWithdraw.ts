import { Venue, type Chain as DegenChain } from "@clawdhq/degen-db";
import { getOnChainAgentOwner } from "@/lib/server/socialAuth";
import { getDecryptedTradingWallet } from "@/lib/server/degen/custody";
import { toSocialChain } from "@/lib/server/degen/degenAuth";
import { withdrawErc20Balance, localEvmSigner, type Erc20WithdrawResult } from "@clawdhq/custody-core";
import type { EvmPrismaChain } from "@/lib/server/evmExchangeReaders";

// Sweeps a venue's custodied wallet back to the agent's verified on-chain owner — never a
// caller-supplied address, by construction: the only address this module will ever send to is
// whatever getOnChainAgentOwner reads directly from the chain, read fresh on every call rather
// than trusted from a stored value. A compromised key or a bug upstream of this function can
// cause a bad *trade*; it structurally cannot cause a bad *destination*.
//
// Hyperliquid needs no withdrawal path here at all: the agent wallet was approved via HL's own
// approveAgent as a trade-only signer (see hyperliquid.ts/the plan's custody section) and
// structurally cannot withdraw funds by Hyperliquid's own protocol rules — only the owner's
// real wallet can, directly through Hyperliquid, entirely outside this app.

export type WithdrawResult = Erc20WithdrawResult;

/** withdrawChain only matters for CLAWDHQ_LAUNCH, whose custody wallet is reused across all
 * three EVM testnets (the same address is valid on each — see custody.ts) and so can hold a
 * balance on any of them independently; the caller picks which one to sweep (defaulting to
 * BASE_SEPOLIA if unspecified). Every other withdrawable venue lives on exactly one chain, so
 * this resolves that chain itself rather than accepting a caller-supplied one — passing
 * withdrawChain for one of those would silently look at the wrong chain, not error, which is
 * worse than not accepting the parameter at all. */
function fixedWithdrawChainFor(venue: Venue): EvmPrismaChain | null {
  return null;
}

export async function withdrawTradingWallet(chain: DegenChain, agentChainId: string, venue: Venue, withdrawChain?: EvmPrismaChain): Promise<WithdrawResult> {
  if (venue === Venue.HYPERLIQUID) {
    throw new Error("Hyperliquid agent wallets cannot withdraw by design. Only the owner's own wallet can, directly through Hyperliquid");
  }

  const [wallet, ownerAddress] = await Promise.all([getDecryptedTradingWallet(chain, agentChainId, venue), getOnChainAgentOwner(toSocialChain(chain), agentChainId)]);
  if (!wallet) throw new Error(`No ${venue} wallet has been provisioned for this agent`);
  if (!ownerAddress) throw new Error("Could not resolve this agent's on-chain owner. Refusing to withdraw with no verified destination");

  const evmChain = fixedWithdrawChainFor(venue) ?? withdrawChain ?? "MONAD_MAINNET";
  return withdrawErc20Balance(localEvmSigner(evmChain, wallet.privateKey), evmChain, ownerAddress as `0x${string}`);
}
