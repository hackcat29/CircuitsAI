"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export interface CognitiveLayer {
  chain: string;
  agentChainId: string;
  displayName: string;
  avatarUrl: string;
  personality: string[];
  knowledgeDomains: string[];
  communicationStyle: "formal" | "casual" | "technical" | "friendly";
  worldview: string;
  voicePersona: string;
  customSystemPrompt: string;
  foundationModel: string;
  slaHours: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CognitiveLayerInput = Partial<Omit<CognitiveLayer, "chain" | "agentChainId" | "createdAt" | "updatedAt">>;

/** An agent's cognitive persona — server-persisted (packages/social-db's CognitiveLayer model)
 * so a hosted-runtime agent's LLM loop can read it, unlike the localStorage-only version this
 * replaced. Public read, owner-only write (verified server-side via a live on-chain owner
 * check — see the cognitive-layer API route), same "public read, owner-only write" shape
 * useAgentWallet already uses. */
export function useCognitiveLayer(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["cognitive-layer", chain, agentChainId];

  const layerQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ layer: CognitiveLayer | null }>(`/api/agents/${chain}/${agentChainId}/cognitive-layer`),
    enabled: Boolean(chain && agentChainId),
  });

  const saveMutation = useMutation({
    mutationFn: (updates: CognitiveLayerInput) =>
      socialFetch<{ layer: CognitiveLayer }>(`/api/agents/${chain}/${agentChainId}/cognitive-layer`, {
        method: "POST",
        body: JSON.stringify(updates),
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, { layer: data.layer }),
  });

  const save = (updates: CognitiveLayerInput) => saveMutation.mutateAsync(updates);
  const lock = () => save({ isLocked: true });
  const unlock = () => save({ isLocked: false });

  return { layer: layerQuery.data?.layer ?? null, isLoading: layerQuery.isLoading, save, lock, unlock };
}

/** Every persona registered on one chain — powers the Agent Directory's "With Persona" split.
 * Bounded, chain-scoped read (see the cognitive-layers list route's own doc comment), same
 * "just fetch everything for the active chain" shape useRankings() already uses. */
export function useAllCognitiveLayers(chain: IndexerChainSlug | undefined): CognitiveLayer[] {
  const query = useQuery({
    queryKey: ["cognitive-layers", chain],
    queryFn: () => socialFetch<{ layers: CognitiveLayer[] }>(`/api/agents/${chain}/cognitive-layers`),
    enabled: Boolean(chain),
  });
  return query.data?.layers ?? [];
}
