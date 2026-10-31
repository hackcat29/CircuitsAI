"use client";

import { ShieldCheck, Scale, Lock, Unlock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc } from "@/lib/format";

interface EvaluatorBondMetricsProps {
  myBondUsdc: bigint | null;
  requiredBondUsdc: bigint | null;
  isStaked: boolean;
  onStake: () => Promise<void>;
  onUnstake: () => Promise<void>;
  busy: boolean;
  isConnected: boolean;
  chainName: string;
}

export function EvaluatorBondMetrics({
  myBondUsdc,
  requiredBondUsdc,
  isStaked,
  onStake,
  onUnstake,
  busy,
  isConnected,
  chainName,
}: EvaluatorBondMetricsProps) {
  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 space-y-4 shadow-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14.5px] font-extrabold text-text-primary">Permissionless Evaluator Pool</h3>
            <p className="text-[11.5px] text-text-tertiary">Stake a bond on {chainName} to resolve disputed tasks and earn resolution fees.</p>
          </div>
        </div>

        <span
          className={cn(
            "text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5",
            isStaked
              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
              : "bg-bg-surface3 text-text-quaternary border-border-subtle",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", isStaked ? "bg-[#1FD487] animate-pulse" : "bg-text-quaternary")} />
          <span>{isStaked ? "Active Bond Staked" : "Unbonded"}</span>
        </span>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <div className="text-[10px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <Lock className="h-3 w-3 text-accent-violet" />
            <span>Required Juror Bond</span>
          </div>
          <div className="font-mono text-[14px] font-extrabold text-text-primary">
            {requiredBondUsdc !== null ? formatUsdc(requiredBondUsdc) : "$50.00"}
          </div>
          <div className="text-[10px] text-text-quaternary">Refunded upon unstaking</div>
        </div>

        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <div className="text-[10px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-[#1FD487]" />
            <span>Your Staked Balance</span>
          </div>
          <div className="font-mono text-[14px] font-extrabold text-[#1FD487]">
            {myBondUsdc !== null ? formatUsdc(myBondUsdc) : "$0.00"}
          </div>
          <div className="text-[10px] text-text-quaternary">{isStaked ? "Eligible for random panel selection" : "Stake to qualify for panels"}</div>
        </div>

        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <div className="text-[10px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <Scale className="h-3 w-3 text-[#F5A623]" />
            <span>Commit-Reveal Quorum</span>
          </div>
          <div className="font-mono text-[14px] font-extrabold text-text-primary">
            3-Evaluator Majority
          </div>
          <div className="text-[10px] text-text-quaternary">2/3 consensus required to finalize</div>
        </div>
      </div>

      {/* Action Strip */}
      <div className="pt-2 border-t border-border-subtle flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-text-tertiary">
          Evaluator panels commit sealed hash votes before revealing to prevent frontrunning and collusion.
        </p>

        {isConnected && (
          <div className="flex items-center gap-2">
            {!isStaked ? (
              <button
                type="button"
                disabled={busy}
                onClick={onStake}
                className="px-4 py-2 rounded-full bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {busy ? "Staking…" : "Stake Evaluator Bond"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onUnstake}
                className="px-4 py-2 rounded-full bg-bg-surface3 border border-border-strong text-text-secondary hover:text-text-primary text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {busy ? "Unstaking…" : "Unstake Bond"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
