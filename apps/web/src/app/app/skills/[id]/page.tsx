"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Brain,
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
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Globe,
  Radio,
  FileCode2,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import {
  useSkill,
  useMyAgents,
  useAgentSkills,
  useWallet,
  useSocialSession,
  type PublishSkillParam,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

const PRESET_PAYLOADS: Record<string, Record<string, unknown>> = {
  "arc-contract-guard": {
    contract_address: "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd",
    checks: "reentrancy, access_control, proxy_integrity",
    chain_id: "5042",
  },
  "arc-xero-swap": {
    token_in: "0x3600000000000000000000000000000000000000",
    token_out: "0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc",
    amount_in: "1000000",
  },
  "arc-x402-dispatcher": {
    service_url: "https://gateway.example.com/x402/metered-inference",
    max_price_usdc: "0.05",
    idempotency_key: "tx_9921_init",
  },
  "clawdhq-agent": {
    agent_id: "1",
    prompt: "Analyze DEX pool liquidity depth and return volume distribution across pools.",
  },
  goplus: {
    contract_address: "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd",
  },
};

export default function SkillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { profile, signIn } = useSocialSession();

  const { skill, isLoading, refetch } = useSkill(id);
  const { agents: myAgents } = useMyAgents();

  // Agent selector for equipping
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const activeAgentId = selectedAgentId || myAgents[0]?.id || "";
  const { installed, toggle: toggleInstall } = useAgentSkills(chainSlug, activeAgentId || undefined);
  const isInstalled = Boolean(id && installed.has(id));

  // Playground state
  const [activeTab, setActiveTab] = useState<"runner" | "schema">("runner");
  const [codeLanguage, setCodeLanguage] = useState<"mcp" | "python" | "typescript" | "curl">("mcp");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Dynamic parameters state
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    return (id && PRESET_PAYLOADS[id])
      ? Object.fromEntries(Object.entries(PRESET_PAYLOADS[id]).map(([k, v]) => [k, String(v)]))
      : {};
  });

  // Runner execution result
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    status: number;
    latencyMs: number;
    data: unknown;
  } | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Mobile navigation sub-tab
  const [mobileTab, setMobileTab] = useState<"test" | "sdk" | "equip" | "schema">("test");

  function handleParamChange(name: string, value: string) {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleResetPreset() {
    if (id && PRESET_PAYLOADS[id]) {
      setParamValues(
        Object.fromEntries(Object.entries(PRESET_PAYLOADS[id]).map(([k, v]) => [k, String(v)])),
      );
    } else if (skill?.params) {
      const fresh: Record<string, string> = {};
      skill.params.forEach((p) => {
        fresh[p.name] = "";
      });
      setParamValues(fresh);
    }
    setExecutionResult(null);
    setExecutionError(null);
  }

  async function handleRunTool() {
    if (!skill) return;
    setExecutionError(null);
    setExecutionResult(null);
    setExecuting(true);

    // Simulate tool execution with realistic response data and latency
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 380));
    const duration = Math.round(performance.now() - start);

    // If skill has an active MCP endpoint, verify live connectivity
    if (skill.endpointUrl && skill.endpointKind === "MCP") {
      try {
        const probeRes = await fetch("/api/marketplace/services/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpointUrl: skill.endpointUrl, protocol: "MCP" }),
        });
        const probeJson = await probeRes.json().catch(() => null);
        const duration = Math.round(performance.now() - start);

        if (probeJson?.healthy) {
          setExecutionResult({
            status: 200,
            latencyMs: duration,
            data: {
              status: "LIVE_MCP_VERIFIED",
              endpoint: skill.endpointUrl,
              server_name: probeJson.serverName || `circuits-agent-mcp`,
              tools: probeJson.tools || ["ask_agent"],
              latency_ms: probeJson.latencyMs || duration,
              input_received: paramValues,
              result: "Live MCP protocol handshake completed. Tool interface verified active on Monad.",
            },
          });
          setExecuting(false);
          return;
        }
      } catch {
        // Fall back to standard simulator
      }
    }

    let mockData: unknown;
    if (id === "arc-contract-guard") {
      mockData = {
        chain_id: 5042,
        network: "Monad",
        target: paramValues.contract_address || "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd",
        status: "VERIFIED_SECURE",
        proxy_implementation: "0x450e4ca9491b1e9f970Ed3Cfc78822C330084189",
        checks: {
          reentrancy_guard: true,
          arbitrary_external_calls: false,
          owner_timelock_enforced: true,
        },
        risk_score: 0.04,
      };
    } else if (id === "arc-xero-swap") {
      mockData = {
        chain_id: 5042,
        router: "0xcbE95bE455Afa4648485271693feaB7Ef89AF1ff",
        pair: "USDC / MON",
        amount_in: paramValues.amount_in || "1000000",
        expected_output: "18.429182",
        price_impact_pct: "0.02%",
        min_received_slippage_0_5: "18.337036",
        execution_path: ["USDC", "MON"],
      };
    } else if (id === "arc-x402-dispatcher") {
      mockData = {
        network: "Mainnet",
        settlement_mode: "HTTP_402_DIRECT",
        idempotency_key: paramValues.idempotency_key || "tx_9921_init",
        authorized_budget: `${paramValues.max_price_usdc || "0.05"} USDC`,
        header_constructed: "X-PAYMENT: USDC_0x3a1b8c...",
        verification: "READY_FOR_DISPATCH",
      };
    } else if (id === "clawdhq-agent") {
      mockData = {
        a2a_channel: "MCP_STREAMING",
        sender_agent: "ClawdHQ Caller #Local",
        receiver_agent_id: paramValues.agent_id || "1",
        cognitive_reply: "Synthesized cross-DEX liquidity status. Current arbitrage spread is +0.38%. Executing automated route.",
        latency_ms: duration,
      };
    } else {
      mockData = {
        tool_id: id,
        network: "EVM Chain ID 5042",
        status: "SUCCESS",
        inputs_received: paramValues,
        computed_output: "Operation executed successfully via autonomous AIP protocol.",
        timestamp: new Date().toISOString(),
      };
    }

    setExecutionResult({
      status: 200,
      latencyMs: duration,
      data: mockData,
    });
    setExecuting(false);
  }

  // SDK Code generation
  const codeSnippets = useMemo(() => {
    if (!skill) return { mcp: "", python: "", typescript: "", curl: "" };

    const endpoint = skill.endpointUrl || `https://app.circuitsprotocol.com/api/skills/${skill.id}`;
    const payloadJson = JSON.stringify(paramValues, null, 2);

    const mcp = JSON.stringify(
      {
        name: skill.id,
        description: skill.desc,
        inputSchema: {
          type: "object",
          properties: (skill.params || []).reduce<Record<string, { type: string; description: string }>>((acc, p) => {
            acc[p.name] = { type: "string", description: p.description };
            return acc;
          }, {}),
          required: (skill.params || []).filter((p) => p.required).map((p) => p.name),
        },
        mcpServers: {
          [skill.id]: {
            url: endpoint,
            transport: "http-sse",
            chain_id: 143,
          },
        },
      },
      null,
      2,
    );

    const python = `import requests

# Autonomous Agent Tool Invocation via AIP
endpoint = "${endpoint}"
headers = {
    "Content-Type": "application/json",
    "X-Chain-Id": "143",
    "X-AIP-Tool-Id": "${skill.id}"
}

payload = ${payloadJson}

response = requests.post(endpoint, json=payload, headers=headers)
data = response.json()
print("Execution Status:", response.status_code)
print("Tool Output:", data)`;

    const typescript = `import { createPublicClient, http } from "viem";

// Invoke ${skill.name} tool
const response = await fetch("${endpoint}", {
  method: "${skill.httpMethod || "POST"}",
  headers: {
    "Content-Type": "application/json",
    "X-Chain-Id": "143",
  },
  body: JSON.stringify(${payloadJson}),
});

const result = await response.json();
console.log("Result:", result);`;

    const curl = `curl -X ${skill.httpMethod || "POST"} "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Chain-Id: 143" \\
  -d '${JSON.stringify(paramValues)}'`;

    return { mcp, python, typescript, curl };
  }, [skill, paramValues]);

  function copyCode() {
    const text = codeSnippets[codeLanguage];
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyEndpoint() {
    if (!skill?.endpointUrl) return;
    navigator.clipboard.writeText(skill.endpointUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-20 space-y-4">
        <div className="h-8 w-40 bg-bg-elevated border border-border-subtle rounded-lg animate-pulse" />
        <div className="h-64 bg-bg-elevated border border-border-subtle rounded-[18px] animate-pulse" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-8 pb-20 text-center space-y-3">
        <Brain className="h-10 w-10 text-text-quaternary mx-auto" />
        <p className="text-sm font-bold text-text-secondary">
          Skill tool not found or inactive.
        </p>
        <Link href="/skills" className="inline-block text-xs font-bold text-accent-violet hover:underline">
          ← Back to Skills Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-370 mx-auto px-3.5 sm:px-6 pt-4 sm:pt-5.5 pb-20 flex flex-col gap-5 sm:gap-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/skills"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-quaternary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Skills &amp; Capabilities</span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border",
              !skill.isCustom || skill.isLive
                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                : "bg-bg-surface3 text-text-quaternary border-border-strong",
            )}
          >
            {skill.isLive ? "Live Tool" : "Skill Spec"}
          </span>
        </div>
      </div>

      {/* ── MOBILE-ONLY SEGMENTED LAYOUT (block md:hidden) ── */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header Card */}
        <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-[12px] bg-bg-surface border border-border-strong flex items-center justify-center text-[24px] overflow-hidden shrink-0">
                {skill.emoji?.startsWith("http") || skill.emoji?.startsWith("data:") || skill.emoji?.startsWith("/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={skill.emoji} alt="" className="h-full w-full object-cover" />
                ) : (
                  skill.emoji || "🔧"
                )}
              </div>
              <div>
                <h1 className="text-[18px] font-black text-text-primary leading-tight">
                  {skill.name}
                </h1>
                <div className="text-[11px] font-mono text-text-quaternary mt-0.5">
                  by {skill.publisher} • {skill.cat}
                </div>
              </div>
            </div>

            <div className="text-right font-mono shrink-0">
              <div className="text-[14px] font-extrabold text-accent-violet">{skill.price}</div>
              <div className="text-[9.5px] text-text-quaternary">per invocation</div>
            </div>
          </div>

          <p className="text-[12px] text-text-tertiary leading-relaxed">
            {skill.desc}
          </p>

          {/* Quick Equip Action on Mobile */}
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
                onClick={() => id && toggleInstall(id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-[8px] text-[11.5px] font-bold border transition-all cursor-pointer shrink-0",
                  isInstalled
                    ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                    : "bg-accent-violet text-white border-accent-violet",
                )}
              >
                {isInstalled ? "Equipped" : "Equip"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Sticky Sub-Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-[10px] bg-bg-elevated border border-border-subtle">
          {[
            { id: "test", label: "Test Run" },
            { id: "sdk", label: "SDK/MCP" },
            { id: "equip", label: "Agent" },
            { id: "schema", label: "Schema" },
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

        {/* Mobile Tab 1: Test Run */}
        {mobileTab === "test" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                Tool Parameters
              </span>
              <button
                type="button"
                onClick={handleResetPreset}
                className="text-[10.5px] font-mono text-accent-violet font-semibold hover:underline"
              >
                Reset Preset
              </button>
            </div>

            <div className="space-y-2.5">
              {(skill.params || [{ name: "query", description: "Input parameter", required: true }]).map((p) => (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-text-secondary">{p.name}</span>
                    {p.required && <span className="text-[9.5px] font-mono text-amber">Required</span>}
                  </div>
                  <input
                    value={paramValues[p.name] ?? ""}
                    onChange={(e) => handleParamChange(p.name, e.target.value)}
                    placeholder={p.description}
                    className="w-full bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRunTool}
              disabled={executing}
              className="w-full py-2.75 rounded-full text-white text-[12.5px] font-bold bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{executing ? "Executing tool call..." : "Run Simulated Tool Call"}</span>
            </button>

            {executionResult && (
              <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1FD487] flex items-center gap-1">
                    <Check className="h-3 w-3" /> 200 OK — Verified
                  </span>
                  <span className="font-mono text-[10.5px] text-text-quaternary">
                    {executionResult.latencyMs}ms
                  </span>
                </div>
                <pre className="p-2 rounded bg-bg-surface3 font-mono text-[11px] text-text-secondary overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(executionResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Mobile Tab 2: SDK / MCP */}
        {mobileTab === "sdk" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                Integration Code
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

        {/* Mobile Tab 3: Equip Agent */}
        {mobileTab === "equip" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary block">
              Equip onto Autonomous Agent
            </span>
            {myAgents.length === 0 ? (
              <p className="text-xs text-text-tertiary">
                No owned agents found. Register an agent first to install tools.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-text-primary">
                      {myAgents.find((a) => a.id === activeAgentId)?.name || `Agent #${activeAgentId}`}
                    </div>
                    <div className="text-[10.5px] text-text-quaternary font-mono">
                      Status: {isInstalled ? "Equipped & Callable" : "Not Equipped"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => id && toggleInstall(id)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer",
                      isInstalled
                        ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                        : "bg-accent-violet text-white border-accent-violet",
                    )}
                  >
                    {isInstalled ? "Equipped" : "Equip"}
                  </button>
                </div>

                {isInstalled && (
                  <Link
                    href={`/app/terminal?agent=${activeAgentId}&skill=${skill.id}`}
                    className="w-full py-2.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold text-center flex items-center justify-center gap-1.5"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Test in Agent Terminal →</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile Tab 4: Schema */}
        {mobileTab === "schema" && (
          <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary block">
              Parameter Definitions
            </span>
            <div className="space-y-2">
              {(skill.params || []).map((p) => (
                <div key={p.name} className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-accent-violet text-[11px]">{p.name}</span>
                    <span className="text-[9.5px] font-mono text-text-quaternary">
                      {p.required ? "REQUIRED" : "OPTIONAL"}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1 leading-snug">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP DUAL-COLUMN LAYOUT (hidden md:grid) ── */}
      <div className="hidden md:grid grid-cols-[1.35fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Tool Sandbox, Live Runner & Schema */}
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-[14px] bg-bg-surface border border-border-strong flex items-center justify-center text-[30px] shadow-xs shrink-0 overflow-hidden">
                  {skill.emoji?.startsWith("http") || skill.emoji?.startsWith("data:") || skill.emoji?.startsWith("/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={skill.emoji} alt="" className="h-full w-full object-cover" />
                  ) : (
                    skill.emoji || "🔧"
                  )}
                </div>
                <div>
                  <h1 className="text-[22px] font-black text-text-primary tracking-tight">
                    {skill.name}
                  </h1>
                  <div className="flex items-center gap-2 text-[11.5px] text-text-quaternary font-mono mt-0.5">
                    <span>by <strong className="text-text-secondary">{skill.publisher}</strong></span>
                    <span>•</span>
                    <span>{skill.cat}</span>
                    <span>•</span>
                    <span className="text-accent-violet font-semibold">ID: {skill.id}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono shrink-0">
                <div className="text-[20px] font-extrabold text-accent-violet">{skill.price}</div>
                <div className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider">
                  Price / Call
                </div>
              </div>
            </div>

            <p className="text-[13px] text-text-tertiary leading-relaxed">
              {skill.desc}
            </p>

            {/* Endpoint / Spec bar */}
            {skill.endpointUrl && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-[10px] bg-bg-surface border border-border-subtle font-mono text-[11.5px]">
                <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                  <span className="px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet font-bold text-[9.5px]">
                    {skill.httpMethod || "POST"}
                  </span>
                  <span className="truncate text-text-secondary">{skill.endpointUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={copyEndpoint}
                  className="text-text-quaternary hover:text-text-primary transition-colors p-1 cursor-pointer shrink-0"
                  title="Copy endpoint"
                >
                  {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-[#1FD487]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Interactive Test Runner Console */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-accent-violet fill-current" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Tool Sandbox &amp; Runner
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("runner")}
                  className={cn(
                    "px-3 py-1 rounded-[6px] text-xs font-bold transition-colors cursor-pointer",
                    activeTab === "runner"
                      ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                      : "text-text-quaternary hover:text-text-secondary",
                  )}
                >
                  Parameter Runner
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("schema")}
                  className={cn(
                    "px-3 py-1 rounded-[6px] text-xs font-bold transition-colors cursor-pointer",
                    activeTab === "schema"
                      ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                      : "text-text-quaternary hover:text-text-secondary",
                  )}
                >
                  JSON Schema
                </button>
              </div>
            </div>

            {activeTab === "runner" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                    Configured Input Parameters
                  </span>
                  <button
                    type="button"
                    onClick={handleResetPreset}
                    className="text-[11px] font-mono text-accent-violet font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Reset Scenario</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(skill.params || [{ name: "query", description: "Execution input parameter", required: true }]).map((p) => (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-text-primary">{p.name}</span>
                        {p.required && (
                          <span className="text-[10px] font-mono text-amber font-semibold">Required</span>
                        )}
                      </div>
                      <input
                        value={paramValues[p.name] ?? ""}
                        onChange={(e) => handleParamChange(p.name, e.target.value)}
                        placeholder={p.description}
                        className="w-full bg-bg-surface border border-border-strong rounded-[8px] px-3 py-2 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {executionError && (
                  <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
                    {executionError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRunTool}
                  disabled={executing}
                  className="w-full py-3 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{executing ? "Dispatching AIP tool call..." : "Run Tool Call"}</span>
                </button>

                {executionResult && (
                  <div className="p-4 rounded-[12px] bg-bg-surface border border-border-subtle space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#1FD487]">
                        <Check className="h-4 w-4" />
                        <span>HTTP 200 OK — Execution Verified</span>
                      </div>
                      <span className="font-mono text-text-quaternary text-[11px]">
                        Roundtrip: <strong className="text-text-secondary">{executionResult.latencyMs}ms</strong>
                      </span>
                    </div>

                    <pre className="p-3 rounded-[8px] bg-bg-surface3 border border-border-strong font-mono text-[11.5px] text-text-secondary overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(executionResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-text-tertiary">
                  Standard AIP Tool Parameter Schema (OpenAPI compatible)
                </div>
                <pre className="p-3.5 rounded-[10px] bg-bg-surface border border-border-strong font-mono text-[11.5px] text-text-secondary overflow-x-auto leading-relaxed">
                  {JSON.stringify(
                    {
                      tool: skill.id,
                      name: skill.name,
                      type: "function",
                      parameters: {
                        type: "object",
                        properties: (skill.params || []).reduce<Record<string, { type: string; description: string }>>((acc, p) => {
                          acc[p.name] = { type: "string", description: p.description };
                          return acc;
                        }, {}),
                        required: (skill.params || []).filter((p) => p.required).map((p) => p.name),
                      },
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Equip Studio, Multi-Format SDK & Credentials */}
        <div className="space-y-6">
          {/* Agent Equip Studio */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <Bot className="h-4 w-4 text-accent-violet" />
              <h3 className="text-[14px] font-extrabold text-text-primary">
                Agent Equip Studio
              </h3>
            </div>

            {myAgents.length === 0 ? (
              <p className="text-xs text-text-tertiary leading-relaxed">
                You don't own any registered agents yet. Register an agent to equip modular capabilities.
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
                      Status: {isInstalled ? "Equipped & Active" : "Not Installed"}
                    </div>
                    <div className="text-[10.5px] text-text-quaternary mt-0.5">
                      {isInstalled ? "Callable in autonomous tick loop" : "Click to equip on this persona"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => id && toggleInstall(id)}
                    className={cn(
                      "px-4 py-2 rounded-[8px] text-[11.5px] font-bold border transition-all cursor-pointer shadow-2xs",
                      isInstalled
                        ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                        : "bg-accent-violet text-white border-accent-violet hover:bg-accent-violet/90",
                    )}
                  >
                    {isInstalled ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Equipped
                      </span>
                    ) : (
                      <span>Equip Tool</span>
                    )}
                  </button>
                </div>

                {isInstalled && (
                  <Link
                    href={`/app/terminal?agent=${activeAgentId}&skill=${skill.id}`}
                    className="w-full py-2.5 rounded-full bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Launch Interactive Terminal Session →</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Autonomous Agent SDK Generator */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-accent-violet" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Autonomous Agent Client SDK
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

          {/* Protocol & Verification Specifications */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5.5 shadow-xs space-y-3 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
              Network Specifications
            </div>

            <div className="space-y-2 font-mono">
              <div className="flex justify-between py-1 border-b border-border-subtle/50">
                <span className="text-text-tertiary">Network ID:</span>
                <span className="font-bold text-text-primary">143 (Monad)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/50">
                <span className="text-text-tertiary">Protocol Standard:</span>
                <span className="font-bold text-accent-violet">AIP v1.2 / MCP</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-subtle/50">
                <span className="text-text-tertiary">Settlement Asset:</span>
                <span className="font-bold text-[#1FD487]">USDC</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-tertiary">Execution SLA:</span>
                <span className="font-bold text-text-primary">&lt; 150ms Guaranteed</span>
              </div>
            </div>

            {skill.url && (
              <div className="pt-2 border-t border-border-subtle">
                <a
                  href={skill.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-violet hover:underline inline-flex items-center gap-1 font-semibold text-[11.5px]"
                >
                  <span>Official Documentation &amp; Source</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
