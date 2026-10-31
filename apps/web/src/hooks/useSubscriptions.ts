"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";
import { useSocialSession } from "./useSocialSession";

export type SubscriptionFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Subscription {
  id: string;
  chain: IndexerChainSlug;
  ownerAddress: string;
  hiredAgentId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
  frequency: SubscriptionFrequency;
  isActive: boolean;
  maxConcurrentOpenJobs: number;
  nextRunAt: string;
  executionCount: number;
  totalPaidUsdc: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  chain: IndexerChainSlug;
  hiredAgentId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays?: number;
  frequency: SubscriptionFrequency;
}

export interface UpdateSubscriptionInput {
  isActive?: boolean;
  taskDescription?: string;
  budgetUsdc?: string;
  deadlineDays?: number;
  frequency?: SubscriptionFrequency;
}

/** Real, DB-backed recurring-task plans — see /api/subscriptions. Creating one immediately
 * provisions a custodied wallet (see the create mutation's response) that must be funded before
 * "Run Now" can actually post a job; see useSubscriptionWallet for that and
 * useSubscriptionRuns for triggering/reviewing runs. */
export function useSubscriptions() {
  const queryClient = useQueryClient();
  const { profile } = useSocialSession();
  const queryKey = useMemo(() => ["subscriptions", profile?.id ?? "guest"], [profile?.id]);

  const subsQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ subscriptions: Subscription[] }>("/api/subscriptions").then((d) => d.subscriptions),
  });

  const create = useMutation({
    mutationFn: (input: CreateSubscriptionInput) =>
      socialFetch<{ subscription: Subscription; wallet: { address: string; status: string } }>("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: UpdateSubscriptionInput & { id: string }) =>
      socialFetch<{ subscription: Subscription }>(`/api/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggle = useMutation({
    mutationFn: (sub: Subscription) => socialFetch<{ subscription: Subscription }>(`/api/subscriptions/${sub.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !sub.isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...subsQuery, subs: subsQuery.data ?? [], create, update, toggle, remove };
}
