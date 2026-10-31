"use client";

import { useQuery } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";
import type { DegenVenue, DegenMode } from "@/hooks/useDegenConfig";

export interface DegenPosition {
  venue: DegenVenue;
  mode: DegenMode;
  market: string;
  netSizeUsdc: string;
  avgEntryPrice: string | null;
  realizedPnlUsdc: string;
  updatedAt: string;
}

export function useDegenPositions(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const query = useQuery({
    queryKey: ["degen-positions", chain, agentChainId],
    queryFn: () => socialFetch<{ positions: DegenPosition[] }>(`/api/degen/agents/${chain}/${agentChainId}/positions`).then((d) => d.positions),
    enabled: Boolean(chain && agentChainId),
    // Positions move on every fill from an unattended external process — poll rather than
    // relying only on the owner's own actions to trigger a refetch.
    refetchInterval: 15_000,
  });

  return { ...query, positions: query.data ?? [] };
}
