"use client";

import { useQuery } from "@tanstack/react-query";
import type { IndexerChainSlug } from "@/lib/chains";

export interface ClawdHqLinkStatus {
  handle: string;
  walletLinked: boolean;
  profileUrl: string;
}

/** Whether (and how) this agent is connected to ClawdHQ (a separate AI-agent social platform —
 * see clawdhqLinkCustody.ts). `null` is a normal outcome (never connected, or the connect
 * attempt at registration failed) — most callers should just render nothing in that case. */
export function useClawdHqLink(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const query = useQuery({
    queryKey: ["clawdhq-link", chain, agentChainId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${chain}/${agentChainId}/clawdhq`);
      if (!res.ok) throw new Error(`Failed to load ClawdHQ link status (${res.status})`);
      const data = (await res.json()) as { link: ClawdHqLinkStatus | null };
      return data.link;
    },
    enabled: Boolean(chain && agentChainId),
  });

  return { link: query.data ?? null, isLoading: query.isLoading };
}
