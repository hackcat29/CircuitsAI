"use client";

import { useState } from "react";
import {
  X,
  Brain,
  Handshake,
  DollarSign,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc } from "@/lib/format";
import type { NegotiationSummary } from "@clawdhq/sdk";

interface NegotiationAiAssistantModalProps {
  negotiation: NegotiationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyTerms: (budgetUsdc: string, deadlineDays: string, rationale: string) => void;
}

export function NegotiationAiAssistantModal({
  negotiation,
  isOpen,
  onClose,
  onApplyTerms,
}: NegotiationAiAssistantModalProps) {
  if (!isOpen || !negotiation) return null;

  const currentBudgetNum = Number(negotiation.budget) / 1e6;
  const suggestedBudget = (currentBudgetNum * 1.2).toFixed(0);
  const suggestedDeadline = String(Math.max(2, Number(negotiation.deadlineDays)));
  const suggestedRationale = `Adjusting budget to $${suggestedBudget} USDC for high-assurance deliverables within a verified ${suggestedDeadline}-day SLA window on Monad.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-text-primary">AI Counter-Offer Formulator</h3>
              <p className="text-[11px] text-text-tertiary">Formulate optimal win-win terms based on market benchmarks.</p>
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
          {/* Current Terms Summary */}
          <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1 text-xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
              Current Offered Terms
            </span>
            <div className="flex items-center justify-between font-bold text-text-primary pt-0.5">
              <span>Opening Budget: {formatUsdc(negotiation.budget)}</span>
              <span>Deadline: {negotiation.deadlineDays.toString()} Days</span>
            </div>
            <div className="text-[10.5px] font-mono text-text-secondary pt-1">
              Task Hash: {negotiation.taskHash.slice(0, 10)}…{negotiation.taskHash.slice(-6)}
            </div>
          </div>

          {/* AI Recommended Adjusted Terms */}
          <div className="p-4 rounded-[14px] bg-[#0c2a1d] border border-[#1FD487]/30 text-[#1FD487] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Recommended Win-Win Counter-Offer</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 border border-[#1FD487]/40 font-bold">
                High Probability Agreement
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold">
              <div className="p-2.5 rounded-[8px] bg-black/20 border border-[#1FD487]/20">
                <span className="text-[10px] text-[#1FD487]/70 block">Target Budget</span>
                <span className="text-[14px]">${suggestedBudget} USDC</span>
              </div>
              <div className="p-2.5 rounded-[8px] bg-black/20 border border-[#1FD487]/20">
                <span className="text-[10px] text-[#1FD487]/70 block">Target SLA</span>
                <span className="text-[14px]">{suggestedDeadline} Days</span>
              </div>
            </div>

            <p className="text-[11.5px] text-text-primary leading-relaxed bg-black/20 p-2.5 rounded-[8px] border border-[#1FD487]/20">
              &ldquo;{suggestedRationale}&rdquo;
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[9px] bg-bg-surface3 border border-border-strong text-text-secondary text-xs font-bold hover:border-border-hover transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              onApplyTerms(suggestedBudget, suggestedDeadline, suggestedRationale);
              onClose();
            }}
            className="px-5 py-2 rounded-[9px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>Apply Recommended Terms</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
