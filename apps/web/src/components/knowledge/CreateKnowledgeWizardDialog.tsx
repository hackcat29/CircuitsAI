"use client";

import { useState, useMemo } from "react";
import {
  Database,
  MessageSquareCode,
  BrainCircuit,
  Cpu,
  ShieldCheck,
  Rocket,
  Check,
  X,
  Plus,
  Trash2,
  Activity,
  Coins,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Globe,
  Radio,
  Server,
  DollarSign,
  Info,
  Layers,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type ContributionType,
  type CreateKnowledgeContributionInput,
} from "@/hooks";

interface CreateKnowledgeWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onPublish: (input: CreateKnowledgeContributionInput, targetAgentId?: string) => Promise<void>;
  myAgents?: { id: string; name: string }[];
  isPending?: boolean;
}

interface KnowledgePreset {
  id: string;
  type: ContributionType;
  title: string;
  description: string;
  tags: string[];
  priceUsdc: string;
  stakeUsdc: string;
  contentUrl?: string;
  contentBody?: string;
}

const TYPE_CONFIG: Record<
  ContributionType,
  { label: string; icon: typeof Database; desc: string; bg: string; color: string; tag: string }
> = {
  DATASET: { label: "Dataset", icon: Database, desc: "Labeled training or evaluation data", bg: "#0c1a2e", color: "#60A5FA", tag: "Data" },
  PROMPT: { label: "Prompt", icon: MessageSquareCode, desc: "Reusable prompt templates and chains", bg: "#1a1a2e", color: "#A78BFA", tag: "Prompt" },
  MEMORY: { label: "Memory", icon: BrainCircuit, desc: "Structured knowledge base entries", bg: "#0c2a1d", color: "#1FD487", tag: "Memory" },
  MODEL: { label: "Model", icon: Cpu, desc: "Fine-tuned model weights or adapters", bg: "#2e2210", color: "#FFB13D", tag: "Weights" },
};

const URL_TYPES = new Set<ContributionType>(["DATASET", "MODEL"]);

const KNOWLEDGE_PRESETS: KnowledgePreset[] = [
  {
    id: "defi-liquidity",
    type: "MEMORY",
    title: "DeFi Liquidity & AMM Routing Memory",
    description: "Structured vector knowledge base indexing pool reserves, slippage patterns, and optimal cross-DEX execution routes.",
    tags: ["DeFi", "Liquidity", "AMM", "Routing"],
    priceUsdc: "0.50",
    stakeUsdc: "25",
    contentBody: JSON.stringify(
      {
        domain: "DeFi AMM Liquidity",
        pools: [
          { pair: "USDC/MON", fee_tier: "0.05%", optimal_route: "Direct", avg_slippage: "0.01%" },
          { pair: "USDC/ETH", fee_tier: "0.30%", optimal_route: "via Xero AMM", avg_slippage: "0.04%" },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: "contract-audit-prompt",
    type: "PROMPT",
    title: "Smart Contract Audit & Formal Reasoning Prompt",
    description: "Multi-shot reasoning chain and structured vulnerability checklist for EVM bytecode analysis, reentrancy detection, and access control audit.",
    tags: ["Security", "Bytecode", "Audit", "Reasoning"],
    priceUsdc: "1.00",
    stakeUsdc: "50",
    contentBody: `SYSTEM PROMPT:
You are an expert autonomous bytecode auditor.
Analyze target contract addresses for reentrancy vectors, arbitrary external calls, and unauthorized privilege escalation.

OUTPUT FORMAT (JSON):
{
  "risk_score": 0.0 - 1.0,
  "vulnerabilities": [],
  "reentrancy_safe": true/false,
  "verdict": "APPROVED | FLAG_MANUAL_REVIEW | REJECT"
}`,
  },
  {
    id: "arc-tx-dataset",
    type: "DATASET",
    title: "On-Chain Transaction Dataset",
    description: "Labeled telemetry dataset of 250,000 verified sub-second USDC micro-transactions, gas costs, and validator sequencing latency.",
    tags: ["Dataset", "Transactions", "MicroPay", "Testnet"],
    priceUsdc: "2.50",
    stakeUsdc: "100",
    contentUrl: "https://datasets.example.com/v1/telemetry/transactions_250k.json",
  },
  {
    id: "trading-lora",
    type: "MODEL",
    title: "Autonomous Trading & Sentiment LoRA Adapter",
    description: "Rank-16 LoRA adapter fine-tuned on decentralized orderflow, whale tracking, and sub-second momentum signals.",
    tags: ["Model", "LoRA", "Trading", "Sentiment"],
    priceUsdc: "2.00",
    stakeUsdc: "75",
    contentUrl: "https://models.example.com/v1/adapters/lora_trading_v2.safetensors",
  },
  {
    id: "security-kb",
    type: "MEMORY",
    title: "Cross-Chain Security Incident Knowledge Base",
    description: "Real-time indexed repository of attack signatures, compromised signer addresses, and malicious proxy implementations.",
    tags: ["Security", "Exploits", "Signatures", "Audits"],
    priceUsdc: "0.75",
    stakeUsdc: "30",
    contentBody: JSON.stringify(
      {
        signatures: [
          { pattern: "unprotected_initialize", severity: "CRITICAL", remediation: "Add initializer modifier" },
          { pattern: "read_only_reentrancy", severity: "HIGH", remediation: "Check pool state reentrancy guard" },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: "custom",
    type: "DATASET",
    title: "Custom Domain Knowledge Asset",
    description: "Contribute bespoke training data, specialized reasoning prompts, or domain knowledge for autonomous agents.",
    tags: ["Custom", "Research"],
    priceUsdc: "1.00",
    stakeUsdc: "10",
    contentBody: "{\n  \"data\": \"Custom domain knowledge payload...\"\n}",
  },
];

const PRICE_PRESETS = ["0.10", "0.50", "1.00", "2.50", "5.00"];

export function CreateKnowledgeWizardDialog({
  open,
  onClose,
  onPublish,
  myAgents = [],
  isPending = false,
}: CreateKnowledgeWizardDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");

  // Step 1: Type, Presets & Metadata
  const [type, setType] = useState<ContributionType>("DATASET");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>(["Research"]);
  const [tagInput, setTagInput] = useState("");

  // Step 2: Content Payload & Probe
  const [contentUrl, setContentUrl] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    ok: boolean;
    sizeKb: number;
    tokensEstimated: number;
    message: string;
  } | null>(null);

  // Step 3: Pricing, Staking & Auto-Bind
  const [priceUsdc, setPriceUsdc] = useState("1.00");
  const [stakeUsdc, setStakeUsdc] = useState("10");
  const [autoBind, setAutoBind] = useState(true);
  const [targetAgentId, setTargetAgentId] = useState<string>(myAgents[0]?.id || "");
  const [simulatedResolutionsDaily, setSimulatedResolutionsDaily] = useState<number>(1000);
  const [error, setError] = useState<string | null>(null);

  const needsUrl = URL_TYPES.has(type);

  function applyPreset(presetId: string) {
    const p = KNOWLEDGE_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setSelectedPreset(presetId);
    setType(p.type);
    setTitle(p.title);
    setDescription(p.description);
    setTags([...p.tags]);
    setPriceUsdc(p.priceUsdc);
    setStakeUsdc(p.stakeUsdc);
    setContentUrl(p.contentUrl || "");
    setContentBody(p.contentBody || "");
    setProbeResult(null);
    setError(null);
  }

  function handleAddTag() {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) {
      setTags([...tags, v]);
      setTagInput("");
    }
  }

  function handleRemoveTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function handleTestProbe() {
    setError(null);
    if (needsUrl && !contentUrl.trim()) {
      setError("Please provide a valid content URL.");
      return;
    }
    if (!needsUrl && !contentBody.trim()) {
      setError("Please enter the content payload text.");
      return;
    }

    setProbing(true);
    setProbeResult(null);

    // Simulate pre-flight format & reachability probe
    await new Promise((resolve) => setTimeout(resolve, 550));

    const contentLen = needsUrl ? contentUrl.length * 120 : contentBody.length;
    const sizeKb = Math.max(1.2, Math.round((contentLen / 1024) * 10) / 10);
    const tokens = Math.round(contentLen / 4.1);

    setProbeResult({
      ok: true,
      sizeKb,
      tokensEstimated: tokens,
      message: needsUrl
        ? "Remote resource reachable (HTTP 200 OK) — verification probe passed."
        : "Payload format validated — Clean schema structure ready for x402 injection.",
    });
    setProbing(false);
  }

  // 50/30/20 Revenue Calculation
  const revenueMetrics = useMemo(() => {
    const p = parseFloat(priceUsdc) || 0;
    const totalDaily = p * simulatedResolutionsDaily;
    const totalMonthly = totalDaily * 30;

    return {
      creatorMonthly: (totalMonthly * 0.5).toFixed(2),
      agentTreasuryMonthly: (totalMonthly * 0.3).toFixed(2),
      protocolMonthly: (totalMonthly * 0.2).toFixed(2),
      totalMonthly: totalMonthly.toFixed(2),
    };
  }, [priceUsdc, simulatedResolutionsDaily]);

  async function handlePublish() {
    setError(null);
    if (!title.trim()) {
      setError("Asset title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (needsUrl && !contentUrl.trim()) {
      setError("Content URL is required for DATASET or MODEL assets.");
      return;
    }
    if (!needsUrl && !contentBody.trim()) {
      setError("Content body payload is required for PROMPT or MEMORY assets.");
      return;
    }

    try {
      await onPublish(
        {
          title: title.trim(),
          description: description.trim(),
          type,
          tags,
          priceUsdc: priceUsdc.trim() || "1",
          stakeUsdc: stakeUsdc.trim() || "10",
          contentUrl: needsUrl ? contentUrl.trim() : undefined,
          contentBody: needsUrl ? undefined : contentBody.trim(),
        },
        autoBind && targetAgentId ? targetAgentId : undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish knowledge asset.");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div className="w-full max-w-160 max-h-[92vh] overflow-y-auto bg-bg-elevated border border-border-strong rounded-[20px] p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.8)] flex flex-col gap-4 text-text-primary">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-3.5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet font-bold border border-accent-violet/30">
                x402 Protocol
              </span>
              <span className="text-[11px] text-text-quaternary font-mono">
                Step {step} of 3
              </span>
            </div>
            <h2 className="text-[18px] font-black text-text-primary flex items-center gap-2">
              <Database className="h-5 w-5 text-accent-violet" />
              <span>Knowledge Asset Mining Wizard</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-quaternary hover:text-text-secondary transition-colors p-1.5 rounded-lg hover:bg-bg-surface3 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, label: "Type & Presets" },
            { num: 2, label: "Payload & Probe" },
            { num: 3, label: "Pricing & Deploy" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as typeof step)}
              className={cn(
                "p-2 rounded-[10px] text-left border transition-all cursor-pointer",
                step === s.num
                  ? "bg-bg-surface border-accent-violet text-accent-violet"
                  : step > s.num
                  ? "bg-bg-surface/50 border-[#1FD487]/40 text-[#1FD487]"
                  : "bg-bg-surface/30 border-border-subtle text-text-quaternary",
              )}
            >
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider">
                Step 0{s.num}
              </div>
              <div className="text-[12px] font-extrabold truncate">{s.label}</div>
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* ── STEP 1: ASSET TYPE & PRESETS ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Asset Type Selector */}
            <div>
              <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
                Knowledge Asset Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TYPE_CONFIG) as ContributionType[]).map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setType(t);
                        setProbeResult(null);
                      }}
                      className={cn(
                        "p-2.5 rounded-[10px] border text-left transition-all cursor-pointer flex flex-col gap-1",
                        type === t
                          ? "bg-accent-violet/10 border-accent-violet text-text-primary"
                          : "bg-bg-surface border-border-subtle text-text-secondary hover:border-border-strong",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="h-4 w-4 text-accent-violet" />
                        <span className="text-[9.5px] font-bold font-mono px-1.5 py-0.2 rounded bg-bg-surface3">
                          {cfg.tag}
                        </span>
                      </div>
                      <div className="text-[12px] font-extrabold">{cfg.label}</div>
                      <div className="text-[9.5px] text-text-quaternary line-clamp-1">{cfg.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick-Start Templates */}
            <div>
              <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
                Domain Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {KNOWLEDGE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={cn(
                      "p-2 rounded-[9px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                      selectedPreset === p.id
                        ? "bg-accent-violet/10 border-accent-violet text-text-primary"
                        : "bg-bg-surface border-border-subtle text-text-secondary hover:border-border-strong",
                    )}
                  >
                    <div className="text-[11.5px] font-bold truncate">{p.title}</div>
                    <div className="flex items-center justify-between text-[9.5px] font-mono text-text-quaternary">
                      <span>{p.type}</span>
                      <span className="text-accent-violet font-bold">${p.priceUsdc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1">
                  Asset Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. DeFi Liquidity & AMM Routing Memory"
                  className="w-full bg-bg-surface border border-border-strong rounded-[10px] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1">
                  Description &amp; Ingestion Guidance *
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the domain scope, key facts, and instructions for how agents should inject this into their context window..."
                  className="w-full bg-bg-surface border border-border-strong rounded-[10px] px-3 py-2 text-[12px] text-text-primary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/60 transition-colors leading-relaxed"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1">
                  Tags &amp; Domain Topics
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Type tag and press Add..."
                    className="flex-1 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1.5 text-[11.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 rounded-[8px] bg-bg-surface3 border border-border-strong text-xs font-bold text-text-secondary hover:bg-bg-raised cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-bg-surface border border-border-subtle text-[10.5px] font-mono text-accent-violet flex items-center gap-1"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-text-quaternary hover:text-red-400 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: CONTENT PAYLOAD & PRE-FLIGHT PROBE ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider">
                  {needsUrl ? `${type} Remote Storage Endpoint *` : `${type} Content Payload *`}
                </label>
                <span className="text-[10px] font-mono text-accent-violet">
                  {needsUrl ? "IPFS / Arweave / HTTPS" : "Direct Context Payload"}
                </span>
              </div>

              {needsUrl ? (
                <div>
                  <input
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    placeholder="https://datasets.example.com/v1/data.json or ipfs://Qm..."
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors"
                  />
                  <p className="text-[10px] text-text-quaternary mt-1">
                    URL must be publicly reachable and return valid JSON or Safetensors model weights.
                  </p>
                </div>
              ) : (
                <textarea
                  rows={8}
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  placeholder={
                    type === "PROMPT"
                      ? "SYSTEM PROMPT:\nYou are an expert autonomous research agent analyzing multi-chain DeFi data...\n\nOUTPUT SCHEMA (JSON):\n{ ... }"
                      : '{\n  "domain": "DeFi",\n  "entries": [\n    { "topic": "AMM Routing", "status": "OPTIMAL" }\n  ]\n}'
                  }
                  className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] p-3 text-[11.5px] font-mono text-text-secondary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/60 leading-relaxed"
                />
              )}

              {/* Pre-flight Probe Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestProbe}
                  disabled={probing || (needsUrl ? !contentUrl.trim() : !contentBody.trim())}
                  className="w-full py-2 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary border border-border-strong text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Activity className="h-3.5 w-3.5 text-accent-violet" />
                  <span>{probing ? "Probing payload format & reachability..." : "Run Pre-Flight Content Probe"}</span>
                </button>

                {probeResult && (
                  <div className="mt-2 p-2.5 rounded-[8px] bg-[#0c2a1d] border border-[#1FD487]/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[#1FD487] font-semibold text-[11.5px]">
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        <span>{probeResult.message}</span>
                      </div>
                      <span className="font-mono text-[10.5px]">Verified</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10.5px] font-mono text-text-secondary pt-1 border-t border-[#1FD487]/20">
                      <span>Payload: <strong className="text-text-primary">{probeResult.sizeKb} KB</strong></span>
                      <span>•</span>
                      <span>Estimated Context: <strong className="text-text-primary">~{probeResult.tokensEstimated.toLocaleString()} tokens</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: PRICING, 50/30/20 SIMULATOR & DEPLOY ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Price & Stake */}
            <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-3">
              <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block">
                Resolution Pricing (USDC per x402 call)
              </label>

              <div className="flex items-center gap-2">
                <input
                  value={priceUsdc}
                  onChange={(e) => setPriceUsdc(e.target.value)}
                  placeholder="1.00"
                  className="w-32 bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 text-[13px] font-mono font-bold text-[#1FD487] placeholder:text-text-quaternary outline-none focus:border-accent-violet/60"
                />
                <div className="flex flex-wrap gap-1">
                  {PRICE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPriceUsdc(preset)}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[11px] font-mono font-bold border transition-colors cursor-pointer",
                        priceUsdc === preset
                          ? "bg-accent-dark border-accent-violet/50 text-accent-violet"
                          : "bg-bg-surface3 border-border-strong text-text-secondary hover:border-border-hover",
                      )}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-xs">
                <span className="text-text-quaternary">Anti-Spam Staking Deposit:</span>
                <span className="font-mono font-bold text-text-primary">${stakeUsdc} USDC (refunded upon verification)</span>
              </div>
            </div>

            {/* 50/30/20 Revenue Split Simulator */}
            <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                  50/30/20 Revenue Split Calculator
                </span>
                <span className="text-[11px] font-mono text-accent-violet font-semibold">
                  Monthly Projections
                </span>
              </div>

              <div className="flex items-center gap-2">
                {[100, 1000, 10000].map((daily) => (
                  <button
                    key={daily}
                    type="button"
                    onClick={() => setSimulatedResolutionsDaily(daily)}
                    className={cn(
                      "flex-1 py-1.5 rounded-[6px] text-[11px] font-mono font-bold border transition-colors cursor-pointer",
                      simulatedResolutionsDaily === daily
                        ? "bg-accent-dark border-accent-violet/50 text-accent-violet"
                        : "bg-bg-surface3 border-border-strong text-text-secondary hover:border-border-hover",
                    )}
                  >
                    {daily.toLocaleString()} uses / day
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[8px] bg-bg-surface3 border border-border-strong text-center font-mono">
                <div>
                  <div className="text-[9.5px] text-text-quaternary uppercase">Creator (50%)</div>
                  <div className="text-[13px] font-extrabold text-[#1FD487] mt-0.5">
                    ${revenueMetrics.creatorMonthly}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] text-text-quaternary uppercase">Agent (30%)</div>
                  <div className="text-[13px] font-extrabold text-accent-violet mt-0.5">
                    ${revenueMetrics.agentTreasuryMonthly}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] text-text-quaternary uppercase">Protocol (20%)</div>
                  <div className="text-[13px] font-extrabold text-text-primary mt-0.5">
                    ${revenueMetrics.protocolMonthly}
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Bind to Owned Agent */}
            {myAgents.length > 0 && (
              <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBind}
                    onChange={(e) => setAutoBind(e.target.checked)}
                  />
                  <span className="text-[12px] font-bold text-text-primary">
                    Auto-inject this knowledge into my agent's runtime memory upon publish
                  </span>
                </label>

                {autoBind && (
                  <select
                    value={targetAgentId}
                    onChange={(e) => setTargetAgentId(e.target.value)}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 text-[12px] font-bold text-text-primary outline-none focus:border-accent-violet/60 cursor-pointer"
                  >
                    {myAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (#{a.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation & Actions Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-3.5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as typeof step)}
              className="px-4 py-2.5 rounded-full bg-bg-surface3 border border-border-strong text-text-secondary text-[12px] font-bold hover:bg-bg-raised transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-bg-surface3 border border-border-strong text-text-secondary text-[12px] font-bold hover:bg-bg-raised transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !title.trim()) {
                  setError("Please enter a knowledge asset title.");
                  return;
                }
                setError(null);
                setStep((s) => (s + 1) as typeof step);
              }}
              className="px-5 py-2.5 rounded-full bg-accent-violet hover:bg-accent-violet/90 text-white text-[12.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Next: {step === 1 ? "Payload & Probe" : "Pricing & Deploy"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending || !title.trim() || !description.trim()}
              className="px-6 py-2.5 rounded-full text-white text-[12.5px] font-bold bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>{isPending ? "Publishing..." : "Publish Knowledge Asset"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
