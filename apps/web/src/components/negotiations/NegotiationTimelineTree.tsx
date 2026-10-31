"use client";

import { Handshake, ArrowDown, CheckCircle2, Clock, DollarSign, User, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc } from "@/lib/format";
import type { NegotiationSummary } from "@clawdhq/sdk";

interface NegotiationTimelineTreeProps {
  negotiation: NegotiationSummary;
}

export function NegotiationTimelineTree({ negotiation }: NegotiationTimelineTreeProps) {
  const isAgreed = negotiation.status === 2;
  const isCommitted = negotiation.status === 3;
  const isCountered = negotiation.status === 1;
  const isProposed = negotiation.status === 0;

  return (
    <div className="p-4 rounded-[14px] bg-bg-surface border border-border-subtle space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-accent-violet" />
          <span>Negotiation Terms Timeline</span>
        </span>
        <span className="text-[10px] font-mono font-bold text-accent-violet">
          Round #{isProposed ? 1 : 2}
        </span>
      </div>

      {/* Step 1: Initial Offer */}
      <div className="flex items-start gap-3 text-xs">
        <div className="flex flex-col items-center">
          <div className="h-7 w-7 rounded-full bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet text-[11px] font-extrabold">
            1
          </div>
          <div className="w-0.5 h-8 bg-border-strong my-1" />
        </div>

        <div className="flex-1 p-3 rounded-[10px] bg-bg-raised border border-border-subtle space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-text-primary">Opening Terms (Client Proposal)</span>
            <span className="font-mono text-accent-violet font-bold">{formatUsdc(negotiation.budget)}</span>
          </div>
          <div className="text-[11px] font-mono text-text-secondary">
            Task Hash: {negotiation.taskHash.slice(0, 10)}…{negotiation.taskHash.slice(-6)}
          </div>
          <div className="text-[10px] text-text-quaternary font-mono">
            Client: {negotiation.client.slice(0, 6)}… · SLA: {negotiation.deadlineDays.toString()} Days
          </div>
        </div>
      </div>

      {/* Step 2: Counter-Offer or Active State */}
      <div className="flex items-start gap-3 text-xs">
        <div className="flex flex-col items-center">
          <div
            className={cn(
              "h-7 w-7 rounded-full border flex items-center justify-center text-[11px] font-extrabold",
              isCountered || isAgreed || isCommitted
                ? "bg-[#0c2a1d] border-[#1FD487]/40 text-[#1FD487]"
                : "bg-bg-surface3 border-border-subtle text-text-quaternary",
            )}
          >
            2
          </div>
        </div>

        <div
          className={cn(
            "flex-1 p-3 rounded-[10px] border space-y-1",
            isCountered || isAgreed || isCommitted
              ? "bg-bg-raised border-accent-violet/40 shadow-2xs"
              : "bg-bg-surface3/40 border-dashed border-border-subtle",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-text-primary">
              {isCountered ? "Counter-Offer Active" : isAgreed ? "Terms Mutually Agreed" : isCommitted ? "Committed into Escrow" : "Awaiting Counter-Offer"}
            </span>
            <span className="font-mono text-[11px] text-[#1FD487] font-bold">
              {isCountered || isAgreed || isCommitted ? `${formatUsdc(negotiation.budget)} · ${negotiation.deadlineDays.toString()}d` : "Pending"}
            </span>
          </div>

          <p className="text-[11px] text-text-tertiary">
            {isCommitted
              ? "Escrow deposit confirmed on Monad. Task is active in the Marketplace."
              : isAgreed
              ? "Both parties accepted terms. Ready for 1-click escrow deposit."
              : isCountered
              ? "Provider adjusted budget and SLA. Client or Provider may accept or re-counter."
              : "Counterparty can counter-offer with adjusted pricing or SLA parameters."}
          </p>
        </div>
      </div>
    </div>
  );
}
