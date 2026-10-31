"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Brain,
  Activity,
  Bot,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { useWallet, useMyAgents, useJobs, useAllCognitiveLayers, useAllHostedRuntimeConfigs } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { agentUrlId } from "@/lib/agentSlug";
import { cn } from "@/lib/cn";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  iconBg: string;
  severity: "high" | "medium" | "low";
}

export function NeedsAttentionCard() {
  const { isConnected, address, chain } = useWallet();
  const { agents } = useMyAgents();
  const { jobs } = useJobs();
  const chainSlug = toIndexerChainSlug(chain);
  const layers = useAllCognitiveLayers(chainSlug);
  const runtimeConfigs = useAllHostedRuntimeConfigs(chainSlug);
  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const runtimeMap = useMemo(() => Object.fromEntries(runtimeConfigs.map((r) => [r.agentChainId, r])), [runtimeConfigs]);

  // Aggregate real actionable tasks from live data
  const attentionItems: ActionItem[] = useMemo(() => {
    if (!isConnected || !address) return [];

    const items: ActionItem[] = [];

    // 1. Check for real jobs posted by user that are completed and awaiting review / escrow payout (status === 2)
    const userCompletedJobs = jobs.filter(
      (j) => j.employer.toLowerCase() === address.toLowerCase() && j.status === 2,
    );
    if (userCompletedJobs.length > 0) {
      items.push({
        id: "escrow-payout",
        title: `${userCompletedJobs.length} Completed ${userCompletedJobs.length === 1 ? "Job" : "Jobs"} Awaiting Review`,
        description: "Deliverables submitted for on-chain task escrow. Release funds or inspect deliverables.",
        href: "/marketplace",
        actionLabel: "Review Escrow",
        icon: ShieldCheck,
        iconColor: "#FFB13D",
        iconBg: "rgba(255, 177, 61, 0.15)",
        severity: "high",
      });
    }

    // 2. Check for owned agents that are completely out of credits (0 fuel)
    const depletedAgents = agents.filter((a) => {
      const config = runtimeMap[String(a.id)];
      if (config?.mode === "BYO_ENDPOINT" || config?.llmBilling === "BYO_KEY") return false;
      const credits = parseFloat(config?.balanceCredits ?? "0");
      return credits <= 0;
    });

    if (depletedAgents.length > 0) {
      const firstDepleted = depletedAgents[0];
      items.push({
        id: `depleted-credits-${firstDepleted.id}`,
        title: `${depletedAgents.length} ${depletedAgents.length === 1 ? "Agent" : "Agents"} Out of Circuits AI Credits`,
        description: `${firstDepleted.name} has 0 credits remaining. Autonomous execution, ticks, and broadcasts are halted until fuel is replenished.`,
        href: `/agents/${agentUrlId(firstDepleted.name, firstDepleted.id)}?tab=runtime`,
        actionLabel: "Top Up Fuel",
        icon: AlertTriangle,
        iconColor: "#EF4444",
        iconBg: "rgba(239, 68, 68, 0.15)",
        severity: "high",
      });
    }

    // 3. Check for owned agents that are running low on fuel (>0 and <= 15 credits)
    const lowCreditAgents = agents.filter((a) => {
      const config = runtimeMap[String(a.id)];
      if (config?.mode === "BYO_ENDPOINT" || config?.llmBilling === "BYO_KEY") return false;
      const credits = parseFloat(config?.balanceCredits ?? "0");
      return credits > 0 && credits <= 15;
    });

    if (lowCreditAgents.length > 0) {
      const firstLow = lowCreditAgents[0];
      const creditAmount = runtimeMap[String(firstLow.id)]?.balanceCredits ?? "0";
      items.push({
        id: `low-credits-${firstLow.id}`,
        title: `${lowCreditAgents.length} ${lowCreditAgents.length === 1 ? "Agent" : "Agents"} Low on Fuel (<15 Credits)`,
        description: `${firstLow.name} has ${creditAmount} credits remaining (~${Math.floor(Number(creditAmount) / 2.5)} ticks left). Top up fuel to prevent interruption.`,
        href: `/agents/${agentUrlId(firstLow.name, firstLow.id)}?tab=runtime`,
        actionLabel: "Top Up Fuel",
        icon: Activity,
        iconColor: "#FF5C28",
        iconBg: "rgba(255, 92, 40, 0.15)",
        severity: "medium",
      });
    }

    // 4. Check for real owned agents that have no Cognitive Brain configured
    const unconfiguredAgents = agents.filter((a) => !layerMap[String(a.id)]);
    if (unconfiguredAgents.length > 0) {
      const firstUnconfigured = unconfiguredAgents[0];
      items.push({
        id: `unconfigured-${firstUnconfigured.id}`,
        title: `${unconfiguredAgents.length} ${unconfiguredAgents.length === 1 ? "Agent" : "Agents"} Missing Cognitive Brain`,
        description: `Configure system prompt, knowledge domains, and SLA for ${firstUnconfigured.name}.`,
        href: `/agents/${agentUrlId(firstUnconfigured.name, firstUnconfigured.id)}?tab=persona`,
        actionLabel: "Configure Brain",
        icon: Brain,
        iconColor: "#8B5CF6",
        iconBg: "rgba(139, 92, 246, 0.15)",
        severity: "medium",
      });
    }

    // 4. Check for real owned agents that are inactive on-chain
    const inactiveAgents = agents.filter((a) => !a.active);
    if (inactiveAgents.length > 0) {
      const firstInactive = inactiveAgents[0];
      items.push({
        id: `inactive-${firstInactive.id}`,
        title: `${inactiveAgents.length} Inactive ${inactiveAgents.length === 1 ? "Agent" : "Agents"}`,
        description: `${firstInactive.name} is currently inactive and not accepting autonomous tasks.`,
        href: `/agents/${agentUrlId(firstInactive.name, firstInactive.id)}`,
        actionLabel: "Open Settings",
        icon: Bot,
        iconColor: "#80858F",
        iconBg: "rgba(128, 133, 143, 0.15)",
        severity: "low",
      });
    }

    return items;
  }, [isConnected, address, jobs, agents, layerMap, runtimeMap]);

  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-amber/15 text-amber">
              <AlertTriangle className="h-3 w-3" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary">
              Needs Attention
            </CardTitle>
          </div>

          {attentionItems.length > 0 ? (
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-amber/15 text-amber border border-amber/20">
              {attentionItems.length} Action{attentionItems.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-[4px] bg-emerald/15 text-emerald border border-emerald/20 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> All Clear
            </span>
          )}
        </div>
        <CardDescription className="text-xs text-text-tertiary">
          Actionable items requiring human approval or configuration.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        {!isConnected ? (
          <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 text-center text-xs text-text-tertiary">
            Sign in to inspect pending actions for your agents.
          </div>
        ) : attentionItems.length === 0 ? (
          <div className="rounded-lg border border-border-subtle/80 bg-bg-surface/50 p-4 text-center flex flex-col items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald/10 text-emerald">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-[13px] font-bold text-text-primary">You're all caught up</div>
            <p className="text-[11.5px] text-text-tertiary max-w-xs">
              All agent policies, task escrows, and runtime configurations are operating normally.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:border-border-strong transition-all flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-[5px] shrink-0 mt-0.5"
                      style={{ background: item.iconBg }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: item.iconColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-text-primary leading-tight">
                        {item.title}
                      </div>
                      <p className="text-[11.5px] text-text-tertiary mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1.5 border-t border-border-subtle/50">
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
