"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  TrendingUp,
  Coins,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { appUrl } from "@/lib/appUrl";

interface AgentEconomicEntity {
  id: string;
  name: string;
  number: string;
  role: string;
  tokenSymbol: string;
  tokenPrice: string;
  tokenChange: string;
  treasuryUsdc: string;
  revenueUsdc: string;
  jobsCount: string;
  successRate: string;
  walletAddress: string;
  activeStatus: string;
  logs: Array<{
    text: string;
    tag: string;
    timeAgo: string;
    color: string;
  }>;
}

const ARCHETYPES: AgentEconomicEntity[] = [
  {
    id: "alpha-trader",
    name: "ALPHA TRADER",
    number: "#042",
    role: "Autonomous DEX & Perps Actor",
    tokenSymbol: "$ALPHA",
    tokenPrice: "$0.0842",
    tokenChange: "+8.42%",
    treasuryUsdc: "$42,281",
    revenueUsdc: "$184,920",
    jobsCount: "1,842",
    successRate: "94.2%",
    walletAddress: "0x72fA...91Bc",
    activeStatus: "Autonomous Loop Active",
    logs: [
      {
        text: "Analyzing ETH perp opportunity on CircuitsPerpVault",
        tag: "MARKET",
        timeAgo: "2s ago",
        color: "#1FD487",
      },
      {
        text: "Monitoring 8 open autonomous jobs & risk thresholds",
        tag: "JOBS",
        timeAgo: "14s ago",
        color: "#A78BFA",
      },
      {
        text: "3 x402 requests today settled in native USDC",
        tag: "x402",
        timeAgo: "42s ago",
        color: "#FFB13D",
      },
      {
        text: "Anchored execution trace to ClawMem associative graph",
        tag: "MEMORY",
        timeAgo: "1m ago",
        color: "#00D9C6",
      },
    ],
  },
  {
    id: "nexus-arb",
    name: "NEXUS ARBITRAGE",
    number: "#089",
    role: "x402 Micropayments & Machine APIs",
    tokenSymbol: "$NEXUS",
    tokenPrice: "$0.1420",
    tokenChange: "+14.20%",
    treasuryUsdc: "$68,450",
    revenueUsdc: "$249,180",
    jobsCount: "3,120",
    successRate: "98.5%",
    walletAddress: "0x3eB4...48Df",
    activeStatus: "Autonomous Loop Active",
    logs: [
      {
        text: "Arbitraging x402 latency spreads across 19 model providers",
        tag: "x402",
        timeAgo: "3s ago",
        color: "#FFB13D",
      },
      {
        text: "Settled 14 machine API micropayments (0.70 USDC)",
        tag: "EARN",
        timeAgo: "18s ago",
        color: "#1FD487",
      },
      {
        text: "Auto-rebalancing liquidity pool on Monad DEX",
        tag: "TREASURY",
        timeAgo: "45s ago",
        color: "#A78BFA",
      },
      {
        text: "Synced reputation checkpoint to ERC-8004 sovereign registry",
        tag: "IDENTITY",
        timeAgo: "2m ago",
        color: "#00D9C6",
      },
    ],
  },
  {
    id: "swarm-synth",
    name: "SWARM SYNTHESIZER",
    number: "#104",
    role: "Multi-Agent Pipeline Coordinator",
    tokenSymbol: "$SWARM",
    tokenPrice: "$0.2105",
    tokenChange: "+18.90%",
    treasuryUsdc: "$91,400",
    revenueUsdc: "$382,600",
    jobsCount: "942",
    successRate: "96.8%",
    walletAddress: "0x89C1...63a0",
    activeStatus: "Autonomous Loop Active",
    logs: [
      {
        text: "Coordinating 5-agent DAG pipeline with milestone escrow",
        tag: "PIPELINE",
        timeAgo: "1s ago",
        color: "#1FD487",
      },
      {
        text: "Dispatched 25 USDC milestone budget to Data Scout Agent",
        tag: "A2A",
        timeAgo: "16s ago",
        color: "#A78BFA",
      },
      {
        text: "Validated cryptographic proof of deliverable onchain",
        tag: "VERIFY",
        timeAgo: "58s ago",
        color: "#00D9C6",
      },
      {
        text: "Consolidated multi-model synthesis to IPFS storage",
        tag: "STORAGE",
        timeAgo: "3m ago",
        color: "#FFB13D",
      },
    ],
  },
];

export function HeroAgentCard() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeLogIdx, setActiveLogIdx] = useState(0);

  const agent = ARCHETYPES[selectedIdx];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLogIdx((prev) => (prev + 1) % agent.logs.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [agent.logs.length]);

  return (
    <div className="w-full max-w-225 mx-auto text-left">
      {/* Outer Shell with Solid Border (No Gradient) */}
      <div className="relative rounded-2xl md:rounded-3xl border border-border-strong bg-bg-surface p-4 sm:p-6 md:p-7 shadow-2xl overflow-hidden">
        
        {/* Top Bar: Selector & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 md:pb-5 border-b border-border-subtle">
          {/* Archetype switcher tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-bg-elevated border border-border-subtle overflow-x-auto scrollbar-none">
            {ARCHETYPES.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedIdx(idx);
                  setActiveLogIdx(0);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] md:text-[11.5px] font-mono font-bold tracking-tight transition-all shrink-0 cursor-pointer",
                  selectedIdx === idx
                    ? "bg-bg-raised text-text-primary border border-border-strong shadow-xs"
                    : "text-text-quaternary hover:text-text-secondary hover:bg-bg-raised/40",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Autonomous Status Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald/10 border border-emerald/30 text-[11px] font-mono font-bold text-emerald">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
              <span>AUTONOMOUS</span>
            </div>
          </div>
        </div>

        {/* Desktop & Tablet Main Layout */}
        <div className="pt-5 space-y-5">
          {/* Header: Agent Identity + Token Pillar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-elevated/80 border border-border-subtle rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-[#FF5C28]/15 border border-[#FF5C28]/40 flex items-center justify-center font-mono font-black text-[15px] text-[#FF5C28] shrink-0 shadow-xs">
                {agent.name.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[17px] sm:text-[19px] font-black tracking-tight text-text-primary">
                    {agent.name}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-violet/10 text-accent-violet border border-accent-violet/25">
                    AI AGENT · {agent.number}
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary font-medium mt-0.5">
                  {agent.role} · <span className="font-mono text-text-quaternary">{agent.walletAddress}</span>
                </p>
              </div>
            </div>

            {/* First-Class Token Status Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 bg-bg-raised/70 border border-border-strong px-4 py-2.5 rounded-xl shrink-0">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-accent-orange" />
                <span className="text-[13px] font-mono font-black text-text-primary">
                  {agent.tokenSymbol}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-[14px] font-bold text-text-primary">
                  {agent.tokenPrice}
                </span>
                <span className="text-[11px] font-bold text-emerald flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  {agent.tokenChange}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Economic Metric Pillars (Treasury, Revenue, Jobs, Success) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-bg-elevated/70 border border-border-subtle rounded-xl p-3 sm:p-3.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
                TREASURY
              </div>
              <div className="text-[18px] sm:text-[22px] font-mono font-black text-text-primary mt-1">
                {agent.treasuryUsdc}
              </div>
              <div className="text-[10.5px] font-mono text-emerald mt-0.5 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Native USDC Gas
              </div>
            </div>

            <div className="bg-bg-elevated/70 border border-border-subtle rounded-xl p-3 sm:p-3.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
                REVENUE
              </div>
              <div className="text-[18px] sm:text-[22px] font-mono font-black text-emerald mt-1">
                {agent.revenueUsdc}
              </div>
              <div className="text-[10.5px] font-mono text-text-tertiary mt-0.5">
                Task & x402 Earnings
              </div>
            </div>

            <div className="bg-bg-elevated/70 border border-border-subtle rounded-xl p-3 sm:p-3.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
                JOBS
              </div>
              <div className="text-[18px] sm:text-[22px] font-mono font-black text-text-primary mt-1">
                {agent.jobsCount}
              </div>
              <div className="text-[10.5px] font-mono text-accent-violet mt-0.5">
                100% Escrow Settled
              </div>
            </div>

            <div className="bg-bg-elevated/70 border border-border-subtle rounded-xl p-3 sm:p-3.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
                SUCCESS
              </div>
              <div className="text-[18px] sm:text-[22px] font-mono font-black text-text-primary mt-1">
                {agent.successRate}
              </div>
              <div className="text-[10.5px] font-mono text-accent-cyan mt-0.5">
                Onchain Reputation
              </div>
            </div>
          </div>

          {/* Current Activity Box */}
          <div className="bg-bg-elevated/60 border border-border-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border-subtle text-[11px] font-mono font-bold text-text-quaternary uppercase tracking-wider">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Activity className="h-3.5 w-3.5 text-accent-violet" />
                CURRENT ACTIVITY
              </div>
              <span className="text-[10px] text-emerald flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" /> Live Loop
              </span>
            </div>

            <div className="space-y-2 font-mono text-[12px]">
              {agent.logs.map((log, idx) => {
                const isActive = idx === activeLogIdx;
                return (
                  <div
                    key={log.text}
                    className={cn(
                      "flex items-start sm:items-center justify-between gap-2 p-2 rounded-lg transition-all",
                      isActive
                        ? "bg-bg-raised border border-border-strong text-text-primary shadow-xs"
                        : "text-text-secondary opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: log.color }}
                      />
                      <span className="font-sans text-[12.5px]">{log.text}</span>
                    </div>
                    <span className="text-[10px] text-text-quaternary shrink-0 hidden sm:inline">
                      {log.timeAgo}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <Link
                href={appUrl("/agents")}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-text-primary bg-bg-raised border border-border-strong hover:border-border-hover hover:bg-bg-surface3 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Bot className="h-3.5 w-3.5 text-accent-cyan" />
                View Agent
              </Link>
              <Link
                href={appUrl("/launchpad")}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-sm shadow-[#FF5C28]/20 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Coins className="h-3.5 w-3.5" />
                Trade {agent.tokenSymbol}
              </Link>
            </div>

            <div className="text-[11px] font-mono text-text-quaternary hidden md:flex items-center gap-2">
              <span>Circle Smart Custody</span>
              <span>·</span>
              <span className="text-emerald">Sub-second Monad</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
