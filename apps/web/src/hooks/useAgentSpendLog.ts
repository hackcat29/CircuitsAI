"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { IndexerChainSlug } from "@/lib/chains";
import type { SpendAction } from "./useAgentSpendPolicy";

export type AgentSpendLogStatus = "PENDING" | "ATTEMPTING" | "SUBMITTED" | "SUCCEEDED" | "FAILED";

export interface AgentSpendLogEntry {
  id: string;
  action: SpendAction;
  amountUsdc: string;
  targetRef: string | null;
  status: AgentSpendLogStatus;
  txHashOrRef: string | null;
  error: string | null;
  createdAt: string;
}

export interface PostJobSpendInput {
  hiredAgentId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays?: number;
}

export interface X402PaymentSpendInput {
  recipient: string;
  amountUsdc: string;
  reason?: string;
}

export interface CallSkillSpendInput {
  skillId: string;
  input?: unknown;
}

export interface X402ResourceSpendInput {
  url: string;
  maxAmountUsdc: string;
}

/** Owner-only audit trail of an agent's autonomous spends (AgentSpendLog), plus the manual
 * owner-triggered POST_JOB/X402_PAYMENT spend actions — the same
 * checkAgentSpendPolicy/executeAgentSpend path the tick loop calls unattended, exercisable here
 * by an explicit owner request first. */
export function useAgentSpendLog(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-spend-log", chain, agentChainId];

  const logQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ logs: AgentSpendLogEntry[] }>(`/api/agents/${chain}/${agentChainId}/spend-log`),
    enabled: Boolean(chain && agentChainId),
  });

  const postJob = useMutation({
    mutationFn: (input: PostJobSpendInput) =>
      socialFetch<{ ok: true; txHashOrRef: string; jobChainId: string }>(`/api/agents/${chain}/${agentChainId}/spend-policy/post-job`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const x402Payment = useMutation({
    mutationFn: (input: X402PaymentSpendInput) =>
      socialFetch<{ ok: true; txHashOrRef: string }>(`/api/agents/${chain}/${agentChainId}/spend-policy/x402-payment`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const callSkill = useMutation({
    mutationFn: (input: CallSkillSpendInput) =>
      socialFetch<{ ok: true; txHashOrRef: string; result: unknown }>(`/api/agents/${chain}/${agentChainId}/spend-policy/call-skill`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Negotiated version of x402Payment above — fetches `url` itself and pays whatever it
  // actually advertises (up to maxAmountUsdc), instead of the caller declaring the amount
  // upfront. See payX402ResourceFromAgentWallet's own doc comment (custody-core).
  const x402Resource = useMutation({
    mutationFn: (input: X402ResourceSpendInput) =>
      socialFetch<{ ok: true; txHashOrRef: string; data: unknown }>(`/api/agents/${chain}/${agentChainId}/spend-policy/x402-resource`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    logs: logQuery.data?.logs ?? [],
    isLoading: logQuery.isLoading,
    postJob: (input: PostJobSpendInput) => postJob.mutateAsync(input),
    x402Payment: (input: X402PaymentSpendInput) => x402Payment.mutateAsync(input),
    callSkill: (input: CallSkillSpendInput) => callSkill.mutateAsync(input),
    x402Resource: (input: X402ResourceSpendInput) => x402Resource.mutateAsync(input),
  };
}
