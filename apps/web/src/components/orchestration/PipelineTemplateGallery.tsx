"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Workflow,
  TrendingUp,
  Coins,
  ShieldCheck,
  Activity,
  Globe,
  X,
  Check,
  Bot,
  ArrowRight,
  GitMerge,
  Cpu,
  Scale,
  Sparkles,
  UserCheck,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { PipelineStep, PipelineExecutionMode, RankedAgent, MyAgentSummary } from "@/hooks";

export interface PipelineTemplateStepDefinition {
  role: PipelineStep["role"];
  suggestedAgentName: string;
  preferredKeywords: string[];
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  category: "Trading & Perps" | "Launchpad & Social" | "Security & Audit" | "Predictions" | "Cross-Chain";
  icon: typeof TrendingUp;
  badge: string;
  badgeColor: string;
  description: string;
  executionMode: PipelineExecutionMode;
  estimatedBudgetUsdc: string;
  defaultProjectName: string;
  defaultTicker: string;
  steps: PipelineTemplateStepDefinition[];
}

export interface TailoredPipelinePayload {
  templateId: string;
  name: string;
  description: string;
  executionMode: PipelineExecutionMode;
  steps: {
    role: PipelineStep["role"];
    agentChainId: string;
    agentName: string;
    taskDescription: string;
    budgetUsdc: string;
    deadlineDays: number;
  }[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "launchpad_engine",
    name: "Token Launch & Community Hype Engine",
    category: "Launchpad & Social",
    icon: Coins,
    badge: "Circuits Launchpad",
    badgeColor: "#A78BFA",
    description: "End-to-end token deployment pipeline: Deploy bonding curve token on Circuits Launchpad → Broadcast viral alpha to ClawdHQ Social → Guard liquidity and DEX graduation.",
    executionMode: "SERIAL",
    estimatedBudgetUsdc: "45",
    defaultProjectName: "ArcPulse",
    defaultTicker: "$PULSE",
    steps: [
      {
        role: "ORCHESTRATOR",
        suggestedAgentName: "Builder",
        preferredKeywords: ["builder", "arc-builder", "deploy", "launchpad"],
        taskDescription: "Deploy new bonding curve token {{token_ticker}} ({{project_name}}) on Circuits Launchpad with initial virtual reserves, creator allocation, and tokenomics description on Monad.",
        budgetUsdc: "20",
        deadlineDays: 2,
      },
      {
        role: "WORKER",
        suggestedAgentName: "Content",
        preferredKeywords: ["content", "arc-content", "social", "publisher"],
        taskDescription: "Generate viral launch announcements, tokenomics breakdown threads, and technical thesis for {{project_name}} ({{token_ticker}}) based on {{step_1.output}}. Broadcast autonomously to ClawdHQ Social feed.",
        budgetUsdc: "10",
        deadlineDays: 1,
      },
      {
        role: "EVALUATOR",
        suggestedAgentName: "Liquidity Guard",
        preferredKeywords: ["liq", "arc-liq", "liquidity", "guard"],
        taskDescription: "Monitor {{project_name}} ({{token_ticker}}) launchpad bonding curve volume, market cap progression, and DEX graduation readiness on Monad. Alert on anomalous sell walls or sniping bots.",
        budgetUsdc: "15",
        deadlineDays: 3,
      },
    ],
  },
  {
    id: "trading_fleet",
    name: "Alpha Research & Degen Trading Fleet",
    category: "Trading & Perps",
    icon: TrendingUp,
    badge: "50x Perps + Oracles",
    badgeColor: "#FF5C28",
    description: "Multi-agent institutional trading desk: Market analyst extracts alpha → Risk evaluator checks leverage caps → Execution bot enters margin positions.",
    executionMode: "SERIAL",
    estimatedBudgetUsdc: "50",
    defaultProjectName: "Delta-Neutral Arbitrage Desk",
    defaultTicker: "$ARCDESK",
    steps: [
      {
        role: "WORKER",
        suggestedAgentName: "Meridian Alpha",
        preferredKeywords: ["alpha", "meridian", "arc-alpha", "research"],
        taskDescription: "Scan crypto spot feeds, 50x Perp funding rates on CircuitsPerpVault, and Polymarket odds for {{project_name}}. Output top 3 high-conviction trade setups with target entries and stop-losses in structured JSON.",
        budgetUsdc: "15",
        deadlineDays: 2,
      },
      {
        role: "EVALUATOR",
        suggestedAgentName: "Sentinel (Risk Guard)",
        preferredKeywords: ["sentinel", "arc-sentinel", "risk", "guard"],
        taskDescription: "Evaluate trade setups for {{project_name}} from Step 1 ({{step_1.output}}). Verify portfolio delta, liquidation thresholds, and max leverage caps. Approve or reject with customized risk parameters.",
        budgetUsdc: "10",
        deadlineDays: 1,
      },
      {
        role: "ORCHESTRATOR",
        suggestedAgentName: "CHAD-GPT",
        preferredKeywords: ["chad-gpt", "arc-arb", "arb", "trader"],
        taskDescription: "Execute approved orders for {{project_name}} from Step 2 on CircuitsPerpVault and CircuitsPredictionVault using isolated margin. Monitor trailing stops and report realized PnL.",
        budgetUsdc: "25",
        deadlineDays: 3,
      },
    ],
  },
  {
    id: "security_audit",
    name: "Smart Contract Security & Formal Audit",
    category: "Security & Audit",
    icon: ShieldCheck,
    badge: "High Assurance",
    badgeColor: "#1FD487",
    description: "Automated institutional audit workflow: Vulnerability scanner → Testnet fuzzing agent → Multi-sig escrow settlement validator.",
    executionMode: "SERIAL",
    estimatedBudgetUsdc: "65",
    defaultProjectName: "Target Protocol Suite",
    defaultTicker: "$SEC",
    steps: [
      {
        role: "WORKER",
        suggestedAgentName: "Sentinel",
        preferredKeywords: ["sentinel", "arc-sentinel", "security", "auditor"],
        taskDescription: "Scan target smart contract bytecode and Solidity source of {{project_name}} for reentrancy, access control flaws, flash loan attack surfaces, and arithmetic issues.",
        budgetUsdc: "30",
        deadlineDays: 3,
      },
      {
        role: "WORKER",
        suggestedAgentName: "AgentOps",
        preferredKeywords: ["agentops", "arc-agentops", "fuzz", "verifier"],
        taskDescription: "Deploy fuzzing vectors and stress test scenarios on Monad to validate {{project_name}} contract invariants under high-throughput conditions.",
        budgetUsdc: "20",
        deadlineDays: 2,
      },
      {
        role: "EVALUATOR",
        suggestedAgentName: "Sentinel",
        preferredKeywords: ["sentinel", "arc-sentinel", "settlement", "validator"],
        taskDescription: "Review formal audit report from {{step_1.output}} and fuzzing telemetry from {{step_2.output}} for {{project_name}}. Authorize protocol escrow release if zero high-severity issues.",
        budgetUsdc: "15",
        deadlineDays: 1,
      },
    ],
  },
  {
    id: "prediction_arb",
    name: "Prediction Market Probability Arbitrageur",
    category: "Predictions",
    icon: Activity,
    badge: "UMA / Pyth Oracles",
    badgeColor: "#F5A623",
    description: "Parallel market intelligence: Monitor live oracle discrepancy ∥ NLP event sentiment → Execute high EV prediction positions on Monad.",
    executionMode: "PARALLEL",
    estimatedBudgetUsdc: "55",
    defaultProjectName: "Macro Odds Arbitrage",
    defaultTicker: "$ODDS",
    steps: [
      {
        role: "WORKER",
        suggestedAgentName: "Oracle",
        preferredKeywords: ["oracle", "arc-oracle", "pyth", "feed"],
        taskDescription: "Monitor UMA and Pyth oracle feeds across major crypto events on Monad. Flag pricing anomalies where odds diverge by >8% for {{project_name}}.",
        budgetUsdc: "15",
        deadlineDays: 2,
      },
      {
        role: "WORKER",
        suggestedAgentName: "News",
        preferredKeywords: ["news", "arc-news", "nlp", "scraper"],
        taskDescription: "Scan breaking crypto news and regulatory feeds for probability momentum shifts on {{project_name}} ahead of market consensus.",
        budgetUsdc: "15",
        deadlineDays: 2,
      },
      {
        role: "ORCHESTRATOR",
        suggestedAgentName: "Arbitrage",
        preferredKeywords: ["arb", "arc-arb", "scalper", "bot"],
        taskDescription: "Take binary outcome positions based on parallel signals from Step 1 and Step 2 on {{project_name}}. Liquidate shares when target expected value is reached.",
        budgetUsdc: "25",
        deadlineDays: 3,
      },
    ],
  },
  {
    id: "cctp_bridge",
    name: "Cross-Chain CCTP Yield & Liquidity Fleet",
    category: "Cross-Chain",
    icon: Globe,
    badge: "Circle CCTP v2",
    badgeColor: "#3B82F6",
    description: "Cross-chain orchestration: CCTP liquidity scanner → Route optimizer → Bridge settlement validator on Monad.",
    executionMode: "SERIAL",
    estimatedBudgetUsdc: "40",
    defaultProjectName: "USDC Native Yield Router",
    defaultTicker: "$CCTP",
    steps: [
      {
        role: "WORKER",
        suggestedAgentName: "Stable",
        preferredKeywords: ["stable", "arc-stable", "scanner", "cctp"],
        taskDescription: "Scan USDC mint/burn rates and cross-chain liquidity spreads for {{project_name}} across Monad, Ethereum, and Base.",
        budgetUsdc: "15",
        deadlineDays: 2,
      },
      {
        role: "WORKER",
        suggestedAgentName: "Yield",
        preferredKeywords: ["yield", "arc-yield", "optimizer", "route"],
        taskDescription: "Calculate optimal Circle CCTP transfer routes, gas overhead, and expected net yield for {{project_name}} cross-chain execution.",
        budgetUsdc: "10",
        deadlineDays: 1,
      },
      {
        role: "EVALUATOR",
        suggestedAgentName: "Sentinel",
        preferredKeywords: ["sentinel", "arc-sentinel", "validator", "security"],
        taskDescription: "Confirm attestation receipts from Circle Iris and verify on-chain native USDC balance for {{project_name}} before releasing escrow funds.",
        budgetUsdc: "15",
        deadlineDays: 2,
      },
    ],
  },
];

interface PipelineTemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (payload: TailoredPipelinePayload) => Promise<void>;
  isLoading?: boolean;
  userAgents?: MyAgentSummary[];
  allAgents?: RankedAgent[];
  userAddress?: string;
}

export function PipelineTemplateGallery({
  isOpen,
  onClose,
  onSelectTemplate,
  isLoading = false,
  userAgents = [],
  allAgents = [],
  userAddress,
}: PipelineTemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate>(PIPELINE_TEMPLATES[0]);

  // Project Personalization Form State
  const [projectName, setProjectName] = useState<string>(PIPELINE_TEMPLATES[0].defaultProjectName);
  const [tokenTicker, setTokenTicker] = useState<string>(PIPELINE_TEMPLATES[0].defaultTicker);
  const [prioritizeMyAgents, setPrioritizeMyAgents] = useState<boolean>(userAgents.length > 0);

  // Per-Step Selected Agent Overrides: stepIndex -> agentChainId
  const [stepAgentOverrides, setStepAgentOverrides] = useState<Record<number, string>>({});

  // Reset form state when user selects a different template
  useEffect(() => {
    setProjectName(selectedTemplate.defaultProjectName);
    setTokenTicker(selectedTemplate.defaultTicker);
    setStepAgentOverrides({});
  }, [selectedTemplate.id]);

  // Smart Agent Resolver for a given step
  const resolveAgentForStep = (stepIndex: number, stepDef: PipelineTemplateStepDefinition) => {
    // 1. Manual user override
    const overrideId = stepAgentOverrides[stepIndex];
    if (overrideId) {
      const foundUserAgent = userAgents.find((a) => String(a.id) === overrideId || String(a.numericId) === overrideId);
      if (foundUserAgent) return { id: String(foundUserAgent.numericId || foundUserAgent.id), name: foundUserAgent.name, isUserOwned: true };

      const foundAllAgent = allAgents.find((a) => String(a.id) === overrideId);
      if (foundAllAgent) return { id: String(foundAllAgent.id), name: foundAllAgent.name, isUserOwned: false };
    }

    // 2. Prioritize user-owned agents if enabled
    if (prioritizeMyAgents && userAgents.length > 0) {
      // Check if user owns an agent that matches this step or keywords
      const userMatch = userAgents.find((ua) => {
        const lowerName = ua.name.toLowerCase();
        return stepDef.preferredKeywords.some((kw) => lowerName.includes(kw));
      });
      if (userMatch) {
        return { id: String(userMatch.numericId || userMatch.id), name: userMatch.name, isUserOwned: true };
      }
      // If user owns only 1-2 agents, assign user agent to suitable worker/evaluator step
      if (userAgents[stepIndex % userAgents.length]) {
        const fallbackUser = userAgents[stepIndex % userAgents.length];
        return { id: String(fallbackUser.numericId || fallbackUser.id), name: fallbackUser.name, isUserOwned: true };
      }
    }

    // 3. Match from all registered fleet agents using preferred keywords
    for (const kw of stepDef.preferredKeywords) {
      const fleetMatch = allAgents.find((a) => a.name.toLowerCase().includes(kw.toLowerCase()));
      if (fleetMatch) {
        return { id: String(fleetMatch.id), name: fleetMatch.name, isUserOwned: false };
      }
    }

    // 4. Exact suggested name match
    const suggestedMatch = allAgents.find((a) =>
      a.name.toLowerCase().includes(stepDef.suggestedAgentName.toLowerCase()) ||
      stepDef.suggestedAgentName.toLowerCase().includes(a.name.toLowerCase())
    );
    if (suggestedMatch) {
      return { id: String(suggestedMatch.id), name: suggestedMatch.name, isUserOwned: false };
    }

    // 5. Fallback to first available agent
    if (allAgents.length > 0) {
      const fallback = allAgents[0];
      return { id: String(fallback.id), name: fallback.name, isUserOwned: false };
    }

    return { id: "1", name: stepDef.suggestedAgentName, isUserOwned: false };
  };

  // Interpolate prompt description with user parameters
  const interpolatePrompt = (text: string): string => {
    return text
      .replaceAll("{{project_name}}", projectName || selectedTemplate.defaultProjectName)
      .replaceAll("{{token_ticker}}", tokenTicker || selectedTemplate.defaultTicker)
      .replaceAll("{{user_address}}", userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "your wallet");
  };

  if (!isOpen) return null;

  const categories = ["ALL", "Trading & Perps", "Launchpad & Social", "Security & Audit", "Predictions", "Cross-Chain"];
  const filtered = selectedCategory === "ALL"
    ? PIPELINE_TEMPLATES
    : PIPELINE_TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleDeploy = () => {
    const tailoredSteps = selectedTemplate.steps.map((stepDef, idx) => {
      const assigned = resolveAgentForStep(idx, stepDef);
      return {
        role: stepDef.role,
        agentChainId: assigned.id,
        agentName: assigned.name,
        taskDescription: interpolatePrompt(stepDef.taskDescription),
        budgetUsdc: stepDef.budgetUsdc,
        deadlineDays: stepDef.deadlineDays,
      };
    });

    const payload: TailoredPipelinePayload = {
      templateId: selectedTemplate.id,
      name: `${projectName || selectedTemplate.defaultProjectName} Workflow`,
      description: interpolatePrompt(selectedTemplate.description),
      executionMode: selectedTemplate.executionMode,
      steps: tailoredSteps,
    };

    onSelectTemplate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet shadow-2xs">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-extrabold text-text-primary">Tailored Multi-Agent Blueprints</h2>
              </div>
              <p className="text-[11.5px] text-text-tertiary">
                Institutional AI workflows personalized to your project and owned agents.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* User Owned Agent Customization Banner */}
        {userAgents.length > 0 && (
          <div className="px-6 py-2.5 bg-accent-violet/10 border-b border-accent-violet/20 flex items-center justify-between flex-wrap gap-2 text-[12px]">
            <div className="flex items-center gap-2 text-accent-violet font-semibold">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                You own <strong>{userAgents.length} agent(s)</strong> on Monad. Blueprints can be automatically tailored with your agents.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPrioritizeMyAgents((prev) => !prev)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                prioritizeMyAgents
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                  : "bg-bg-surface border-border-subtle text-text-tertiary hover:text-text-primary"
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>{prioritizeMyAgents ? "Using Your Agents" : "Prioritize My Agents"}</span>
            </button>
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="px-6 py-2.5 border-b border-border-subtle bg-bg-raised/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-[7px] text-[11.5px] font-bold border transition-all whitespace-nowrap cursor-pointer",
                selectedCategory === cat
                  ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                  : "bg-bg-surface border-border-subtle text-text-tertiary hover:border-border-strong hover:text-text-secondary",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Modal Body: Left List / Right Tailored Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Template Cards List */}
          <div className="md:col-span-4 border-r border-border-subtle p-3.5 overflow-y-auto space-y-2 max-h-[62vh]">
            {filtered.map((tpl) => {
              const isSelected = selectedTemplate.id === tpl.id;
              const Icon = tpl.icon;

              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={cn(
                    "p-3 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col gap-1.5",
                    isSelected
                      ? "bg-accent-dark/40 border-accent-violet/50 shadow-xs ring-1 ring-accent-violet/20"
                      : "bg-bg-raised/50 border-border-subtle hover:border-border-strong hover:bg-bg-raised text-text-secondary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-accent-violet shrink-0" />
                      <span className="text-[12.5px] font-extrabold text-text-primary truncate">{tpl.name}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-tertiary line-clamp-2 leading-relaxed">{tpl.description}</p>

                  <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                    <span className="px-1.5 py-0.25 rounded bg-bg-surface3 border border-border-subtle font-bold" style={{ color: tpl.badgeColor }}>
                      {tpl.badge}
                    </span>
                    <span className="font-bold text-accent-violet">~${tpl.estimatedBudgetUsdc} USDC</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Interactive Blueprint Customization & Steps */}
          <div className="md:col-span-8 p-5 overflow-y-auto flex flex-col justify-between max-h-[62vh] bg-bg-surface3/10 space-y-4">
            <div className="space-y-4">
              {/* Header Details */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[15px] font-extrabold text-text-primary">{selectedTemplate.name}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                    {selectedTemplate.executionMode} EXECUTION
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {interpolatePrompt(selectedTemplate.description)}
                </p>
              </div>

              {/* Personalization Inputs */}
              <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5">
                <div className="flex items-center justify-between text-[11.5px] font-bold text-text-primary">
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5 text-accent-violet" />
                    <span>Tailor to Your Project</span>
                  </span>
                  <span className="text-[10px] text-text-quaternary font-mono">Dynamic Prompt Interpolation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-text-tertiary block mb-1">Project Name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. ArcPulse"
                      className="w-full px-2.5 py-1.5 rounded-[7px] bg-bg-elevated border border-border-subtle text-[12px] text-text-primary font-medium focus:outline-none focus:border-accent-violet"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-text-tertiary block mb-1">Token Ticker / Symbol</label>
                    <input
                      type="text"
                      value={tokenTicker}
                      onChange={(e) => setTokenTicker(e.target.value)}
                      placeholder="e.g. $PULSE"
                      className="w-full px-2.5 py-1.5 rounded-[7px] bg-bg-elevated border border-border-subtle text-[12px] text-text-primary font-medium focus:outline-none focus:border-accent-violet"
                    />
                  </div>
                </div>
              </div>

              {/* Step Sequence Flow */}
              <div className="space-y-2.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary flex items-center justify-between">
                  <span>Workflow Steps ({selectedTemplate.steps.length})</span>
                  <span className="font-mono text-accent-violet">Est. Total: ${selectedTemplate.estimatedBudgetUsdc} USDC</span>
                </div>

                {selectedTemplate.steps.map((stepDef, idx) => {
                  const RoleIcon = stepDef.role === "ORCHESTRATOR" ? GitMerge : stepDef.role === "WORKER" ? Cpu : Scale;
                  const roleColor = stepDef.role === "ORCHESTRATOR" ? "#FF5C28" : stepDef.role === "WORKER" ? "#1FD487" : "#A78BFA";
                  const assigned = resolveAgentForStep(idx, stepDef);
                  const interpolatedTask = interpolatePrompt(stepDef.taskDescription);

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-[10px] bg-bg-elevated border border-border-subtle flex flex-col gap-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-7 w-7 rounded-[7px] border flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${roleColor}15`, borderColor: `${roleColor}35`, color: roleColor }}
                          >
                            <RoleIcon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: roleColor }}>
                            Step {idx + 1} • {stepDef.role}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-accent-violet">${stepDef.budgetUsdc} USDC</span>
                      </div>

                      {/* Agent Selector Dropdown tailored to user */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-text-tertiary shrink-0 font-medium">Assigned Agent:</span>
                        <select
                          value={assigned.id}
                          onChange={(e) => {
                            const newId = e.target.value;
                            setStepAgentOverrides((prev) => ({ ...prev, [idx]: newId }));
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold border focus:outline-none transition-all cursor-pointer truncate max-w-[280px]",
                            assigned.isUserOwned
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                              : "bg-bg-surface border-border-subtle text-text-primary focus:border-accent-violet"
                          )}
                        >
                          {userAgents.length > 0 && (
                            <optgroup label="🌟 Your Owned Agents">
                              {userAgents.map((ua) => (
                                <option key={ua.id} value={String(ua.numericId || ua.id)}>
                                  🌟 Your Agent: {ua.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="🤖 Recommended Specialists & Fleet">
                            {allAgents.map((ag) => (
                              <option key={ag.id} value={String(ag.id)}>
                                {ag.name.toLowerCase().includes(stepDef.suggestedAgentName.toLowerCase()) ? "⭐ " : ""}
                                {ag.name} (Tier {ag.tier ?? 1})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Tailored Task Description */}
                      <p className="text-[11px] text-text-secondary leading-relaxed bg-bg-surface/60 p-2 rounded-[6px] border border-border-subtle/50">
                        {interpolatedTask}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deploy Blueprint Button */}
            <div className="pt-3 mt-3 border-t border-border-subtle flex items-center justify-between">
              <div className="text-[11px] text-text-quaternary font-mono">
                Auto-provisions pipeline wallet &amp; steps on Monad
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleDeploy}
                className="px-5 py-2.5 rounded-full bg-accent-violet text-white text-[12px] font-extrabold hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>{isLoading ? "Instantiating Blueprint…" : "Deploy This Blueprint"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
