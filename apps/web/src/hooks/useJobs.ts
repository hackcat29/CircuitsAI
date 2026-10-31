"use client";

import { useEffect, useState } from "react";
import { useEvmAdapter } from "./useEvmAdapter";
import { MONAD_MAINNET } from "@/lib/chains";

const MAX_RECENT_JOBS = 20;

export interface MarketplaceJob {
  id: string;
  employer: string;
  employerAgentId?: string;
  hiredAgentId: string;
  budget: bigint;
  status: number;
  deadline: bigint;
  chain?: string;
  taskHash?: string;
}

export interface JobsState {
  loading: boolean;
  jobs: MarketplaceJob[];
}

export function useJobs(): JobsState {
  const monadMainnetAdapter = useEvmAdapter(MONAD_MAINNET);

  const [state, setState] = useState<JobsState>({ loading: true, jobs: [] });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.jobs.length > 0 ? prev : { ...prev, loading: true }));

    async function loadChainJobs(
      adapter: ReturnType<typeof useEvmAdapter>,
      chainSlug: string,
    ): Promise<MarketplaceJob[]> {
      if (!adapter) return [];
      try {
        const stats = await adapter.getProtocolStats();
        const total = stats.totalJobs;
        if (total === 0n) return [];
        const fromId = total > BigInt(MAX_RECENT_JOBS) ? total - BigInt(MAX_RECENT_JOBS) + 1n : 1n;
        const ids = bigintRange(fromId, total).reverse();
        const jobs = await Promise.all(ids.map((id) => adapter.getJob(id)));
        return jobs
          .filter(
            (job) =>
              job &&
              job.jobId !== "0" &&
              job.employer &&
              job.employer !== "0x0000000000000000000000000000000000000000",
          )
          .map((job) => ({
            id: job.jobId,
            employer: job.employer,
            employerAgentId: job.employerAgentId || "0",
            hiredAgentId: job.hiredAgentId,
            budget: job.budget,
            status: job.status,
            deadline: job.deadline,
            chain: chainSlug,
            taskHash: job.taskHash,
          }));
      } catch (err) {
        console.warn(`useJobs: failed fetching from ${chainSlug}:`, err);
        return [];
      }
    }

    async function load(): Promise<JobsState> {
      const monadMainnetJobs = await loadChainJobs(monadMainnetAdapter, "MONAD_MAINNET");
      // Sort newest first by id
      monadMainnetJobs.sort((a, b) => Number(b.id) - Number(a.id));
      return {
        loading: false,
        jobs: monadMainnetJobs,
      };
    }

    load()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, jobs: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [monadMainnetAdapter]);

  return state;
}

function bigintRange(from: bigint, to: bigint): bigint[] {
  const result: bigint[] = [];
  for (let i = from; i <= to; i++) result.push(i);
  return result;
}

