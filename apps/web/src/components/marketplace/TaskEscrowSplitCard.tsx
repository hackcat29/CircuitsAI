"use client";

import { UserCheck, Bot, Scale, Lock } from "lucide-react";
import type { JobDetail } from "@/hooks/useJob";
import { formatUsdc } from "@/lib/format";

export function TaskEscrowSplitCard({ job }: { job: JobDetail }) {
  const budgetMicros = job.budget;
  const creatorPayoutMicros = (budgetMicros * 50n) / 100n;
  const agentTreasuryMicros = (budgetMicros * 30n) / 100n;
  const protocolPoolMicros = budgetMicros - creatorPayoutMicros - agentTreasuryMicros;

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 sm:p-5.5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-text-primary">
              Escrow &amp; Payout Allocation
            </h3>
            <p className="text-[11px] text-text-tertiary">
              Settled on-chain upon employer confirmation
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-secondary border border-border-subtle">
          Contract Escrow
        </span>
      </div>

      {/* Escrow Total Callout */}
      <div className="p-3.5 rounded-[12px] bg-bg-surface3/40 border border-border-subtle flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block mb-0.5">
            Locked Escrow Amount
          </span>
          <span className="text-2xl font-black font-mono text-accent-violet">
            {formatUsdc(budgetMicros)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-text-secondary font-bold">
            Settlement: USDC
          </span>
          <span className="text-[10px] text-text-quaternary mt-0.5 block">Automated split</span>
        </div>
      </div>

      {/* 3-Way Split Breakdown */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block">
          Payout Distribution
        </span>

        <div className="grid grid-cols-1 gap-2">
          {/* 50% Creator */}
          <div className="p-2.5 rounded-[10px] bg-bg-surface3/40 border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[#1FD487]/15 text-[#1FD487] flex items-center justify-center">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-text-primary block">
                  Creator / Owner (50%)
                </span>
                <span className="text-[10px] text-text-quaternary block">
                  Direct transfer upon completion
                </span>
              </div>
            </div>
            <span className="text-[12px] font-mono font-bold text-[#1FD487]">
              {formatUsdc(creatorPayoutMicros)}
            </span>
          </div>

          {/* 30% Agent Treasury */}
          <div className="p-2.5 rounded-[10px] bg-bg-surface3/40 border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-accent-violet/15 text-accent-violet flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-text-primary block">
                  Agent Treasury (30%)
                </span>
                <span className="text-[10px] text-text-quaternary block">
                  Operational runtime balance
                </span>
              </div>
            </div>
            <span className="text-[12px] font-mono font-bold text-accent-violet">
              {formatUsdc(agentTreasuryMicros)}
            </span>
          </div>

          {/* 20% Protocol & Evaluators */}
          <div className="p-2.5 rounded-[10px] bg-bg-surface3/40 border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-amber/15 text-amber flex items-center justify-center">
                <Scale className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-[11.5px] font-bold text-text-primary block">
                  Protocol &amp; Arbiters (20%)
                </span>
                <span className="text-[10px] text-text-quaternary block">
                  Dispute staking and network security
                </span>
              </div>
            </div>
            <span className="text-[12px] font-mono font-bold text-text-secondary">
              {formatUsdc(protocolPoolMicros)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
