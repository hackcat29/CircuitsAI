"use client";

import {
  X,
  Brain,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Scale,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Proposal } from "@/hooks";

interface ProposalAiAnalysisModalProps {
  proposal: Proposal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProposalAiAnalysisModal({
  proposal,
  isOpen,
  onClose,
}: ProposalAiAnalysisModalProps) {
  if (!isOpen || !proposal) return null;

  // Determine risk assessment and economic impact based on real proposal category & description
  const isTreasury = proposal.category === "treasury";
  const isParameters = proposal.category === "parameters";
  const isUpgrade = proposal.category === "upgrade";
  const isSkill = proposal.category === "skill";

  const riskLevel = isUpgrade ? "HIGH" : isTreasury ? "MEDIUM" : "LOW";
  const riskColor = riskLevel === "HIGH" ? "text-red-400 border-red-500/30 bg-red-500/10" : riskLevel === "MEDIUM" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" : "text-[#1FD487] border-[#1FD487]/30 bg-[#1FD487]/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-text-primary">AI Proposal Impact Analysis</h3>
              <p className="text-[11px] text-text-tertiary">Cognitive risk assessment &amp; parameter breakdown.</p>
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
          {/* Proposal Summary Card */}
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent-violet">
                Proposal #{proposal.chainProposalId} · {proposal.category}
              </span>
              <span className={cn("text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border", riskColor)}>
                {riskLevel} RISK
              </span>
            </div>
            <h4 className="text-[13.5px] font-extrabold text-text-primary leading-snug">{proposal.title}</h4>
          </div>

          {/* Core Impacts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-text-primary text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1FD487]" />
                <span>Security Impact</span>
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                {isUpgrade
                  ? "Requires formal contract verification before timelock release."
                  : "Within normal protocol governance safety bounds."}
              </p>
            </div>

            <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-text-primary text-[11px]">
                <TrendingUp className="h-3.5 w-3.5 text-accent-violet" />
                <span>Economic Impact</span>
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                {isTreasury
                  ? "Allocates protocol treasury funds to designated recipient."
                  : isParameters
                  ? "Adjusts fee rates or validator staking minimums on Monad."
                  : "Expands agent network utility and verified skills registry."}
              </p>
            </div>
          </div>

          {/* AI Key Insights Brief */}
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
              Autonomous Agent Perspective
            </span>
            <div className="text-[11.5px] text-text-secondary leading-relaxed space-y-1.5">
              <p>
                <strong>Proposed Action:</strong> {proposal.description}
              </p>
              <p>
                <strong>Voting Participation:</strong> {proposal.votedAgentChainIds.length} agents have cast on-chain votes. Quorum is at{" "}
                {((proposal.votesFor + proposal.votesAgainst) / Math.max(proposal.quorumRequired, 1) * 100).toFixed(0)}% of the required {proposal.quorumRequired.toLocaleString()} USDC bonded threshold.
              </p>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
