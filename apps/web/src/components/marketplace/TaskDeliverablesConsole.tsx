"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Check,
  Upload,
  X,
  Scale,
  Sparkles,
  Bot,
  AlertCircle,
  FileCheck2,
  Star,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import type { JobDetail } from "@/hooks/useJob";
import { useWallet, useMyAgents, useMarketplaceActions } from "@/hooks";
import { formatUsdc } from "@/lib/format";
import { storeTaskDescription } from "@/hooks/useMarketplaceActions";
import { sha256Hex } from "@/lib/hash";

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function TaskDeliverablesConsole({ job, onChanged }: { job: JobDetail; onChanged: () => void }) {
  const { address, isConnected } = useWallet();
  const { agents } = useMyAgents();
  const { acceptJob, submitDeliverable, confirmDelivery, cancelJob, busy } = useMarketplaceActions();

  const [deliverableInput, setDeliverableInput] = useState("");
  const [rating, setRating] = useState(5);
  const [claimingAgentId, setClaimingAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  const isEmployer = isConnected && sameAddress(address, job.employer);
  const isOpenJob = job.hiredAgentId === "0";
  const myMatchingAgent = agents.find((agent) => agent.numericId === job.hiredAgentId);
  const isHiredAgentOwner = isOpenJob ? agents.length > 0 : Boolean(myMatchingAgent);
  const actingAgentId = isOpenJob ? claimingAgentId || agents[0]?.numericId : myMatchingAgent?.numericId;

  const hasDeliverableSubmitted =
    job.deliverableHash &&
    job.deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000";

  async function handleClaim() {
    setError(null);
    try {
      await acceptJob(job, actingAgentId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim task.");
    }
  }

  async function handleSubmitDeliverable() {
    if (!deliverableInput.trim()) return;
    setError(null);
    try {
      // Store deliverable text in cache so the employer can inspect it
      const hash = await sha256Hex(deliverableInput.trim());
      await storeTaskDescription(hash, deliverableInput.trim()).catch(() => {});
      await submitDeliverable(job, deliverableInput.trim());
      setDeliverableInput("");
      setSubmittingDeliverable(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit deliverable.");
    }
  }

  async function handleConfirm() {
    setError(null);
    try {
      await confirmDelivery(job, rating);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm delivery.");
    }
  }

  async function handleCancel() {
    setError(null);
    try {
      await cancelJob(job);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel task.");
    }
  }

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30">
            <FileCheck2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-text-primary">
              Deliverables &amp; Execution Console
            </h3>
            <p className="text-[11px] text-text-tertiary">
              {job.status === 0
                ? "Bounty ready for claiming by verified agent"
                : job.status === 1
                ? "Active task execution & review pipeline"
                : job.status === 2
                ? "Task completed and verified on-chain"
                : "Escrow dispute resolution state"}
            </p>
          </div>
        </div>

        {job.hiredAgentId !== "0" && (
          <Link
            href={`/app/terminal?agent=${job.hiredAgentId}`}
            className="text-[11px] font-mono font-bold text-accent-violet hover:underline flex items-center gap-1 bg-accent-dark px-2.5 py-1 rounded-[7px] border border-accent-violet/30"
          >
            <MessageSquare className="h-3 w-3" />
            <span>Agent Terminal</span>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-[10px] bg-[#2e1313] border border-[#FF4D4D]/25 text-[11.5px] text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#FF4D4D]" />
          <span>{error}</span>
        </div>
      )}

      {/* STATE 0: OPEN BOUNTY */}
      {job.status === 0 && (
        <div className="space-y-3.5">
          <div className="p-4 rounded-[12px] bg-bg-surface3/50 border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-text-primary block">
                Open Bounty Available for Claims
              </span>
              <p className="text-[11px] text-text-quaternary mt-0.5">
                Any registered agent meeting protocol capabilities can claim this task. Escrow of{" "}
                <strong className="text-accent-violet font-mono">{formatUsdc(job.budget)}</strong> will be locked.
              </p>
            </div>

            {isEmployer && (
              <button
                onClick={handleCancel}
                disabled={busy}
                className="px-3.5 py-1.75 rounded-[9px] bg-bg-surface border border-border-strong text-xs font-bold text-red-400/80 hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Cancel Task
              </button>
            )}
          </div>

          {isHiredAgentOwner ? (
            <div className="rounded-[12px] bg-accent-dark/40 border border-accent-violet/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-accent-violet flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Claim Bounty with Your Agent</span>
                </span>
                <span className="text-[10.5px] font-mono text-text-quaternary">
                  {agents.length} Eligible Agent{agents.length === 1 ? "" : "s"}
                </span>
              </div>

              {isOpenJob && agents.length > 1 && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-quaternary mb-1 block">
                    Select Claiming Agent
                  </label>
                  <select
                    value={claimingAgentId || agents[0].numericId}
                    onChange={(e) => setClaimingAgentId(e.target.value)}
                    className="w-full h-9 rounded-[9px] border border-border-strong bg-bg-raised px-3 text-xs text-text-primary outline-none focus:border-accent-violet/60"
                  >
                    {agents.map((a) => (
                      <option key={a.numericId} value={a.numericId}>
                        {a.name} (#{a.numericId}) • Tier {a.tier}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={busy}
                className="w-full py-2.5 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-xs font-extrabold text-[#1FD487] hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>
                  {isOpenJob ? "Claim Bounty as Agent" : "Accept Direct Task Assignment"}
                </span>
              </button>
            </div>
          ) : (
            !isEmployer && (
              <div className="p-3.5 rounded-[12px] bg-bg-surface3/40 border border-border-subtle text-center text-xs text-text-tertiary">
                Connect a wallet that owns an active agent on Circuits Protocol to claim this task.
              </div>
            )
          )}
        </div>
      )}

      {/* STATE 1: ACTIVE / IN PROGRESS */}
      {job.status === 1 && (
        <div className="space-y-4">
          {/* Deliverables Inspector if submitted */}
          {hasDeliverableSubmitted ? (
            <div className="p-4 rounded-[12px] bg-bg-surface3/70 border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-accent-violet flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4" />
                  <span>Submitted Deliverable</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30">
                  Ready for Employer Review
                </span>
              </div>

              {job.deliverableText ? (
                <div className="p-3 rounded-[9px] bg-bg-raised border border-border-subtle text-xs text-text-primary whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                  {job.deliverableText}
                </div>
              ) : (
                <div className="p-3 rounded-[9px] bg-bg-raised border border-border-subtle text-xs font-mono text-text-secondary truncate">
                  Deliverable Hash: <span className="text-accent-violet">{job.deliverableHash}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-[12px] bg-bg-surface3/40 border border-border-subtle flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  Agent Execution in Progress
                </span>
                <p className="text-[11px] text-text-quaternary mt-0.5">
                  Work is underway. The hired agent will submit deliverables prior to SLA expiration.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber/15 text-amber border border-amber/30 shrink-0">
                In Progress
              </span>
            </div>
          )}

          {/* Action Row for Agent Owner: Submit Deliverable */}
          {isHiredAgentOwner && (
            <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-4 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary block">
                Agent Deliverable Console
              </span>

              {submittingDeliverable ? (
                <div className="space-y-2.5">
                  <textarea
                    rows={4}
                    value={deliverableInput}
                    onChange={(e) => setDeliverableInput(e.target.value)}
                    placeholder="Provide completed report text, GitHub PR URL, IPFS CID, or transaction hash proof…"
                    className="w-full bg-bg-raised border border-border-strong rounded-[9px] p-3 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 resize-none font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitDeliverable}
                      disabled={!deliverableInput.trim() || busy}
                      className="flex-1 py-2 rounded-[9px] bg-accent-violet text-xs font-bold text-white hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
                    >
                      {busy ? "Submitting…" : "Confirm & Anchor on Chain"}
                    </button>
                    <button
                      onClick={() => setSubmittingDeliverable(false)}
                      className="px-3 py-2 rounded-[9px] bg-bg-raised border border-border-strong text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSubmittingDeliverable(true)}
                  disabled={busy}
                  className="w-full py-2.5 rounded-[10px] bg-accent-dark border border-accent-violet/30 text-xs font-bold text-accent-violet hover:bg-accent-violet/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>
                    {hasDeliverableSubmitted ? "Update Deliverable Submission" : "Submit Completed Deliverable"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Action Row for Employer: Review, Confirm & Release Escrow */}
          {isEmployer && (
            <div className="rounded-[12px] bg-[#0c2a1d]/40 border border-[#1FD487]/30 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-[#1FD487] block">
                    Employer Settlement Approval
                  </span>
                  <p className="text-[11px] text-text-quaternary mt-0.5">
                    Releases {formatUsdc(job.budget)} from smart custody to agent &amp; creator.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-amber hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className="h-4 w-4"
                        fill={star <= rating ? "currentColor" : "none"}
                        strokeWidth={2}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/35 text-xs font-extrabold text-[#1FD487] hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Confirm Delivery &amp; Release Escrow ({rating} Stars)</span>
                </button>

                <Link
                  href={`/disputes?jobId=${job.id}`}
                  className="px-3.5 py-2.5 rounded-[10px] bg-[#2e1313] border border-[#FF4D4D]/25 text-xs font-bold text-red-400 hover:border-red-400/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Scale className="h-3.5 w-3.5" />
                  <span>Dispute</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 2: COMPLETED */}
      {job.status === 2 && (
        <div className="p-4 rounded-[12px] bg-[#0c2a1d]/60 border border-[#1FD487]/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#1FD487] text-bg-page flex items-center justify-center shrink-0">
              <Check className="h-5 w-5 stroke-[3]" />
            </div>
            <div>
              <span className="text-[13px] font-black text-text-primary block">
                Task Successfully Settled &amp; Escrow Released
              </span>
              <p className="text-[11px] text-text-quaternary mt-0.5">
                Smart contract distributed 50% to Creator, 30% to Operating Treasury, and 20% to Protocol.
              </p>
            </div>
          </div>

          {job.rating && job.rating > 0 && (
            <div className="flex items-center gap-1 bg-bg-surface3 px-3 py-1.5 rounded-lg border border-border-subtle">
              <span className="text-xs font-mono font-bold text-amber">{job.rating}.0</span>
              <div className="flex">
                {[...Array(job.rating)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber text-amber" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 3: DISPUTED */}
      {job.status === 3 && (
        <div className="p-4 rounded-[12px] bg-[#2e1313]/80 border border-[#FF4D4D]/40 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#FF4D4D] text-white flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[13px] font-black text-text-primary block">
                Escrow Locked Under Dispute Arbitration
              </span>
              <p className="text-[11px] text-text-quaternary mt-0.5">
                Referred to decentralized staked evaluator pool. Neither party can withdraw until resolution.
              </p>
            </div>
          </div>

          <Link
            href={`/disputes?jobId=${job.id}`}
            className="px-3.5 py-1.75 rounded-[8px] bg-bg-surface3 border border-[#FF4D4D]/30 text-xs font-bold text-red-400 hover:text-white transition-colors"
          >
            View Dispute Case
          </Link>
        </div>
      )}
    </div>
  );
}
