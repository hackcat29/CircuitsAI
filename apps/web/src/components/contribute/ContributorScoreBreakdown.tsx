"use client";

import { Award, Trophy, Users, Shield, Coins } from "lucide-react";

interface ContributorScoreBreakdownProps {
  totalScore: number;
  builderScore?: number;
  revenueScore?: number;
  launchpadBuyVolumeUsdc?: number;
  escrowFundedVolumeUsdc?: number;
  totalLeaderboardScore: number;
  protocolVolumeUsdc?: number;
  tierName: string;
  tierColor: string;
}

export function ContributorScoreBreakdown({
  totalScore,
  builderScore = 0,
  revenueScore = 0,
  launchpadBuyVolumeUsdc = 0,
  escrowFundedVolumeUsdc = 0,
  totalLeaderboardScore,
  tierName,
  tierColor,
}: ContributorScoreBreakdownProps) {
  const scorePercentage = totalLeaderboardScore > 0 ? (totalScore / totalLeaderboardScore) * 100 : 0;
  const totalVolumeContributed = launchpadBuyVolumeUsdc + escrowFundedVolumeUsdc;

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[14.5px] font-extrabold text-text-primary">Ecosystem Contributor Standing</h3>
            <p className="text-[11.5px] text-text-tertiary">On-chain activity score and builder rank across Circuits Protocol.</p>
          </div>
        </div>

        <span
          className="text-[10px] font-mono font-bold px-2.5 py-0.75 rounded-full border"
          style={{ color: tierColor, borderColor: `${tierColor}40`, background: `${tierColor}10` }}
        >
          {tierName} Tier Contributor
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <span className="text-[10px] font-sans font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Award className="h-3 w-3 text-accent-violet" />
            <span>Total Contributor Score</span>
          </span>
          <div className="font-extrabold text-[16px] text-text-primary">
            {totalScore.toLocaleString()} <span className="text-xs font-normal text-text-quaternary">pts</span>
          </div>
          <div className="text-[10px] text-text-quaternary font-sans">
            {scorePercentage > 0 ? `${scorePercentage.toFixed(1)}% of network points` : "Start completing quests"}
          </div>
        </div>

        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <span className="text-[10px] font-sans font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Coins className="h-3 w-3 text-amber-400" />
            <span>Revenue &amp; Capital Score</span>
          </span>
          <div className="font-extrabold text-[16px] text-amber-400">
            {revenueScore.toLocaleString()} <span className="text-xs font-normal text-text-quaternary">pts</span>
          </div>
          <div className="text-[10px] text-text-quaternary font-sans">
            {totalVolumeContributed > 0
              ? `$${totalVolumeContributed.toFixed(0)} USDC injected`
              : "Launchpad buys & escrows"}
          </div>
        </div>

        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <span className="text-[10px] font-sans font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Users className="h-3 w-3 text-[#1FD487]" />
            <span>Network Total Points</span>
          </span>
          <div className="font-extrabold text-[16px] text-[#1FD487]">
            {totalLeaderboardScore.toLocaleString()} <span className="text-xs font-normal text-text-quaternary">pts</span>
          </div>
          <div className="text-[10px] text-text-quaternary font-sans">Total points logged across builders</div>
        </div>

        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1">
          <span className="text-[10px] font-sans font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Shield className="h-3 w-3 text-amber-400" />
            <span>Tier Status</span>
          </span>
          <div className="font-extrabold text-[16px]" style={{ color: tierColor }}>
            {tierName} Tier
          </div>
          <div className="text-[10px] text-text-quaternary font-sans">Verifiable on-chain reputation</div>
        </div>
      </div>
    </div>
  );
}

// Alias for backward compatibility if imported elsewhere
export const ContributorRevenueShareEstimator = ContributorScoreBreakdown;
