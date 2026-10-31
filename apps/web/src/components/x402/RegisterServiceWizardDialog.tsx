"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useFormDraftState } from "@/hooks";
import { socialFetch } from "@/lib/social/api";
import {
  Server,
  Zap,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Activity,
  Cpu,
  ShieldCheck,
  Database,
  BarChart3,
  Bot,
  Info,
  AlertCircle,
  Sparkles,
  TrendingUp,
  DollarSign,
  Send,
  Lock,
} from "lucide-react";

export interface RegisterServiceWizardProps {
  open: boolean;
  onClose: () => void;
  onRegister: (form: {
    agentChainId: string;
    name: string;
    description: string;
    endpoint: string;
    priceUsdc: string;
  }) => Promise<void>;
  myAgents: { id: string; name: string }[];
  isPending: boolean;
}

interface ServiceWizardState {
  agentChainId: string;
  preset: string;
  name: string;
  description: string;
  endpoint: string;
  priceUsdc: string;
  sampleRequest: string;
  expectedResponse: string;
}

const SERVICE_PRESETS = [
  {
    id: "oracle",
    icon: Database,
    title: "Real-Time Token Oracle",
    domain: "DeFi Oracle",
    price: "0.01",
    desc: "Provides sub-second spot price feeds, depth aggregates, and liquidity analytics across on-chain pools.",
    endpoint: "https://api.agent-oracle.arc/v1/spot",
    sampleReq: JSON.stringify({ pair: "USDC/USD", depth: 10 }, null, 2),
    sampleRes: JSON.stringify({ price: "1.0002", depthUsdc: "4500000", timestamp: Date.now() }, null, 2),
  },
  {
    id: "audit",
    icon: ShieldCheck,
    title: "Smart Contract Audit",
    domain: "Security",
    price: "0.50",
    desc: "Performs bytecode static analysis, reentrancy detection, and storage layout verification on EVM contracts.",
    endpoint: "https://audit-runtime.arc/v1/bytecode",
    sampleReq: JSON.stringify({ contract: "0x123...abc", checks: ["reentrancy", "access_control"] }, null, 2),
    sampleRes: JSON.stringify({ safe: true, criticalCount: 0, gasOptimizationScore: 94 }, null, 2),
  },
  {
    id: "sentiment",
    icon: BarChart3,
    title: "Sentiment & Alpha Engine",
    domain: "NLP Alpha",
    price: "0.05",
    desc: "Synthesizes real-time social sentiment, on-chain whale wallet shifts, and protocol volume velocity.",
    endpoint: "https://sentiment.alpha-agent.arc/v1/analyze",
    sampleReq: JSON.stringify({ asset: "MON", timeframe: "24h" }, null, 2),
    sampleRes: JSON.stringify({ sentimentScore: 0.82, signal: "ACCUMULATION", confidence: 0.91 }, null, 2),
  },
  {
    id: "yield",
    icon: TrendingUp,
    title: "DeFi Yield Rebalancer",
    domain: "DeFi Yield",
    price: "0.10",
    desc: "Calculates risk-adjusted net yield opportunities across lending pools and returns automated rebalancing paths.",
    endpoint: "https://yield.rebalance-engine.arc/v1/optimal",
    sampleReq: JSON.stringify({ collateralAsset: "USDC", targetRisk: "LOW" }, null, 2),
    sampleRes: JSON.stringify({ optimalApy: "8.4%", recommendedVault: "0xVault...1", route: ["Deposit", "Stake"] }, null, 2),
  },
  {
    id: "vision",
    icon: Cpu,
    title: "Multimodal Vision/OCR",
    domain: "Vision AI",
    price: "0.05",
    desc: "Parses charts, financial tables, and receipts into structured JSON records with high-precision confidence scoring.",
    endpoint: "https://vision.ocr-agent.arc/v1/parse",
    sampleReq: JSON.stringify({ imageUrl: "https://.../chart.png", extract: "table" }, null, 2),
    sampleRes: JSON.stringify({ tableData: [["Asset", "Volume"], ["USDC", "1.2M"]], confidence: 0.98 }, null, 2),
  },
  {
    id: "custom",
    icon: Sparkles,
    title: "Custom Compute API",
    domain: "Custom",
    price: "0.05",
    desc: "Expose any arbitrary computational model or tool endpoint to the autonomous agent economy.",
    endpoint: "https://api.your-domain.com/v1/query",
    sampleReq: JSON.stringify({ query: "Your custom payload parameters" }, null, 2),
    sampleRes: JSON.stringify({ status: "success", result: {} }, null, 2),
  },
];

const PRICE_PRESETS = ["0.01", "0.05", "0.10", "0.25", "0.50", "1.00"];

export function RegisterServiceWizardDialog({
  open,
  onClose,
  onRegister,
  myAgents,
  isPending,
}: RegisterServiceWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // Probe testing state
  const [probeStatus, setProbeStatus] = useState<"idle" | "probing" | "verified" | "failed">("idle");
  const [probeLatency, setProbeLatency] = useState<number | null>(null);
  const [probeHttpStatus, setProbeHttpStatus] = useState<number | null>(null);
  const [probeIsMcp, setProbeIsMcp] = useState<boolean>(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [form, setForm, clearDraft] = useFormDraftState<ServiceWizardState>("register_x402_service_wizard", {
    agentChainId: myAgents[0]?.id || "",
    preset: "oracle",
    name: "",
    description: "",
    endpoint: "",
    priceUsdc: "0.05",
    sampleRequest: "",
    expectedResponse: "",
  });

  useEffect(() => {
    if (!form.agentChainId && myAgents[0]?.id) {
      setForm((f) => ({ ...f, agentChainId: myAgents[0].id }));
    }
  }, [myAgents, form.agentChainId, setForm]);

  useEffect(() => {
    if (open) {
      setError(null);
      setCurrentStep(1);
    }
  }, [open]);

  if (!open) return null;

  function applyPreset(preset: typeof SERVICE_PRESETS[0]) {
    const defaultEndpoint = form.agentChainId
      ? `https://app.circuitsprotocol.com/api/agents/hosted/MONAD_MAINNET/${form.agentChainId}/mcp`
      : preset.endpoint;

    setForm((p) => ({
      ...p,
      preset: preset.id,
      name: preset.title,
      description: preset.desc,
      endpoint: defaultEndpoint,
      priceUsdc: preset.price,
      sampleRequest: preset.sampleReq,
      expectedResponse: preset.sampleRes,
    }));
    setProbeStatus("idle");
    setProbeError(null);
  }

  async function handleTestProbe() {
    setError(null);
    setProbeError(null);
    if (!form.endpoint.trim()) {
      setError("Please enter an endpoint URL to test.");
      return;
    }

    try {
      const url = new URL(form.endpoint);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        setError("Endpoint must use http or https protocol.");
        return;
      }
    } catch {
      setError("Endpoint must be a valid URL.");
      return;
    }

    setProbeStatus("probing");
    try {
      const res = await socialFetch<{
        ok: boolean;
        status: number;
        latencyMs: number;
        isMcp: boolean;
        message?: string;
        error?: string;
      }>("/api/marketplace/services/probe", {
        method: "POST",
        body: JSON.stringify({ endpoint: form.endpoint.trim() }),
      });

      setProbeLatency(res.latencyMs);
      setProbeHttpStatus(res.status);
      setProbeIsMcp(res.isMcp);

      if (res.ok) {
        setProbeStatus("verified");
      } else {
        setProbeStatus("failed");
        setProbeError(res.error || "Endpoint failed health verification.");
      }
    } catch (err: any) {
      setProbeStatus("failed");
      setProbeError(err?.message || "Health verification connection failed.");
    }
  }

  function validateStep(step: 1 | 2 | 3): boolean {
    setError(null);
    if (step === 1) {
      if (!form.agentChainId) {
        setError("Please select an agent persona to host this service.");
        return false;
      }
      if (!form.name.trim() || form.name.length < 3) {
        setError("Service name is required (minimum 3 characters).");
        return false;
      }
      if (!form.description.trim() || form.description.length < 10) {
        setError("Detailed description is required (minimum 10 characters).");
        return false;
      }
    }

    if (step === 2) {
      if (!form.endpoint.trim()) {
        setError("Please enter a valid HTTPS endpoint URL.");
        return false;
      }
      try {
        new URL(form.endpoint);
      } catch {
        setError("Endpoint URL is invalid.");
        return false;
      }
    }

    if (step === 3) {
      const price = parseFloat(form.priceUsdc);
      if (isNaN(price) || price <= 0) {
        setError("Price per call must be greater than 0 USDC.");
        return false;
      }
    }

    return true;
  }

  function handleNext() {
    if (!validateStep(currentStep)) return;
    if (currentStep < 3) {
      setCurrentStep((s) => (s + 1) as 1 | 2 | 3);
    }
  }

  function handleBack() {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as 1 | 2 | 3);
    }
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;
    try {
      await onRegister({
        agentChainId: form.agentChainId,
        name: form.name.trim(),
        description: form.description.trim(),
        endpoint: form.endpoint.trim(),
        priceUsdc: form.priceUsdc.trim(),
      });
      clearDraft();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register x402 service.");
    }
  }

  const priceNum = parseFloat(form.priceUsdc) || 0;
  const monthly100 = (priceNum * 100 * 30).toFixed(2);
  const monthly1k = (priceNum * 1000 * 30).toFixed(2);
  const monthly10k = (priceNum * 10000 * 30).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-border-subtle flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-dark text-accent-violet border border-accent-violet/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-black text-text-primary flex items-center gap-2">
                <span>Publish x402 Service</span>
                <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                  Step {currentStep} of 3
                </span>
              </h2>
              <p className="text-[11.5px] text-text-tertiary">
                Metered pay-per-call API powered by on-chain USDC micro-settlements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-surface transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="px-6 pt-3.5 pb-3 border-b border-border-subtle/70 bg-bg-surface/50">
          <div className="flex items-center justify-between relative">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => { if (currentStep > 1) setCurrentStep(1); }}
              className="flex items-center gap-2 cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 1
                    ? "bg-accent-violet text-white shadow-xs"
                    : currentStep > 1
                    ? "bg-[#1FD487] text-white"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                {currentStep > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 1 ? "text-text-primary" : "text-text-tertiary")}>
                  Identity &amp; Presets
                </div>
                <div className="text-[9.5px] text-text-quaternary">Agent &amp; Domain</div>
              </div>
            </button>

            <div className="flex-1 h-[1.5px] mx-2.5 sm:mx-4 bg-border-subtle" />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => { if (validateStep(1) && currentStep > 2) setCurrentStep(2); }}
              className="flex items-center gap-2 cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 2
                    ? "bg-accent-violet text-white shadow-xs"
                    : currentStep > 2
                    ? "bg-[#1FD487] text-white"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                {currentStep > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 2 ? "text-text-primary" : "text-text-tertiary")}>
                  Endpoint &amp; Probe
                </div>
                <div className="text-[9.5px] text-text-quaternary">Live Health Verification</div>
              </div>
            </button>

            <div className="flex-1 h-[1.5px] mx-2.5 sm:mx-4 bg-border-subtle" />

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => { if (validateStep(1) && validateStep(2)) setCurrentStep(3); }}
              className="flex items-center gap-2 cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 3
                    ? "bg-accent-violet text-white shadow-xs"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                3
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 3 ? "text-text-primary" : "text-text-tertiary")}>
                  Pricing &amp; Deploy
                </div>
                <div className="text-[9.5px] text-text-quaternary">USDC Rate &amp; Publish</div>
              </div>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: IDENTITY & PRESETS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Persona Selector */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  1. Host Agent Persona
                </label>
                {myAgents.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber/10 border border-amber/25 text-amber text-xs font-semibold">
                    No owned agents detected on this wallet. Register or claim an agent first.
                  </div>
                ) : (
                  <select
                    value={form.agentChainId}
                    onChange={(e) => setForm((p) => ({ ...p, agentChainId: e.target.value }))}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-violet cursor-pointer font-bold"
                  >
                    {myAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Agent #{a.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Presets Grid */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-accent-violet" />
                    <span>Domain Presets</span>
                  </label>
                  <span className="text-[10px] text-text-quaternary">Auto-fills specs &amp; templates</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SERVICE_PRESETS.map((pst) => {
                    const Icon = pst.icon;
                    const selected = form.preset === pst.id;
                    return (
                      <button
                        key={pst.id}
                        type="button"
                        onClick={() => applyPreset(pst)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                          selected
                            ? "bg-accent-violet/10 border-accent-violet text-accent-violet"
                            : "bg-bg-surface3/50 border-border-subtle hover:border-border-strong text-text-secondary",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className="h-4 w-4 text-accent-violet" />
                          <span className="font-mono text-[10px] font-bold text-[#1FD487]">${pst.price}</span>
                        </div>
                        <div>
                          <div className="text-[11.5px] font-bold text-text-primary truncate">{pst.title}</div>
                          <div className="text-[9.5px] text-text-quaternary truncate">{pst.domain}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service API Name */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  2. Service API Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Real-Time Token Volatility & Liquidity Oracle"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-violet transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  3. Description &amp; Capabilities
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the returned dataset, computation model, and requirements for autonomous agents..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-violet transition-colors resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* STEP 2: ENDPOINT & HEALTH PROBE */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Endpoint URL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                    1. Target Endpoint URL (HTTPS)
                  </label>
                  {form.agentChainId && (
                    <button
                      type="button"
                      onClick={() => {
                        const mcpUrl = `https://app.circuitsprotocol.com/api/agents/hosted/MONAD_MAINNET/${form.agentChainId}/mcp`;
                        setForm((p) => ({ ...p, endpoint: mcpUrl }));
                        setProbeStatus("idle");
                        setProbeError(null);
                      }}
                      className="text-[10.5px] font-bold text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Bot className="h-3 w-3" />
                      <span>Use Agent #{form.agentChainId} Hosted MCP</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://api.your-agent.com/v1/analyze"
                    value={form.endpoint}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, endpoint: e.target.value }));
                      setProbeStatus("idle");
                      setProbeError(null);
                    }}
                    className="flex-1 bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-primary outline-none focus:border-accent-violet transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleTestProbe}
                    disabled={probeStatus === "probing"}
                    className="px-3.5 py-2.5 rounded-xl bg-accent-dark border border-accent-violet/30 text-accent-violet hover:bg-accent-violet hover:text-white text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {probeStatus === "probing" ? "Probing…" : "Test Endpoint"}
                  </button>
                </div>
              </div>

              {/* Probe Result Banner */}
              {probeStatus === "verified" && (
                <div className="p-3.5 rounded-xl bg-[#0c2a1d] border border-[#1FD487]/30 text-[#1FD487] text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      Endpoint Verified &amp; Responsive (HTTP {probeHttpStatus})
                      {probeIsMcp && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#1FD487]/20 border border-[#1FD487]/40 font-mono">
                          MCP Active
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-text-quaternary">{probeLatency}ms latency</span>
                </div>
              )}

              {probeStatus === "failed" && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Health Verification Failed</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">{probeError}</div>
                  </div>
                </div>
              )}

              {/* Sample Request JSON */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  2. Sample Request Payload (JSON)
                </label>
                <textarea
                  rows={4}
                  value={form.sampleRequest}
                  onChange={(e) => setForm((p) => ({ ...p, sampleRequest: e.target.value }))}
                  placeholder='{"action": "analyze", "parameters": { ... }}'
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl p-3 text-xs font-mono text-text-primary outline-none focus:border-accent-violet resize-none leading-relaxed"
                />
              </div>

              {/* Expected Response JSON */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  3. Expected Response Schema (JSON)
                </label>
                <textarea
                  rows={3}
                  value={form.expectedResponse}
                  onChange={(e) => setForm((p) => ({ ...p, expectedResponse: e.target.value }))}
                  placeholder='{"status": "ok", "data": { ... }}'
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl p-3 text-xs font-mono text-text-primary outline-none focus:border-accent-violet resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* STEP 3: PRICING ECONOMICS & DEPLOY */}
          {currentStep === 3 && (
            <div className="space-y-5">
              {/* Pricing Input & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                    1. Price per Invocation (USDC)
                  </label>
                  <span className="text-[10px] text-text-quaternary">Instant wallet settlement</span>
                </div>

                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-text-tertiary">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="0.05"
                    value={form.priceUsdc}
                    onChange={(e) => setForm((p) => ({ ...p, priceUsdc: e.target.value }))}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-xl pl-8 pr-16 py-2.5 text-sm font-mono font-bold text-text-primary outline-none focus:border-accent-violet"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-text-tertiary">
                    USDC
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PRICE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, priceUsdc: p }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                        form.priceUsdc === p
                          ? "bg-accent-violet text-white shadow-xs"
                          : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary",
                      )}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly Revenue Simulator */}
              <div className="p-4 rounded-xl bg-bg-surface3/70 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-[#1FD487]" />
                    <span>Estimated Monthly Revenue</span>
                  </span>
                  <span className="text-[10px] font-mono text-accent-violet font-bold">
                    @ ${priceNum} USDC / call
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[9.5px] text-text-quaternary font-bold uppercase">100 Calls/day</div>
                    <div className="text-[14px] font-mono font-extrabold text-text-primary mt-0.5">
                      ${monthly100}
                    </div>
                    <div className="text-[9px] text-[#1FD487] font-semibold">~$USDC / mo</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[9.5px] text-text-quaternary font-bold uppercase">1,000 Calls/day</div>
                    <div className="text-[14px] font-mono font-extrabold text-[#1FD487] mt-0.5">
                      ${monthly1k}
                    </div>
                    <div className="text-[9px] text-[#1FD487] font-semibold">~$USDC / mo</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[9.5px] text-text-quaternary font-bold uppercase">10,000 Calls/day</div>
                    <div className="text-[14px] font-mono font-extrabold text-accent-violet mt-0.5">
                      ${monthly10k}
                    </div>
                    <div className="text-[9px] text-accent-violet font-semibold">~$USDC / mo</div>
                  </div>
                </div>
              </div>

                {/* Non-Custodial Settlement Guarantee */}
              <div className="p-3.5 rounded-xl bg-bg-surface border border-border-subtle space-y-1.5">
                <span className="text-[10.5px] font-mono font-bold uppercase text-text-quaternary flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#1FD487]" />
                  <span>Direct On-Chain Settlement</span>
                </span>
                <p className="text-[11px] text-text-tertiary leading-relaxed">
                  Callers pay directly to your connected wallet address via on-chain USDC transfer. The gateway verifies payment logs with instant finality before proxying the call.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-5 sm:p-6 pt-3.5 border-t border-border-subtle bg-bg-surface/50 flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-bg-surface border border-border-strong transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-accent-violet hover:bg-accent-violet/90 active:scale-98 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Continue</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isPending ? "Publishing…" : `Publish Service ($${priceNum.toFixed(2)} USDC / call)`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
