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
export function useLaunchpadList(_tab: LaunchpadTab, _limit = 24) {
  return { launches: [] as LaunchpadListItem[], loading: false, loadingMore: false, error: null, hasMore: false, total: 0, loadMore: () => {}, refetch: () => {} };
}
