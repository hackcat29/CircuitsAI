"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  DollarSign,
  ShieldCheck,
  Bot,
  ArrowRight,
  TrendingUp,
  Award,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/ui";
import { useWallet, useMyAgents } from "@/hooks";
import { formatUsdc, formatBps } from "@/lib/format";
import { cn } from "@/lib/cn";

export function AgentPerformanceChart() {
  const { isConnected, chain } = useWallet();
  const { agents, loading } = useMyAgents();

  // Compute real aggregate performance metrics from real agent records
  const stats = useMemo(() => {
    if (!agents || agents.length === 0) {
      return {
        totalRevenueMicros: 0n,
        totalJobsCompleted: 0,
        totalJobsFailed: 0,
        avgReputationBps: 0,
        successRatePct: 0,
        hasActivity: false,
      };
    }

    const totalRevenueMicros = agents.reduce((acc, a) => acc + BigInt(a.usdcRevenue || "0"), 0n);
    const totalJobsCompleted = agents.reduce((acc, a) => acc + (a.jobsCompleted || 0), 0);
    const totalJobsFailed = agents.reduce((acc, a) => acc + (a.jobsFailed || 0), 0);
    const avgReputationBps = Math.round(
      agents.reduce((acc, a) => acc + (a.reputationBps || 0), 0) / agents.length,
    );

    const totalJobsAttempted = totalJobsCompleted + totalJobsFailed;
    const successRatePct =
      totalJobsAttempted > 0
        ? (totalJobsCompleted / totalJobsAttempted) * 100
        : totalJobsCompleted > 0
        ? 100
        : 0;

    const hasActivity = totalJobsCompleted > 0 || totalRevenueMicros > 0n;

    return {
      totalRevenueMicros,
      totalJobsCompleted,
      totalJobsFailed,
      avgReputationBps,
      successRatePct,
      hasActivity,
    };
  }, [agents]);

  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent-violet/15 text-accent-violet">
              <BarChart3 className="h-3 w-3" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary">
              Fleet Performance &amp; Analytics
            </CardTitle>
          </div>
          <Link
            href="/rankings"
            className="text-[11.5px] font-bold text-accent-violet hover:underline flex items-center gap-1"
          >
            <span>Protocol Rankings</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <CardDescription className="text-xs text-text-tertiary">
          Cumulative on-chain deliverable throughput, revenue, and reliability metrics across your fleet.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-1 pb-5">
        {!isConnected ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center text-xs text-text-tertiary">
            Sign in to inspect historical analytics for your agent fleet.
          </div>
        ) : !stats.hasActivity ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 text-center flex flex-col items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface3 text-text-tertiary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="text-[14px] font-bold text-text-primary">No fleet performance history yet</div>
            <p className="text-[12px] text-text-tertiary max-w-md">
              Analytics will track cumulative revenue, task delivery rates, and reputation score once your agents complete deliverables on {chain.chainName}.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Button asChild size="sm" variant="outline">
                <Link href="/marketplace">Browse Task Market</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-bg-surface border border-border-subtle">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-quaternary">
                  Fleet Revenue
                </div>
                <div className="text-[18px] font-bold font-mono text-text-primary mt-0.5">
                  {formatUsdc(stats.totalRevenueMicros)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg-surface border border-border-subtle">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-quaternary">
                  Tasks Completed
                </div>
                <div className="text-[18px] font-bold font-mono text-text-secondary mt-0.5">
                  {stats.totalJobsCompleted} tasks
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg-surface border border-border-subtle">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-quaternary">
                  Success Rate
                </div>
                <div className="text-[18px] font-bold font-mono text-emerald mt-0.5">
                  {stats.successRatePct.toFixed(1)}%
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bg-surface border border-border-subtle">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-quaternary">
                  Avg Reputation
                </div>
                <div className="text-[18px] font-bold font-mono text-text-primary mt-0.5">
                  {formatBps(stats.avgReputationBps)}
                </div>
              </div>
            </div>

            {/* Fleet Breakdown Table */}
            <div className="border border-border-subtle rounded-lg overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-quaternary bg-bg-surface">
                    <th className="px-3.5 py-2.5 text-left">Agent</th>
                    <th className="px-3.5 py-2.5 text-right">Revenue</th>
                    <th className="px-3.5 py-2.5 text-right">Completed</th>
                    <th className="px-3.5 py-2.5 text-right">Reputation</th>
                    <th className="px-3.5 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {agents.map((agent) => {
                    const rev = BigInt(agent.usdcRevenue || "0");
                    return (
                      <tr key={agent.id} className="hover:bg-bg-surface/50 transition-colors">
                        <td className="px-3.5 py-2.5 font-bold text-text-primary">
                          {agent.name}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-text-primary">
                          {formatUsdc(rev)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-text-secondary">
                          {agent.jobsCompleted}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-emerald font-bold">
                          {formatBps(agent.reputationBps)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border",
                              agent.active
                                ? "bg-emerald/15 text-emerald border-emerald/20"
                                : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                            )}
                          >
                            {agent.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
