"use client";

import { useCallback, useEffect, useState } from "react";
import { zeroAddress, zeroHash, type Hex } from "viem";
import { ALL_CHAINS, BASE_SEPOLIA, ETH_SEPOLIA, type EvmChainConfig } from "@/lib/chains";
import { useEvmCrossChainIdentityAdapter } from "./useEvmCrossChainIdentityAdapter";

export interface LinkedIdentityChainStatus {
  chain: EvmChainConfig;
  /** True once *that* chain's own contract has recorded an owner for the globalId — either
   * because the link originated there, or an attested CCTP message from a peer arrived. */
  known: boolean;
  /** Null if known but not yet claimed on that chain via claimLocalAgent (or registerLink, on
   * whichever chain originated the link, which claims automatically). */
  localAgentId: bigint | null;
}

export interface LinkedIdentitySummary {
  globalId: Hex | null;
  chains: LinkedIdentityChainStatus[];
  loading: boolean;
  /** True when the last refresh() failed (e.g. RPC rate-limited) — `chains`/`globalId` are
   * left at their last-known values rather than cleared, so callers can show a stale-data
   * warning instead of losing what was already displayed. */
  error: boolean;
  refresh: () => Promise<void>;
}

/** Assembles one agent's full cross-chain identity picture: reads `localAgentId`'s globalId as
 * recorded on `homeChain` (the chain a profile page happens to be viewing — a raw agent id is
 * only meaningful on the chain it was registered on), then queries every configured CCTP chain
 * for what it separately knows about that same globalId. A single ClawdHQCrossChainIdentity
 * deployment only ever knows its own chain's view (see the contract's trust-model doc comment)
 * — this hook is what actually stitches the cross-chain picture together, by querying one
 * read-only adapter per chain. Calls both chains' adapter hooks unconditionally (not via
 * `ALL_CHAINS.map(useEvmCrossChainIdentityAdapter)`, which would violate the rules of hooks) —
 * safe because the set of CCTP chains is a fixed constant, not something that varies at runtime. */
export function useLinkedIdentities(homeChain: EvmChainConfig, localAgentId: string): LinkedIdentitySummary {
  const baseAdapter = useEvmCrossChainIdentityAdapter(BASE_SEPOLIA);
  const ethAdapter = useEvmCrossChainIdentityAdapter(ETH_SEPOLIA);

  const [globalId, setGlobalId] = useState<Hex | null>(null);
  const [chains, setChains] = useState<LinkedIdentityChainStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const adapterByChainId: Record<number, ReturnType<typeof useEvmCrossChainIdentityAdapter>> = {
        [BASE_SEPOLIA.chainId]: baseAdapter,
        [ETH_SEPOLIA.chainId]: ethAdapter,
      };

      const homeAdapter = adapterByChainId[homeChain.chainId];
      if (!homeAdapter || !localAgentId) {
        setGlobalId(null);
        setChains([]);
        setError(false);
        return;
      }

      const id = await homeAdapter.getGlobalIdForLocalAgent(BigInt(localAgentId));
      if (id === zeroHash) {
        setGlobalId(null);
        setChains([]);
        setError(false);
        return;
      }
      setGlobalId(id);

      const results = await Promise.all(
        ALL_CHAINS.map(async (chain): Promise<LinkedIdentityChainStatus> => {
          const adapter = adapterByChainId[chain.chainId];
          if (!adapter) return { chain, known: false, localAgentId: null };

          const owner = await adapter.getOwnerOfGlobalId(id);
          if (owner.toLowerCase() === zeroAddress.toLowerCase()) {
            return { chain, known: false, localAgentId: null };
          }
          const claimedId = await adapter.getLocalAgentIdForGlobalId(id);
          return { chain, known: true, localAgentId: claimedId === 0n ? null : claimedId };
        })
      );
      setChains(results);
      setError(false);
    } catch {
      // Leave globalId/chains at their last-known values (e.g. right after a successful
      // registerLink/claimLocalAgent write, this is just the follow-up read losing the race
      // against the RPC rate limit) — only flag that this refresh didn't land.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [homeChain.chainId, localAgentId, baseAdapter, ethAdapter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { globalId, chains, loading, error, refresh };
}
