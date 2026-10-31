"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";
import { useSocialSession } from "./useSocialSession";

export type PipelineExecutionMode = "SERIAL" | "PARALLEL";
export type PipelineStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "FAILED";
export type PipelineStepRole = "orchestrator" | "worker" | "evaluator";
export type PipelineStepStatus = "PENDING" | "ATTEMPTING" | "SUBMITTED" | "COMPLETED" | "FAILED";

export interface PipelineStep {
  id: string;
  position: number;
  agentChainId: string;
  agentName: string;
  role: "ORCHESTRATOR" | "WORKER" | "EVALUATOR";
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
  status: PipelineStepStatus;
  jobChainId: string | null;
  txHashOrRef: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  chain: IndexerChainSlug;
  ownerAddress: string;
  name: string;
  description: string;
  executionMode: PipelineExecutionMode;
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  steps: PipelineStep[];
}

export interface CreatePipelineInput {
  chain: IndexerChainSlug;
  name: string;
  description: string;
  executionMode: PipelineExecutionMode;
}

export interface AddStepInput {
  agentChainId: string;
  agentName: string;
  role: "ORCHESTRATOR" | "WORKER" | "EVALUATOR";
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
}

/** Real, DB-backed multi-agent pipelines — see /api/orchestration/pipelines. Creating one
 * immediately provisions a custodied wallet (same shape as useSubscriptions) that must be
 * funded before "Run" can actually post the first step's job; see usePipelineWallet for that.
 * Every step after the first (SERIAL mode) is posted automatically by the indexer once its
 * predecessor's on-chain job completes — poll the pipeline detail query while a run is active
 * to see that happen without a manual refresh. */
export function useOrchestration() {
  const queryClient = useQueryClient();
  const { profile } = useSocialSession();
  const listKey = useMemo(() => ["pipelines", profile?.id ?? "guest"], [profile?.id]);

  const pipelinesQuery = useQuery({
    queryKey: listKey,
    queryFn: () => socialFetch<{ pipelines: Pipeline[] }>("/api/orchestration/pipelines").then((d) => d.pipelines),
    enabled: Boolean(profile),
    // Poll while any pipeline is ACTIVE so a SERIAL pipeline's automatic step-to-step
    // advancement (driven by the indexer, not this client) shows up without a manual refresh.
    refetchInterval: (query) => (query.state.data?.some((p) => p.status === "ACTIVE") ? 5_000 : false),
  });

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: listKey });

  const create = useMutation({
    mutationFn: (input: CreatePipelineInput) =>
      socialFetch<{ pipeline: Pipeline; wallet: { address: string; status: string } }>("/api/orchestration/pipelines", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAll(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/orchestration/pipelines/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
  });

  const addStep = useMutation({
    mutationFn: ({ pipelineId, ...input }: AddStepInput & { pipelineId: string }) =>
      socialFetch<{ step: PipelineStep }>(`/api/orchestration/pipelines/${pipelineId}/steps`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(),
  });

  const removeStep = useMutation({
    mutationFn: ({ pipelineId, stepId }: { pipelineId: string; stepId: string }) =>
      socialFetch<{ ok: true }>(`/api/orchestration/pipelines/${pipelineId}/steps/${stepId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
  });

  const updateStep = useMutation({
    mutationFn: ({ pipelineId, stepId, ...input }: Partial<AddStepInput> & { pipelineId: string; stepId: string }) =>
      socialFetch<{ step: PipelineStep }>(`/api/orchestration/pipelines/${pipelineId}/steps/${stepId}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(),
  });

  const run = useMutation({
    mutationFn: (pipelineId: string) => socialFetch<{ pipeline: Pipeline }>(`/api/orchestration/pipelines/${pipelineId}/run`, { method: "POST" }),
    onSuccess: () => invalidateAll(),
  });

  return { ...pipelinesQuery, pipelines: profile ? (pipelinesQuery.data ?? []) : [], create, remove, addStep, removeStep, updateStep, run };
}
