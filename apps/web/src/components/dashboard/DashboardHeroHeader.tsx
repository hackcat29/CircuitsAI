"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  Bot,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Rocket,
  DollarSign,
  Activity,
} from "lucide-react";
import { useWallet, useSocialSession } from "@/hooks";
import { formatCount, formatUsdc, formatBps, truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface DashboardHeroHeaderProps {
  isConnected: boolean;
  ownedAgentsCount: number;
  activeAgentsCount: number;
  totalJobsCompleted: number;
  totalRevenueMicros: bigint;
  avgReputationBps: number;
  protocolVolumeUsdc: bigint;
  protocolTotalAgents: bigint;
  protocolTotalJobs: bigint;
  protocolActiveAgents: bigint;
  statsLoading: boolean;
  volumeLoading: boolean;
  onOpenCreate: () => void;
}

export function DashboardHeroHeader({
  isConnected,
  ownedAgentsCount,
  activeAgentsCount,
  totalJobsCompleted,
  totalRevenueMicros,
  avgReputationBps,
  protocolVolumeUsdc,
  protocolTotalAgents,
  protocolTotalJobs,
  protocolActiveAgents,
  statsLoading,
  volumeLoading,
  onOpenCreate,
}: DashboardHeroHeaderProps) {
  const { address, chain } = useWallet();
  const { profile } = useSocialSession();

  const userDisplayName = useMemo(() => {
    if (profile?.username) return `@${profile.username}`;
    if (profile?.displayName) return profile.displayName;
    if (profile?.walletAddress) return truncateAddress(profile.walletAddress);
    if (address) return truncateAddress(address);
    return null;
  }, [profile, address]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. Mobile Greeting (< sm) */}
      <div className="sm:hidden px-1 pt-1 pb-0">
        <h1 className="text-[17px] font-black tracking-tight text-text-primary">
          {isConnected && userDisplayName ? `Welcome back, ${userDisplayName}` : "Circuits Protocol"}
        </h1>
        <p className="text-[11.5px] text-text-quaternary mt-0.5 font-mono">
          Autonomous Fleet Operations
        </p>
      </div>

      {/* 2. Desktop Hero Header & Primary Economy Summary (>= sm) */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-3 bg-bg-elevated border border-border-subtle rounded-[16px] p-5 shadow-xs">
        <div>
          <span className="text-[11px] font-mono uppercase font-bold text-text-quaternary block mb-0.5">
            {isConnected && userDisplayName ? `Welcome back, ${userDisplayName}` : "Circuits Protocol Engine"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-black font-mono tracking-tight text-text-primary">
              {isConnected ? formatUsdc(totalRevenueMicros) : formatCount(protocolActiveAgents)}
            </span>
            <span className="text-xs font-bold text-text-tertiary font-mono">
              {isConnected ? "Total Earnings" : "Active Agents Online"}
            </span>
          </div>
        </div>

        {/* Global CTAs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreate}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create</span>
          </button>

          <Link
            href="/marketplace?create=1"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-text-secondary bg-bg-surface border border-border-strong hover:text-text-primary hover:border-border-hover transition-colors"
          >
            <Plus className="h-4 w-4 text-accent-violet" />
            <span>Post Job</span>
          </Link>
        </div>
      </div>

      {/* 3. Desktop 4-Metric Grid (Visible on >= sm) */}
      <div
        className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden border border-border-subtle shadow-xs"
        style={{ gap: "1px", background: "var(--color-border-subtle)" }}
      >
        {/* Metric 1: Your Agents / Active Agents */}
        <div className="bg-bg-elevated p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-emerald/15 text-emerald">
                <Bot className="h-3 w-3" />
              </div>
              <span className="text-[11px] font-semibold text-text-tertiary">
                {isConnected ? "Your Agents" : "Active Agents"}
              </span>
            </div>
            {isConnected && (
              <Link href="/agents?mine=1" className="text-text-quaternary hover:text-text-secondary transition-colors">
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div>
            <div className="text-[20px] sm:text-[22px] font-extrabold tracking-tight font-mono text-text-primary">
              {statsLoading ? (
                "···"
              ) : isConnected ? (
                <span>
                  {activeAgentsCount}{" "}
                  <span className="text-[12px] font-normal text-text-quaternary">
                    / {ownedAgentsCount} active
                  </span>
                </span>
              ) : (
                formatCount(protocolActiveAgents)
              )}
            </div>
            <div className="text-[11px] font-semibold text-text-quaternary mt-1">
              {isConnected
                ? ownedAgentsCount === 0
                  ? "No agents registered"
                  : `${activeAgentsCount} active`
                : `of ${formatCount(protocolTotalAgents)} registered`}
            </div>
          </div>
        </div>

        {/* Metric 2: Agent Revenue / Network Settlement */}
        <div className="bg-bg-elevated p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-amber/15 text-amber">
                <DollarSign className="h-3 w-3" />
              </div>
              <span className="text-[11px] font-semibold text-text-tertiary">
                {isConnected ? "Agent Revenue" : "Network Settlement"}
              </span>
            </div>
            {isConnected && (
              <Link href="/wallet" className="text-text-quaternary hover:text-text-secondary transition-colors">
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div>
            <div className="text-[20px] sm:text-[22px] font-extrabold tracking-tight font-mono text-text-primary">
              {isConnected ? formatUsdc(totalRevenueMicros) : "Sub-Second"}
            </div>
            <div className="text-[11px] font-semibold text-text-quaternary mt-1">
              {isConnected ? "Total revenue" : "Native USDC Gas • Chain 5042"}
            </div>
          </div>
        </div>

        {/* Metric 3: Tasks Completed */}
        <div className="bg-bg-elevated p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-purple/15 text-purple">
                <Activity className="h-3 w-3" />
              </div>
              <span className="text-[11px] font-semibold text-text-tertiary">
                {isConnected ? "Tasks Delivered" : "Total Tasks"}
              </span>
            </div>
            <Link href="/marketplace" className="text-text-quaternary hover:text-text-secondary transition-colors">
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div>
            <div className="text-[20px] sm:text-[22px] font-extrabold tracking-tight font-mono text-text-primary">
              {statsLoading ? (
                "···"
              ) : isConnected ? (
                totalJobsCompleted
              ) : (
                formatCount(protocolTotalJobs)
              )}
            </div>
            <div className="text-[11px] font-semibold text-text-quaternary mt-1">
              {isConnected ? "Completed tasks" : "Escrow tasks completed"}
            </div>
          </div>
        </div>

        {/* Metric 4: Avg Reputation / Network Health */}
        <div className="bg-bg-elevated p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent-violet/15 text-accent-violet">
                <ShieldCheck className="h-3 w-3" />
              </div>
              <span className="text-[11px] font-semibold text-text-tertiary">
                {isConnected ? "Avg Reputation" : "Active Runtimes"}
              </span>
            </div>
            <Link href="/rankings" className="text-text-quaternary hover:text-text-secondary transition-colors">
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div>
            <div className="text-[20px] sm:text-[22px] font-extrabold tracking-tight font-mono text-text-primary">
              {statsLoading ? (
                "···"
              ) : isConnected ? (
                ownedAgentsCount > 0 ? formatBps(avgReputationBps) : "N/A"
              ) : (
                formatCount(protocolActiveAgents)
              )}
            </div>
            <div className="text-[11px] font-semibold text-text-quaternary mt-1">
              {isConnected ? (ownedAgentsCount > 0 ? "Reputation score" : "No agents registered") : "Hosted & BYO agents online"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
