"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, Check, Upload, X, Scale } from "lucide-react";
import type { MarketplaceJob } from "@/hooks";
import { useWallet, useMyAgents, useMarketplaceActions } from "@/hooks";
import { checkOperationChain } from "@/lib/chainGuard";

export const STATUS_MAP: Record<number, { label: string; bg: string; color: string }> = {
  0: { label: "Open", bg: "#2e2210", color: "#FFB13D" },
  1: { label: "Active", bg: "#0c2a1d", color: "#1FD487" },
  2: { label: "Completed", bg: "#0c2a1d", color: "#1FD487" },
  3: { label: "Disputed", bg: "#2e1313", color: "#FF4D4D" },
  4: { label: "Cancelled", bg: "#1a1a1a", color: "#54585f" },
  5: { label: "Resolved", bg: "#0c2a1d", color: "#1FD487" },
};

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function formatDeadline(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(deadline);
  if (!ts) return "···";
  const diff = ts - now;
  if (diff < 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

export function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Renders the real actions available for a job's current status, gated to whichever
 * connected wallet is actually the employer or owns the hired agent — anyone else sees no
 * action buttons for that job. Shared between the Task Market grid and a task's own detail page. */
export function JobActionButtons({ job, onChanged }: { job: MarketplaceJob; onChanged: () => void }) {
  const { address, isConnected } = useWallet();
  const { agents } = useMyAgents();
  const { acceptJob, submitDeliverable, confirmDelivery, cancelJob, busy } = useMarketplaceActions();
  const [deliverable, setDeliverable] = useState("");
  const [showDeliverableInput, setShowDeliverableInput] = useState(false);
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [claimingAgentId, setClaimingAgentId] = useState("");

  const isEmployer = isConnected && sameAddress(address, job.employer);
  const isOpenJob = job.hiredAgentId === "0";
  const myMatchingAgent = agents.find((agent) => agent.numericId === job.hiredAgentId);
  // For a directed hire, only the pre-selected agent's owner can act. For an open job, any of
  // this wallet's own active agents is eligible to claim it — there's no single "the" hired
  // agent yet.
  const isHiredAgentOwner = isOpenJob ? agents.length > 0 : Boolean(myMatchingAgent);
  const actingAgentId = isOpenJob ? claimingAgentId || agents[0]?.numericId : myMatchingAgent?.numericId;

  async function handle(action: () => Promise<void>) {
    if (job.chain && !checkOperationChain(job.chain, "interact with this task")) {
      return;
    }
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  if (job.status === 0) {
    if (!isHiredAgentOwner && !isEmployer) return null;
    return (
      <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-border-subtle">
        {error && <p className="text-[10.5px] text-red">{error}</p>}
        {isOpenJob && isHiredAgentOwner && agents.length > 1 && (
          <select
            value={claimingAgentId || agents[0].numericId}
            onChange={(e) => setClaimingAgentId(e.target.value)}
            className="h-8 rounded-[9px] border border-border-strong bg-bg-raised px-2 text-[11px] text-text-primary outline-none"
          >
            {agents.map((a) => (
              <option key={a.numericId} value={a.numericId}>Claim as {a.name} (#{a.numericId})</option>
            ))}
          </select>
        )}
        <div className="flex gap-1.5">
          {isHiredAgentOwner && (
            <button
              onClick={() => handle(() => acceptJob(job, actingAgentId))}
              disabled={busy}
              className="flex-1 py-1.75 rounded-[9px] bg-[#0c2a1d] border border-[#1FD487]/25 text-[11.5px] font-bold text-[#1FD487] hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {isOpenJob ? (
                <>
                  <Play className="h-3 w-3 fill-current" /> Claim Job
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Accept Job
                </>
              )}
            </button>
          )}
          {isEmployer && (
            <button
              onClick={() => handle(() => cancelJob(job))}
              disabled={busy}
              className="px-3 py-1.75 rounded-[9px] bg-bg-raised border border-border-strong text-[11.5px] font-bold text-red-400/70 hover:text-red-400 hover:border-red-400/25 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (job.status === 1) {
    if (!isHiredAgentOwner && !isEmployer) return null;
    return (
      <div className="mt-2.5 pt-2.5 border-t border-border-subtle space-y-1.5">
        {error && <p className="text-[10.5px] text-red">{error}</p>}
        {isHiredAgentOwner && (
          showDeliverableInput ? (
            <div className="space-y-1.5">
              <input
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                placeholder="Deliverable URI or hash…"
                className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-2.5 py-1.75 text-[11.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => handle(async () => { await submitDeliverable(job, deliverable); setShowDeliverableInput(false); setDeliverable(""); })}
                  disabled={!deliverable || busy}
                  className="flex-1 py-1.75 rounded-[9px] bg-accent-violet text-[11.5px] font-bold text-white hover:brightness-110 transition-all disabled:opacity-40"
                >
                  Submit
                </button>
                <button onClick={() => setShowDeliverableInput(false)} className="px-3 py-1.75 rounded-[9px] bg-bg-raised border border-border-strong text-[11.5px] font-bold text-text-secondary transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeliverableInput(true)}
              disabled={busy}
              className="w-full py-1.75 rounded-[9px] bg-accent-dark border border-accent-violet/25 text-[11.5px] font-bold text-accent-violet hover:bg-accent-violet/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Submit Deliverable
            </button>
          )
        )}
        {isEmployer && (
          <div className="flex gap-1.5">
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="h-8.5 rounded-[9px] border border-border-strong bg-bg-raised px-2 text-[11.5px] text-text-primary outline-none"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} star{r === 1 ? "" : "s"}</option>
              ))}
            </select>
            <button
              onClick={() => handle(() => confirmDelivery(job, rating))}
              disabled={busy}
              className="flex-1 py-1.75 rounded-[9px] bg-[#0c2a1d] border border-[#1FD487]/25 text-[11.5px] font-bold text-[#1FD487] hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3" /> Confirm
            </button>
            <button
              onClick={() => handle(() => cancelJob(job))}
              disabled={busy}
              className="px-3 py-1.75 rounded-[9px] bg-bg-raised border border-border-strong text-[11.5px] font-bold text-red-400/70 hover:text-red-400 hover:border-red-400/25 transition-colors disabled:opacity-40 flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {/* disputeJob (Core) only accepts a job while Active (status 1) — either party can
            raise it. A status-2 (Completed) job has already paid out; there's nothing left to
            dispute by then, so this link only ever renders here, not on a completed job. */}
        <Link
          href={`/disputes?jobId=${job.id}`}
          className="flex items-center justify-center gap-1 text-center py-1.5 rounded-[9px] bg-[#2e1313] border border-[#FF4D4D]/20 text-[11px] font-bold text-[#FF4D4D]/70 hover:text-[#FF4D4D] hover:border-[#FF4D4D]/35 transition-colors"
        >
          <Scale className="h-3 w-3 text-[#FF4D4D]" /> Raise Dispute
        </Link>
      </div>
    );
  }

  return null;
}
