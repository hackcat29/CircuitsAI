"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

export type ExchangeListingMode = "OPEN" | "AUCTION";
export type ExchangeListingStatus = "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";

export interface ExchangeListing {
  id: string;
  chain: string;
  chainListingId: string;
  agentChainId: string;
  seller: string;
  mode: ExchangeListingMode;
  status: ExchangeListingStatus;
  fairValueSnapshotUsdc: string;
  reservePriceUsdc: string;
  endTime: string | null;
  highestBidChainId: string | null;
  createdAtChain: string;
  updatedAtChain: string;
}

export interface ExchangeListingFilters {
  chain?: string;
  status?: ExchangeListingStatus;
  mode?: ExchangeListingMode;
}

interface ListingsPage {
  listings: ExchangeListing[];
  nextCursor: string | null;
}

/** Browses the indexer's cached listings across every chain (see apps/indexer,
 * packages/marketplace-db). A short refetch interval keeps auction countdowns and new
 * bids reasonably live without needing a websocket — this is a deliberate deviation from
 * `useMyAgents`/`useProtocolStats`'s no-refetch-interval pattern, since those don't need
 * live updates and this does.
 *
 * Cursor-paginated (mirrors useSocialFeed's own useInfiniteQuery shape exactly) — the API route
 * has always supported a `cursor`/`nextCursor` page, this hook just never asked for page two
 * before. `refetchInterval` only refetches the *first* page automatically (react-query's own
 * behavior for an infinite query); pages already loaded via `fetchNextPage` stay loaded across
 * that live refresh. */
export function useExchangeListings(filters: ExchangeListingFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["exchange-listings", filters],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<ListingsPage> => {
      const params = new URLSearchParams();
      if (filters.chain) params.set("chain", filters.chain);
      if (filters.status) params.set("status", filters.status);
      if (filters.mode) params.set("mode", filters.mode);
      if (pageParam) params.set("cursor", pageParam);

      const res = await fetch(`/api/exchange/listings?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load listings (${res.status})`);
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 10_000,
  });
}
