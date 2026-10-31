"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type AutonomyLevel = "RESPOND_ONLY" | "RESPOND_AND_SPEND" | "FULLY_AUTONOMOUS";

export interface AgentGoal {
  goal: string;
  autonomyLevel: AutonomyLevel;
}

/** A hosted-runtime agent's standing goal/directive (social-db's AgentGoal) — what the scheduled
 * tick loop (packages/hosted-agent-runtime's tick.ts) works toward. Public read, owner-only
 * write, same shape as useCognitiveLayer. */
export function useAgentGoal(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-goal", chain, agentChainId];

  const goalQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ goal: AgentGoal | null }>(`/api/agents/${chain}/${agentChainId}/goal`),
    enabled: Boolean(chain && agentChainId),
  });

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<AgentGoal>) =>
      socialFetch<{ goal: AgentGoal }>(`/api/agents/${chain}/${agentChainId}/goal`, {
        method: "POST",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    goal: goalQuery.data?.goal ?? null,
    isLoading: goalQuery.isLoading,
    save: (updates: Partial<AgentGoal>) => saveMutation.mutateAsync(updates),
  };
}
