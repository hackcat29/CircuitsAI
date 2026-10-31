"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bot,
  Workflow,
  BrainCircuit,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Layers,
  Coins,
  TrendingUp,
  Briefcase,
  Zap,
  Store,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ContributorEntry } from "@/lib/server/contributorScore";

interface ContributorQuestMatrixProps {
  entry: Partial<ContributorEntry>;
}

export function ContributorQuestMatrix({ entry }: ContributorQuestMatrixProps) {
  const [activeTab, setActiveTab] = useState<"all" | "revenue" | "builder">("all");

  const buyVol = entry.launchpadBuyVolumeUsdc ?? 0;
  const escrowsFunded = entry.escrowJobsFunded ?? 0;
  const escrowVol = entry.escrowFundedVolumeUsdc ?? 0;
  const serviceCalls = entry.serviceCallsCount ?? 0;
  const exchangeVol = entry.exchangeBidsVolumeUsdc ?? 0;

  const agentsRegistered = entry.agentsRegistered ?? 0;
  const pipelinesBuilt = entry.pipelinesBuilt ?? 0;
  const skillsPublished = entry.skillsPublished ?? 0;
  const projectsLaunched = entry.projectsLaunched ?? 0;
  const jobsCompleted = entry.jobsCompleted ?? 0;

  const quests = useMemo(() => [
    // --- REVENUE & CAPITAL QUESTS ---
    {
      id: "launchpad-backer",
      category: "revenue" as const,
      title: "Back a Launchpad Token",
      points: "+15 pts",
      desc: "Purchase ≥ $10 USDC in any bonding curve token to provide initial liquidity.",
      icon: Coins,
      completed: buyVol >= 10,
      progressPct: Math.min(100, Math.round((buyVol / 10) * 100)),
      countText: `$${buyVol.toFixed(0)} / $10 USDC`,
      actionLabel: "Buy Tokens",
      href: "/launchpad",
    },
    {
      id: "launchpad-volume",
      category: "revenue" as const,
      title: "Launchpad Volume Patron",
      points: "+50 pts",
      desc: "Accumulate $100+ USDC in Launchpad trading volume across agent curves.",
      icon: TrendingUp,
      completed: buyVol >= 100,
      progressPct: Math.min(100, Math.round((buyVol / 100) * 100)),
      countText: `$${buyVol.toFixed(0)} / $100 USDC`,
      actionLabel: "Trade Curves",
      href: "/launchpad",
    },
    {
      id: "escrow-funder",
      category: "revenue" as const,
      title: "Fund a Task Escrow (Client)",
      points: "+20 pts",
      desc: "Deposit USDC into a task escrow to hire autonomous agents for execution.",
      icon: Briefcase,
      completed: escrowsFunded > 0,
      progressPct: escrowsFunded > 0 ? 100 : 0,
      countText: `${escrowsFunded} funded ($${escrowVol.toFixed(0)})`,
      actionLabel: "Post Task",
      href: "/marketplace",
    },
    {
      id: "service-consumer",
      category: "revenue" as const,
      title: "Consume Paid Agent APIs (x402)",
      points: "+10 pts",
      desc: "Execute paid micropayment queries against verified agent service endpoints.",
      icon: Zap,
      completed: serviceCalls > 0,
      progressPct: serviceCalls > 0 ? 100 : 0,
      countText: `${serviceCalls} paid calls`,
      actionLabel: "Browse APIs",
      href: "/marketplace",
    },
    {
      id: "exchange-collector",
      category: "revenue" as const,
      title: "Acquire Agent on Exchange",
      points: "+25 pts",
      desc: "Place winning bids or acquire agent ownership on the secondary exchange.",
      icon: Store,
      completed: exchangeVol > 0,
      progressPct: exchangeVol > 0 ? 100 : 0,
      countText: `$${exchangeVol.toFixed(0)} traded`,
      actionLabel: "Explore Exchange",
      href: "/exchange",
    },

    // --- BUILDER & DEV QUESTS ---
    {
      id: "agent",
      category: "builder" as const,
      title: "Deploy an Agent",
      points: "+10 pts",
      desc: "Register a verified AI agent with cognitive layer persona on Monad.",
      icon: Bot,
      completed: agentsRegistered > 0,
      progressPct: agentsRegistered > 0 ? 100 : 0,
      countText: `${agentsRegistered} registered`,
      actionLabel: "Deploy Agent",
      href: "/register",
    },
    {
      id: "pipeline",
      category: "builder" as const,
      title: "Build an Orchestration Pipeline",
      points: "+15 pts",
      desc: "Create an interactive visual DAG pipeline connecting multiple agents.",
      icon: Workflow,
      completed: pipelinesBuilt > 0,
      progressPct: pipelinesBuilt > 0 ? 100 : 0,
      countText: `${pipelinesBuilt} pipelines`,
      actionLabel: "Open Canvas",
      href: "/orchestrate",
    },
    {
      id: "skill",
      category: "builder" as const,
      title: "Publish a Verified Skill",
      points: "+20 pts",
      desc: "Contribute an installable MCP tool or skill to the knowledge repository.",
      icon: BrainCircuit,
      completed: skillsPublished > 0,
      progressPct: skillsPublished > 0 ? 100 : 0,
      countText: `${skillsPublished} published`,
      actionLabel: "Publish Skill",
      href: "/knowledge",
    },
    {
      id: "launch",
      category: "builder" as const,
      title: "Launch a Bonding Token Project",
      points: "+25 pts",
      desc: "Deploy a fair-launch bonding curve token backed by USDC.",
      icon: Rocket,
      completed: projectsLaunched > 0,
      progressPct: projectsLaunched > 0 ? 100 : 0,
      countText: `${projectsLaunched} launched`,
      actionLabel: "Launch Token",
      href: "/launchpad/create",
    },
    {
      id: "jobs",
      category: "builder" as const,
      title: "Complete Marketplace Tasks",
      points: "+5 pts / 10 jobs",
      desc: "Fulfill client task escrows with verified high satisfaction.",
      icon: CheckCircle2,
      completed: jobsCompleted >= 10,
      progressPct: Math.min(100, Math.round((jobsCompleted / 10) * 100)),
      countText: `${jobsCompleted} / 10 completed`,
      actionLabel: "Browse Tasks",
      href: "/marketplace",
    },
  ], [
    buyVol,
    escrowsFunded,
    escrowVol,
    serviceCalls,
    exchangeVol,
    agentsRegistered,
    pipelinesBuilt,
    skillsPublished,
    projectsLaunched,
    jobsCompleted,
  ]);

  const filteredQuests = useMemo(() => {
    if (activeTab === "all") return quests;
    return quests.filter((q) => q.category === activeTab);
  }, [quests, activeTab]);

  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent-violet" />
          <h3 className="text-[14.5px] font-extrabold text-text-primary">Contributor Quests &amp; Actions</h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-bg-surface p-0.5 rounded-lg border border-border-subtle text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                activeTab === "all" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              All ({quests.length})
            </button>
            <button
              onClick={() => setActiveTab("revenue")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                activeTab === "revenue" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <Coins className="h-3 w-3" />
              <span>Revenue &amp; Capital</span>
            </button>
            <button
              onClick={() => setActiveTab("builder")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                activeTab === "builder" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <Bot className="h-3 w-3" />
              <span>Builders &amp; Devs</span>
            </button>
          </div>

          <span className="text-xs font-mono text-text-quaternary shrink-0">
            {completedCount}/{quests.length} Completed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredQuests.map((q) => {
          const Icon = q.icon;

          return (
            <div
              key={q.id}
              className={cn(
                "p-4 rounded-[14px] border transition-all flex flex-col justify-between gap-3",
                q.completed
                  ? "bg-[#0c2a1d]/30 border-[#1FD487]/30"
                  : "bg-bg-surface border-border-subtle hover:border-border-strong",
              )}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0",
                        q.completed
                          ? "bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30"
                          : q.category === "revenue"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-bg-surface3 text-text-tertiary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[13px] font-extrabold text-text-primary leading-tight">{q.title}</h4>
                        {q.category === "revenue" && (
                          <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-400 border border-amber-400/25">
                            Revenue
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-accent-violet font-bold">{q.points}</span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0",
                      q.completed
                        ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/40"
                        : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                    )}
                  >
                    {q.completed ? "Completed" : "In Progress"}
                  </span>
                </div>

                <p className="text-[11px] text-text-tertiary leading-relaxed">{q.desc}</p>

                {/* Progress bar for ongoing milestone quests */}
                {!q.completed && q.progressPct > 0 && (
                  <div className="pt-1">
                    <div className="h-1.5 bg-bg-surface3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-violet rounded-full transition-all duration-500"
                        style={{ width: `${q.progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-xs">
                <span className="font-mono text-[10.5px] text-text-quaternary">{q.countText}</span>
                <Link
                  href={q.href}
                  className="flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                >
                  <span>{q.actionLabel}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
