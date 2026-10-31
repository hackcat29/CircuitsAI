"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";
import { toIndexerChainSlug, isEvmChain } from "@/lib/chains";

export type LaunchpadTab = "trending" | "top" | "gainers" | "new" | "graduated";

export interface LaunchpadListItem {
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
  graduated: boolean;
  active: boolean;
  /** ISO timestamp — buyTokens/sellTokens revert (LaunchNotStarted) on-chain before this. See
   * ClawdHQLaunchpad.sol's AgentLaunch.tradingStartsAt doc comment. */
  tradingStartsAt: string;
  createdAtChain: string;
  graduatedAtChain: string | null;
  priceUsdc: string;
  fdvUsdc: string;
  marketCapUsdc: string;
  volume24hUsdc: string;
  priceChangeBps24h: number | null;
  priceChangeBps7d: number | null;
  holdersCount: number;
}

interface ListState {
  loading: boolean;
  loadingMore: boolean;
  launches: LaunchpadListItem[];
  total: number;
  hasMore: boolean;
}

/** Backed by the indexer's Launch cache (GET /api/launchpad), not live RPC — see that route's
 * doc comment for why this is what makes trending/gainers/top sorting (and per-launch 24h price
 * change) possible at all (useLaunches.ts's live-RPC approach can only ever show the most
 * recent 20, unsorted, with no price-change figure since that needs the trade ledger).
 *
 * Accumulating pagination, not a single fixed-size fetch: `loadMore()` appends the next
 * `pageSize` page rather than re-fetching everything with a larger page size, so this scales to
 * however many launches actually exist instead of the "fetch top 20 forever" ceiling the old
 * per-page hooks had. Switching `chain`/`tab`/`pageSize` resets back to page one. */
export function useLaunchpadList(tab: LaunchpadTab, pageSize = 24): ListState & { loadMore: () => void } {
  const { chain } = useWallet();
  const [state, setState] = useState<ListState>({ loading: true, loadingMore: false, launches: [], total: 0, hasMore: false });
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    (offset: number, replace: boolean) => {
      if (!isEvmChain(chain)) {
        setState({ loading: false, loadingMore: false, launches: [], total: 0, hasMore: false });
        return;
      }
      const requestId = ++requestIdRef.current;
      setState((prev) => ({ ...prev, loading: replace, loadingMore: !replace }));

      const params = new URLSearchParams({ chain: toIndexerChainSlug(chain), tab, pageSize: String(pageSize), offset: String(offset) });
      fetch(`/api/launchpad?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load launches"))))
        .then((data: { launches: LaunchpadListItem[]; total: number; hasMore: boolean }) => {
          if (requestId !== requestIdRef.current) return; // superseded by a newer request — discard
          setState((prev) => ({
            loading: false,
            loadingMore: false,
            launches: replace ? data.launches : [...prev.launches, ...data.launches],
            total: data.total,
            hasMore: data.hasMore,
          }));
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setState({ loading: false, loadingMore: false, launches: [], total: 0, hasMore: false });
        });
    },
    [chain, tab, pageSize]
  );

  useEffect(() => {
    fetchPage(0, true);
    // fetchPage is itself recreated only when chain/tab/pageSize change (see its own useCallback
    // deps), so this effect already re-runs exactly when this list should reset to page one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, tab, pageSize]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.loading || prev.loadingMore || !prev.hasMore) return prev;
      fetchPage(prev.launches.length, false);
      return prev;
    });
  }, [fetchPage]);

  return { ...state, loadMore };
}
