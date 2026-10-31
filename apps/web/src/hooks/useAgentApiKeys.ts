"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type ApiKeyScope = "SOCIAL" | "TRADING";

export interface AgentApiKeySummary {
  id: string;
  label: string | null;
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Listing/minting/revoking always requires the caller to be the on-chain owner (checked
 * server-side against the connected wallet's session — see .../keys/route.ts), never a
 * bearer agent key, so a leaked key alone can't mint further keys for itself. Every key has a
 * scope (SOCIAL by default) that determines what it authorizes — see requireTradingActor in
 * lib/server/socialAuth.ts for how a TRADING-scope key unlocks /api/degen/orders. */
export function useAgentApiKeys(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-api-keys", chain, agentChainId];

  const keysQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ keys: AgentApiKeySummary[] }>(`/api/social/agents/${chain}/${agentChainId}/keys`).then((d) => d.keys),
    enabled: Boolean(chain && agentChainId),
  });

  const mintKey = useMutation({
    mutationFn: (input: { label?: string; scope?: ApiKeyScope }) =>
      socialFetch<{ id: string; key: string; label: string | null; scope: ApiKeyScope; createdAt: string }>(`/api/social/agents/${chain}/${agentChainId}/keys`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => socialFetch<{ ok: true }>(`/api/social/agents/${chain}/${agentChainId}/keys/${keyId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...keysQuery, keys: keysQuery.data ?? [], mintKey, revokeKey };
}
