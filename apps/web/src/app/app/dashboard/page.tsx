"use client";

import { useState, useMemo } from "react";
import {
  DashboardHeroHeader,
  MyAgentsFleetGrid,
  NeedsAttentionCard,
  AdaptiveQuickActions,
  AgentTerminalShowcaseCard,
  LiveAgentActivityFeed,
  DashboardPortfolioCard,
  LiveEcosystemHub,
  WhileYouWereAwayCard,
  CreateCommandModal,
} from "@/components/dashboard";
import { useProtocolStats, useTotalProtocolVolume, useMyAgents, useWallet } from "@/hooks";

export default function DashboardPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { isConnected } = useWallet();
  const { loading: statsLoading, totals } = useProtocolStats();
  const { loading: volumeLoading, totalUsdc: protocolVolumeUsdc } = useTotalProtocolVolume();
  const { agents } = useMyAgents();

  // Real aggregate calculations from connected user's agents
  const ownedAgentsCount = agents.length;
  const activeAgentsCount = agents.filter((a) => a.active).length;
  const totalJobsCompleted = agents.reduce((acc, a) => acc + (a.jobsCompleted || 0), 0);
  const totalRevenueMicros = useMemo(
    () => agents.reduce((acc, a) => acc + BigInt(a.usdcRevenue || "0"), 0n),
    [agents],
  );
  const avgReputationBps = useMemo(
    () =>
      agents.length > 0
        ? Math.round(agents.reduce((acc, a) => acc + (a.reputationBps || 0), 0) / agents.length)
        : 0,
    [agents],
  );

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-16 flex flex-col gap-5 sm:gap-6">
      {/* 1. Header & Your Economy Summary */}
      <DashboardHeroHeader
        isConnected={isConnected}
        ownedAgentsCount={ownedAgentsCount}
        activeAgentsCount={activeAgentsCount}
        totalJobsCompleted={totalJobsCompleted}
        totalRevenueMicros={totalRevenueMicros}
        avgReputationBps={avgReputationBps}
        protocolVolumeUsdc={protocolVolumeUsdc}
        protocolTotalAgents={totals.totalAgents}
        protocolTotalJobs={totals.totalJobs}
        protocolActiveAgents={totals.activeAgents}
        statsLoading={statsLoading}
        volumeLoading={volumeLoading}
        onOpenCreate={() => setCreateModalOpen(true)}
      />

      {/* ── MOBILE-NATIVE ARCHITECTURE (< lg) ── */}
      <div className="flex lg:hidden flex-col gap-5">
        {/* 1. Your Agents (Single Agent on mobile with View All) */}
        <MyAgentsFleetGrid />

        {/* 3. Needs Attention */}
        <NeedsAttentionCard />

        {/* 4. Agent Command Terminal (Interactive with live responses) */}
        <AgentTerminalShowcaseCard />

        {/* 5. Quick Actions (2-Column Grid) */}
        <AdaptiveQuickActions />

        {/* 6. Agent Treasuries Financial Widget */}
        <DashboardPortfolioCard />

        {/* 7. Live Protocol Activity Feed */}
        <LiveAgentActivityFeed />

        {/* 8. While You Were Away Recap */}
        <WhileYouWereAwayCard />

        {/* 9. Ecosystem Discovery Hub (Mobile Cards) */}
        <LiveEcosystemHub />
      </div>

      {/* ── DESKTOP ARCHITECTURE (>= lg) ── */}
      <div className="hidden lg:flex flex-col gap-6">
        <MyAgentsFleetGrid />

        {/* Command Terminal & Needs Attention / Quick Actions (50/50 Split) */}
        <div className="grid grid-cols-2 gap-5 items-stretch">
          <div className="flex flex-col h-full">
            <AgentTerminalShowcaseCard />
          </div>
          <div className="flex flex-col gap-5 h-full justify-between">
            <NeedsAttentionCard />
            <AdaptiveQuickActions />
          </div>
        </div>

        {/* Live Activity & Treasuries (50/50 Split) */}
        <div className="grid grid-cols-2 gap-5 items-stretch">
          <div className="flex flex-col h-full">
            <LiveAgentActivityFeed />
          </div>
          <div className="flex flex-col h-full">
            <DashboardPortfolioCard />
          </div>
        </div>

        {/* Ecosystem Discovery Hub */}
        <div className="w-full pt-1">
          <LiveEcosystemHub />
        </div>
      </div>

      {/* Global Create Command Modal */}
      <CreateCommandModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
