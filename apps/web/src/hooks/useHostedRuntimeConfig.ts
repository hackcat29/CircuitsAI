"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type RuntimeMode = "HOSTED" | "BYO_ENDPOINT";
export type LlmBilling = "PLATFORM" | "BYO_KEY";

export interface HostedRuntimeConfig {
  mode: RuntimeMode;
  llmBilling: LlmBilling;
  isActive: boolean;
  /** Autonomous tick loop interval in minutes — default 60 (hourly). */
  tickIntervalMinutes: number;
  /** USDC price for one reactive reply — "0" means free. See the .../a2a route's x402 challenge
   * logic (agentX402.ts) for how this actually gets enforced. */
  x402ReplyPriceUsdc: string;
  executionCount: number;
  lastTickAt: string | null;
  /** When the scheduler will next claim this row for a goal-driven tick — null until a first
   * tick has ever been scheduled. RESPOND_ONLY agents still get one (the scheduler pushes it
   * out on every claim regardless of whether a tick actually does anything), so this alone
   * doesn't imply the agent is spending — see tick.ts's own RESPOND_ONLY early-return. */
  nextTickAt: string | null;
}

export interface HostedRuntimeConfigInput {
  mode?: RuntimeMode;
  llmBilling?: LlmBilling;
  isActive?: boolean;
  tickIntervalMinutes?: number;
  x402ReplyPriceUsdc?: string;
}

/** An agent's hosted-runtime configuration (custody-db's HostedRuntimeConfig) — whether
 * ClawdHQ runs this agent, and how its LLM calls are billed. Public read, owner-only write, same
 * shape as useAgentWallet/useCognitiveLayer. `hasLlmKey` reflects whether a BYO key is stored
 * without ever exposing it (see the llm-key route's own doc comment on why that's write-only). */
export function useHostedRuntimeConfig(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["hosted-runtime-config", chain, agentChainId];

  const configQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ config: HostedRuntimeConfig | null; hasLlmKey: boolean }>(`/api/agents/${chain}/${agentChainId}/hosted-runtime`),
    enabled: Boolean(chain && agentChainId),
  });

  const saveMutation = useMutation({
    mutationFn: (updates: HostedRuntimeConfigInput) =>
      socialFetch<{ config: HostedRuntimeConfig }>(`/api/agents/${chain}/${agentChainId}/hosted-runtime`, {
        method: "POST",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    config: configQuery.data?.config ?? null,
    hasLlmKey: configQuery.data?.hasLlmKey ?? false,
    isLoading: configQuery.isLoading,
    save: (updates: HostedRuntimeConfigInput) => saveMutation.mutateAsync(updates),
  };
}

export interface HostedRuntimeConfigSummary {
  agentChainId: string;
  mode: RuntimeMode;
  llmBilling: LlmBilling;
  isActive: boolean;
  balanceUsdc?: string;
  balanceCredits?: string;
}

/** Every hosted-runtime config for one chain — powers the Agent Directory / Marketplace hire
 * picker / Terminal's "Hosted" badges without an N+1 fetch per agent. Bounded, chain-scoped
 * read, same shape useAllCognitiveLayers already uses. */
export function useAllHostedRuntimeConfigs(chain: IndexerChainSlug | undefined) {
  const query = useQuery({
    queryKey: ["hosted-runtime-configs", chain],
    queryFn: () => socialFetch<{ configs: HostedRuntimeConfigSummary[] }>(`/api/agents/${chain}/hosted-runtime-configs`),
    enabled: Boolean(chain),
  });
  return query.data?.configs ?? [];
}
