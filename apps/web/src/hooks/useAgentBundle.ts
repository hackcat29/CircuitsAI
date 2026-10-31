"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import { useSocialSession } from "./useSocialSession";

export interface SquadMemberDetail {
  agentChainId: string;
  agentName: string;
  role: string;
  splitBps: number;
}

export interface AgentBundle {
  id: string;
  chain?: string;
  name: string;
  description: string;
  category: string;
  priceUsdc: string;
  creatorAddress?: string;
  tags: string[];
  isPublished: boolean;
  usageCount: number;
  totalVolumeUsdc?: string;
  createdAt: number;
  updatedAt?: number;
  members?: SquadMemberDetail[];
  agentIds: string[];
  agentNames: string[];
  agentEmojis: string[];
}

export interface CreateSquadBundleInput {
  name: string;
  description: string;
  category?: string;
  priceUsdc?: string;
  tags?: string[] | string;
  chain?: string;
  members?: { agentChainId: string; role?: string; splitBps?: number }[];
  selectedAgentIds?: string[];
  isPublished?: boolean;
}

export interface HireSquadInput {
  bundleId: string;
  objective: string;
  txHash?: string;
  jobChainId?: string;
}

export interface HireSquadResult {
  ok: boolean;
  hireId: string;
  status: string;
  bundleId: string;
  bundleName: string;
  objective: string;
  totalPriceUsdc: string;
  totalUsageCount: number;
  members: {
    agentChainId: string;
    agentName: string;
    role: string;
    splitBps: number;
    allocatedUsdc: string;
  }[];
  jobChainIds?: string[];
  txHash?: string;
  deliverable?: string;
  agentOutputs?: {
    agentChainId: string;
    agentName: string;
    role: string;
    output: string;
  }[];
  message: string;
}

export interface SquadHireRecord {
  id: string;
  bundleId: string;
  buyerAddress: string;
  objective: string;
  status: string;
  jobChainIds: string[];
  deliverable: string | null;
  createdAt: string;
}

export function useAgentBundles(userAddress?: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useSocialSession();
  const queryKey = useMemo(() => ["bundles", userAddress || "all"], [userAddress]);

  const bundlesQuery = useQuery({
    queryKey,
    queryFn: () =>
      socialFetch<{ bundles: AgentBundle[] }>("/api/bundles?publishedOnly=false").then((d) => d.bundles),
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bundles"] });

  const createMutation = useMutation({
    mutationFn: (input: CreateSquadBundleInput) =>
      socialFetch<{ bundle: AgentBundle }>("/api/bundles", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((d) => d.bundle),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CreateSquadBundleInput & { isPublished: boolean }> }) =>
      socialFetch<{ bundle: AgentBundle }>(`/api/bundles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }).then((d) => d.bundle),
    onSuccess: () => invalidate(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      socialFetch<{ ok: true }>(`/api/bundles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(),
  });

  const hireMutation = useMutation({
    mutationFn: ({ bundleId, objective, txHash, jobChainId }: HireSquadInput) =>
      socialFetch<HireSquadResult>(`/api/bundles/${bundleId}/hire`, {
        method: "POST",
        body: JSON.stringify({ objective, txHash, jobChainId }),
      }),
    onSuccess: () => invalidate(),
  });

  return {
    bundles: bundlesQuery.data ?? [],
    loading: bundlesQuery.isLoading,
    isError: bundlesQuery.isError,
    error: bundlesQuery.error,
    create: (input: CreateSquadBundleInput) => createMutation.mutateAsync(input),
    creating: createMutation.isPending,
    update: (id: string, updates: Partial<CreateSquadBundleInput & { isPublished: boolean }>) =>
      updateMutation.mutateAsync({ id, updates }),
    updating: updateMutation.isPending,
    remove: (id: string) => removeMutation.mutateAsync(id),
    removing: removeMutation.isPending,
    hire: (bundleId: string, objective: string, options?: { txHash?: string; jobChainId?: string }) =>
      hireMutation.mutateAsync({ bundleId, objective, txHash: options?.txHash, jobChainId: options?.jobChainId }),
    hiring: hireMutation.isPending,
    refresh: () => bundlesQuery.refetch(),
  };
}

export function useSquadHires(bundleId?: string | null) {
  return useQuery({
    queryKey: ["squad-hires", bundleId || ""],
    queryFn: async () => {
      if (!bundleId) return [];
      const data = await socialFetch<{ hires: SquadHireRecord[] }>(`/api/bundles/${bundleId}/hires`);
      return data.hires || [];
    },
    enabled: Boolean(bundleId),
    staleTime: 10_000,
  });
}
