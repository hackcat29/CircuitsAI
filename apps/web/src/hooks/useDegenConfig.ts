"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";

export type DegenVenue = "HYPERLIQUID" | "CLAWDHQ_LAUNCH" | "SPORTYSTAKE_PREDICTIONS" | "SPORTYSTAKE_SPORTSBOOK" | "SPORTYSTAKE_CASINO";
export type DegenMode = "LIVE";

export interface DegenAgentConfig {
  chain: IndexerChainSlug;
  agentChainId: string;
  mode: DegenMode;
  killSwitchEnabled: boolean;
  killedAt: string | null;
  killedReason: string | null;
  allowedVenues: DegenVenue[];
  maxPositionUsdc: string;
  maxDailyLossUsdc: string;
  strategyPrompt?: string;
  updatedAt: string;
}

export interface SaveDegenConfigInput {
  allowedVenues: DegenVenue[];
  maxPositionUsdc: string;
  maxDailyLossUsdc: string;
  mode?: DegenMode;
  strategyPrompt?: string;
}

/** Risk config + kill switch — always the owner's wallet session (server-checked against
 * on-chain ownership, see .../config/route.ts), never a bearer agent key: a leaked TRADING key
 * shouldn't be able to loosen its own risk limits. The one exception is engaging (not
 * disengaging) the kill switch, which the agent's own key can also do — see useDegenKillSwitch. */
export function useDegenConfig(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["degen-config", chain, agentChainId];

  const configQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ config: DegenAgentConfig | null }>(`/api/degen/agents/${chain}/${agentChainId}/config`).then((d) => d.config),
    enabled: Boolean(chain && agentChainId),
  });

  const saveConfig = useMutation({
    mutationFn: (input: SaveDegenConfigInput) =>
      socialFetch<{ config: DegenAgentConfig }>(`/api/degen/agents/${chain}/${agentChainId}/config`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setKillSwitch = useMutation({
    mutationFn: (input: { engage: boolean; reason?: string }) =>
      socialFetch<{ killSwitchEnabled: boolean }>(`/api/degen/agents/${chain}/${agentChainId}/kill`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...configQuery, config: configQuery.data ?? null, saveConfig, setKillSwitch };
}
