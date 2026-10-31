"use client";

import { useQuery } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";
import type { DegenVenue, DegenMode } from "@/hooks/useDegenConfig";

export interface DegenOrder {
  id: string;
  venue: DegenVenue;
  mode: DegenMode;
  action: string;
  market: string;
  requestedUsdc: string;
  status: "FILLED" | "REJECTED" | "ERROR";
  fillPrice: string | null;
  txHashOrRef: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export function useDegenOrders(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const query = useQuery({
    queryKey: ["degen-orders", chain, agentChainId],
    queryFn: () => socialFetch<{ orders: DegenOrder[] }>(`/api/degen/agents/${chain}/${agentChainId}/orders`).then((d) => d.orders),
    enabled: Boolean(chain && agentChainId),
    refetchInterval: 15_000,
  });

  return { ...query, orders: query.data ?? [] };
}
