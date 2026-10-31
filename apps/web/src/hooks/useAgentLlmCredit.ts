"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export interface AgentLlmUsageEntry {
  id: string;
  callKind: "REACTIVE_REPLY" | "TICK_DECISION";
  // Platform-billed usage is always OPENROUTER in practice (see resolveLlmKey's PLATFORM
  // branch) — ANTHROPIC/OPENAI/GEMINI are included since AgentLlmUsage.provider is typed against
  // the full LlmProvider enum, not because a PLATFORM-billed row can actually carry them.
  provider: "ANTHROPIC" | "OPENAI" | "GEMINI" | "OPENROUTER";
  inputTokens: number;
  outputTokens: number;
  costUsdc: string;
  costCredits: string;
  /** Null for a row whose costUsdc no longer matches any current tier's rate (an operator
   * changed a PLATFORM_LLM_COST_*_USDC env var since this row was charged) — the UI shows
   * "Legacy rate" for these instead of a tier badge. See tierForHistoricalCost's doc comment. */
  tier: "STANDARD" | "PLUS" | "PRO" | null;
  createdAt: string;
}

/** Owner-only view of a PLATFORM-billed agent's prepaid LLM credit balance, recent per-call
 * debit log, and the top-up action — see the llm-credits API routes' own doc comments for how
 * the balance is actually backed (a real on-chain transfer from the agent's AgentWallet, not an
 * admin-settable number). BYO_KEY-billed agents don't use this — their calls aren't metered. */
export function useAgentLlmCredit(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-llm-credit", chain, agentChainId];

  const query = useQuery({
    queryKey,
    queryFn: () =>
      socialFetch<{ balanceUsdc: string; balanceCredits: string; agentWalletBalanceUsdc: string | null; usage: AgentLlmUsageEntry[] }>(
        `/api/agents/${chain}/${agentChainId}/llm-credits`,
      ),
    enabled: Boolean(chain && agentChainId),
  });

  const topUp = useMutation({
    mutationFn: (amountUsdc: string) =>
      socialFetch<{ ok: true; txHashOrRef: string }>(`/api/agents/${chain}/${agentChainId}/llm-credits/top-up`, {
        method: "POST",
        body: JSON.stringify({ amountUsdc }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    balanceUsdc: query.data?.balanceUsdc ?? "0",
    balanceCredits: query.data?.balanceCredits ?? "0",
    agentWalletBalanceUsdc: query.data?.agentWalletBalanceUsdc ?? null,
    usage: query.data?.usage ?? [],
    isLoading: query.isLoading,
    topUp: (amountUsdc: string) => topUp.mutateAsync(amountUsdc),
  };
}
