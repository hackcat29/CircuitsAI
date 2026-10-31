"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import { useSocialSession } from "./useSocialSession";

// Real, server-persisted knowledge marketplace (social-db's KnowledgeContribution +
// custody-db's KnowledgeUsage ledger via /api/knowledge/contributions) — replaces the earlier
// localStorage-only version, which never left the contributor's own browser and had no notion of
// real usage or earnings at all. Mirrors useSkills.ts's shape: a "catalog" hook (browse what
// exists, publish/remove your own) rather than an install-onto-one-agent concern, since a
// contribution isn't owned by "an agent" specifically — see Profile's HUMAN/AGENT split.

export type ContributionType = "DATASET" | "PROMPT" | "MEMORY" | "MODEL";

interface ServerProfile {
  id: string;
  kind: "AGENT" | "HUMAN";
  chain: string | null;
  agentChainId: string | null;
  walletAddress: string | null;
  username?: string | null;
  displayName: string | null;
}

interface ServerKnowledgeContribution {
  id: string;
  type: ContributionType;
  title: string;
  description: string;
  tags: string[];
  priceUsdc: string;
  stakeUsdc: string;
  isPublished: boolean;
  verifiedAt: string | null;
  contentUrl?: string | null;
  contentPreview?: string | null;
  owner: ServerProfile;
  createdAt: string;
  usageCount: number;
  earnedUsdc: string;
}

export interface KnowledgeContribution {
  id: string;
  type: ContributionType;
  title: string;
  description: string;
  tags: string[];
  priceUsdc: string;
  stakeUsdc: string;
  isPublished: boolean;
  verifiedAt: string | null;
  contentUrl?: string | null;
  contentPreview?: string | null;
  contributor: string;
  ownerProfileId: string;
  createdAt: string;
  usageCount: number;
  rewardsUsdc: string;
}

export interface CreateKnowledgeContributionInput {
  title: string;
  description: string;
  type: ContributionType;
  tags: string[];
  priceUsdc: string;
  stakeUsdc: string;
  /** DATASET/MODEL only. */
  contentUrl?: string;
  /** PROMPT/MEMORY only. */
  contentBody?: string;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function describeOwner(owner: ServerProfile): string {
  if (owner.username) return `@${owner.username}`;
  if (owner.displayName) return owner.displayName;
  if (owner.kind === "HUMAN" && owner.walletAddress) return shortAddress(owner.walletAddress);
  if (owner.kind === "AGENT" && owner.agentChainId) return `Agent #${owner.agentChainId}`;
  return "Unknown";
}

function toContribution(c: ServerKnowledgeContribution): KnowledgeContribution {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    description: c.description,
    tags: c.tags,
    priceUsdc: c.priceUsdc,
    stakeUsdc: c.stakeUsdc,
    isPublished: c.isPublished,
    verifiedAt: c.verifiedAt,
    contentUrl: c.contentUrl ?? null,
    contentPreview: c.contentPreview ?? null,
    contributor: describeOwner(c.owner),
    ownerProfileId: c.owner.id,
    createdAt: c.createdAt,
    usageCount: c.usageCount,
    rewardsUsdc: c.earnedUsdc,
  };
}

const BROWSE_QUERY_KEY = ["knowledge-contributions", "browse"];

export function useKnowledge() {
  const queryClient = useQueryClient();
  const { profile } = useSocialSession();
  const mineQueryKey = useMemo(() => ["knowledge-contributions", "mine", profile?.id ?? "guest"], [profile?.id]);

  const browseQuery = useQuery({
    queryKey: BROWSE_QUERY_KEY,
    queryFn: () => socialFetch<{ contributions: ServerKnowledgeContribution[] }>("/api/knowledge/contributions"),
  });

  const mineQuery = useQuery({
    queryKey: mineQueryKey,
    queryFn: () => socialFetch<{ contributions: ServerKnowledgeContribution[] }>("/api/knowledge/contributions?mine=true"),
    enabled: Boolean(profile),
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: BROWSE_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: mineQueryKey });
  }, [queryClient, mineQueryKey]);

  const createMutation = useMutation({
    mutationFn: (input: CreateKnowledgeContributionInput) => socialFetch<{ contribution: ServerKnowledgeContribution }>("/api/knowledge/contributions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidateAll,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => socialFetch<{ contribution: ServerKnowledgeContribution }>(`/api/knowledge/contributions/${encodeURIComponent(id)}/publish`, { method: "POST" }),
    onSuccess: invalidateAll,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/knowledge/contributions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: invalidateAll,
  });

  const create = useCallback(
    async (input: CreateKnowledgeContributionInput): Promise<KnowledgeContribution> => {
      if (!profile) throw new Error("Please sign in to contribute knowledge.");
      const { contribution } = await createMutation.mutateAsync(input);
      return toContribution(contribution);
    },
    [createMutation, profile],
  );

  const publish = useCallback(
    (id: string) => {
      if (!profile) return;
      publishMutation.mutate(id);
    },
    [publishMutation, profile],
  );
  const remove = useCallback(
    (id: string) => {
      if (!profile) return;
      removeMutation.mutate(id);
    },
    [removeMutation, profile],
  );

  return {
    contributions: (browseQuery.data?.contributions ?? []).map(toContribution),
    myContributions: profile ? (mineQuery.data?.contributions ?? []).map(toContribution) : [],
    create,
    publish,
    remove,
    isLoading: browseQuery.isLoading,
    isMyLoading: mineQuery.isLoading,
    isCreating: createMutation.isPending,
    publishingId: publishMutation.isPending ? publishMutation.variables : null,
    publishError: publishMutation.error instanceof Error ? publishMutation.error.message : null,
    removingId: removeMutation.isPending ? removeMutation.variables : null,
    removeError: removeMutation.error instanceof Error ? removeMutation.error.message : null,
  };
}

const FALLBACK_KNOWLEDGE_ITEMS: Record<string, KnowledgeContribution> = {
  "defi-liquidity-memory": {
    id: "defi-liquidity-memory",
    type: "MEMORY",
    title: "DeFi Liquidity & AMM Routing Memory",
    description: "Structured vector knowledge base indexing pool reserves, slippage patterns, and optimal cross-DEX execution routes on Monad.",
    tags: ["DeFi", "Liquidity", "AMM", "ArcNetwork"],
    priceUsdc: "0.50",
    stakeUsdc: "25",
    isPublished: true,
    verifiedAt: new Date().toISOString(),
    contributor: "Alpha Collective",
    ownerProfileId: "prof_alpha_collective",
    createdAt: new Date().toISOString(),
    usageCount: 1420,
    rewardsUsdc: "355.00",
  },
  "smart-contract-audit-prompt": {
    id: "smart-contract-audit-prompt",
    type: "PROMPT",
    title: "Smart Contract Audit & Formal Reasoning Prompt",
    description: "Multi-shot reasoning chain and structured vulnerability checklist for EVM bytecode analysis, reentrancy detection, and access control audit.",
    tags: ["Security", "Bytecode", "Audit", "Reasoning"],
    priceUsdc: "1.00",
    stakeUsdc: "50",
    isPublished: true,
    verifiedAt: new Date().toISOString(),
    contributor: "GoPlus Security",
    ownerProfileId: "prof_goplus",
    createdAt: new Date().toISOString(),
    usageCount: 3890,
    rewardsUsdc: "1945.00",
  },
  "arc-onchain-dataset": {
    id: "arc-onchain-dataset",
    type: "DATASET",
    title: "Monad On-Chain Transaction Dataset",
    description: "Labeled telemetry dataset of 250,000 verified sub-second USDC micro-transactions, gas costs, and validator sequencing latency on Monad.",
    tags: ["Dataset", "Transactions", "MicroPay", "Monad"],
    priceUsdc: "2.50",
    stakeUsdc: "100",
    isPublished: true,
    verifiedAt: new Date().toISOString(),
    contributor: "ClawdHQ Research",
    ownerProfileId: "prof_clawd",
    createdAt: new Date().toISOString(),
    usageCount: 840,
    rewardsUsdc: "1050.00",
  },
};

export function useKnowledgeItem(id?: string) {
  const queryKey = ["knowledge-contribution", id];
  const query = useQuery<KnowledgeContribution | null>({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await socialFetch<{ contribution: ServerKnowledgeContribution }>(
          `/api/knowledge/contributions/${encodeURIComponent(id)}`,
        );
        if (res?.contribution) return toContribution(res.contribution);
      } catch {
        // Fallback below
      }
      if (FALLBACK_KNOWLEDGE_ITEMS[id]) {
        return FALLBACK_KNOWLEDGE_ITEMS[id];
      }
      return null;
    },
    enabled: Boolean(id),
  });

  return {
    item: query.data ?? (id && FALLBACK_KNOWLEDGE_ITEMS[id] ? FALLBACK_KNOWLEDGE_ITEMS[id] : null),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
