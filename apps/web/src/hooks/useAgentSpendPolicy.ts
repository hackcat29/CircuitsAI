"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type SpendAction = "POST_JOB" | "X402_PAYMENT" | "CALL_SKILL" | "USE_KNOWLEDGE" | "SWAP";

export interface AgentSpendPolicy {
  dailyCapUsdc: string;
  allowedActions: SpendAction[];
  isEnabled: boolean;
  /** Per-call ceiling for the hosted-runtime tick loop's own PAY_X402_RESOURCE decision — null
   * means the owner hasn't opted the autonomous loop into it. See the schema field's own doc
   * comment (custody-db) for why this is deliberately separate from dailyCapUsdc and never
   * proposed by the LLM itself. */
  autonomousX402ResourceCapUsdc: string | null;
}

export interface AgentSpendPolicyInput {
  dailyCapUsdc?: string;
  allowedActions?: SpendAction[];
  isEnabled?: boolean;
  /** Omit to leave unchanged, pass a value to set it, pass null to clear it (turns the
   * autonomous PAY_X402_RESOURCE action back off). */
  autonomousX402ResourceCapUsdc?: string | null;
}

/** Owner-only view/edit of an agent's capped-autonomous-spend authorization (custody-db's
 * AgentSpendPolicy) — how much of the agent's AgentWallet balance the hosted runtime may spend
 * per day, on which action types, and an instant on/off switch. Unlike useCognitiveLayer/
 * useHostedRuntimeConfig, there's no public read here: the cap itself isn't information a
 * non-owner has any legitimate reason to see (see the spend-policy route's own doc comment). */
export function useAgentSpendPolicy(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-spend-policy", chain, agentChainId];

  const policyQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ policy: AgentSpendPolicy | null }>(`/api/agents/${chain}/${agentChainId}/spend-policy`),
    enabled: Boolean(chain && agentChainId),
  });

  const saveMutation = useMutation({
    mutationFn: (updates: AgentSpendPolicyInput) =>
      socialFetch<{ policy: AgentSpendPolicy }>(`/api/agents/${chain}/${agentChainId}/spend-policy`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    policy: policyQuery.data?.policy ?? null,
    isLoading: policyQuery.isLoading,
    save: (updates: AgentSpendPolicyInput) => saveMutation.mutateAsync(updates),
  };
}
