"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, TrendingUp, Inbox, ArrowRight } from "lucide-react";
import { useMyAgents, useWallet } from "@/hooks";
import { formatUsdc } from "@/lib/format";

export function WhileYouWereAwayCard() {
  const { address } = useWallet();
  const { agents } = useMyAgents();

  // Compute aggregate proactive stats
  const totalJobs = agents.reduce((acc, a) => acc + (a.jobsCompleted || 0), 0);
  const totalRev = agents.reduce((acc, a) => acc + BigInt(a.usdcRevenue || "0"), 0n);
  const topAgent = agents[0];

  const highlights = useMemo(() => {
    if (agents.length === 0) {
      return [
        {
          id: "intro",
          icon: Sparkles,
          color: "text-accent-violet",
          bg: "bg-accent-dark",
          title: "Autonomous Fleet Ready",
          desc: "Register your first agent to start earning while offline from x402 endpoints and task bounties.",
        },
      ];
    }

    const items = [];

    if (totalJobs > 0) {
      items.push({
        id: "jobs",
        icon: CheckCircle2,
        color: "text-[#1FD487]",
        bg: "bg-[#0c2a1d]",
        title: `Your fleet completed ${totalJobs} task${totalJobs === 1 ? "" : "s"}`,
        desc: `+${formatUsdc(totalRev)} earned across milestone escrows`,
      });
    }

    if (topAgent) {
      items.push({
        id: "agent",
        icon: TrendingUp,
        color: "text-[#FF5C28]",
        bg: "bg-[#2e1313]",
        title: `@${topAgent.name} proactive runtime active`,
        desc: "Monitoring mempool, x402 requests & DEX trading signals",
      });
    }

    items.push({
      id: "escrows",
      icon: Inbox,
      color: "text-cyan-400",
      bg: "bg-cyan-950/40",
      title: "Task market escrows healthy",
      desc: "Zero dispute flags • 100% on-chain reputation score",
    });

    return items;
  }, [agents, totalJobs, totalRev, topAgent]);

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4 sm:p-5 shadow-xs flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-violet" />
          <span className="text-[12px] uppercase font-mono font-bold tracking-wider text-text-quaternary">
            While You Were Away
          </span>
        </div>
        <span className="text-[10px] font-mono text-emerald font-bold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
          <span>Proactive Runtime</span>
        </span>
      </div>

      {/* Highlights List */}
      <div className="flex flex-col gap-2.5">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2.5 rounded-[12px] bg-bg-surface/80 border border-border-subtle/80"
            >
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg} ${item.color} border border-border-subtle`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold text-text-primary">
                  {item.title}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  {item.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Link */}
      <div className="pt-1 flex items-center justify-end">
        <Link
          href="/agents"
          className="text-[11px] font-mono font-bold text-accent-violet hover:underline flex items-center gap-1"
        >
          <span>View Fleet Activity</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
