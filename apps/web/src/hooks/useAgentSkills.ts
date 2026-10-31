"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

/** Skills installed onto one specific agent (social-db's AgentSkill) — the real
 * declared-capability list, and (for a hosted agent) also what packages/hosted-agent-runtime
 * actually reads to decide which skills it can offer as tools; see skillRegistry.ts's own doc
 * comment for why only some installed skills resolve to something callable. Public read,
 * owner-only write, same shape as useCognitiveLayer/useHostedRuntimeConfig — this replaced an
 * earlier localStorage-only version that had no server-side presence at all, and (a latent bug
 * in that version) keyed installs by numeric agent id alone, so two agents with the same id on
 * different chains shared one install list; this version is properly chain-scoped. */
export function useAgentSkills(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-skills", chain, agentChainId];
  const enabled = Boolean(chain && agentChainId);

  const skillsQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ skillIds: string[] }>(`/api/agents/${chain}/${agentChainId}/skills`),
    enabled,
  });

  const installMutation = useMutation({
    mutationFn: (skillId: string) =>
      socialFetch<{ skillIds: string[] }>(`/api/agents/${chain}/${agentChainId}/skills`, {
        method: "POST",
        body: JSON.stringify({ skillId }),
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const uninstallMutation = useMutation({
    mutationFn: (skillId: string) =>
      socialFetch<{ skillIds: string[] }>(`/api/agents/${chain}/${agentChainId}/skills/${encodeURIComponent(skillId)}`, {
        method: "DELETE",
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const installed = new Set(skillsQuery.data?.skillIds ?? []);

  function toggle(skillId: string): void {
    if (!enabled) return;
    if (installed.has(skillId)) {
      uninstallMutation.mutate(skillId);
    } else {
      installMutation.mutate(skillId);
    }
  }

  return { installed, toggle, isLoading: skillsQuery.isLoading };
}

/** Total skill-installations across a set of agents — used by the Contribute page's score.
 * Sums each agent's install count via the same route `useAgentSkills` reads, in parallel. */
export async function countInstalledAcrossAgents(chain: IndexerChainSlug, agentChainIds: string[]): Promise<number> {
  const counts = await Promise.all(
    agentChainIds.map((agentChainId) =>
      socialFetch<{ skillIds: string[] }>(`/api/agents/${chain}/${agentChainId}/skills`)
        .then((r) => r.skillIds.length)
        .catch(() => 0),
    ),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}
