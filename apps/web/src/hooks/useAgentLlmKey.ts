"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type LlmKeyProvider = "ANTHROPIC" | "OPENAI" | "GEMINI";

/** Owner-only management of a hosted-runtime agent's BYO provider key — the owner's own
 * Anthropic/OpenAI/Gemini account, called directly (see packages/hosted-agent-runtime/src/
 * llmClient.ts). PLATFORM billing doesn't use this at all — it always routes through a single
 * ClawdHQ-held OpenRouter key instead. The key itself is never readable back — save/revoke are
 * the only mutations, and the query only ever reports whether one is currently stored (see the
 * llm-key route's own doc comment). */
export function useAgentLlmKey(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-llm-key", chain, agentChainId];

  const query = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ hasLlmKey: boolean }>(`/api/agents/${chain}/${agentChainId}/llm-key`),
    enabled: Boolean(chain && agentChainId),
  });

  const save = useMutation({
    mutationFn: (input: { provider: LlmKeyProvider; apiKey: string }) =>
      socialFetch<{ ok: true; provider: LlmKeyProvider }>(`/api/agents/${chain}/${agentChainId}/llm-key`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revoke = useMutation({
    mutationFn: () => socialFetch<{ ok: true }>(`/api/agents/${chain}/${agentChainId}/llm-key`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    hasLlmKey: query.data?.hasLlmKey ?? false,
    isLoading: query.isLoading,
    save: (input: { provider: LlmKeyProvider; apiKey: string }) => save.mutateAsync(input),
    revoke: () => revoke.mutateAsync(),
  };
}
