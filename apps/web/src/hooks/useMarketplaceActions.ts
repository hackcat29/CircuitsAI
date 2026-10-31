"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useWallet } from "./useWallet";
import { useEvmAdapter } from "./useEvmAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { sha256Hex } from "@/lib/hash";
import type { MarketplaceJob } from "./useJobs";

export interface PostJobInput {
  /** Empty/omitted posts an *open* job — no agent pre-selected, any active agent's owner can
   * later claim it (see acceptJob's `claimingAgentId` param). */
  hiredAgentId: string;
  employerAgentId: string;
  budgetUsdc: string;
  deadlineDays: number;
  taskDescription: string;
}

export function useMarketplaceActions() {
  const { chain } = useWallet();
  const evmAdapter = useEvmAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  async function postJob(input: PostJobInput): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to post a task.");
      const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000) + input.deadlineDays * 86400);
      const taskHash = await sha256Hex(input.taskDescription);
      // postJob only ever puts this hash on-chain, never the text — store it before the tx so
      // a hired agent (human or an autonomous runtime, see packages/agent-runtime) can later
      // learn what the job actually asks for. Failing the whole submission here is better than
      // minting an on-chain job whose description can never be recovered.
      await storeTaskDescription(taskHash, input.taskDescription);
      await evmAdapter.postJob({
        employerAgentId: BigInt(input.employerAgentId || "0"),
        hiredAgentId: BigInt(input.hiredAgentId || "0"),
        taskHash,
        budget: parseUnits(input.budgetUsdc, 6),
        deadline: deadlineSeconds,
      });
    });
  }

  /** `claimingAgentId` is required for an open job (job.hiredAgentId === "0") — which of the
   * caller's own agents is doing the claiming — and ignored for a directed hire, which already
   * has its agent fixed at post time. */
  async function acceptJob(job: MarketplaceJob, claimingAgentId?: string): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to accept this task.");
      if (job.hiredAgentId === "0") {
        if (!claimingAgentId) throw new Error("Choose which of your agents is claiming this job.");
        await evmAdapter.acceptOpenJob(BigInt(job.id), BigInt(claimingAgentId));
        return;
      }
      await evmAdapter.acceptJob(BigInt(job.id));
    });
  }

  async function submitDeliverable(job: MarketplaceJob, deliverableText: string): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to submit a deliverable.");
      const hash = await sha256Hex(deliverableText);
      await evmAdapter.submitDeliverable(BigInt(job.id), hash);
    });
  }

  async function confirmDelivery(job: MarketplaceJob, rating: number): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to confirm delivery.");
      await evmAdapter.confirmDelivery(BigInt(job.id), rating);
    });
  }

  async function cancelJob(job: MarketplaceJob): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to cancel this task.");
      await evmAdapter.cancelJob(BigInt(job.id));
    });
  }

  /** Only valid while the job is Active (status 1) — callable by either the employer or the
   * hired agent's owner (Core checks this, not the client). */
  async function disputeJob(job: MarketplaceJob): Promise<void> {
    await run(async () => {
      if (!evmAdapter) throw new Error("Please sign in or connect your wallet to dispute this task.");
      await evmAdapter.disputeJob(BigInt(job.id));
    });
  }

  return { busy, postJob, acceptJob, submitDeliverable, confirmDelivery, cancelJob, disputeJob };
}

/** Writes the plaintext behind a taskHash to the off-chain cache (see
 * apps/web/src/app/api/marketplace/task-descriptions/route.ts) — same-origin call, no base URL
 * needed since this only ever runs in the browser. Throws on failure so the caller can abort
 * the on-chain post rather than mint an unrecoverable job. Exported for useNegotiationActions.ts,
 * which needs the exact same recoverability fix for negotiation-originated jobs. */
export async function storeTaskDescription(taskHash: string, description: string): Promise<void> {
  const res = await fetch("/api/marketplace/task-descriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskHash, description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to store task description.");
  }
}
