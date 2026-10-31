"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./useWallet";
import { toIndexerChainSlug, isEvmChain } from "@/lib/chains";

export interface LaunchHolder {
  address: string;
  balance: string;
  isLiquidityPool: boolean;
}

export interface LaunchDetail {
  id: string;
  chain?: string;
  launchChainId: string;
  agentChainId: string;
  agentName: string | null;
  token: string;
  name: string;
  symbol: string;
  creator: string;
  totalSupply: string;
  usdcRaised: string;
  tokensSold: string;
  graduationThreshold: string;
  /** USDC (6dec), fixed at creation — the v3 constant-product curve's starting virtual reserve
   * (see ClawdHQLaunchpad.sol's contract-level doc comment and lib/bondingCurve.ts). */
  initialVirtualUsdcReserve: string;
  buybackPoolUsdc: string;
  buybackBps: number;
  buybackInterval: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  nextBuybackAt: string;
  /** ISO timestamp — buyTokens/sellTokens revert (LaunchNotStarted) on-chain before this, not
   * just a UI countdown. See ClawdHQLaunchpad.sol's AgentLaunch.tradingStartsAt doc comment. */
  tradingStartsAt: string;
  graduated: boolean;
  active: boolean;
  createdAtChain: string;
  graduatedAtChain: string | null;
  priceUsdc: string;
  fdvUsdc: string;
  marketCapUsdc: string;
  volume24hUsdc: string;
  priceChangeBps24h: number | null;
  priceChangeBps7d: number | null;
  liquidityUsdc: string | null;
  /** True total, unbounded — `holders` below is only the top 20 for display. */
  holdersCount: number;
  holders: LaunchHolder[];
  metadata: {
    websiteUrl: string | null;
    twitterUrl: string | null;
    telegramUrl: string | null;
    description: string | null;
    team: unknown;
  } | null;
}

interface DetailState {
  loading: boolean;
  launch: LaunchDetail | null;
  error: string | null;
}

/** Backed by GET /api/launchpad/[launchChainId] — the indexer's Launch cache plus a handful of
 * live enrichments (agent name join, holders derived from LaunchTrade, and — only for a
 * graduated launch — a live Xero reserves read). See that route's doc comments for why each
 * piece is computed the way it is. */
export function useLaunchDetail(launchChainId: string): DetailState & { refetch: () => void } {
  const { chain } = useWallet();
  const [state, setState] = useState<DetailState>({ loading: true, launch: null, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!isEvmChain(chain) || !launchChainId) {
      setState({ loading: false, launch: null, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    const params = new URLSearchParams({ chain: toIndexerChainSlug(chain) });
    fetch(`/api/launchpad/${launchChainId}?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to load launch");
        }
        return res.json() as Promise<LaunchDetail>;
      })
      .then((launch) => {
        if (!cancelled) setState({ loading: false, launch, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, launch: null, error: err instanceof Error ? err.message : "Failed to load launch" });
      });

    return () => {
      cancelled = true;
    };
  }, [chain, launchChainId, refreshKey]);

  return { ...state, refetch };
}
