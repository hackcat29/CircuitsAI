"use client";

import { CheckCircle2, XCircle, Users, Scale } from "lucide-react";
import { cn } from "@/lib/cn";

interface GovernanceQuorumGaugeProps {
  votesFor: number;
  votesAgainst: number;
  quorumRequired: number;
  status: string;
  className?: string;
}

export function GovernanceQuorumGauge({
  votesFor,
  votesAgainst,
  quorumRequired,
  status,
  className,
}: GovernanceQuorumGaugeProps) {
  const totalVotes = votesFor + votesAgainst;
  const quorumMet = totalVotes >= quorumRequired;
  const quorumPercent = quorumRequired > 0 ? Math.min(100, Math.round((totalVotes / quorumRequired) * 100)) : 100;

  const forPercent = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
  const againstPercent = totalVotes > 0 ? Math.round((votesAgainst / totalVotes) * 100) : 0;

  return (
    <div className={cn("p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5", className)}>
      {/* Header: Quorum status & Total vote weight */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 font-bold">
          <Users className="h-3.5 w-3.5 text-accent-violet" />
          <span className="text-text-primary">Quorum Progress</span>
          <span
            className={cn(
              "text-[9.5px] font-mono px-1.5 py-0.25 rounded-full border",
              quorumMet
                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                : "bg-bg-surface3 text-text-quaternary border-border-subtle",
            )}
          >
            {quorumMet ? "Quorum Met" : `${quorumPercent}% Reached`}
          </span>
        </div>

        <span className="font-mono text-text-quaternary text-[10.5px]">
          {totalVotes.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {quorumRequired.toLocaleString(undefined, { maximumFractionDigits: 1 })} USDC Bonded
        </span>
      </div>

      {/* Quorum Progress Bar */}
      <div className="h-2 w-full rounded-full bg-bg-surface3 overflow-hidden flex">
        {totalVotes > 0 ? (
          <>
            <div
              className="h-full bg-[#1FD487] transition-all duration-500"
              style={{ width: `${(votesFor / Math.max(quorumRequired, totalVotes)) * 100}%` }}
              title={`For: ${votesFor.toFixed(1)} USDC (${forPercent}%)`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${(votesAgainst / Math.max(quorumRequired, totalVotes)) * 100}%` }}
              title={`Against: ${votesAgainst.toFixed(1)} USDC (${againstPercent}%)`}
            />
          </>
        ) : (
          <div className="h-full w-full bg-bg-surface3" />
        )}
      </div>

      {/* Vote Breakdown Numbers */}
      <div className="flex items-center justify-between text-[10.5px] font-mono pt-0.5">
        <div className="flex items-center gap-1 text-[#1FD487] font-bold">
          <CheckCircle2 className="h-3 w-3" />
          <span>For: {votesFor.toLocaleString(undefined, { maximumFractionDigits: 1 })} USDC ({forPercent}%)</span>
        </div>

        <div className="flex items-center gap-1 text-red-400 font-bold">
          <XCircle className="h-3 w-3" />
          <span>Against: {votesAgainst.toLocaleString(undefined, { maximumFractionDigits: 1 })} USDC ({againstPercent}%)</span>
        </div>
      </div>
    </div>
  );
}
