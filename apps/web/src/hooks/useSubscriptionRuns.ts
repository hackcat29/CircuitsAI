"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";

export type SubscriptionRunStatus = "PENDING" | "ATTEMPTING" | "SUBMITTED" | "SUCCEEDED" | "FAILED";

export interface SubscriptionRun {
  id: string;
  status: SubscriptionRunStatus;
  jobChainId: string | null;
  txHashOrRef: string | null;
  error: string | null;
  createdAt: string;
}

export interface RunNowResult {
  runId: string;
  jobChainId: string;
  txHashOrRef: string;
}

/** Run history for one subscription, the owner-triggered "Run Now" pipeline, and the
 * owner-authenticated confirm/cancel/dispute relay for jobs it posted — see runJob.ts/
 * jobRelay.ts for why these go through the custodied wallet rather than the connected browser
 * wallet (it's the on-chain employer for jobs it posted, not the human owner directly). */
export function useSubscriptionRuns(subscriptionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["subscription-runs", subscriptionId];

  const runsQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ runs: SubscriptionRun[] }>(`/api/subscriptions/${subscriptionId}/runs`).then((d) => d.runs),
    enabled: Boolean(subscriptionId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-wallet", subscriptionId] });
  };

  const runNow = useMutation({
    mutationFn: () => socialFetch<RunNowResult>(`/api/subscriptions/${subscriptionId}/run-now`, { method: "POST" }),
    onSuccess: invalidateAll,
  });

  const confirmJob = useMutation({
    mutationFn: ({ jobChainId, rating }: { jobChainId: string; rating: number }) =>
      socialFetch<{ txHashOrRef: string }>(`/api/subscriptions/${subscriptionId}/jobs/${jobChainId}/confirm`, { method: "POST", body: JSON.stringify({ rating }) }),
    onSuccess: invalidateAll,
  });

  const cancelJob = useMutation({
    mutationFn: (jobChainId: string) => socialFetch<{ txHashOrRef: string }>(`/api/subscriptions/${subscriptionId}/jobs/${jobChainId}/cancel`, { method: "POST" }),
    onSuccess: invalidateAll,
  });

  const disputeJob = useMutation({
    mutationFn: (jobChainId: string) => socialFetch<{ txHashOrRef: string }>(`/api/subscriptions/${subscriptionId}/jobs/${jobChainId}/dispute`, { method: "POST" }),
    onSuccess: invalidateAll,
  });

  return { ...runsQuery, runs: runsQuery.data ?? [], runNow, confirmJob, cancelJob, disputeJob };
}
