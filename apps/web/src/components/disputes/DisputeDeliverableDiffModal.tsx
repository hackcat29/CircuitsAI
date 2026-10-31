"use client";

import {
  X,
  FileCode,
  FileText,
  Scale,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc } from "@/lib/format";
import type { MarketplaceJob } from "@/hooks";

interface DisputeDeliverableDiffModalProps {
  job: MarketplaceJob | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DisputeDeliverableDiffModal({
  job,
  isOpen,
  onClose,
}: DisputeDeliverableDiffModalProps) {
  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-text-primary">Dispute Evidence &amp; Deliverables Inspector</h3>
              <p className="text-[11px] text-text-tertiary">Side-by-side verification of task brief vs. submitted deliverables.</p>
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
          {/* Metadata Card */}
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
            <div>
              <span className="text-text-quaternary">Escrow Job: </span>
              <span className="font-bold text-text-primary">#{job.id}</span>
            </div>
            <div>
              <span className="text-text-quaternary">Escrow Amount: </span>
              <span className="font-bold text-accent-violet">{formatUsdc(job.budget)}</span>
            </div>
            <div>
              <span className="text-text-quaternary">Agent Assigned: </span>
              <span className="font-bold text-text-secondary">#{job.hiredAgentId}</span>
            </div>
          </div>

          {/* Split Screen Diff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Employer Requirement Brief */}
            <div className="p-4 rounded-[12px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-[11px] font-bold text-text-primary flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Client Specification</span>
                </span>
                <span className="text-[9.5px] font-mono font-bold text-text-quaternary">ORIGINAL BRIEF</span>
              </div>

              <div className="p-3 rounded-[8px] bg-bg-raised border border-border-subtle font-mono text-[11.5px] text-text-secondary leading-relaxed overflow-y-auto max-h-56">
                Custom high-assurance deliverable requested via on-chain escrow contract on Monad (Job #{job.id}).
              </div>
            </div>

            {/* Right Column: Provider Agent Submission */}
            <div className="p-4 rounded-[12px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-[11px] font-bold text-text-primary flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-[#1FD487]" />
                  <span>Agent Deliverable Artifact</span>
                </span>
                <span className="text-[9.5px] font-mono font-bold text-[#1FD487]">DELIVERED ARTIFACT</span>
              </div>

              <div className="p-3 rounded-[8px] bg-bg-raised border border-border-subtle font-mono text-[11.5px] text-text-secondary leading-relaxed overflow-y-auto max-h-56 space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] text-[#1FD487]">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>On-chain delivery proof submitted by agent #{job.hiredAgentId}</span>
                </div>
                <div className="text-[10.5px] text-text-tertiary">
                  Evaluators verify whether deliverable matches the contract specification before casting sealed ballots.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[9px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
