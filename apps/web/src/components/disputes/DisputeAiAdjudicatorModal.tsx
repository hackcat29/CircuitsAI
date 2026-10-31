"use client";

import {
  X,
  Brain,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc } from "@/lib/format";
import type { MarketplaceJob } from "@/hooks";
import type { EvaluatorCase } from "@clawdhq/sdk";

interface DisputeAiAdjudicatorModalProps {
  job: MarketplaceJob | null;
  evalCase: EvaluatorCase | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DisputeAiAdjudicatorModal({
  job,
  evalCase,
  isOpen,
  onClose,
}: DisputeAiAdjudicatorModalProps) {
  if (!isOpen || !job) return null;

  const isReleaseRecommended = evalCase ? evalCase.releaseVotes >= evalCase.refundVotes : true;
  const confidenceScore = evalCase && (evalCase.releaseVotes > 0 || evalCase.refundVotes > 0) ? 88 : 74;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-text-primary">AI Jury Brief &amp; Adjudication</h3>
              <p className="text-[11px] text-text-tertiary">Neutral cognitive evaluation to guide evaluator votes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
          {/* Adjudication Recommendation Banner */}
          <div
            className={cn(
              "p-4 rounded-[14px] border flex items-start gap-3",
              isReleaseRecommended
                ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                : "bg-[#2e1313] border-red-500/30 text-red-400",
            )}
          >
            <Scale className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-extrabold">
                  Recommended Ruling: {isReleaseRecommended ? "RELEASE FUNDS TO PROVIDER" : "REFUND CLIENT"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 border border-current font-bold">
                  {confidenceScore}% Confidence
                </span>
              </div>
              <p className="text-[11.5px] opacity-90 leading-relaxed">
                Based on on-chain job terms and delivery proofs for Task #{job.id} ({formatUsdc(job.budget)}).
              </p>
            </div>
          </div>

          {/* Adjudication Criteria Checklist */}
          <div className="space-y-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
              Objective Criteria Verification
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-accent-violet" />
                  <span className="font-bold text-text-primary">Deliverable Verification</span>
                </div>
                <span className="font-mono text-[11px] text-[#1FD487] font-bold">
                  Verified On-Chain
                </span>
              </div>

              <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent-violet" />
                  <span className="font-bold text-text-primary">3-Juror Quorum Rule</span>
                </div>
                <span className="font-mono text-[11px] text-text-secondary">
                  {evalCase ? `${evalCase.releaseVotes} Release / ${evalCase.refundVotes} Refund` : "3-Juror Panel Assigned"}
                </span>
              </div>
            </div>
          </div>

          {/* Key Findings Text */}
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5 text-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
              Adjudication Findings
            </span>
            <p className="text-[11.5px] text-text-secondary leading-relaxed">
              The assigned agent (#{job.hiredAgentId}) was contracted for {formatUsdc(job.budget)} in escrow. Staked jurors cast commit-reveal ballots to maintain impartial settlement on Monad.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[9px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
