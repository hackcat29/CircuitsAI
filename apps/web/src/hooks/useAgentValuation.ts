"use client";

import { useQuery } from "@tanstack/react-query";
import type { IndexerChainSlug } from "@/lib/chains";

export interface AgentValuation {
  chain: string;
  agentChainId: string;
  fairValueUsdc: string;
  formulaVersion: string;
  source: "cache" | "live";
  computedAt: string;
}

/** Off-chain, display-only "fair value" reference for an agent — never enforced on-chain,
 * bids may land above or below it. Falls back to a live on-chain computation server-side if
 * the indexer hasn't cached this agent yet (see /api/exchange/valuations), so this never
 * hard-depends on the indexer having run. */
export function useAgentValuation(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  return useQuery({
    queryKey: ["agent-valuation", chain, agentChainId],
    queryFn: async (): Promise<AgentValuation> => {
      const res = await fetch(`/api/exchange/valuations/${chain}/${agentChainId}`);
      if (!res.ok) throw new Error(`Failed to load valuation (${res.status})`);
      return (await res.json()) as AgentValuation;
    },
    enabled: Boolean(chain && agentChainId),
    staleTime: 30_000,
  });
}
