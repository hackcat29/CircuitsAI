"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  MessageSquareCode,
  BrainCircuit,
  Cpu,
  UploadCloud,
  Search,
  Lightbulb,
  DollarSign,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Code2,
  Copy,
  Check,
  X,
  FileText,
  Terminal,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useKnowledge,
  useMyAgents,
  useSocialSession,
  type ContributionType,
  type KnowledgeContribution,
  type CreateKnowledgeContributionInput,
} from "@/hooks";
import { CreateKnowledgeWizardDialog } from "@/components/knowledge/CreateKnowledgeWizardDialog";
import { MobileKnowledgeCard } from "@/components/knowledge/MobileKnowledgeCard";

const TYPE_CONFIG: Record<
  ContributionType,
  { label: string; icon: typeof Database; desc: string; bg: string; color: string; tag: string }
> = {
  DATASET: { label: "Dataset", icon: Database, desc: "Labeled training or evaluation data", bg: "#0c1a2e", color: "#60A5FA", tag: "Data" },
  PROMPT: { label: "Prompt", icon: MessageSquareCode, desc: "Reusable prompt templates and chains", bg: "#1a1a2e", color: "#A78BFA", tag: "Prompt" },
  MEMORY: { label: "Memory", icon: BrainCircuit, desc: "Structured knowledge base entries", bg: "#0c2a1d", color: "#1FD487", tag: "Memory" },
  MODEL: { label: "Model", icon: Cpu, desc: "Fine-tuned model weights or adapters", bg: "#2e2210", color: "#FFB13D", tag: "Weights" },
};

function KnowledgeSampleModal({
  item,
  onClose,
}: {
  item: KnowledgeContribution;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"sample" | "code">("sample");
  const [copied, setCopied] = useState(false);
  const tc = TYPE_CONFIG[item.type];

  const sampleData = useMemo(() => {
    if (item.contentPreview) {
      return item.contentPreview;
    }
    if (item.type === "PROMPT") {
      return `SYSTEM PROMPT:\nYou are an expert autonomous research agent analyzing multi-chain DeFi data.\n\nUSER INPUT:\n{{query_context}}\n\nOUTPUT SCHEMA (JSON):\n{\n  "verdict": "BULLISH | BEARISH | NEUTRAL",\n  "confidence_score": 0.94,\n  "key_catalysts": ["liquidity_spike", "whale_accumulation"]\n}`;
    }
    if (item.type === "MEMORY") {
      return `{\n  "knowledge_id": "${item.id}",\n  "domain": "Cross-Chain Liquidity & Security",\n  "entries": [\n    {\n      "subject": "Curve Tricrypto Slippage",\n      "optimal_route_hops": 2,\n      "avg_slippage_bps": 4.2\n    }\n  ]\n}`;
    }
    if (item.type === "MODEL") {
      return `{\n  "architecture": "LoRA-Adapter-v2",\n  "base_model": "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",\n  "specialization": "Smart Contract Audit & Formal Verification",\n  "weights_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"\n}`;
    }
    return `[\n  {\n    "timestamp": 1740345600,\n    "pair": "CLAW/USDC",\n    "liquidity_usd": 1250000,\n    "volume_24h": 420000,\n    "sentiment_score": 0.88\n  },\n  {\n    "timestamp": 1740349200,\n    "pair": "CLAW/ETH",\n    "liquidity_usd": 890000,\n    "volume_24h": 310000,\n    "sentiment_score": 0.92\n  }\n]`;
  }, [item]);

  const agentCodeSnippet = `import requests

# Autonomous agent resolves and injects Knowledge item via x402
gateway_url = "https://app.circuitsprotocol.com/api/knowledge/contributions/${item.id}/resolve"
headers = {
    "X-402-Payment-Asset": "USDC",
    "X-402-Max-Budget": "${item.priceUsdc}"
}

# Resolve knowledge item into runtime memory
response = requests.get(gateway_url, headers=headers)
knowledge_payload = response.json()

# Inject into Agent Cognitive System Prompt / Context Window
agent.memory.inject_context(knowledge_payload)`;

  const copySnippet = () => {
    navigator.clipboard.writeText(activeTab === "sample" ? sampleData : agentCodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-150 max-h-[90vh] overflow-y-auto bg-bg-elevated border border-border-strong rounded-[18px] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0 border border-border-strong" style={{ background: tc.bg }}>
              <tc.icon className="h-5 w-5" style={{ color: tc.color }} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold text-text-primary flex items-center gap-2">
                <span>{item.title}</span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>
                  {tc.label}
                </span>
              </h3>
              <p className="text-[11.5px] text-text-quaternary mt-0.5 font-mono">
                by {item.contributor} • ${item.priceUsdc}/use
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-quaternary hover:text-text-secondary transition-colors p-1 flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <button
            onClick={() => setActiveTab("sample")}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1.5",
              activeTab === "sample"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Sample Content Payload</span>
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1.5",
              activeTab === "code"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Agent Injection Code</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
              {activeTab === "sample" ? "Raw Payload Preview" : "Python AIP Integration Snippet"}
            </span>
            <button
              onClick={copySnippet}
              className="text-[11.5px] font-semibold text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#1FD487]" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied!" : "Copy to Clipboard"}</span>
            </button>
          </div>

          <pre className="p-4 rounded-[12px] bg-bg-surface border border-border-strong text-[11.5px] font-mono text-text-secondary overflow-x-auto leading-relaxed max-h-72 whitespace-pre-wrap">
            {activeTab === "sample" ? sampleData : agentCodeSnippet}
          </pre>
        </div>

        <div className="flex justify-end pt-2 border-t border-border-subtle">
          <Link
            href={`/knowledge/${item.id}`}
            className="px-4 py-2 rounded-full text-xs font-bold text-white bg-accent-violet hover:bg-accent-violet/90 transition-colors flex items-center gap-1"
          >
            <span>Open Detail Page</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

type SortOption = "uses-desc" | "price-asc" | "price-desc" | "newest";

export default function KnowledgePage() {
  const router = useRouter();
  const {
    contributions,
    myContributions,
    create,
    publish,
    remove,
    isLoading,
    isMyLoading,
    isCreating,
    publishingId,
    publishError,
    removingId,
    removeError,
  } = useKnowledge();
  const { agents: myAgents } = useMyAgents();
  const { profile, signIn, signingIn, error: sessionError } = useSocialSession();

  const [activeTab, setActiveTab] = useState<"browse" | "mine">("browse");
  const [typeFilter, setTypeFilter] = useState<ContributionType | "all">("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("uses-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [inspectingItem, setInspectingItem] = useState<KnowledgeContribution | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("table");
    }
  }, []);

  // Filtered & Sorted contributions
  const filtered = useMemo(() => {
    const source = activeTab === "mine" ? myContributions : contributions;
    let list = typeFilter === "all" ? [...source] : source.filter((c) => c.type === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.contributor.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return list.sort((a, b) => {
      if (sortBy === "uses-desc") return (b.usageCount || 0) - (a.usageCount || 0);
      if (sortBy === "price-asc") return (parseFloat(a.priceUsdc) || 0) - (parseFloat(b.priceUsdc) || 0);
      if (sortBy === "price-desc") return (parseFloat(b.priceUsdc) || 0) - (parseFloat(a.priceUsdc) || 0);
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [contributions, myContributions, activeTab, typeFilter, query, sortBy]);

  // Knowledge Pagination
  const [knowledgePage, setKnowledgePage] = useState(1);
  const KNOWLEDGE_PAGE_SIZE = 12;
  const totalKnowledgePages = Math.max(1, Math.ceil(filtered.length / KNOWLEDGE_PAGE_SIZE));
  const paginatedKnowledge = useMemo(() => {
    return filtered.slice((knowledgePage - 1) * KNOWLEDGE_PAGE_SIZE, knowledgePage * KNOWLEDGE_PAGE_SIZE);
  }, [filtered, knowledgePage]);

  // Reset page when filters change
  useEffect(() => {
    setKnowledgePage(1);
  }, [typeFilter, query, sortBy, activeTab]);

  async function handleCreate(input: CreateKnowledgeContributionInput, targetAgentId?: string) {
    if (!profile) {
      signIn();
      return;
    }
    await create(input);
  }

  function handleCreateClick() {
    if (!profile) {
      signIn();
      return;
    }
    setShowCreateWizard(true);
  }

  // Telemetry
  const totalRewards = myContributions.reduce((sum, c) => sum + parseFloat(c.rewardsUsdc || "0"), 0);
  const globalTotalUses = useMemo(() => contributions.reduce((sum, c) => sum + (c.usageCount || 0), 0), [contributions]);
  const verifiedCount = useMemo(() => contributions.filter((c) => c.verifiedAt).length, [contributions]);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-17.5 flex flex-col gap-5 sm:gap-6">
      {/* 3-Step Guided Knowledge Creation Wizard */}
      <CreateKnowledgeWizardDialog
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onPublish={handleCreate}
        myAgents={myAgents}
        isPending={isCreating}
      />

      {/* Sample Inspector Modal */}
      {inspectingItem && <KnowledgeSampleModal item={inspectingItem} onClose={() => setInspectingItem(null)} />}

      {/* ── MOBILE-ONLY EXPERIENCE (block md:hidden) ── */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header */}
        <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <Link
              href="/marketplace"
              className="text-[11.5px] text-text-quaternary font-semibold hover:text-text-secondary"
            >
              ← Task Marketplace
            </Link>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet font-bold border border-accent-violet/30">
              x402 Protocol
            </span>
          </div>

          <div>
            <h1 className="text-[20px] font-black text-text-primary flex items-center gap-2">
              <Database className="h-5 w-5 text-accent-violet" />
              <span>Knowledge Marketplace</span>
            </h1>
            <p className="text-[11.5px] text-text-tertiary mt-0.5 leading-relaxed">
              Datasets, reasoning prompts, memory vector snapshots, and model weights resolved on-chain.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateClick}
            disabled={signingIn}
            className="w-full py-2.75 rounded-full text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{signingIn ? "Signing in…" : profile ? "+ Mine Knowledge" : "Sign in to Mine"}</span>
          </button>
        </div>

        {/* Mobile Swipeable Telemetry Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Assets</div>
            <div className="text-[16px] font-extrabold font-mono text-accent-violet mt-0.5">{contributions.length}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Verified</div>
            <div className="text-[16px] font-extrabold font-mono text-[#1FD487] mt-0.5">{verifiedCount}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Agent Uses</div>
            <div className="text-[16px] font-extrabold font-mono text-text-primary mt-0.5">{globalTotalUses.toLocaleString()}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Rewards</div>
            <div className="text-[16px] font-extrabold font-mono text-amber mt-0.5">${totalRewards.toFixed(2)}</div>
          </div>
        </div>

        {/* Mobile Search & Filter Chips */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search datasets, prompts, models…"
              className="w-full bg-bg-elevated border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(["all", "DATASET", "PROMPT", "MEMORY", "MODEL"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-2.5 py-1 rounded-[7px] text-[11px] font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer capitalize",
                  typeFilter === t
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet"
                    : "border-border-subtle bg-bg-elevated text-text-tertiary",
                )}
              >
                {t === "all" ? "All Types" : t.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center shadow-xs">
            <Database className="h-8 w-8 text-accent-violet mx-auto mb-2" />
            <div className="text-[14px] font-bold text-text-primary">No Knowledge Items Found</div>
            <p className="text-[11.5px] text-text-tertiary mt-1">
              {query ? "Try adjusting your search filters." : "Mine the first knowledge asset."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedKnowledge.map((item) => (
              <MobileKnowledgeCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {totalKnowledgePages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs font-mono text-text-secondary">
            <button
              type="button"
              disabled={knowledgePage <= 1}
              onClick={() => setKnowledgePage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              ← Prev
            </button>
            <span className="font-bold">
              {knowledgePage} / {totalKnowledgePages}
            </span>
            <button
              type="button"
              disabled={knowledgePage >= totalKnowledgePages}
              onClick={() => setKnowledgePage((p) => Math.min(totalKnowledgePages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── DESKTOP-ONLY EXPERIENCE (hidden md:flex md:flex-col md:gap-6) ── */}
      <div className="hidden md:flex md:flex-col md:gap-6">
        {/* Hero Banner with Macro Telemetry */}
        <div className="rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start gap-6 flex-wrap relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/marketplace"
                  className="text-[11.5px] text-text-quaternary hover:text-text-secondary transition-colors font-semibold"
                >
                  ← Task Marketplace
                </Link>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet font-bold border border-accent-violet/30">
                  x402 Protocol
                </span>
              </div>
              <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight mb-2 flex items-center gap-2.5 text-text-primary">
                <Database className="h-6 w-6 text-accent-violet" />
                <span>Knowledge Marketplace &amp; Mining Hub</span>
              </h1>
              <p className="text-[13px] text-text-tertiary leading-[1.6] max-w-150">
                Contribute labeled datasets, reasoning prompts, memory vector snapshots, and fine-tuned model adapters. Autonomous agents resolve your knowledge via x402, splitting revenue: 50% to Creator, 30% to Agent Treasury (for token buybacks &amp; autonomous spend), and 20% to Protocol.
              </p>

              {/* Telemetry Strip */}
              <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-accent-violet">{contributions.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Total Assets</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-[#1FD487]">{verifiedCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Verified Knowledge</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-text-primary">{globalTotalUses.toLocaleString()}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Agent Invocations</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-amber">${totalRewards.toFixed(2)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Your Earnings (50% Cut)</div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button
                onClick={handleCreateClick}
                disabled={signingIn}
                className="flex items-center gap-1.5 px-6 py-2.75 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{signingIn ? "Signing in…" : profile ? "+ Mine Knowledge" : "Sign in to Mine"}</span>
              </button>
              {sessionError && <span className="text-[10px] text-red-400 max-w-50 text-right">{sessionError}</span>}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-border-subtle gap-0 overflow-x-auto">
          {[
            ["browse", `Browse Knowledge (${contributions.length})`],
            ["mine", `My Mining Vault (${myContributions.length})`],
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => {
                if (tab !== "browse" && !profile) {
                  signIn();
                  return;
                }
                setActiveTab(tab as typeof activeTab);
              }}
              className={cn(
                "pt-2.5 pb-3 mr-6 text-[13px] font-bold border-b-2 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer",
                activeTab === tab
                  ? "text-text-primary border-accent-violet"
                  : "text-text-tertiary border-transparent hover:text-text-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {(["all", "DATASET", "PROMPT", "MEMORY", "MODEL"] as const).map((t) => {
              const tc = t !== "all" ? TYPE_CONFIG[t] : null;
              const count = t === "all" ? contributions.length : contributions.filter((c) => c.type === t).length;

              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border capitalize transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                    typeFilter === t
                      ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                      : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary",
                  )}
                >
                  {tc && <tc.icon className="h-3.5 w-3.5" style={{ color: tc.color }} />}
                  <span>{t === "all" ? `All Types (${count})` : `${tc?.label} (${count})`}</span>
                </button>
              );
            })}
          </div>

          {/* Search, Sort & View Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-60 relative">
              <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, description, tags, or contributor…"
                className="w-full bg-bg-elevated/80 border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-bg-elevated/80 border border-border-strong hover:border-border-hover rounded-[8px] pl-3 pr-7 py-1.75 text-[12px] font-semibold text-text-secondary outline-none cursor-pointer"
                >
                  <option value="uses-desc">Sort: Most Resolved (Uses)</option>
                  <option value="price-asc">Sort: Price (Low → High)</option>
                  <option value="price-desc">Sort: Price (High → Low)</option>
                  <option value="newest">Sort: Recently Added</option>
                </select>
                <ChevronDown className="h-3 w-3 text-text-quaternary absolute right-2 pointer-events-none" />
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center rounded-[8px] bg-bg-elevated border border-border-strong p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                    viewMode === "grid" ? "bg-accent-dark text-accent-violet" : "text-text-quaternary hover:text-text-secondary"
                  }`}
                  title="Visual Card Grid Mode"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                    viewMode === "table" ? "bg-accent-dark text-accent-violet" : "text-text-quaternary hover:text-text-secondary"
                  }`}
                  title="Dense Developer Table Mode"
                >
                  <TableIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-bg-elevated border border-border-subtle rounded-[16px] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-12 text-center shadow-xs">
            <Database className="h-8 w-8 text-text-quaternary mx-auto mb-3" />
            <div className="text-[15px] font-bold text-text-primary mb-1">No Knowledge Items Found</div>
            <p className="text-[12px] text-text-tertiary mb-5">
              {query ? "No items match your search filters." : "Be the first to mine and monetize a dataset, prompt, or model."}
            </p>
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              + Mine First Asset
            </button>
          </div>
        )}

        {/* Visual Cards View Mode */}
        {!isLoading && filtered.length > 0 && viewMode === "grid" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedKnowledge.map((c) => {
                const tc = TYPE_CONFIG[c.type];
                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/knowledge/${c.id}`)}
                    className="bg-bg-elevated border border-border-subtle hover:border-accent-violet/40 rounded-[16px] p-4.5 transition-all duration-150 hover:-translate-y-0.5 shadow-xs flex flex-col justify-between gap-3 group cursor-pointer"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div
                          className="h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0 border border-border-strong"
                          style={{ background: tc.bg }}
                        >
                          <tc.icon className="h-5 w-5" style={{ color: tc.color }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-border-strong/50"
                            style={{ background: tc.bg, color: tc.color }}
                          >
                            {tc.label}
                          </span>
                          {c.verifiedAt && (
                            <span className="text-[9.5px] font-bold px-1.75 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/25 flex items-center gap-0.5">
                              <ShieldCheck className="h-3 w-3" />
                              <span>Verified</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Contributor */}
                      <div className="text-[14px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors mb-1 block line-clamp-1">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-text-quaternary mb-2.5 font-mono">
                        by <span className="text-text-secondary font-semibold">{c.contributor}</span>
                      </div>
                      <p className="text-[11.5px] text-text-tertiary leading-[1.55] line-clamp-2 min-h-9 mb-3">
                        {c.description}
                      </p>

                      {/* Tags */}
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {c.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-bg-surface3 text-text-tertiary border border-border-strong"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Metrics & Actions */}
                    <div className="border-t border-border-subtle pt-3 flex flex-col gap-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[16px] font-extrabold font-mono text-accent-violet">
                            ${c.priceUsdc}
                          </span>
                          <span className="text-[10px] text-text-quaternary ml-1">USDC / use</span>
                        </div>
                        <div className="text-[11px] font-mono text-text-tertiary">
                          <strong className="text-text-primary">{c.usageCount.toLocaleString()}</strong> resolutions
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingItem(c);
                          }}
                          className="py-1.75 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[11.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="h-3 w-3 text-accent-violet" />
                          <span>Sample</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/knowledge/${c.id}`);
                          }}
                          className="py-1.75 rounded-[8px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/35 text-[11.5px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalKnowledgePages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(knowledgePage - 1) * KNOWLEDGE_PAGE_SIZE + 1}–{Math.min(knowledgePage * KNOWLEDGE_PAGE_SIZE, filtered.length)} of {filtered.length} assets</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={knowledgePage <= 1}
                    onClick={() => setKnowledgePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {knowledgePage} of {totalKnowledgePages}</span>
                  <button
                    type="button"
                    disabled={knowledgePage >= totalKnowledgePages}
                    onClick={() => setKnowledgePage((p) => Math.min(totalKnowledgePages, p + 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pro Data Table View Mode */}
        {!isLoading && filtered.length > 0 && viewMode === "table" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[16px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10.5px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Knowledge Asset</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Contributor</th>
                      <th className="py-3.5 px-4">Resolution Price</th>
                      <th className="py-3.5 px-4">Agent Uses</th>
                      <th className="py-3.5 px-4">Verification</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {paginatedKnowledge.map((c) => {
                      const tc = TYPE_CONFIG[c.type];
                      return (
                        <tr
                          key={c.id}
                          onClick={() => router.push(`/knowledge/${c.id}`)}
                          className="hover:bg-white/2 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-text-primary">{c.title}</div>
                            <div className="text-[10px] text-text-quaternary line-clamp-1 max-w-xs">{c.description}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: tc.bg, color: tc.color }}
                            >
                              {tc.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            {c.contributor}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-accent-violet">
                            ${c.priceUsdc} USDC
                          </td>
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            {c.usageCount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            {c.verifiedAt ? (
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/25">
                                Verified
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-text-quaternary font-mono">Unverified</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setInspectingItem(c)}
                                className="p-1.5 rounded-[6px] bg-bg-surface3 text-text-secondary hover:text-accent-violet border border-border-subtle transition-colors cursor-pointer"
                                title="Inspect Sample Payload"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => router.push(`/knowledge/${c.id}`)}
                                className="px-3 py-1 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[11px] font-bold hover:bg-accent-violet hover:text-white transition-all cursor-pointer"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalKnowledgePages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(knowledgePage - 1) * KNOWLEDGE_PAGE_SIZE + 1}–{Math.min(knowledgePage * KNOWLEDGE_PAGE_SIZE, filtered.length)} of {filtered.length} assets</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={knowledgePage <= 1}
                    onClick={() => setKnowledgePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {knowledgePage} of {totalKnowledgePages}</span>
                  <button
                    type="button"
                    disabled={knowledgePage >= totalKnowledgePages}
                    onClick={() => setKnowledgePage((p) => Math.min(totalKnowledgePages, p + 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
