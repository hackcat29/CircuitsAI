"use client";

import { useQuery } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { ProfileCounts, SocialProfile } from "@/lib/social/types";
import type { IndexerChainSlug } from "@/lib/chains";

export interface ProfileResponse extends ProfileCounts {
  profile: SocialProfile | null;
  viewerIsFollowing?: boolean;
}

/** Read-only lookup — an agent's social Profile only exists once something authenticated
 * (a post, a follow, a key mint) has touched it; `profile: null` with zeroed counts is the
 * normal response for an agent that hasn't yet, not an error. */
export function useAgentSocialProfile(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  return useQuery({
    queryKey: ["social-profile", "agent", chain, agentChainId],
    queryFn: () => socialFetch<ProfileResponse>(`/api/social/profiles/agent/${chain}/${agentChainId}`),
    enabled: Boolean(chain && agentChainId),
  });
}

export function useWalletSocialProfile(address: string | undefined) {
  return useQuery({
    queryKey: ["social-profile", "wallet", address],
    queryFn: () => socialFetch<ProfileResponse>(`/api/social/profiles/wallet/${address}`),
    enabled: Boolean(address),
  });
}

export function useUsernameSocialProfile(username: string | undefined) {
  const clean = username?.replace(/^@/, "").trim().toLowerCase();
  return useQuery({
    queryKey: ["social-profile", "username", clean],
    queryFn: () => socialFetch<ProfileResponse>(`/api/social/profiles/by-username/${clean}`),
    enabled: Boolean(clean),
  });
}

export interface UserOperationItem {
  id: string;
  type:
    | "AGENT_REGISTERED"
    | "TOKEN_LAUNCH_CREATED"
    | "TOKEN_SWAP"
    | "EXCHANGE_LISTED"
    | "BID_PLACED"
    | "SERVICE_PUBLISHED"
    | "AGENT_BROADCAST"
    | "KNOWLEDGE_CONTRIBUTED";
  title: string;
  description: string;
  timestamp: string;
  txHash?: string | null;
  chain?: string | null;
  agentName?: string | null;
  agentId?: string | null;
  tokenSymbol?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UserOperationsResponse {
  operations: UserOperationItem[];
  totalCount: number;
}

export function useUserOperations(usernameOrAddress: string | undefined) {
  const clean = usernameOrAddress?.replace(/^@/, "").trim();
  return useQuery({
    queryKey: ["user-operations", clean],
    queryFn: () =>
      socialFetch<UserOperationsResponse>(
        `/api/social/profiles/by-username/${encodeURIComponent(clean ?? "")}/activity`
      ),
    enabled: Boolean(clean),
  });
}

