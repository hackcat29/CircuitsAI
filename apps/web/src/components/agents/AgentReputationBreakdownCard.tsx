"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Award,
  Cpu,
  Activity,
  Coins,
  Bot,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  PieChart,
} from "lucide-react";
import {
  calculateAgentReputation,
  type AgentActivityInput,
  type AgentReputationBreakdown,
} from "@/lib/reputation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface AgentReputationBreakdownCardProps {
  agent?: AgentActivityInput;
  rep?: AgentReputationBreakdown;
  className?: string;
  defaultExpanded?: boolean;
}

export function AgentReputationBreakdownCard({
  agent,
  rep: initialRep,
  className,
  defaultExpanded = false,
}: AgentReputationBreakdownCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rep: AgentReputationBreakdown = initialRep ?? calculateAgentReputation(agent ?? {});

  return (
    <Card className={cn("border border-border-subtle bg-bg-elevated/80 shadow-xs overflow-hidden", className)}>
      <CardHeader className="pb-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-violet/15 text-accent-violet border border-accent-violet/25">
              <Award className="h-3.5 w-3.5" />
            </div>
            <div>
              <CardTitle className="text-[14.5px] font-extrabold text-text-primary tracking-tight flex items-center gap-2">
                <span>Reputation &amp; SLA Standing</span>
                <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold", rep.badgeBgClass)}>
                  Grade {rep.grade} · {rep.gradeLabel}
                </span>
              </CardTitle>
            </div>
          </div>

          <div className="text-right">
            <span className={cn("text-[20px] font-black font-mono tracking-tight", rep.gradeColorClass)}>
              {rep.effectiveScorePct.toFixed(1)}%
            </span>
          </div>
        </div>

        <CardDescription className="text-xs text-text-tertiary">
          On-chain reputation computed from verified tasks, capabilities, treasury balance, and ecosystem activity.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 text-xs">
        {/* Granular SLA Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-xl bg-bg-surface border border-border-subtle text-center space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Success Rate</div>
            <div className="text-[14px] font-extrabold font-mono text-emerald">{rep.sla.successRate}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-bg-surface border border-border-subtle text-center space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">On-Time Delivery</div>
            <div className="text-[14px] font-extrabold font-mono text-accent-cyan">{rep.sla.onTimeRate}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-bg-surface border border-border-subtle text-center space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Dispute Rate</div>
            <div className="text-[14px] font-extrabold font-mono text-text-primary">{rep.sla.disputeRate}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-bg-surface border border-border-subtle text-center space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Avg Response</div>
            <div className="text-[14px] font-extrabold font-mono text-accent-violet">{rep.sla.responseMs}ms</div>
          </div>
        </div>

        {/* Categories Overview Bars */}
        <div className="space-y-2.5 pt-1">
          {Object.entries(rep.categories).map(([key, cat]) => {
            const pct = Math.min(100, Math.round((cat.scoreBps / cat.maxBps) * 100));
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                    {key === "identity" && <ShieldCheck className="h-3 w-3 text-accent-violet" />}
                    {key === "tokenLaunch" && <Coins className="h-3 w-3 text-[#FF5C28]" />}
                    {key === "social" && <MessageSquare className="h-3 w-3 text-pink-400" />}
                    {key === "taskExecution" && <Activity className="h-3 w-3 text-emerald" />}
                    {key === "treasury" && <TrendingUp className="h-3 w-3 text-emerald" />}
                    {key === "capabilities" && <Cpu className="h-3 w-3 text-accent-cyan" />}
                    {key === "ecosystem" && <Layers className="h-3 w-3 text-purple-400" />}
                    <span>{cat.name}</span>
                  </span>
                  <span className="font-mono text-text-tertiary font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-violet transition-all duration-300"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expandable Detailed Proof Vector Factors */}
        <div className="pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-[11.5px] font-bold text-accent-violet hover:text-accent-violet/80 transition-colors py-1 cursor-pointer"
          >
            <span>{expanded ? "Hide Operational Proof Breakdown" : "View Operational Proof Vectors"}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 animate-in fade-in duration-200">
              {Object.entries(rep.categories).map(([key, cat]) => (
                <div key={key} className="p-3 rounded-xl bg-bg-surface border border-border-subtle/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-text-primary">
                    <span>{cat.name}</span>
                    <span className="font-mono text-text-tertiary">
                      +{cat.scoreBps} / {cat.maxBps} bps
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {cat.factors.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between text-text-secondary">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2
                            className={cn(
                              "h-3 w-3 shrink-0",
                              f.achieved ? "text-emerald" : "text-text-quaternary/40",
                            )}
                          />
                          <span className={cn(f.achieved ? "text-text-secondary" : "text-text-quaternary")}>
                            {f.label}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-text-quaternary">
                          {f.achieved ? `+${f.earnedBps} bps` : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
