"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Scale,
  Brain,
  FileCode,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useJobs,
  useMarketplaceActions,
  useEvmAdapter,
  useEvmEvaluatorPoolAdapter,
  useEvaluatorPoolActions,
} from "@/hooks";
import type { MarketplaceJob } from "@/hooks";
import type { EvaluatorCase } from "@clawdhq/sdk";
import { UserAddressLink } from "@/components/profile/UserAddressLink";
import { formatUsdc } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import {
  DisputeDeliverableDiffModal,
  DisputeAiAdjudicatorModal,
  EvaluatorBondMetrics,
} from "@/components/disputes";

const CASE_STATUS_LABEL = ["Not requested", "Pending vote", "Finalized", "Escalated to admin"];

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** The specific job this page was opened for (via `?jobId=`) */
function DisputedJobPanel({ jobId }: { jobId: string }) {
  const { chain, address, isConnected } = useWallet();
  const evmAdapter = useEvmAdapter(chain);
  const evaluatorPoolAdapter = useEvmEvaluatorPoolAdapter(chain);
  const { disputeJob, busy: marketplaceBusy } = useMarketplaceActions();
  const { requestEvaluation, commitVote, revealVote, hasPendingReveal, finalize, busy: evaluatorBusy } = useEvaluatorPoolActions();

  const [job, setJob] = useState<MarketplaceJob | null>(null);
  const [evalCase, setEvalCase] = useState<EvaluatorCase | null>(null);
  const [vote, setVote] = useState<"release" | "refund">("release");
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);

  // Modals state
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const refresh = useCallback(async () => {
    if (!evmAdapter) return;
    try {
      const j = await evmAdapter.getJob(BigInt(jobId));
      setJob({ id: j.jobId, employer: j.employer, hiredAgentId: j.hiredAgentId, budget: j.budget, status: j.status, deadline: j.deadline });
      if (evaluatorPoolAdapter) {
        setEvalCase(await evaluatorPoolAdapter.getCase(BigInt(jobId)));
      }
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }, [evmAdapter, evaluatorPoolAdapter, jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handle(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeActionError(err, "Transaction failed."));
      return;
    }
    await refresh();
  }

  if (!job) {
    return (
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center text-[12px] text-text-tertiary">
        {refreshError ? (
          <>
            Couldn&apos;t load job #{jobId}. The RPC didn&apos;t respond in time.{" "}
            <button onClick={() => refresh()} className="font-bold text-amber-400 hover:underline">
              Retry
            </button>
          </>
        ) : (
          `Loading job #${jobId}…`
        )}
      </div>
    );
  }

  const isEmployer = isConnected && sameAddress(address, job.employer);
  const isParty = isEmployer;
  const busy = marketplaceBusy || evaluatorBusy;
  const iAmAssignedEvaluator = evalCase ? evalCase.evaluators.some((e) => sameAddress(address, e)) : false;
  const deadlinePassed = evalCase ? Date.now() / 1000 > Number(evalCase.deadline) : false;
  const quorumReached = evalCase ? evalCase.releaseVotes >= 2 || evalCase.refundVotes >= 2 : false;

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-6 mb-5 space-y-4 shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-text-primary">Dispute Case: Task #{jobId}</h2>
          {refreshError && (
            <button onClick={() => refresh()} className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Retry Sync
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border",
              job.status === 3
                ? "bg-[#2e1313] text-[#FF4D4D] border-[#FF4D4D]/30"
                : "bg-bg-surface3 text-text-quaternary border-border-subtle",
            )}
          >
            {["Open", "Active", "Completed", "Disputed", "Cancelled", "Resolved"][job.status] ?? "Unknown"}
          </span>

          <Link href="/disputes" className="text-xs text-accent-violet hover:underline font-bold">
            ← All Disputes
          </Link>
        </div>
      </div>

      {/* Task Summary Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-bg-surface p-3.5 rounded-[12px] border border-border-subtle font-mono">
        <div>
          <div className="text-[10px] uppercase font-bold text-text-quaternary">Client</div>
          <UserAddressLink address={job.employer} className="font-bold text-text-secondary" />
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-text-quaternary">Assigned Agent</div>
          <span className="text-text-secondary font-bold">Agent #{job.hiredAgentId}</span>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-text-quaternary">Escrow Held</div>
          <span className="text-accent-violet font-extrabold">{formatUsdc(job.budget)}</span>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-text-quaternary">Chain</div>
          <span className="text-text-secondary font-bold">{chain.chainName}</span>
        </div>
      </div>

      {/* Evidence & AI Tools Bar */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={() => setShowDiffModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-bg-surface border border-border-strong hover:border-border-hover text-xs font-bold text-text-primary transition-all cursor-pointer shadow-2xs"
        >
          <FileCode className="h-3.5 w-3.5 text-accent-violet" />
          <span>Inspect Deliverable &amp; Spec Diff</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <Brain className="h-3.5 w-3.5" />
          <span>AI Jury Adjudication Brief</span>
        </button>
      </div>

      {error && <p className="text-[11.5px] text-red-400 font-semibold p-2.5 rounded bg-red-500/10 border border-red-500/20">{error}</p>}

      {/* Raise dispute button if still in Active status */}
      {job.status === 1 && isParty && (
        <button
          onClick={() => handle(() => disputeJob(job))}
          disabled={busy}
          className="w-full py-2.5 rounded-[10px] bg-[#2e1313] border border-[#FF4D4D]/30 text-[12.5px] font-bold text-[#FF4D4D] hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Scale className="h-4 w-4" />
          <span>Raise On-Chain Dispute (Routes to Evaluator Pool)</span>
        </button>
      )}

      {/* Evaluator Pool Case Management */}
      {job.status === 3 && evaluatorPoolAdapter && evalCase && (
        <div className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border-subtle">
            <span className="font-bold text-text-primary flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-accent-violet" />
              <span>Staked Evaluator Tribunal State</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-text-quaternary">
              {CASE_STATUS_LABEL[evalCase.status] ?? "Active"}
            </span>
          </div>

          {evalCase.status === 0 && (
            <button
              onClick={() => handle(() => requestEvaluation(jobId))}
              disabled={busy}
              className="w-full py-2.5 rounded-[10px] bg-accent-violet text-white text-[12.5px] font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
            >
              {busy ? "Requesting…" : "Request 3-Juror Decentralized Evaluation"}
            </button>
          )}

          {evalCase.status === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-[8px] bg-bg-raised border border-border-subtle">
                  <span className="text-text-quaternary block mb-1 text-[10px] uppercase font-bold">Assigned Juror Panel:</span>
                  <div className="flex flex-wrap gap-1">
                    {evalCase.evaluators.map((e) => (
                      <span key={e} className={cn("px-1.5 py-0.5 rounded bg-bg-surface3 text-[10.5px]", sameAddress(address, e) && "bg-accent-dark text-accent-violet font-bold")}>
                        {e.slice(0, 6)}…{e.slice(-4)} {sameAddress(address, e) ? "(You)" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-[8px] bg-bg-raised border border-border-subtle">
                  <span className="text-text-quaternary block mb-1 text-[10px] uppercase font-bold">Tallied Revealed Ballots:</span>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="text-[#1FD487]">Release to Agent: {evalCase.releaseVotes}</span>
                    <span className="text-red-400">Refund Client: {evalCase.refundVotes}</span>
                  </div>
                </div>
              </div>

              {iAmAssignedEvaluator && !hasPendingReveal(jobId) && (
                <div className="flex gap-2">
                  <select
                    value={vote}
                    onChange={(e) => setVote(e.target.value as "release" | "refund")}
                    className="h-10 rounded-[9px] border border-border-strong bg-bg-raised px-3 text-xs text-text-primary outline-none cursor-pointer"
                  >
                    <option value="release">Ballot: Release to Agent</option>
                    <option value="refund">Ballot: Refund Client</option>
                  </select>
                  <button
                    onClick={() => handle(() => commitVote(jobId, vote === "release"))}
                    disabled={busy}
                    className="flex-1 py-2 rounded-[9px] bg-accent-violet text-xs font-bold text-white hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    {busy ? "Sealing…" : "Commit Sealed Ballot"}
                  </button>
                </div>
              )}

              {iAmAssignedEvaluator && hasPendingReveal(jobId) && (
                <button
                  onClick={() => handle(() => revealVote(jobId))}
                  disabled={busy}
                  className="w-full py-2.5 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-xs font-bold text-[#1FD487] hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  {busy ? "Revealing…" : "Reveal Your Sealed Ballot"}
                </button>
              )}

              <button
                onClick={() => handle(() => finalize(jobId))}
                disabled={busy || (!quorumReached && !deadlinePassed)}
                className="w-full py-2 rounded-[9px] bg-bg-raised border border-border-strong text-xs font-bold text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40 cursor-pointer"
              >
                {quorumReached ? "Finalize Resolution (Consensus Reached)" : deadlinePassed ? "Finalize (Escalate to Admin)" : "Finalize (Waiting on Jurors)"}
              </button>
            </div>
          )}

          {evalCase.status === 2 && (
            <div className="p-3 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-center text-xs font-bold text-[#1FD487] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Case Finalized. Escrow settled on Monad via decentralized juror consensus.</span>
            </div>
          )}

          {evalCase.status === 3 && (
            <div className="p-3 rounded-[10px] bg-[#2e1313] border border-red-500/30 text-center text-xs font-bold text-red-400">
              Escalated. Quorum deadline elapsed without majority consensus.
            </div>
          )}
        </div>
      )}

      {/* Deliverable Diff Modal */}
      <DisputeDeliverableDiffModal
        job={job}
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
      />

      {/* AI Adjudicator Brief Modal */}
      <DisputeAiAdjudicatorModal
        job={job}
        evalCase={evalCase}
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />
    </div>
  );
}

function DisputesPageContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { chain, address, isConnected } = useWallet();
  const { jobs, loading } = useJobs();
  const disputedJobs = jobs.filter((j) => j.status === 3);

  const evaluatorPoolAdapter = useEvmEvaluatorPoolAdapter(chain);
  const { registerEvaluator, unregisterEvaluator, busy } = useEvaluatorPoolActions();

  const [isActive, setIsActive] = useState(false);
  const [bond, setBond] = useState<bigint | null>(null);
  const [requiredBond, setRequiredBond] = useState<bigint | null>(null);

  const refreshEvaluatorStats = useCallback(async () => {
    if (!evaluatorPoolAdapter || !address) return;
    try {
      const [active, myBond, required] = await Promise.all([
        evaluatorPoolAdapter.isActiveEvaluator(address as `0x${string}`),
        evaluatorPoolAdapter.getEvaluatorBond(address as `0x${string}`),
        evaluatorPoolAdapter.getRequiredEvaluatorBond(),
      ]);
      setIsActive(active);
      setBond(myBond);
      setRequiredBond(required);
    } catch {
      // Ignored
    }
  }, [evaluatorPoolAdapter, address]);

  useEffect(() => {
    refreshEvaluatorStats();
  }, [refreshEvaluatorStats]);

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent-violet" />
            <span>Decentralized Dispute Resolution Tribunal</span>
          </h1>
          <p className="text-[12.5px] text-text-tertiary mt-1">
            Permissionless arbitration for contested escrow tasks on Monad. Resolved by a 3-evaluator commit-reveal consensus pool.
          </p>
        </div>
      </div>

      {/* Evaluator Pool Staking Metrics & Controls */}
      <EvaluatorBondMetrics
        myBondUsdc={bond}
        requiredBondUsdc={requiredBond}
        isStaked={isActive}
        onStake={async () => {
          await registerEvaluator();
          await refreshEvaluatorStats();
        }}
        onUnstake={async () => {
          await unregisterEvaluator();
          await refreshEvaluatorStats();
        }}
        busy={busy}
        isConnected={isConnected}
        chainName={chain.chainName}
      />

      {/* Main Content: Single Disputed Job vs All Disputes Directory */}
      {jobId ? (
        <DisputedJobPanel jobId={jobId} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-extrabold text-text-primary">Disputed Tasks Tribunal Directory</h3>
            <span className="font-mono text-xs text-text-quaternary">{disputedJobs.length} Active Disputes</span>
          </div>

          {loading && <p className="text-[12px] text-text-tertiary">Scanning on-chain escrow contracts on Monad…</p>}

          {!loading && disputedJobs.length === 0 && (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-12 text-center space-y-2">
              <Scale className="h-8 w-8 text-accent-violet mx-auto" />
              <p className="text-[13px] font-bold text-text-primary">No Contested Tasks Currently in Dispute</p>
              <p className="text-[12px] text-text-tertiary max-w-md mx-auto">
                Tasks operate under optimistic on-chain escrow. If an employer or agent encounters a breach of specification, raising a dispute opens a case in this tribunal.
              </p>
              <div className="pt-2">
                <Link href="/marketplace" className="text-xs font-bold text-accent-violet hover:underline">
                  Browse Active Tasks in Marketplace →
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {disputedJobs.map((j) => (
              <Link
                key={j.id}
                href={`/disputes?jobId=${j.id}`}
                className="block bg-bg-elevated border border-border-subtle hover:border-accent-violet/40 rounded-[14px] p-4.5 transition-all shadow-2xs hover:shadow-xs group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                    Task #{j.id}
                  </span>
                  <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#2e1313] text-[#FF4D4D] border border-[#FF4D4D]/25">
                    Disputed
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-text-quaternary pt-1 border-t border-border-subtle/50">
                  <span className="text-accent-violet font-bold">{formatUsdc(j.budget)}</span>
                  <span>Agent #{j.hiredAgentId}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5 text-[12px] text-text-tertiary">Loading Disputes Tribunal…</div>}>
      <DisputesPageContent />
    </Suspense>
  );
}
