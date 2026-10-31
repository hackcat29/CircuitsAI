"use client";

import type { ProtocolStats } from "@clawdhq/sdk";
import { useEffect, useState } from "react";
import { useEvmAdapter } from "./useEvmAdapter";
import { ALL_CHAINS, SELECTABLE_CHAINS, BASE_SEPOLIA, MONAD_MAINNET, ETH_SEPOLIA, BSC_TESTNET, type EvmChainConfig } from "@/lib/chains";

export interface PerChainStats {
  chain: EvmChainConfig;
  stats: ProtocolStats | undefined;
  deployed: boolean;
  /** True when the contract IS deployed here but the read itself failed (e.g. RPC
   * rate-limited) — distinct from `deployed: false`, which means no contract address is
   * configured for this chain at all. `totals` silently omits this chain's numbers either
   * way, so callers that want to flag "totals may be incomplete" should check this. */
  error: boolean;
}

export interface ProtocolStatsState {
  loading: boolean;
  totals: ProtocolStats;
  perChain: PerChainStats[];
  /** True when at least one deployed chain failed to load — `totals` is a sum of only the
   * chains that succeeded, so it may be undercounting. */
  hasError: boolean;
  retry: () => void;
}

const EMPTY_STATS: ProtocolStats = {
  totalAgents: 0n,
  activeAgents: 0n,
  totalJobs: 0n,
  totalVolume: 0n,
  totalLaunches: 0n,
  graduatedLaunches: 0n,
};

function sumStats(a: ProtocolStats, b: ProtocolStats): ProtocolStats {
  return {
    totalAgents: a.totalAgents + b.totalAgents,
    activeAgents: a.activeAgents + b.activeAgents,
    totalJobs: a.totalJobs + b.totalJobs,
    totalVolume: a.totalVolume + b.totalVolume,
    totalLaunches: a.totalLaunches + b.totalLaunches,
    graduatedLaunches: a.graduatedLaunches + b.graduatedLaunches,
  };
}

/** Fetches `getProtocolStats()` from every configured chain adapter in parallel and
 * aggregates them into protocol-wide totals. Chains whose contracts aren't deployed
 * yet (no adapter configured) are reported with `deployed: false` and excluded from
 * the totals, rather than treated as zero-activity chains. */
export function useProtocolStats(): ProtocolStatsState {
  const monadMainnet = useEvmAdapter(MONAD_MAINNET);
  const base = useEvmAdapter(BASE_SEPOLIA);
  const eth = useEvmAdapter(ETH_SEPOLIA);
  const bsc = useEvmAdapter(BSC_TESTNET);
  const [reloadKey, setReloadKey] = useState(0);

  const [state, setState] = useState<Omit<ProtocolStatsState, "retry">>({
    loading: true,
    totals: EMPTY_STATS,
    perChain: ALL_CHAINS.map((chain) => ({ chain, stats: undefined, deployed: false, error: false })),
    hasError: false,
  });

  useEffect(() => {
    let cancelled = false;
    const adaptersByChain = [
      { chain: MONAD_MAINNET, adapter: monadMainnet },
      { chain: BASE_SEPOLIA, adapter: base },
      { chain: ETH_SEPOLIA, adapter: eth },
      { chain: BSC_TESTNET, adapter: bsc },
    ];

    setState((prev) => ({ ...prev, loading: true }));

    Promise.all(
      adaptersByChain.map(async ({ chain, adapter }) => {
        if (!adapter) return { chain, stats: undefined, deployed: false, error: false };
        try {
          const stats = await adapter.getProtocolStats();
          return { chain, stats, deployed: true, error: false };
        } catch {
          return { chain, stats: undefined, deployed: true, error: true };
        }
      }),
    ).then((perChain) => {
      if (cancelled) return;
      const totals = perChain
        .filter((entry) => SELECTABLE_CHAINS.some((c) => c.chainId === entry.chain.chainId))
        .reduce((acc, entry) => (entry.stats ? sumStats(acc, entry.stats) : acc), EMPTY_STATS);
      const hasError = perChain.some((entry) => entry.error);
      setState({ loading: false, totals, perChain, hasError });
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, monadMainnet, base, eth, bsc]);

  return {
    ...state,
    retry: () => setReloadKey((k) => k + 1),
  };
}
