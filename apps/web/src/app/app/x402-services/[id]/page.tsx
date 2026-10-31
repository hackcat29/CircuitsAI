"use client";

import { IntentsServicePayment } from "@/components/near/IntentsServicePayment";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Server,
  Play,
  Code2,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  Coins,
  Cpu,
  Clock,
  ExternalLink,
  Activity,
  Bot,
  Zap,
  Layers,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  useServiceListing,
  useAllCognitiveLayers,
  useRankings,
  useLaunchpadList,
  useWallet,
  useSocialSession,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatUsdc } from "@/lib/format";
import { cn } from "@/lib/cn";
import { checkOperationChain } from "@/lib/chainGuard";

function truncateAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const PRESET_PAYLOADS: Record<string, object> = {
  "Sentiment Analysis": {
    action: "analyze_sentiment",
    text: "USDC payment confirmation latency across active pool venues.",
    depth: "detailed",
  },
  "Market Oracle": {
    action: "get_spot_price",
    pair: "USDC/USD",
    chain: "arc",
    interval: "1m",
  },
  "Bytecode Audit": {
    action: "audit_contract",
    target: "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd",
    checks: ["reentrancy", "access_control", "overflow"],
  },
  "Custom Payload": {
    prompt: "Fetch transaction volume and settlement status for latest block window.",
  },
};

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { chain, address } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { profile, signIn } = useSocialSession();

  const { listing, isLoading, refetch, call, toggle, remove } = useServiceListing(id);
  const layers = useAllCognitiveLayers(chainSlug);
  const { agents: rankings } = useRankings();
  const { launches } = useLaunchpadList("top", 100);

  // Playground State
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Sentiment Analysis");
  const [requestJson, setRequestJson] = useState<string>(
    JSON.stringify(PRESET_PAYLOADS["Sentiment Analysis"], null, 2),
  );
  const [playgroundTab, setPlaygroundTab] = useState<"invoke" | "code">("invoke");
  const [codeLanguage, setCodeLanguage] = useState<"python" | "typescript" | "curl" | "mcp">("python");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    txHash: string;
    durationMs: number;
    response: { status: number; data: unknown };
  } | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Mobile navigation active sub-tab
  const [mobileTab, setMobileTab] = useState<"playground" | "code" | "agent" | "activity">("playground");

  const hostLayer = useMemo(() => {
    if (!listing) return null;
    return layers.find((l) => l.agentChainId === listing.agentChainId) || null;
  }, [layers, listing]);

  const hostRanking = useMemo(() => {
    if (!listing) return null;
    return rankings.find((a) => String(a.id) === listing.agentChainId) || null;
  }, [rankings, listing]);

  const hostLaunch = useMemo(() => {
    if (!listing) return null;
    return launches.find((l) => l.agentChainId === listing.agentChainId) || null;
  }, [launches, listing]);

  const agentDisplayName = hostLayer?.displayName || hostRanking?.name || (listing ? `Agent #${listing.agentChainId}` : "Autonomous Agent");
  const avatarUrl = hostLayer?.avatarUrl || (listing ? robotAvatarUrl(listing.agentChainId) : "");
  const isOwner = Boolean(address && listing && address.toLowerCase() === listing.ownerAddress.toLowerCase());

  function handleSelectTemplate(name: string) {
    setSelectedTemplate(name);
    setRequestJson(JSON.stringify(PRESET_PAYLOADS[name] || {}, null, 2));
    setExecutionError(null);
    setExecutionResult(null);
  }

  async function handleExecute() {
    if (!profile) {
      signIn();
      return;
    }
    if (!listing) return;
    if (!checkOperationChain(listing.chain, "execute this service call")) return;

    setExecutionError(null);
    setExecutionResult(null);

    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(requestJson);
    } catch {
      setExecutionError("Invalid JSON in request payload editor.");
      return;
    }

    const startTime = Date.now();
    try {
      const res = await call.mutateAsync({ listing, input: parsedInput });
      const durationMs = Date.now() - startTime;
      setExecutionResult({
        txHash: res.txHash,
        durationMs,
        response: res.response,
      });
      refetch();
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "x402 micro-payment execution failed.");
    }
  }

  function copyEndpoint() {
    if (!listing) return;
    navigator.clipboard.writeText(listing.endpoint);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  }

  // SDK Code Snippets
  const codeSnippets = useMemo(() => {
    if (!listing) return { python: "", typescript: "", curl: "", mcp: "" };

    const python = `import requests

# x402 Micropayment Autonomous Request
url = "${listing.endpoint}"
headers = {
    "Content-Type": "application/json",
    "X-402-Asset": "USDC",
    "X-402-Max-Cost": "${listing.priceUsdc}"
}

payload = ${requestJson}

# Broadcasts on-chain USDC transfer and receives real-time response
response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Data:", response.json())`;

    const typescript = `import { parseUnits } from "viem";

// x402 Autonomous Node.js Client
async function queryService() {
  const url = "${listing.endpoint}";
  const payload = ${requestJson};

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-402-Asset": "USDC",
      "X-402-Amount": "${listing.priceUsdc}"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("x402 Output:", data);
}

queryService();`;

    const curl = `curl -X POST "${listing.endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-402-Asset: USDC" \\
  -H "X-402-Amount: ${listing.priceUsdc}" \\
  -d '${requestJson.replace(/\n\s*/g, " ")}'`;

    const mcp = JSON.stringify(
      {
        name: listing.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        description: listing.description,
        parameters: {
          type: "object",
          properties: {
            input: {
              type: "object",
              description: "Structured request parameters for x402 endpoint",
            },
          },
          required: ["input"],
        },
        x402: {
          network: "EVM Chain ID 5042",
          asset: "USDC",
          pricePerCall: listing.priceUsdc,
          endpoint: listing.endpoint,
        },
      },
      null,
      2,
    );

    return { python, typescript, curl, mcp };
  }, [listing, requestJson]);

  function copyActiveCode() {
    const text = codeSnippets[codeLanguage];
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-20 space-y-4">
        <div className="h-8 w-40 bg-bg-elevated border border-border-subtle rounded-lg animate-pulse" />
        <div className="h-64 bg-bg-elevated border border-border-subtle rounded-[18px] animate-pulse" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-8 pb-20 text-center space-y-3">
        <p className="text-sm font-bold text-text-secondary">x402 Service not found or inactive.</p>
        <Link href="/x402-services" className="inline-block text-xs font-bold text-accent-violet hover:underline">
          ← Back to x402 Services
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-370 mx-auto px-3.5 sm:px-6 pt-4 sm:pt-5.5 pb-20 flex flex-col gap-5 sm:gap-6">
      <IntentsServicePayment listingId={listing.id} requestJson={requestJson} onResult={setExecutionResult} />
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/x402-services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to x402 Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          {chain.explorerUrl && (
            <a
              href={`${chain.explorerUrl}/address/${listing.ownerAddress}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-text-tertiary hover:text-text-primary bg-bg-surface3 px-2.5 py-1 rounded-[8px] border border-border-subtle transition-colors"
            >
              <span>Owner: {truncateAddr(listing.ownerAddress)}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={agentDisplayName}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-[14px] border border-border-strong object-cover bg-bg-surface3 shrink-0 shadow-2xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg sm:text-2xl font-black text-text-primary tracking-tight">
                {listing.name}
              </h1>
              <span
                className={cn(
                  "text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border shrink-0",
                  listing.status === "ACTIVE"
                    ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                    : "bg-bg-surface3 text-text-quaternary border-border-strong",
                )}
              >
                {listing.status === "ACTIVE" ? "Active" : "Paused"}
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30 shrink-0">
                x402
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-text-tertiary line-clamp-2 leading-relaxed max-w-2xl">
              {listing.description}
            </p>
          </div>
        </div>

        {/* Pricing & Telemetry Badges */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border-subtle/60 shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold text-text-quaternary sm:text-right">Price per Call</div>
            <div className="text-xl sm:text-2xl font-black font-mono text-[#1FD487]">
              ${listing.priceUsdc} USDC
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-quaternary sm:text-right">
            {listing.callCount} calls settled
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          1. MOBILE LAYOUT (block md:hidden)
          ══════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-4">
        {/* Mobile Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-bg-surface border border-border-strong rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMobileTab("playground")}
            className={cn(
              "flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer",
              mobileTab === "playground" ? "bg-bg-elevated text-text-primary shadow-xs" : "text-text-tertiary",
            )}
          >
            Playground
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("code")}
            className={cn(
              "flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer",
              mobileTab === "code" ? "bg-bg-elevated text-text-primary shadow-xs" : "text-text-tertiary",
            )}
          >
            SDK &amp; MCP
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("agent")}
            className={cn(
              "flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer",
              mobileTab === "agent" ? "bg-bg-elevated text-text-primary shadow-xs" : "text-text-tertiary",
            )}
          >
            Host Agent
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("activity")}
            className={cn(
              "flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer",
              mobileTab === "activity" ? "bg-bg-elevated text-text-primary shadow-xs" : "text-text-tertiary",
            )}
          >
            Calls
          </button>
        </div>

        {/* Mobile Tab 1: Playground */}
        {mobileTab === "playground" && (
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-[#FF5C28]" />
                <span>Interactive Invoker</span>
              </span>
              <span className="text-[11px] font-mono text-[#1FD487] font-bold">
                ${listing.priceUsdc} USDC
              </span>
            </div>

            {/* Presets */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {Object.keys(PRESET_PAYLOADS).map((pName) => (
                <button
                  key={pName}
                  type="button"
                  onClick={() => handleSelectTemplate(pName)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border shrink-0",
                    selectedTemplate === pName
                      ? "bg-accent-violet text-white border-accent-violet"
                      : "bg-bg-surface border-border-subtle text-text-secondary",
                  )}
                >
                  {pName}
                </button>
              ))}
            </div>

            {/* JSON Request Editor */}
            <div>
              <textarea
                rows={5}
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
                className="w-full bg-bg-surface3 border border-border-strong rounded-xl p-3 text-xs font-mono text-text-primary outline-none focus:border-accent-violet resize-none leading-relaxed"
              />
            </div>

            {executionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
                {executionError}
              </div>
            )}

            {executionResult && (
              <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1FD487] font-bold flex items-center gap-1">
                    <Check className="h-3 w-3" /> 200 OK
                  </span>
                  <span className="font-mono text-text-quaternary text-[11px]">
                    {executionResult.durationMs}ms
                  </span>
                </div>
                <pre className="p-2 rounded-lg bg-bg-surface text-[11px] font-mono text-text-secondary overflow-x-auto max-h-40 leading-relaxed">
                  {JSON.stringify(executionResult.response.data, null, 2)}
                </pre>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecute}
              disabled={call.isPending}
              className="w-full py-2.75 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>{call.isPending ? "Broadcasting Payment…" : `Pay $${listing.priceUsdc} USDC & Call`}</span>
            </button>
          </div>
        )}

        {/* Mobile Tab 2: Code & MCP */}
        {mobileTab === "code" && (
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary">Agent Client Snippet</span>
              <button
                type="button"
                onClick={copyActiveCode}
                className="text-xs font-semibold text-accent-violet hover:underline flex items-center gap-1"
              >
                {copiedCode ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCode ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {(["python", "typescript", "curl", "mcp"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCodeLanguage(lang)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all shrink-0",
                    codeLanguage === lang
                      ? "bg-accent-violet text-white"
                      : "bg-bg-surface text-text-tertiary border border-border-subtle",
                  )}
                >
                  {lang === "mcp" ? "MCP Tool" : lang}
                </button>
              ))}
            </div>

            <pre className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle text-[11px] font-mono text-text-secondary overflow-x-auto max-h-64 leading-relaxed whitespace-pre">
              {codeSnippets[codeLanguage]}
            </pre>
          </div>
        )}

        {/* Mobile Tab 3: Host Agent */}
        {mobileTab === "agent" && (
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="h-12 w-12 rounded-[12px] border border-border-strong object-cover bg-bg-surface3"
              />
              <div>
                <div className="text-sm font-extrabold text-text-primary">{agentDisplayName}</div>
                <div className="text-xs font-mono text-text-quaternary">Agent #{listing.agentChainId}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                <span className="text-[10px] text-text-quaternary block uppercase">Model</span>
                <span className="font-bold text-text-primary mt-0.5 block truncate">
                  {hostLayer?.foundationModel || "llama-3.3-70b"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                <span className="text-[10px] text-text-quaternary block uppercase">Target SLA</span>
                <span className="font-bold text-[#1FD487] mt-0.5 block">
                  {hostLayer?.slaHours ? `${hostLayer.slaHours}h` : "Real-Time"}
                </span>
              </div>
            </div>

            <Link
              href={`/agents/${listing.agentChainId}`}
              className="w-full py-2 rounded-xl bg-bg-surface border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <span>View Full Agent Profile</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Mobile Tab 4: Calls */}
        {mobileTab === "activity" && (
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary">Recent Invocations</span>
              <span className="text-[11px] font-mono text-text-quaternary">{listing.calls?.length || 0} calls</span>
            </div>

            {(!listing.calls || listing.calls.length === 0) ? (
              <div className="py-6 text-center text-xs text-text-tertiary">No verified calls recorded yet.</div>
            ) : (
              <div className="divide-y divide-border-subtle/50 text-xs">
                {listing.calls.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-text-secondary">{truncateAddr(c.callerAddress)}</div>
                      <div className="text-[10px] text-text-quaternary">{new Date(c.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#1FD487]">${c.priceUsdc} USDC</div>
                      {chain.explorerUrl && (
                        <a
                          href={`${chain.explorerUrl}/tx/${c.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-accent-violet hover:underline inline-flex items-center gap-0.5 font-mono"
                        >
                          <span>tx</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          2. DESKTOP 2-COLUMN CONSOLE LAYOUT (hidden md:grid)
          ══════════════════════════════════════════════════════ */}
      <div className="hidden md:grid grid-cols-[1.35fr_1fr] gap-6 items-start">
        {/* Left Column: Playground & Telemetry */}
        <div className="space-y-6 min-w-0">
          {/* Interactive Playground Card */}
          <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent-dark text-accent-violet border border-accent-violet/30">
                  <Play className="h-4.5 w-4.5 fill-current" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-text-primary uppercase tracking-wider">
                    Interactive Invocation Console
                  </h2>
                  <p className="text-[11px] text-text-tertiary">
                    Pay-per-call USDC endpoint execution
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={copyEndpoint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] bg-bg-surface3 border border-border-subtle text-xs font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-[#1FD487]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedEndpoint ? "Endpoint Copied" : "Copy Endpoint"}</span>
              </button>
            </div>

            {/* Presets Selector */}
            <div>
              <span className="text-[10px] uppercase font-bold text-text-quaternary block mb-2">
                Payload Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(PRESET_PAYLOADS).map((tName) => (
                  <button
                    key={tName}
                    type="button"
                    onClick={() => handleSelectTemplate(tName)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                      selectedTemplate === tName
                        ? "bg-accent-violet text-white border-accent-violet shadow-xs"
                        : "bg-bg-surface border-border-subtle text-text-secondary hover:border-border-strong",
                    )}
                  >
                    {tName}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold text-text-quaternary">
                  Request Payload (JSON)
                </span>
                <span className="text-xs font-mono font-bold text-[#1FD487]">
                  Cost: ${listing.priceUsdc} USDC
                </span>
              </div>
              <textarea
                rows={6}
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
                className="w-full bg-bg-surface3 border border-border-strong rounded-xl p-3 text-xs font-mono text-text-primary outline-none focus:border-accent-violet resize-none leading-relaxed"
              />
            </div>

            {executionError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{executionError}</span>
              </div>
            )}

            {executionResult && (
              <div className="rounded-xl bg-bg-surface3 border border-border-subtle p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1FD487] font-bold flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    <span>200 OK — Payment Settled</span>
                  </span>
                  <div className="flex items-center gap-3 font-mono text-text-quaternary text-[11px]">
                    <span>Latency: {executionResult.durationMs}ms</span>
                    {chain.explorerUrl && (
                      <a
                        href={`${chain.explorerUrl}/tx/${executionResult.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-violet hover:underline flex items-center gap-1"
                      >
                        <span>Tx</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <pre className="p-3 rounded-lg bg-bg-surface border border-border-subtle text-xs font-mono text-text-secondary overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(executionResult.response.data, null, 2)}
                </pre>
              </div>
            )}

            <button
              type="button"
              onClick={handleExecute}
              disabled={call.isPending}
              className="w-full py-3 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Activity className="h-4 w-4" />
              <span>{call.isPending ? "Broadcasting Payment…" : `Pay $${listing.priceUsdc} USDC & Execute Endpoint`}</span>
            </button>
          </div>

          {/* Recent Invocations Ledger */}
          <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent-dark text-accent-violet border border-accent-violet/30">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">
                    Recent Invocations
                  </h3>
                  <p className="text-[11px] text-text-tertiary">
                    On-chain execution receipts
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-accent-violet">
                {listing.callCount} Lifetime
              </span>
            </div>

            {(!listing.calls || listing.calls.length === 0) ? (
              <div className="py-8 text-center text-xs text-text-tertiary">
                No paid calls recorded yet for this endpoint.
              </div>
            ) : (
              <div className="rounded-xl border border-border-subtle overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-bg-surface border-b border-border-subtle text-[10px] text-text-quaternary uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Caller</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 bg-bg-surface3/40">
                    {listing.calls.map((c) => (
                      <tr key={c.id} className="hover:bg-bg-surface">
                        <td className="py-2.5 px-3 text-text-secondary">{truncateAddr(c.callerAddress)}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1FD487]">${c.priceUsdc} USDC</td>
                        <td className="py-2.5 px-3 text-text-quaternary">{new Date(c.createdAt).toLocaleTimeString()}</td>
                        <td className="py-2.5 px-3 text-right">
                          {chain.explorerUrl && (
                            <a
                              href={`${chain.explorerUrl}/tx/${c.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent-violet hover:underline inline-flex items-center gap-1"
                            >
                              <span>tx</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Host Agent, SDK & Economics */}
        <div className="space-y-6 min-w-0">
          {/* Host Agent Card */}
          <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Host Autonomous Agent
                  </h3>
                  <p className="text-[11px] text-text-tertiary">Verified autonomous operator</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30">
                Verified
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt=""
                className="h-12 w-12 rounded-[12px] border border-border-strong object-cover bg-bg-surface3 shrink-0 shadow-2xs"
              />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-text-primary truncate flex items-center gap-1.5">
                  <span>{agentDisplayName}</span>
                  <span className="font-mono text-[10.5px] text-accent-violet">#{listing.agentChainId}</span>
                </div>
                <p className="text-xs text-text-quaternary mt-0.5 line-clamp-1">
                  {hostLayer?.worldview || "Verifiable autonomous agent operating on Circuits Protocol."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-bg-surface3/50 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-accent-violet" />
                  <span>Model</span>
                </span>
                <span className="font-mono font-bold text-text-primary mt-0.5 block truncate">
                  {hostLayer?.foundationModel || "llama-3.3-70b"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-surface3/50 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block flex items-center gap-1">
                  <Clock className="h-3 w-3 text-[#1FD487]" />
                  <span>SLA Guarantee</span>
                </span>
                <span className="font-mono font-bold text-text-primary mt-0.5 block truncate">
                  {hostLayer?.slaHours ? `${hostLayer.slaHours}h Turnaround` : "Sub-second API"}
                </span>
              </div>
            </div>

            {hostLaunch && (
              <div className="p-2.5 rounded-xl bg-accent-dark/50 border border-accent-violet/30 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-accent-violet">
                  <Coins className="h-3.5 w-3.5" />
                  <span>Token: ${hostLaunch.symbol}</span>
                </span>
                <span className="text-[10.5px] font-mono text-text-quaternary">
                  All x402 revenue powers treasury
                </span>
              </div>
            )}

            <Link
              href={`/agents/${listing.agentChainId}`}
              className="w-full py-2.5 px-3 rounded-xl bg-bg-surface border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Agent Profile</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Client Code & MCP */}
          <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30">
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Client Code &amp; MCP Tool
                  </h3>
                  <p className="text-[11px] text-text-tertiary">SDK and MCP integration snippets</p>
                </div>
              </div>

              <button
                type="button"
                onClick={copyActiveCode}
                className="text-xs font-semibold text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCode ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {(["python", "typescript", "curl", "mcp"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCodeLanguage(lang)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all shrink-0 cursor-pointer",
                    codeLanguage === lang
                      ? "bg-accent-violet text-white shadow-xs"
                      : "bg-bg-surface text-text-tertiary hover:text-text-secondary border border-border-subtle",
                  )}
                >
                  {lang === "mcp" ? "MCP Tool Spec" : lang}
                </button>
              ))}
            </div>

            <pre className="p-3.5 rounded-xl bg-bg-surface3 border border-border-strong text-xs font-mono text-text-secondary overflow-x-auto max-h-60 leading-relaxed whitespace-pre">
              {codeSnippets[codeLanguage]}
            </pre>
          </div>

          {/* Non-Custodial Direct Settlement Card */}
          <div className="rounded-[18px] border border-border-subtle bg-bg-elevated p-5 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-text-primary font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-[#1FD487]" />
              <span>100% Non-Custodial Direct Payment</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Every invocation transfer settles directly from the caller&apos;s wallet to the agent owner on-chain. There is zero protocol custody or intermediate lock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
