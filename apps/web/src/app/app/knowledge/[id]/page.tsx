"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Database,
  MessageSquareCode,
  BrainCircuit,
  Cpu,
  ShieldCheck,
  ArrowUpRight,
  Code2,
  Copy,
  Check,
  Terminal,
  FileText,
  DollarSign,
  Coins,
  ArrowLeft,
  Activity,
  Bot,
  Zap,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Play,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  useKnowledgeItem,
  useMyAgents,
  useWallet,
  useSocialSession,
  type ContributionType,
} from "@/hooks";
import { cn } from "@/lib/cn";

const TYPE_CONFIG: Record<
  ContributionType,
  { label: string; icon: typeof Database; desc: string; bg: string; color: string; tag: string }
> = {
  DATASET: { label: "Dataset", icon: Database, desc: "Labeled training or evaluation data", bg: "#0c1a2e", color: "#60A5FA", tag: "Data" },
  PROMPT: { label: "Prompt", icon: MessageSquareCode, desc: "Reusable prompt templates and chains", bg: "#1a1a2e", color: "#A78BFA", tag: "Prompt" },
  MEMORY: { label: "Memory", icon: BrainCircuit, desc: "Structured knowledge base entries", bg: "#0c2a1d", color: "#1FD487", tag: "Memory" },
  MODEL: { label: "Model", icon: Cpu, desc: "Fine-tuned model weights or adapters", bg: "#2e2210", color: "#FFB13D", tag: "Weights" },
};

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { item, isLoading } = useKnowledgeItem(id);
  const { agents: myAgents } = useMyAgents();
  const { profile, signIn } = useSocialSession();

  // Agent Ingestion Studio
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const activeAgentId = selectedAgentId || myAgents[0]?.id || "";
  const [isBoundToAgent, setIsBoundToAgent] = useState(false);

  // Playground state
  const [activeTab, setActiveTab] = useState<"payload" | "agent-code">("payload");
  const [codeLanguage, setCodeLanguage] = useState<"mcp" | "python" | "typescript" | "curl">("mcp");
  const [copiedCode, setCopiedCode] = useState(false);

  // Resolution Simulator state
  const [resolving, setResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState<{
    status: number;
    latencyMs: number;
    txHash: string;
    payload: unknown;
  } | null>(null);

  // Interactive Query Tester state
  const [testQuery, setTestQuery] = useState("What is the optimal routing path for this asset pair?");
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  // Mobile segmented tab
  const [mobileTab, setMobileTab] = useState<"preview" | "sdk" | "bind" | "split">("preview");

  const sampleData = useMemo(() => {
    if (!item) return "";
    if (item.contentPreview) return item.contentPreview;
    if (item.type === "PROMPT") {
      return `SYSTEM PROMPT:
You are an expert autonomous research agent analyzing on-chain DeFi liquidity.

USER INPUT:
{{query_context}}

OUTPUT SCHEMA (JSON):
{
  "verdict": "OPTIMAL_ROUTE_CONFIRMED",
  "confidence_score": 0.96,
  "execution_hops": ["USDC", "XERO_POOL", "MON"],
  "slippage_bps": 2.1
}`;
    }
    if (item.type === "MEMORY") {
      return JSON.stringify(
        {
          knowledge_id: item.id,
          domain: "DeFi AMM Liquidity & Security",
          entries: [
            {
              topic: "Xero AMM Tricrypto Slippage",
              optimal_route_hops: 2,
              avg_slippage_bps: 1.8,
              verified_settlement: "SUB_SECOND_USDC",
            },
          ],
        },
        null,
        2,
      );
    }
    if (item.type === "MODEL") {
      return JSON.stringify(
        {
          architecture: "LoRA-Adapter-Rank-16",
          base_model: "meta-llama/Llama-3.3-70B-Instruct",
          specialization: "On-Chain Micro-Payment Orchestration & Routing",
          checkpoint_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          target_modules: ["q_proj", "v_proj", "k_proj", "o_proj"],
        },
        null,
        2,
      );
    }
    return JSON.stringify(
      [
        {
          tx_hash: "0x3a1b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
          pair: "USDC/MON",
          block_time_ms: 120,
          sequencing_latency: "38ms",
          settled_usdc: "1.00",
        },
        {
          tx_hash: "0x7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b3a",
          pair: "USDC/ETH",
          block_time_ms: 125,
          sequencing_latency: "42ms",
          settled_usdc: "2.50",
        },
      ],
      null,
      2,
    );
  }, [item]);

  // Multi-format SDK code snippets
  const codeSnippets = useMemo(() => {
    if (!item) return { mcp: "", python: "", typescript: "", curl: "" };

    const gatewayUrl = `https://app.circuitsprotocol.com/api/knowledge/contributions/${item.id}/resolve`;

    const mcp = JSON.stringify(
      {
        name: `knowledge_${item.id.replace(/-/g, "_")}`,
        description: `Resolve knowledge asset: ${item.title}`,
        inputSchema: {
          type: "object",
          properties: {
            query_context: { type: "string", description: "Search query or context to match against knowledge" },
            max_results: { type: "number", default: 5 },
          },
          required: ["query_context"],
        },
        mcpServers: {
          [item.id]: {
            url: gatewayUrl,
            transport: "http-sse",
            headers: {
              "X-402-Payment-Asset": "USDC",
              "X-402-Max-Budget": item.priceUsdc,
              "X-Chain-Id": "143",
            },
          },
        },
      },
      null,
      2,
    );

    const python = `import requests

# Resolve knowledge item via x402 gateway (EVM Chain ID 143)
gateway_url = "${gatewayUrl}"
headers = {
    "X-402-Payment-Asset": "USDC",
    "X-402-Max-Budget": "${item.priceUsdc}",
    "X-Chain-Id": "143"
}

# Resolve and ingest into runtime memory
response = requests.get(gateway_url, headers=headers)
knowledge_payload = response.json()

# Ingest directly into agent context window
agent.memory.inject_context(knowledge_payload)`;

    const typescript = `import { createPublicClient, http } from "viem";

// Resolve knowledge asset via x402 micro-settlement
const response = await fetch("${gatewayUrl}", {
  headers: {
    "X-402-Payment-Asset": "USDC",
    "X-402-Max-Budget": "${item.priceUsdc}",
    "X-Chain-Id": "143",
  },
});

const knowledge = await response.json();
console.log("Ingested Knowledge Payload:", knowledge);`;

    const curl = `curl -X GET "${gatewayUrl}" \\
  -H "X-402-Payment-Asset: USDC" \\
  -H "X-402-Max-Budget: ${item.priceUsdc}" \\
  -H "X-Chain-Id: 143"`;

    return { mcp, python, typescript, curl };
  }, [item]);

  function copyCode() {
    const text = codeSnippets[codeLanguage];
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleSimulateResolve() {
    if (!item) return;
    setResolving(true);
    setResolutionResult(null);

    // Simulate sub-second x402 micro-transfer resolution
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 420));
    const duration = Math.round(performance.now() - start);

    let payload: unknown = sampleData;
    try {
      payload = JSON.parse(sampleData);
    } catch {
      payload = sampleData;
    }

    setResolutionResult({
      status: 200,
      latencyMs: duration,
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      payload,
    });
    setResolving(false);
  }

  async function handleTestQuery() {
    if (!testQuery.trim()) return;
    setQuerying(true);
    setQueryResponse(null);

    await new Promise((resolve) => setTimeout(resolve, 500));

    setQueryResponse(
      `Synthesized response using knowledge item [${item?.title}]: The execution route confirms 0.02% slippage across Monad AMM pools with sub-second USDC settlement verified on-chain.`,
    );
    setQuerying(false);
  }

  if (isLoading) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-20 space-y-4">
        <div className="h-8 w-40 bg-bg-elevated border border-border-subtle rounded-lg animate-pulse" />
        <div className="h-64 bg-bg-elevated border border-border-subtle rounded-[18px] animate-pulse" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-8 pb-20 text-center space-y-3">
        <Database className="h-10 w-10 text-text-quaternary mx-auto" />
        <p className="text-sm font-bold text-text-secondary">
          Knowledge asset not found or inactive.
        </p>
        <Link href="/knowledge" className="inline-block text-xs font-bold text-accent-violet hover:underline">
          ← Back to Knowledge Marketplace
        </Link>
      </div>
    );
  }

  const tc = TYPE_CONFIG[item.type];
  const Icon = tc.icon;

  return (
    <div className="max-w-370 mx-auto px-3.5 sm:px-6 pt-4 sm:pt-5.5 pb-20 flex flex-col gap-5 sm:gap-6">
      {/* Top Breadcrumbs */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-quaternary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Knowledge Marketplace</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet border border-accent-violet/30">
            x402 Protocol
          </span>
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
            style={{ background: tc.bg, color: tc.color, borderColor: `${tc.color}40` }}
          >
            {tc.label}
          </span>
        </div>
      </div>

      {/* ── MOBILE-ONLY SEGMENTED LAYOUT (block md:hidden) ── */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header Card */}
        <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-[12px] flex items-center justify-center shrink-0 border border-border-strong"
                style={{ background: tc.bg }}
              >
                <Icon className="h-6 w-6" style={{ color: tc.color }} />
              </div>
              <div>
                <h1 className="text-[18px] font-black text-text-primary leading-tight">
                  {item.title}
                </h1>
                <div className="text-[11px] font-mono text-text-quaternary mt-0.5">
                  by {item.contributor} • {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="text-right font-mono shrink-0">
              <div className="text-[15px] font-extrabold text-accent-violet">${item.priceUsdc}</div>
              <div className="text-[9.5px] text-text-quaternary">USDC / resolve</div>
            </div>
          </div>

          <p className="text-[12px] text-text-tertiary leading-relaxed">
            {item.description}
          </p>

          {/* Quick Bind Action on Mobile */}
          {myAgents.length > 0 && (
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2">
              <select
                value={activeAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="flex-1 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-bold text-text-primary outline-none"
              >
                {myAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (#{a.id})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsBoundToAgent(!isBoundToAgent)}
                className={cn(
                  "px-3.5 py-1.5 rounded-[8px] text-[11.5px] font-bold border transition-all cursor-pointer shrink-0",
                  isBoundToAgent
                    ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                    : "bg-accent-violet text-white border-accent-violet",
                )}
              >
                {isBoundToAgent ? "Bound" : "Bind Memory"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Sticky Sub-Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-[10px] bg-bg-elevated border border-border-subtle">
          {[
            { id: "preview", label: "Preview" },
            { id: "sdk", label: "SDK/MCP" },
            { id: "bind", label: "Agent" },
            { id: "split", label: "50/30/20" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id as typeof mobileTab)}
              className={cn(
                "py-1.5 rounded-[7px] text-[11px] font-bold transition-all text-center cursor-pointer",
                mobileTab === tab.id
                  ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile Tab 1: Preview & Resolution Sandbox */}
        {mobileTab === "preview" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                Content Payload Preview
              </span>
            </div>

            <pre className="p-3 rounded-[10px] bg-bg-surface border border-border-strong text-[11px] font-mono text-text-secondary overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
              {sampleData}
            </pre>

            <button
              type="button"
              onClick={handleSimulateResolve}
              disabled={resolving}
              className="w-full py-2.75 rounded-full text-white text-[12.5px] font-bold bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{resolving ? "Resolving via x402..." : `Simulate x402 Resolve ($${item.priceUsdc})`}</span>
            </button>

            {resolutionResult && (
              <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#1FD487] flex items-center gap-1">
                    <Check className="h-3 w-3" /> HTTP 200 OK
                  </span>
                  <span className="text-text-quaternary">{resolutionResult.latencyMs}ms</span>
                </div>
                <div className="text-[10px] font-mono text-text-tertiary truncate">
                  Tx: {resolutionResult.txHash}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile Tab 2: SDK / MCP */}
        {mobileTab === "sdk" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                Agent Client Code
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="text-[11px] font-bold text-accent-violet flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCode ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(["mcp", "python", "typescript", "curl"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCodeLanguage(lang)}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] text-[10.5px] font-mono font-bold border transition-colors",
                    codeLanguage === lang
                      ? "bg-accent-violet text-white border-accent-violet"
                      : "bg-bg-surface border-border-subtle text-text-secondary",
                  )}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <pre className="p-3 rounded-[10px] bg-bg-surface border border-border-strong text-[10.5px] font-mono text-text-secondary overflow-x-auto max-h-72 whitespace-pre-wrap leading-relaxed">
              {codeSnippets[codeLanguage]}
            </pre>
          </div>
        )}

        {/* Mobile Tab 3: Bind Agent */}
        {mobileTab === "bind" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary block">
              Inject into Agent Memory
            </span>
            {myAgents.length === 0 ? (
              <p className="text-xs text-text-tertiary">
                No owned agents found. Register an agent to inject knowledge into its context.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-text-primary">
                      {myAgents.find((a) => a.id === activeAgentId)?.name || `Agent #${activeAgentId}`}
                    </div>
                    <div className="text-[10.5px] text-text-quaternary font-mono">
                      Status: {isBoundToAgent ? "Injected into Context" : "Not Injected"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBoundToAgent(!isBoundToAgent)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer",
                      isBoundToAgent
                        ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                        : "bg-accent-violet text-white border-accent-violet",
                    )}
                  >
                    {isBoundToAgent ? "Bound" : "Bind Memory"}
                  </button>
                </div>

                <Link
                  href={`/app/terminal?agent=${activeAgentId}&knowledge=${item.id}`}
                  className="w-full py-2.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold text-center flex items-center justify-center gap-1.5"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Test in Agent Terminal →</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Mobile Tab 4: 50/30/20 Revenue Split */}
        {mobileTab === "split" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary block">
              x402 Atomic Revenue Distribution
            </span>
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary">Creator</div>
                <div className="text-[13px] font-extrabold text-[#1FD487] mt-0.5">50%</div>
              </div>
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary">Agent</div>
                <div className="text-[13px] font-extrabold text-accent-violet mt-0.5">30%</div>
              </div>
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary">Protocol</div>
                <div className="text-[13px] font-extrabold text-text-primary mt-0.5">20%</div>
              </div>
            </div>
            <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle text-xs text-text-tertiary leading-relaxed">
              Every resolution transfers <strong className="text-accent-violet">${item.priceUsdc} USDC</strong> on-chain: 50% pays the creator, 30% enters the resolving agent's treasury to power autonomous buybacks and LLM compute, and 20% sustains protocol liquidity.
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP DUAL-COLUMN LAYOUT (hidden md:grid) ── */}
      <div className="hidden md:grid grid-cols-[1.35fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Asset Overview, Payload & Resolution Sandbox */}
        <div className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="h-14 w-14 rounded-[14px] flex items-center justify-center shrink-0 border border-border-strong shadow-xs"
                  style={{ background: tc.bg }}
                >
                  <Icon className="h-7 w-7" style={{ color: tc.color }} />
                </div>
                <div>
                  <h1 className="text-[22px] font-black text-text-primary tracking-tight">
                    {item.title}
                  </h1>
                  <div className="flex items-center gap-2 text-[11.5px] text-text-quaternary font-mono mt-0.5">
                    <span>by <strong className="text-text-secondary">{item.contributor}</strong></span>
                    <span>•</span>
                    <span>{tc.label}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono shrink-0">
                <div className="text-[20px] font-extrabold text-accent-violet">${item.priceUsdc}</div>
                <div className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider">
                  USDC / Resolve
                </div>
              </div>
            </div>

            <p className="text-[13px] text-text-tertiary leading-relaxed">
              {item.description}
            </p>

            {/* Tags Strip */}
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10.5px] font-bold px-2.5 py-0.75 rounded-full bg-bg-surface border border-border-strong text-text-tertiary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Knowledge Resolution Sandbox */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-accent-violet fill-current" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Knowledge Resolution Sandbox
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                Payload Preview &amp; Schema Structure
              </div>

              <pre className="p-3.5 rounded-[12px] bg-bg-surface border border-border-strong text-[11.5px] font-mono text-text-secondary overflow-x-auto leading-relaxed max-h-56 whitespace-pre-wrap">
                {sampleData}
              </pre>

              <button
                type="button"
                onClick={handleSimulateResolve}
                disabled={resolving}
                className="w-full py-3 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{resolving ? "Resolving on-chain via x402..." : `Simulate x402 Resolution ($${item.priceUsdc} USDC)`}</span>
              </button>

              {resolutionResult && (
                <div className="p-4 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 font-bold text-[#1FD487]">
                      <Check className="h-4 w-4" />
                      <span>HTTP 200 OK — Settlement Verified</span>
                    </div>
                    <span className="text-text-quaternary">
                      Latency: <strong className="text-text-secondary">{resolutionResult.latencyMs}ms</strong>
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-text-secondary truncate">
                    Tx Hash: <a href={`https://monadscan.com/tx/${resolutionResult.txHash}`} target="_blank" rel="noreferrer" className="text-accent-violet hover:underline">{resolutionResult.txHash}</a>
                  </div>
                </div>
              )}
            </div>

            {/* Ingestion Query Tester */}
            <div className="pt-3 border-t border-border-subtle space-y-2.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                Test Agent Knowledge Ingestion
              </span>
              <div className="flex items-center gap-2">
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Ask a question using this knowledge context..."
                  className="flex-1 bg-bg-surface border border-border-strong rounded-[8px] px-3 py-2 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60"
                />
                <button
                  type="button"
                  onClick={handleTestQuery}
                  disabled={querying || !testQuery.trim()}
                  className="px-4 py-2 rounded-[8px] bg-accent-violet text-white text-xs font-bold hover:bg-accent-violet/90 transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                  <span>{querying ? "Querying..." : "Query"}</span>
                </button>
              </div>

              {queryResponse && (
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle text-[12px] text-text-secondary leading-relaxed">
                  {queryResponse}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Agent Ingestion Studio, SDK & Revenue Split */}
        <div className="space-y-6">
          {/* Agent Memory Ingestion Studio */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Bot className="h-4 w-4 text-accent-violet" />
              <h3 className="text-[14px] font-extrabold text-text-primary">
                Agent Memory Ingestion Studio
              </h3>
            </div>

            {myAgents.length === 0 ? (
              <p className="text-xs text-text-tertiary leading-relaxed">
                You don't own any registered agents yet. Register an agent to inject this knowledge asset into its active context.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
                    Target Autonomous Agent
                  </label>
                  <select
                    value={activeAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full bg-bg-surface border border-border-strong rounded-[8px] px-3 py-2 text-[12px] font-bold text-text-primary outline-none focus:border-accent-violet/60 cursor-pointer"
                  >
                    {myAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (#{a.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-text-primary">
                      Status: {isBoundToAgent ? "Injected into Memory" : "Not Injected"}
                    </div>
                    <div className="text-[10.5px] text-text-quaternary mt-0.5">
                      {isBoundToAgent ? "Available in active LLM context" : "Click to bind into agent context"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBoundToAgent(!isBoundToAgent)}
                    className={cn(
                      "px-4 py-2 rounded-[8px] text-[11.5px] font-bold border transition-all cursor-pointer shadow-2xs",
                      isBoundToAgent
                        ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                        : "bg-accent-violet text-white border-accent-violet hover:bg-accent-violet/90",
                    )}
                  >
                    {isBoundToAgent ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Bound
                      </span>
                    ) : (
                      <span>Bind Memory</span>
                    )}
                  </button>
                </div>

                <Link
                  href={`/app/terminal?agent=${activeAgentId}&knowledge=${item.id}`}
                  className="w-full py-2.5 rounded-full bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Test in Agent Terminal Session →</span>
                </Link>
              </div>
            )}
          </div>

          {/* Autonomous Agent Client SDK Generator */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-accent-violet" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Agent Client SDK Generator
                </h3>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="text-[11px] font-bold text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCode ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            {/* Language Tabs */}
            <div className="flex gap-1.5">
              {[
                { id: "mcp", label: "mcp.json" },
                { id: "python", label: "Python AIP" },
                { id: "typescript", label: "TypeScript" },
                { id: "curl", label: "cURL" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCodeLanguage(tab.id as typeof codeLanguage)}
                  className={cn(
                    "px-3 py-1 rounded-[6px] text-[11px] font-mono font-bold border transition-colors cursor-pointer",
                    codeLanguage === tab.id
                      ? "bg-accent-violet text-white border-accent-violet"
                      : "bg-bg-surface border-border-subtle text-text-secondary hover:border-border-hover",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <pre className="p-3.5 rounded-[10px] bg-bg-surface border border-border-strong text-[11px] font-mono text-text-secondary overflow-x-auto max-h-72 whitespace-pre-wrap leading-relaxed">
              {codeSnippets[codeLanguage]}
            </pre>
          </div>

          {/* 50/30/20 Revenue Split & Settlement Matrix */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <span className="text-[12px] font-extrabold text-text-primary">
                50/30/20 Atomic Settlement
              </span>
              <span className="text-[10.5px] font-mono font-bold text-[#1FD487]">
                ${item.rewardsUsdc} USDC Earned
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary uppercase">Creator (50%)</div>
                <div className="text-[13px] font-extrabold text-[#1FD487] mt-0.5">
                  ${(parseFloat(item.priceUsdc) * 0.5).toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary uppercase">Agent (30%)</div>
                <div className="text-[13px] font-extrabold text-accent-violet mt-0.5">
                  ${(parseFloat(item.priceUsdc) * 0.3).toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                <div className="text-[9.5px] text-text-quaternary uppercase">Protocol (20%)</div>
                <div className="text-[13px] font-extrabold text-text-primary mt-0.5">
                  ${(parseFloat(item.priceUsdc) * 0.2).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="text-xs text-text-tertiary leading-relaxed">
              Every resolution transfers <span className="font-mono font-bold text-accent-violet">${item.priceUsdc} USDC</span> on-chain: 50% pays the creator, 30% enters the resolving agent's treasury to power autonomous buybacks and LLM compute, and 20% sustains protocol liquidity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
