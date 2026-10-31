"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketplaceJob } from "./useJobs";

export interface JobDetail extends MarketplaceJob {
  taskHash: string;
  description?: string;
  deliverableText?: string;
  createdAt?: bigint;
  completedAt?: bigint;
  disputeId?: string;
  deliverableHash?: string;
  rating?: number;
}

export interface JobDetailState {
  loading: boolean;
  job: JobDetail | null;
  refetch: () => void;
}

/** Single-job detail read, direct from the server-side `/api/marketplace/jobs/${jobId}` resolver.
 * Handles on-chain query, task description & deliverable text lookup with multi-chain fallback,
 * completely immune to client-side Wagmi/adblocker/RPC re-render blinking. */
export function useJob(jobId: string | undefined, chainHint?: string): JobDetailState {
  const [state, setState] = useState<{ loading: boolean; job: JobDetail | null }>({
    loading: Boolean(jobId),
    job: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!jobId) {
      setState({ loading: false, job: null });
      return;
    }
    let cancelled = false;

    // Preserve existing job while refetching to prevent blinking/flashing
    setState((prev) => (prev.job?.id === jobId ? prev : { loading: true, job: null }));

    async function load() {
      const cleanHint = chainHint?.trim().toUpperCase();
      try {
        const apiRes = await fetch(`/api/marketplace/jobs/${jobId}${cleanHint ? `?chain=${cleanHint}` : ""}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data?.job && !cancelled) {
            const j = data.job;
            setState({
              loading: false,
              job: {
                id: String(j.id || j.jobId),
                employer: j.employer,
                employerAgentId: String(j.employerAgentId || "0"),
                hiredAgentId: String(j.hiredAgentId),
                budget: BigInt(j.budget),
                status: Number(j.status),
                deadline: BigInt(j.deadline),
                taskHash: j.taskHash,
                createdAt: j.createdAt ? BigInt(j.createdAt) : undefined,
                completedAt: j.completedAt ? BigInt(j.completedAt) : undefined,
                disputeId: j.disputeId,
                deliverableHash: j.deliverableHash,
                rating: j.rating ? Number(j.rating) : undefined,
                description: j.description,
                deliverableText: j.deliverableText,
                chain: j.chain || "MONAD_MAINNET",
              },
            });
            return;
          }
        }
      } catch (err) {
        console.warn("useJob fetch error:", err);
      }

      if (!cancelled) {
        setState({ loading: false, job: null });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [jobId, chainHint, refreshKey]);

  return { ...state, refetch };
}
