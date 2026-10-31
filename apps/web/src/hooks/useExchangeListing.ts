"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExchangeListing } from "./useExchangeListings";

export interface ExchangeBid {
  id: string;
  chainBidId: string;
  bidder: string;
  amountUsdc: string;
  active: boolean;
  createdAtChain: string;
}

export interface ExchangeListingAgent {
  name: string;
  endpoint: string;
  agentUri: string;
  owner: string;
  active: boolean;
  tier: number;
  jobsCompleted: number;
  reputationBps: number;
  usdcRevenue: string;
  tokenRoyalties?: string;
  taskRevenue?: string;
  lastJobAtSeconds: number;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
}

export interface ExchangeListingDetail extends ExchangeListing {
  /** Live-read from the listed agent's own chain at request time — null if that chain isn't
   * configured server-side or the read failed, never if the listing itself doesn't exist. */
  agent: ExchangeListingAgent | null;
  bids: ExchangeBid[];
}

/** Single listing + its full bid history. Same short refetch interval as
 * `useExchangeListings` — this is the detail page, where live bid/countdown updates matter most. */
export function useExchangeListing(listingId: string | undefined) {
  return useQuery({
    queryKey: ["exchange-listing", listingId],
    queryFn: async (): Promise<ExchangeListingDetail> => {
      const res = await fetch(`/api/exchange/listings/${listingId}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Listing not found." : `Failed to load listing (${res.status})`);
      return (await res.json()) as ExchangeListingDetail;
    },
    enabled: Boolean(listingId),
    refetchInterval: 8_000,
  });
}
