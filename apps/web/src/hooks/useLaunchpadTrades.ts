"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "./useWallet";
import { toIndexerChainSlug } from "@/lib/chains";

export interface LaunchTrade {
  id: string;
  chain: string;
  launchChainId: string;
  traderAddress: string;
  side: "BUY" | "SELL";
  tokenAmount: string;
  usdcAmount: string;
  txHash: string;
  createdAtChain: string;
}

/** The connected wallet's own buy/sell history on the Launchpad, scoped to the active chain —
 * see /api/launchpad/trades, backed by the indexer's mirror of ClawdHQLaunchpad.sol's
 * TokensPurchased/TokensSold events. */
export function useLaunchpadTrades(address: string | undefined) {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);

  const query = useQuery({
    queryKey: ["launchpad-trades", chainSlug, address],
    queryFn: async (): Promise<{ trades: LaunchTrade[]; nextCursor: string | null }> => {
      const res = await fetch(`/api/launchpad/trades?chain=${chainSlug}&trader=${address}`);
      if (!res.ok) throw new Error("Failed to load trade history.");
      return res.json();
    },
    enabled: false,
  });

  return {
    trades: query.data?.trades ?? [],
    isLoading: query.isLoading,
  };
}

/** Every trader's buy/sell activity on a single launch (or across the entire chain when
 * launchChainId is omitted / undefined) — see /api/launchpad/trades. */
export function useLaunchTrades(launchChainId?: string | undefined) {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);

  const query = useQuery({
    queryKey: ["launch-trades", chainSlug, launchChainId ?? "all"],
    queryFn: async (): Promise<{ trades: LaunchTrade[]; nextCursor: string | null }> => {
      const url = launchChainId
        ? `/api/launchpad/trades?chain=${chainSlug}&launchChainId=${encodeURIComponent(launchChainId)}`
        : `/api/launchpad/trades?chain=${chainSlug}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load trades.");
      return res.json();
    },
    enabled: false,
    refetchInterval: 10_000,
  });

  return {
    trades: query.data?.trades ?? [],
    isLoading: query.isLoading,
  };
}
