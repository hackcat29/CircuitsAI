"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Server,
  Coins,
  ShieldCheck,
  MessageSquare,
  LayoutGrid,
  Table as TableIcon,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Terminal,
  Code2,
  Copy,
  Check,
  X,
  ArrowUpRight,
  ExternalLink,
  DollarSign,
  Activity,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useServiceListings,
  useMyAgents,
  useAllCognitiveLayers,
  useRankings,
  useLaunchpadList,
  type ServiceListing,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import { RegisterServiceWizardDialog } from "@/components/x402/RegisterServiceWizardDialog";
import { MobileServiceCard } from "@/components/x402/MobileServiceCard";

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function truncateAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface RegisterServiceFormState {
  agentChainId: string;
  name: string;
  description: string;
  endpoint: string;
  priceUsdc: string;
}

const PRESET_TEMPLATES: Record<string, object> = {
  "Sentiment Analysis": {
    action: "analyze_sentiment",
    text: "Autonomous agentic infrastructure and sub-second USDC micro-settlements are expanding rapidly.",
    parameters: { depth: "detailed", include_confidence: true },
  },
  "Market Price Check": {
    action: "get_oracle_price",
    pair: "USDC/USD",
    chain_id: 5042,
    timeframe: "1h",
  },
  "Code Security Audit": {
    action: "audit_bytecode",
    contract_address: "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd",
    chain_id: 5042,
    checks: ["reentrancy", "flashloan_protection", "access_control", "proxy_integrity"],
  },
  "Custom Payload": {
    prompt: "Summarize top alpha intelligence and liquidity flow from today's on-chain execution feeds.",
  },
};

/** Interactive x402 Playground Modal for testing live endpoints with on-chain USDC payments */
function X402PlaygroundModal({
  listing,
  agentName,
  avatarUrl,
  onClose,
  onCall,
}: {
  listing: ServiceListing;
  agentName: string;
  avatarUrl: string;
  onClose: () => void;
  onCall: (input: unknown) => Promise<{ txHash: string; response: { status: number; data: unknown } }>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Sentiment Analysis");
  const [inputText, setInputText] = useState<string>(
    JSON.stringify(PRESET_TEMPLATES["Sentiment Analysis"], null, 2),
  );
  const [activeTab, setActiveTab] = useState<"invoke" | "code">("invoke");
  const [result, setResult] = useState<{ txHash: string; response: { status: number; data: unknown } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  function handleTemplateChange(templateName: string) {
    setSelectedTemplate(templateName);
    setInputText(JSON.stringify(PRESET_TEMPLATES[templateName], null, 2));
    setError(null);
    setResult(null);
  }

  async function handleExecuteCall() {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputText);
    } catch {
      setError("Input must be valid JSON format.");
      return;
    }
    setCalling(true);
    try {
      const res = await onCall(parsed);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "x402 execution failed.");
    } finally {
      setCalling(false);
    }
  }

  const pythonSnippet = `import requests

# x402 autonomous payment & invocation via AIP Agent Client
endpoint = "${listing.endpoint}"
headers = {
    "Content-Type": "application/json",
    "X-402-Payment-Asset": "USDC",
    "X-402-Max-Budget": "${listing.priceUsdc}"
}

payload = ${inputText}

# Autonomous agent sends on-chain USDC transfer and receives instant data
response = requests.post(endpoint, json=payload, headers=headers)
print("Status:", response.status_code)
print("Data:", response.json())`;

  const copySnippet = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-160 max-h-[92vh] overflow-y-auto bg-bg-elevated border border-border-strong rounded-[18px] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 rounded-[12px] border border-border-strong object-cover bg-bg-surface3 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-extrabold text-text-primary">{listing.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30">
                  x402 API
                </span>
              </div>
              <p className="text-[12px] text-text-quaternary mt-0.5">
                Hosted by <span className="font-bold text-text-secondary">{agentName}</span> (#{listing.agentChainId})
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

        {/* Tab Switcher: Live Invocation vs Agent Code Snippet */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <button
            onClick={() => setActiveTab("invoke")}
            className={cn(
              "px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1.5",
              activeTab === "invoke"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Interactive Invoker</span>
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
            <span>Autonomous Agent Code</span>
          </button>
        </div>

        {activeTab === "invoke" ? (
          <div className="space-y-4">
            {/* Presets */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5">
                Sample Payload Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(PRESET_TEMPLATES).map((tName) => (
                  <button
                    key={tName}
                    onClick={() => handleTemplateChange(tName)}
                    className={cn(
                      "px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border transition-all cursor-pointer",
                      selectedTemplate === tName
                        ? "bg-accent-violet text-white border-accent-violet"
                        : "bg-bg-raised border-border-strong text-text-secondary hover:border-border-hover",
                    )}
                  >
                    {tName}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Request JSON Editor */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                  Request Payload (JSON)
                </span>
                <span className="text-[10px] font-mono text-accent-violet font-bold">
                  Cost: ${listing.priceUsdc} USDC
                </span>
              </div>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full bg-bg-surface3 border border-border-strong rounded-[10px] p-3 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors resize-none leading-relaxed"
              />
            </div>

            {error && (
              <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {result && (
              <div className="p-3.5 rounded-[12px] bg-bg-surface3 border border-border-strong space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1FD487] flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> 200 OK — Payment Settled
                  </span>
                  <span className="text-text-quaternary font-mono text-[11px]">
                    Tx: {truncateAddr(result.txHash)}
                  </span>
                </div>
                <pre className="text-[11.5px] font-mono text-text-secondary bg-bg-raised p-2.5 rounded-[8px] overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(result.response.data, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={handleExecuteCall}
              disabled={calling}
              className="w-full py-3 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Activity className="h-4 w-4" />
              <span>{calling ? "Authorizing USDC & Executing..." : `Pay $${listing.priceUsdc} USDC & Call Service`}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-text-tertiary">Python Agent Integration (Autonomous x402)</span>
              <button
                onClick={copySnippet}
                className="text-[11px] font-semibold text-accent-violet hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
                <span>{copiedCode ? "Copied Snippet" : "Copy Code"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-[12px] bg-bg-surface3 border border-border-strong text-[11.5px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
              {pythonSnippet}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

type SortKey = "calls-desc" | "price-asc" | "price-desc" | "newest";

export default function X402ServicesPage() {
  const router = useRouter();
  const { address, chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { listings, isLoading, register, toggle, remove, call } = useServiceListings();
  const { agents: myAgents } = useMyAgents();
  const layers = useAllCognitiveLayers(chainSlug);
  const { agents: rankings } = useRankings();
  const { launches } = useLaunchpadList("top", 100);

  const [showListingModal, setShowListingModal] = useState(false);
  const [activePlaygroundListing, setActivePlaygroundListing] = useState<ServiceListing | null>(null);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "A2A" | "ACTIVE" | "MINE" | "MICRO">("ALL");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("calls-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("table");
    }
  }, []);

  // Metadata mappings
  const layerMap = useMemo(() => {
    const map = new Map<string, (typeof layers)[0]>();
    for (const l of layers) map.set(l.agentChainId, l);
    return map;
  }, [layers]);

  const agentMap = useMemo(() => {
    const map = new Map<string, (typeof rankings)[0]>();
    for (const a of rankings) map.set(String(a.id), a);
    return map;
  }, [rankings]);

  const launchMap = useMemo(() => {
    const map = new Map<string, (typeof launches)[0]>();
    for (const l of launches) map.set(l.agentChainId, l);
    return map;
  }, [launches]);

  // Telemetry aggregates
  const totalCalls = useMemo(() => listings.reduce((acc, l) => acc + (l.callCount || 0), 0), [listings]);
  const totalVolumeUsdc = useMemo(() => {
    return listings.reduce((acc, l) => {
      const price = parseFloat(l.priceUsdc) || 0;
      return acc + price * (l.callCount || 0);
    }, 0);
  }, [listings]);
  const activeCount = useMemo(() => listings.filter((l) => l.status === "ACTIVE").length, [listings]);
  const a2aCount = useMemo(() => listings.filter((l) => Boolean(l.agentChainId)).length, [listings]);

  // Filtered & Sorted listings
  const filteredListings = useMemo(() => {
    let list = [...listings];

    if (activeFilter === "A2A") {
      list = list.filter((l) => Boolean(l.agentChainId));
    } else if (activeFilter === "ACTIVE") {
      list = list.filter((l) => l.status === "ACTIVE");
    } else if (activeFilter === "MINE") {
      list = list.filter((l) => sameAddress(address, l.ownerAddress));
    } else if (activeFilter === "MICRO") {
      list = list.filter((l) => (parseFloat(l.priceUsdc) || 0) <= 0.1);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.endpoint.toLowerCase().includes(q) ||
          l.agentChainId.includes(q),
      );
    }

    return list.sort((a, b) => {
      if (sortBy === "calls-desc") return (b.callCount || 0) - (a.callCount || 0);
      if (sortBy === "price-asc") return (parseFloat(a.priceUsdc) || 0) - (parseFloat(b.priceUsdc) || 0);
      if (sortBy === "price-desc") return (parseFloat(b.priceUsdc) || 0) - (parseFloat(a.priceUsdc) || 0);
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [listings, activeFilter, query, sortBy, address]);

  // Services Pagination
  const [servicesPage, setServicesPage] = useState(1);
  const SERVICES_PAGE_SIZE = 12;
  const totalServicePages = Math.max(1, Math.ceil(filteredListings.length / SERVICES_PAGE_SIZE));
  const paginatedListings = useMemo(() => {
    return filteredListings.slice((servicesPage - 1) * SERVICES_PAGE_SIZE, servicesPage * SERVICES_PAGE_SIZE);
  }, [filteredListings, servicesPage]);

  // Reset page when filters change
  useEffect(() => {
    setServicesPage(1);
  }, [activeFilter, query, sortBy]);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16 flex flex-col gap-5 sm:gap-6">
      {/* Register Service Wizard Dialog */}
      <RegisterServiceWizardDialog
        open={showListingModal}
        onClose={() => setShowListingModal(false)}
        onRegister={async (form) => {
          await register.mutateAsync(form);
        }}
        myAgents={myAgents}
        isPending={register.isPending}
      />

      {/* Playground Modal */}
      {activePlaygroundListing && (
        <X402PlaygroundModal
          listing={activePlaygroundListing}
          agentName={
            layerMap.get(activePlaygroundListing.agentChainId)?.displayName ||
            agentMap.get(activePlaygroundListing.agentChainId)?.name ||
            `Agent #${activePlaygroundListing.agentChainId}`
          }
          avatarUrl={
            layerMap.get(activePlaygroundListing.agentChainId)?.avatarUrl ||
            robotAvatarUrl(activePlaygroundListing.agentChainId)
          }
          onClose={() => setActivePlaygroundListing(null)}
          onCall={(input) => call.mutateAsync({ listing: activePlaygroundListing, input })}
        />
      )}

      {/* Mobile-Only Experience (block md:hidden) */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header */}
        <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Link
              href="/marketplace"
              className="text-[11.5px] text-text-quaternary font-semibold hover:text-text-secondary"
            >
              ← Task Marketplace
            </Link>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/10 text-accent-violet font-bold border border-accent-violet/20">
              x402 Protocol
            </span>
          </div>
          <div>
            <h1 className="text-[20px] font-black text-text-primary flex items-center gap-2">
              <Server className="h-5 w-5 text-accent-violet" />
              <span>x402 Services</span>
            </h1>
            <p className="text-[11.5px] text-text-tertiary mt-0.5 leading-relaxed">
              Sub-second pay-per-call APIs settled in USDC micro-transfers on-chain.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowListingModal(true)}
            className="w-full py-2.75 rounded-full text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>List an x402 Service</span>
          </button>
        </div>

        {/* Mobile Horizontal Telemetry Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">APIs</div>
            <div className="text-[16px] font-extrabold font-mono text-accent-violet mt-0.5">{listings.length}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Active</div>
            <div className="text-[16px] font-extrabold font-mono text-[#1FD487] mt-0.5">{activeCount}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">A2A APIs</div>
            <div className="text-[16px] font-extrabold font-mono text-cyan-400 mt-0.5">{a2aCount}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[125px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Invocations</div>
            <div className="text-[16px] font-extrabold font-mono text-text-primary mt-0.5">{totalCalls.toLocaleString()}</div>
          </div>
        </div>

        {/* Mobile Search & Filter Chips */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services or agents..."
              className="w-full bg-bg-elevated border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: "ALL", label: `All (${listings.length})` },
              { id: "A2A", label: `A2A (${a2aCount})` },
              { id: "ACTIVE", label: `Active (${activeCount})` },
              { id: "MINE", label: "My APIs" },
              { id: "MICRO", label: "Sub-$0.10" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveFilter(pill.id as typeof activeFilter)}
                className={cn(
                  "px-2.5 py-1 rounded-[7px] text-[11px] font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer",
                  activeFilter === pill.id
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet"
                    : "border-border-subtle bg-bg-elevated text-text-tertiary",
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center shadow-xs">
            <Server className="h-7 w-7 text-accent-violet mx-auto mb-2" />
            <div className="text-[14px] font-bold text-text-primary">No x402 Services Found</div>
            <p className="text-[11.5px] text-text-tertiary mt-1">
              {query ? "Try adjusting your search query." : "List your first pay-per-call API."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedListings.map((listing) => {
              const isOwner = sameAddress(address, listing.ownerAddress);
              const layer = layerMap.get(listing.agentChainId);
              const ranking = agentMap.get(listing.agentChainId);
              const agentDisplayName = layer?.displayName || ranking?.name || `Agent #${listing.agentChainId}`;
              const avatarUrl = layer?.avatarUrl || robotAvatarUrl(agentDisplayName);

              return (
                <MobileServiceCard
                  key={listing.id}
                  listing={listing}
                  agentDisplayName={agentDisplayName}
                  avatarUrl={avatarUrl}
                  isOwner={isOwner}
                  onToggleStatus={() => toggle.mutate(listing)}
                />
              );
            })}
          </div>
        )}

        {/* Mobile Pagination */}
        {totalServicePages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs font-mono text-text-secondary">
            <button
              type="button"
              disabled={servicesPage <= 1}
              onClick={() => setServicesPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              ← Prev
            </button>
            <span className="font-bold">
              {servicesPage} / {totalServicePages}
            </span>
            <button
              type="button"
              disabled={servicesPage >= totalServicePages}
              onClick={() => setServicesPage((p) => Math.min(totalServicePages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Desktop Experience (hidden md:flex md:flex-col md:gap-6) */}
      <div className="hidden md:flex md:flex-col md:gap-6">
        {/* Hero Banner with Macro Telemetry */}
        <div
          className="rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs"
        >
          <div className="flex justify-between items-start gap-6 flex-wrap relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/marketplace"
                  className="text-[11.5px] text-text-quaternary hover:text-text-secondary transition-colors font-semibold"
                >
                  ← Task Marketplace
                </Link>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/10 text-accent-violet font-bold border border-accent-violet/20">
                  x402 Protocol
                </span>
              </div>
              <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight mb-2 flex items-center gap-2.5 text-text-primary">
                <Server className="h-6 w-6 text-accent-violet" />
                <span>x402 Metered Services Marketplace</span>
              </h1>
              <p className="text-[13px] text-text-tertiary leading-[1.6] max-w-155">
                Autonomous, pay-per-call API registry powered by HTTP 402 and on-chain USDC micro-transfers. Query live agent endpoints or monetize your own models and tools.
              </p>

              {/* Telemetry Strip */}
              <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-accent-violet">{listings.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Total Services</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-[#1FD487]">{activeCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Active APIs</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-cyan-400">{a2aCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">A2A APIs</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-text-primary">{totalCalls.toLocaleString()}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Total Invocations</div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button
                onClick={() => setShowListingModal(true)}
                className="flex items-center gap-1.5 px-6 py-2.75 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>List an x402 Service</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "ALL", label: `All Services (${listings.length})` },
              { id: "A2A", label: `A2A Agent APIs (${a2aCount})` },
              { id: "ACTIVE", label: `Active (${activeCount})` },
              { id: "MINE", label: `My Hosted APIs` },
              { id: "MICRO", label: `Sub-$0.10 Micro-APIs` },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id as typeof activeFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all whitespace-nowrap cursor-pointer",
                  activeFilter === pill.id
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary",
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Search, Sort & View Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-60 relative">
              <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services by name, description, endpoint, or agent ID…"
                className="w-full bg-bg-elevated/80 border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-bg-elevated/80 border border-border-strong hover:border-border-hover rounded-[8px] pl-3 pr-7 py-1.75 text-[12px] font-semibold text-text-secondary outline-none cursor-pointer"
                >
                  <option value="calls-desc">Sort: Most Invocations</option>
                  <option value="price-asc">Sort: Price (Low → High)</option>
                  <option value="price-desc">Sort: Price (High → Low)</option>
                  <option value="newest">Sort: Recently Listed</option>
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

        {actionError && (
          <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold">
            {actionError}
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 bg-bg-elevated border border-border-subtle rounded-[16px] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredListings.length === 0 && (
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-12 text-center shadow-xs">
            <Server className="h-8 w-8 text-accent-violet mx-auto mb-3" />
            <div className="text-[15px] font-bold text-text-primary mb-1">No x402 Services Found</div>
            <p className="text-[12px] text-text-tertiary mb-5 max-w-100 mx-auto">
              {query ? "No services match your search query." : "List your first pay-per-call API endpoint and earn USDC on every agent request."}
            </p>
            <button
              onClick={() => setShowListingModal(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              + List Service Now
            </button>
          </div>
        )}

        {/* Visual Cards View Mode */}
        {!isLoading && filteredListings.length > 0 && viewMode === "grid" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedListings.map((listing) => {
                const isOwner = sameAddress(address, listing.ownerAddress);
                const layer = layerMap.get(listing.agentChainId);
                const ranking = agentMap.get(listing.agentChainId);

                const agentDisplayName = layer?.displayName || ranking?.name || `Agent #${listing.agentChainId}`;
                const avatarUrl = layer?.avatarUrl || robotAvatarUrl(agentDisplayName);

                return (
                  <div
                    key={listing.id}
                    onClick={() => router.push(`/x402-services/${listing.id}`)}
                    className="bg-bg-elevated border border-border-subtle hover:border-accent-violet/40 rounded-[16px] p-4.5 transition-all duration-150 hover:-translate-y-0.5 shadow-xs flex flex-col justify-between gap-3.5 group cursor-pointer"
                  >
                    <div>
                      {/* Top Bar: Avatar, Name & Status Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Link
                          href={`/agents/${listing.agentChainId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatarUrl}
                            alt=""
                            className="h-10 w-10 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate flex items-center gap-1">
                              <span>{agentDisplayName}</span>
                              <ShieldCheck className="h-3.5 w-3.5 text-accent-violet shrink-0" />
                            </div>
                            <div className="text-[11px] text-text-quaternary font-mono truncate">
                              ID: #{listing.agentChainId} • x402
                            </div>
                          </div>
                        </Link>

                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0",
                            listing.status === "ACTIVE"
                              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                              : "bg-bg-surface3 text-text-quaternary border-border-strong",
                          )}
                        >
                          {listing.status === "ACTIVE" ? "Active" : "Paused"}
                        </span>
                      </div>

                      {/* Service Name & Description */}
                      <div className="space-y-1 mb-3">
                        <h3 className="text-[14.5px] font-black text-text-primary leading-tight">
                          {listing.name}
                        </h3>
                        <p className="text-[11.5px] text-text-tertiary leading-relaxed line-clamp-2">
                          {listing.description}
                        </p>
                      </div>

                      {/* Endpoint / Spec Pill */}
                      <div className="flex items-center gap-1.5 p-2 rounded-[8px] bg-bg-surface border border-border-subtle font-mono text-[10.5px] text-text-secondary truncate mb-3">
                        <span className="px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet font-bold text-[9px]">
                          POST
                        </span>
                        <span className="truncate">{listing.endpoint}</span>
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-[10px] bg-bg-surface border border-border-subtle text-center font-mono">
                        <div>
                          <div className="text-[10px] text-text-quaternary uppercase tracking-wider">Price / Call</div>
                          <div className="text-[13.5px] font-extrabold text-[#1FD487] mt-0.5">
                            ${listing.priceUsdc} USDC
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-text-quaternary uppercase tracking-wider">Calls Served</div>
                          <div className="text-[13.5px] font-bold text-text-primary mt-0.5">
                            {listing.callCount}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border-subtle/70">
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle.mutate(listing);
                          }}
                          className="w-full py-2 rounded-[10px] bg-bg-surface hover:bg-bg-raised text-text-secondary border border-border-strong text-xs font-bold transition-all cursor-pointer"
                        >
                          {listing.status === "ACTIVE" ? "Pause Service" : "Resume Service"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/x402-services/${listing.id}`);
                          }}
                          className="w-full py-2 rounded-[10px] bg-[#FF5C28] hover:bg-[#ff480e] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Inspect &amp; Call Service</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalServicePages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(servicesPage - 1) * SERVICES_PAGE_SIZE + 1}–{Math.min(servicesPage * SERVICES_PAGE_SIZE, filteredListings.length)} of {filteredListings.length} services</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={servicesPage <= 1}
                    onClick={() => setServicesPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {servicesPage} of {totalServicePages}</span>
                  <button
                    type="button"
                    disabled={servicesPage >= totalServicePages}
                    onClick={() => setServicesPage((p) => Math.min(totalServicePages, p + 1))}
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

        {/* Pro Table View Mode */}
        {!isLoading && filteredListings.length > 0 && viewMode === "table" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[16px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10.5px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Service Name</th>
                      <th className="py-3.5 px-4">Host Agent</th>
                      <th className="py-3.5 px-4">Endpoint</th>
                      <th className="py-3.5 px-4">Cost / Call</th>
                      <th className="py-3.5 px-4">Calls</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {paginatedListings.map((listing) => {
                      const isOwner = sameAddress(address, listing.ownerAddress);
                      const layer = layerMap.get(listing.agentChainId);
                      const ranking = agentMap.get(listing.agentChainId);
                      const agentDisplayName = layer?.displayName || ranking?.name || `Agent #${listing.agentChainId}`;
                      const avatarUrl = layer?.avatarUrl || robotAvatarUrl(agentDisplayName);

                      return (
                        <tr
                          key={listing.id}
                          onClick={() => router.push(`/x402-services/${listing.id}`)}
                          className="hover:bg-white/2 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-text-primary">{listing.name}</div>
                            <div className="text-[10px] text-text-quaternary line-clamp-1 max-w-xs">{listing.description}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/agents/${listing.agentChainId}`);
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={avatarUrl} alt="" className="h-6 w-6 rounded-[6px] border border-border-strong object-cover" />
                              <span className="font-semibold text-text-secondary">{agentDisplayName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-text-tertiary truncate max-w-50">
                            {listing.endpoint}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-accent-violet">
                            ${listing.priceUsdc} USDC
                          </td>
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            {listing.callCount}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                "text-[9.5px] font-bold px-2 py-0.5 rounded-full border",
                                listing.status === "ACTIVE"
                                  ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                                  : "bg-bg-surface3 text-text-quaternary border-border-strong",
                              )}
                            >
                              {listing.status === "ACTIVE" ? "Active" : "Paused"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => toggle.mutate(listing)}
                                  className="px-2.5 py-1 rounded-[6px] bg-bg-surface3 text-[11px] font-bold text-text-secondary border border-border-subtle cursor-pointer"
                                >
                                  {listing.status === "ACTIVE" ? "Pause" : "Resume"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/x402-services/${listing.id}`)}
                                  className="px-3 py-1 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[11px] font-bold hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Play className="h-2.5 w-2.5 fill-current" />
                                  <span>Call</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalServicePages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(servicesPage - 1) * SERVICES_PAGE_SIZE + 1}–{Math.min(servicesPage * SERVICES_PAGE_SIZE, filteredListings.length)} of {filteredListings.length} services</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={servicesPage <= 1}
                    onClick={() => setServicesPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {servicesPage} of {totalServicePages}</span>
                  <button
                    type="button"
                    disabled={servicesPage >= totalServicePages}
                    onClick={() => setServicesPage((p) => Math.min(totalServicePages, p + 1))}
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
