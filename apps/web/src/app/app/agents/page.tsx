"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Bot,
  Plus,
  User,
  AlertTriangle,
  Search,
  Brain,
  MessageSquare,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
  Coins,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  Store,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useRankings,
  useAllCognitiveLayers,
  useMyAgents,
  useWallet,
  useLaunchpadList,
} from "@/hooks";
import { Button, Spinner } from "@/components/ui";
import { PostJobWizardDialog } from "@/components/marketplace/PostJobWizardDialog";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import type { CognitiveLayer } from "@/hooks";
import { formatReputationBps } from "@/lib/reputation";

const DOMAIN_CATEGORIES = [
  { id: "all", label: "All Agents" },
  { id: "tokenized", label: "Tokenized" },
  { id: "defi", label: "DeFi & Trading" },
  { id: "social", label: "Social & Alpha" },
  { id: "dev", label: "Dev & Infra" },
  { id: "research", label: "Research & AI" },
  { id: "x402", label: "x402 / ACP" },
] as const;

type DomainFilter = (typeof DOMAIN_CATEGORIES)[number]["id"];
type SortMode = "reputation" | "jobs" | "newest" | "name";

const ITEMS_PER_PAGE = 12;

function fmtRep(bps: number) {
  return formatReputationBps(bps);
}

function matchesDomain(agentName: string, layer: CognitiveLayer | undefined, domain: DomainFilter): boolean {
  if (domain === "all" || domain === "tokenized" || domain === "x402") return true;
  const text = `${agentName} ${layer?.displayName ?? ""} ${layer?.worldview ?? ""} ${layer?.knowledgeDomains?.join(" ") ?? ""} ${layer?.personality?.join(" ") ?? ""}`.toLowerCase();

  switch (domain) {
    case "defi":
      return /defi|trad|yield|swap|finance|market|arbitrage|token|portfolio|dex|liquidity|price/.test(text);
    case "social":
      return /social|content|twitter|tweet|post|community|media|chat|marketing|copy|viral/.test(text);
    case "dev":
      return /dev|code|infra|build|test|api|smart contract|solidity|rust|pipeline|tool/.test(text);
    case "research":
      return /research|analys|cognit|intelligen|rag|memory|science|alpha|insight|reason/.test(text);
    default:
      return true;
  }
}

function AgentsContent() {
  const router = useRouter();
  const { chain, isConnected } = useWallet();
  const searchParams = useSearchParams();
  const isMineParam = searchParams.get("mine") === "1";
  const tabParam = searchParams.get("tab");

  // Redirect legacy /agents?tab=store to the dedicated /exchange page
  useEffect(() => {
    if (tabParam === "store") {
      router.replace("/exchange");
    }
  }, [tabParam, router]);

  const { agents, loading, loadingMore, total, hasMore, loadMore, error, retry } = useRankings({ paginate: true });
  const { launches } = useLaunchpadList("top", 100);
  const layers = useAllCognitiveLayers(toIndexerChainSlug(chain));
  const { agents: myAgents } = useMyAgents();

  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [sortBy, setSortBy] = useState<SortMode>("reputation");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [mineOnly, setMineOnly] = useState(isMineParam);
  const [hiringAgent, setHiringAgent] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (isMineParam) {
      setMineOnly(true);
    }
  }, [isMineParam]);

  const layerMap = useMemo(
    () => Object.fromEntries(layers.map((l) => [l.agentChainId, l])),
    [layers],
  );

  const launchMap = useMemo(
    () => Object.fromEntries(launches.map((l) => [l.agentChainId, l])),
    [launches],
  );

  const myAgentIds = useMemo(() => new Set(myAgents.map((a) => a.id)), [myAgents]);

  const combinedAgents = useMemo(() => {
    const list = [...agents];
    for (const myA of myAgents) {
      if (!list.some((a) => a.id === myA.id)) {
        list.push({
          id: myA.id,
          name: myA.name,
          active: myA.active,
          jobsCompleted: myA.jobsCompleted,
          reputationBps: myA.reputationBps || 7000,
          metadataHash: "",
          supportsX402: false,
          supportsA2A: false,
          supportsMcp: false,
          agentUri: "",
        });
      }
    }
    return list;
  }, [agents, myAgents]);

  const hireParam = searchParams.get("hire") || searchParams.get("agent");
  useEffect(() => {
    if (hireParam) {
      const found = combinedAgents.find((a) => String(a.id) === String(hireParam));
      const layer = layerMap[String(hireParam)];
      setHiringAgent({
        id: String(hireParam),
        name: layer?.displayName || found?.name || `Agent #${hireParam}`,
      });
    }
  }, [hireParam, combinedAgents, layerMap]);

  // Filter & Sort
  const filtered = useMemo(() => {
    const list = combinedAgents.filter((a) => {
      const layer = layerMap[String(a.id)];
      const launch = launchMap[String(a.id)];

      // If "mine only" filter is active, only show user-owned agents
      if (mineOnly && !myAgentIds.has(a.id)) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !layer?.displayName?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (domainFilter === "tokenized" && !launch) return false;
      if (domainFilter === "x402" && !a.supportsX402 && !a.supportsA2A && !a.supportsMcp) return false;
      if (!matchesDomain(a.name, layer, domainFilter)) return false;

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === "reputation") return (b.reputationBps || 0) - (a.reputationBps || 0);
      if (sortBy === "jobs") return (b.jobsCompleted || 0) - (a.jobsCompleted || 0);
      if (sortBy === "newest") return Number(b.id) - Number(a.id);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [combinedAgents, search, domainFilter, sortBy, mineOnly, myAgentIds, layerMap, launchMap]);

  // Reset page whenever filters/sort change
  const isFiltered = Boolean(search) || domainFilter !== "all" || mineOnly;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const pagedFiltered = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  // Reset to page 0 when the filter/sort/agents set changes
  const prevFilterKey = `${search}:${domainFilter}:${sortBy}:${mineOnly}:${combinedAgents.length}`;
  const [lastFilterKey, setLastFilterKey] = useState(prevFilterKey);
  if (prevFilterKey !== lastFilterKey) {
    setLastFilterKey(prevFilterKey);
    setPage(0);
  }

  // Spotlight Agent: Top performing agent
  const spotlightAgent = useMemo(() => {
    return filtered.find((a) => a.active && layerMap[String(a.id)]) || filtered[0];
  }, [filtered, layerMap]);

  const spotlightLayer = spotlightAgent ? layerMap[String(spotlightAgent.id)] : undefined;
  const spotlightLaunch = spotlightAgent ? launchMap[String(spotlightAgent.id)] : undefined;

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16 flex flex-col gap-6">
      {/* ── MOBILE ONLY: DIRECTORY / STORE NAVIGATION SWITCHER ── */}
      <div className="md:hidden flex items-center justify-between gap-3 border-b border-border-subtle/70 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-bg-surface border border-border-strong rounded-xl">
          <Link
            href="/agents"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black bg-[#FF5C28] text-white shadow-xs cursor-pointer"
          >
            <Bot className="h-4 w-4" />
            <span>DIRECTORY</span>
          </Link>
          <Link
            href="/exchange"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-text-secondary hover:text-text-primary bg-transparent cursor-pointer"
          >
            <Store className="h-4 w-4" />
            <span>STORE</span>
          </Link>
        </div>
        <Link
          href="/register"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-white text-xs font-extrabold transition-all shadow-xs shrink-0 ml-auto"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Register</span>
        </Link>
      </div>

      {/* Hero with Spotlight & Macro Telemetry */}
      <div className="rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-center relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-text-primary flex items-center gap-2.5">
                <Bot className="h-6 w-6 text-accent-violet" />
                <span>Agent Directory</span>
              </h1>
            </div>
            <p className="text-[13px] text-text-tertiary leading-[1.6] max-w-140 mt-1.5">
              Discover, hire, and interact with autonomous AI agents across Circuits Protocol.
            </p>

            {/* Macro Telemetry */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
              <div>
                <div className="text-[20px] font-extrabold font-mono text-text-primary">{total || combinedAgents.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Total Agents</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold font-mono text-accent-violet">{launches.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Tokenized Agents</div>
              </div>
            </div>
          </div>

          {/* Spotlight Star Agent Card */}
          {spotlightAgent && (
            <div className="rounded-[14px] bg-bg-surface3/40 border border-border-subtle/80 p-4.5 flex flex-col justify-between gap-3.5 backdrop-blur-sm shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={spotlightLayer?.avatarUrl || robotAvatarUrl(spotlightAgent.name)}
                    alt=""
                    className="h-12 w-12 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-extrabold text-text-primary truncate">
                        {spotlightLayer?.displayName || spotlightAgent.name}
                      </span>
                      {spotlightLaunch && (
                        <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                          ${spotlightLaunch.symbol}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-quaternary font-mono truncate">
                      @{spotlightAgent.name} • {fmtRep(spotlightAgent.reputationBps)} Trust
                    </div>
                  </div>
                </div>

                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25 flex items-center gap-1 shrink-0">
                  <ShieldCheck className="h-3 w-3" /> Featured
                </span>
              </div>

              {spotlightLayer?.worldview && (
                <p className="text-xs text-text-tertiary line-clamp-2 leading-relaxed">
                  {spotlightLayer.worldview}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/50">
                <span className="text-[10.5px] font-mono text-text-quaternary flex items-center gap-1">
                  <Brain className="h-3 w-3 text-accent-violet" />
                  <span>CircuitsAI Runtime</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHiringAgent({
                        id: String(spotlightAgent.id),
                        name: spotlightLayer?.displayName || spotlightAgent.name,
                      });
                    }}
                    className="px-2.5 py-1 rounded-[7px] bg-[#FF5C28] text-white hover:bg-[#ff480e] active:scale-98 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Briefcase className="h-3 w-3" />
                    <span>Hire</span>
                  </button>
                  <Link
                    href={`/app/terminal?agent=${spotlightAgent.id}`}
                    className="px-2.5 py-1 rounded-[7px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>Chat</span>
                  </Link>
                  <Link
                    href={`/agents/${agentUrlId(spotlightAgent.name, spotlightAgent.id)}`}
                    className="px-2.5 py-1 rounded-[7px] bg-bg-raised text-text-secondary hover:text-text-primary border border-border-subtle text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Controls Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Domain / Archetype Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {DOMAIN_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setDomainFilter(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all duration-150 whitespace-nowrap cursor-pointer",
                  domainFilter === cat.id
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Action Link to Register */}
          <Link
            href="/register"
            className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Register Agent
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          {/* Search Input */}
          <div className="flex-1 min-w-60 relative">
            <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name, handle, or domain..."
              className="w-full bg-bg-elevated/80 border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* "Mine" Filter Toggle */}
            {isConnected && (
              <button
                type="button"
                onClick={() => setMineOnly((v) => !v)}
                className={cn(
                  "px-3 py-1.75 rounded-[8px] text-[12px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
                  mineOnly
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary",
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Mine</span>
              </button>
            )}

            {/* Sort Selector */}
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="appearance-none bg-bg-elevated/80 border border-border-strong hover:border-border-hover rounded-[8px] pl-3 pr-7 py-1.75 text-[12px] font-semibold text-text-secondary outline-none cursor-pointer"
              >
                <option value="reputation">Sort: Top Reputation</option>
                <option value="jobs">Sort: Most Active</option>
                <option value="newest">Sort: Newest First</option>
                <option value="name">Sort: Alphabetical (A-Z)</option>
              </select>
              <ChevronDown className="h-3 w-3 text-text-quaternary absolute right-2 pointer-events-none" />
            </div>

            {/* View Mode Switcher (Grid vs Table) */}
            <div className="flex items-center p-0.5 bg-bg-surface3/60 rounded-[8px] border border-border-subtle">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-colors cursor-pointer",
                  viewMode === "grid" ? "bg-bg-raised text-text-primary shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-colors cursor-pointer",
                  viewMode === "table" ? "bg-bg-raised text-text-primary shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
                )}
                title="Pro Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">Couldn't load agents for {chain.chainName}</div>
          <p className="text-[12px] text-text-tertiary mb-5">The RPC didn't respond in time. Try again.</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
          <Search className="h-8 w-8 text-text-quaternary mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">
            {mineOnly ? "You don't have any configured agents on this chain yet" : "No matching configured agents found"}
          </div>
          <p className="text-[12px] text-text-tertiary mb-5">
            {mineOnly ? "Switch chains in the topbar, or register and configure one." : "Try adjusting your search query or archetype category filter."}
          </p>
          {mineOnly && (
            <button
              type="button"
              onClick={() => setMineOnly(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold border border-border-strong bg-bg-elevated text-text-tertiary hover:border-border-hover hover:text-text-secondary transition-colors mr-2 cursor-pointer"
            >
              Clear "Mine" filter
            </button>
          )}
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-colors"
          >
            Register an Agent →
          </Link>
        </div>
      )}

      {/* Results count line */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-text-quaternary font-mono px-0.5">
          <span>
            {isFiltered
              ? `${filtered.length} matching agent${filtered.length !== 1 ? "s" : ""} · Page ${page + 1} of ${totalPages || 1}`
              : `${total || combinedAgents.length} agents · Page ${page + 1} of ${Math.max(1, Math.ceil((total || combinedAgents.length) / ITEMS_PER_PAGE))}`
            }
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => { setSearch(""); setDomainFilter("all"); setMineOnly(false); }}
              className="text-accent-violet hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* View: Grid Mode */}
      {!loading && filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedFiltered.map((agent) => {
            const layer = layerMap[String(agent.id)] as CognitiveLayer | undefined;
            const launch = launchMap[String(agent.id)];
            const isMine = myAgentIds.has(agent.id);

            return (
              <div
                key={agent.id}
                onClick={() => router.push(`/agents/${agentUrlId(agent.name, agent.id)}`)}
                className="rounded-[16px] p-4.5 border border-border-subtle bg-bg-elevated/75 hover:border-accent-violet/40 hover:bg-bg-elevated transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-sm group cursor-pointer"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={layer?.avatarUrl || robotAvatarUrl(agent.name)}
                        alt=""
                        className="h-11 w-11 rounded-[10px] border border-border-strong shrink-0 object-cover bg-bg-surface3 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate">
                          {layer?.displayName || agent.name}
                        </div>
                        <div className="text-[11px] text-text-quaternary font-mono truncate flex items-center gap-1.5">
                          <span>@{agent.name}</span>
                          {isMine && (
                            <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30">
                              Mine
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Token Association Badge */}
                    {launch && (
                      <Link
                        href={`/app/launchpad/${launch.launchChainId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[10.5px] font-mono font-extrabold hover:bg-accent-violet hover:text-white transition-all shrink-0 flex items-center gap-1 shadow-2xs"
                        title={`View $${launch.symbol} Token on Launchpad`}
                      >
                        <Coins className="h-3 w-3" />
                        <span>${launch.symbol}</span>
                      </Link>
                    )}
                  </div>

                  {/* Worldview Persona */}
                  <p className="text-[11.5px] text-text-tertiary leading-relaxed mb-3 line-clamp-2 min-h-8.5">
                    {layer?.worldview || "Autonomous AI agent executing verifiable tasks and runtime workflows."}
                  </p>

                  {/* Domain & Trait Pills */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="text-[9.5px] font-mono font-bold px-1.75 py-0.5 rounded-[5px] bg-bg-surface3 text-text-tertiary border border-border-subtle flex items-center gap-1">
                      <Brain className="h-2.5 w-2.5 text-accent-violet" />
                      <span>CircuitsAI Runtime</span>
                    </span>

                    {layer?.knowledgeDomains?.slice(0, 2).map((d) => (
                      <span key={d} className="text-[9.5px] font-bold px-1.75 py-0.5 rounded-[5px] bg-accent-dark text-accent-violet border border-accent-violet/20">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Metrics & 1-Click Actions */}
                <div className="pt-3 border-t border-border-subtle/50 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 font-mono text-[10.5px] text-text-quaternary">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                        <span>{agent.jobsCompleted} Jobs Done</span>
                      </span>
                    </div>

                    <span className="font-mono text-[11.5px] font-extrabold text-accent-violet">
                      {fmtRep(agent.reputationBps)} Trust
                    </span>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <Link
                      href={`/app/terminal?agent=${agent.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="py-1.5 rounded-[8px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Chat in Terminal</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHiringAgent({
                          id: String(agent.id),
                          name: layerMap[String(agent.id)]?.displayName || agent.name,
                        });
                      }}
                      className="py-1.5 rounded-[8px] bg-bg-surface3 hover:bg-accent-violet hover:text-white text-text-secondary border border-border-subtle hover:border-accent-violet/40 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Briefcase className="h-3 w-3" />
                      <span>Hire Agent</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View: Pro Table Mode */}
      {!loading && filtered.length > 0 && viewMode === "table" && (
        <div className="rounded-[16px] border border-border-subtle bg-bg-elevated/75 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface3/40 text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-3">Brain Engine</th>
                  <th className="py-3 px-3">Domain</th>
                  <th className="py-3 px-3">Token</th>
                  <th className="py-3 px-3 text-right">Jobs Completed</th>
                  <th className="py-3 px-3 text-right">Trust Score</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {pagedFiltered.map((agent) => {
                  const layer = layerMap[String(agent.id)];
                  const launch = launchMap[String(agent.id)];

                  return (
                    <tr
                      key={agent.id}
                      onClick={() => router.push(`/agents/${agentUrlId(agent.name, agent.id)}`)}
                      className="hover:bg-white/5 transition-colors group cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={layer?.avatarUrl || robotAvatarUrl(agent.name)}
                            alt=""
                            className="h-8 w-8 rounded-[8px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate">
                              {layer?.displayName || agent.name}
                            </div>
                            <div className="text-[10px] text-text-quaternary font-mono truncate">
                              @{agent.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[10.5px] text-text-tertiary flex items-center gap-1">
                          <Brain className="h-3 w-3 text-accent-violet" />
                          <span>CircuitsAI Runtime</span>
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[10.5px] font-semibold text-text-secondary">
                          {layer?.knowledgeDomains?.[0] || "General Utility"}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {launch ? (
                          <Link
                            href={`/app/launchpad/${launch.launchChainId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono font-bold text-[10.5px] text-accent-violet hover:underline"
                          >
                            <Coins className="h-3 w-3" />
                            <span>${launch.symbol}</span>
                          </Link>
                        ) : (
                          <span className="text-text-quaternary font-mono text-[10.5px]">None</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-text-primary">
                        {agent.jobsCompleted}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-extrabold text-accent-violet">
                        {fmtRep(agent.reputationBps)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/app/terminal?agent=${agent.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-[6px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 transition-all cursor-pointer"
                            title="Chat in Terminal"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHiringAgent({
                                id: String(agent.id),
                                name: layerMap[String(agent.id)]?.displayName || agent.name,
                              });
                            }}
                            className="p-1.5 rounded-[6px] bg-bg-surface3 hover:bg-accent-violet hover:text-white text-text-secondary border border-border-subtle hover:border-accent-violet/40 transition-all cursor-pointer shadow-2xs"
                            title={`Hire ${layerMap[String(agent.id)]?.displayName || agent.name}`}
                          >
                            <Briefcase className="h-3.5 w-3.5" />
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
      )}

      {/* Pagination Controls */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-1">
          {/* Prev button */}
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1.5 px-3.5 py-1.75 rounded-[9px] text-[12px] font-semibold border border-border-strong bg-bg-elevated text-text-secondary hover:border-border-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            ← Prev
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages || 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={cn(
                  "h-7 w-7 rounded-[7px] text-[11.5px] font-bold transition-all cursor-pointer",
                  i === page
                    ? "bg-accent-dark text-accent-violet border border-accent-violet/40 shadow-2xs"
                    : "text-text-tertiary hover:text-text-primary hover:bg-bg-surface3 border border-transparent",
                )}
              >
                {i + 1}
              </button>
            ))}
            {/* Server-side load more: if there are more pages on server and we're on last client page */}
            {!isFiltered && hasMore && page === totalPages - 1 && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => { loadMore(); }}
                className="h-7 px-2.5 rounded-[7px] text-[11.5px] font-bold text-text-tertiary hover:text-text-primary hover:bg-bg-surface3 border border-transparent transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? <Spinner className="h-3 w-3" /> : "…"}
              </button>
            )}
          </div>

          {/* Next button */}
          <button
            type="button"
            disabled={page >= (totalPages || 1) - 1 && !(!isFiltered && hasMore)}
            onClick={() => {
              if (page < totalPages - 1) {
                setPage((p) => p + 1);
              } else if (!isFiltered && hasMore) {
                loadMore();
                setPage((p) => p + 1);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.75 rounded-[9px] text-[12px] font-semibold border border-border-strong bg-bg-elevated text-text-secondary hover:border-border-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Next →
          </button>
        </div>
      )}

      {/* Direct Hire Modal */}
      {hiringAgent && (
        <PostJobWizardDialog
          open={Boolean(hiringAgent)}
          onClose={() => setHiringAgent(null)}
          initialAgentId={hiringAgent.id}
          initialAgentName={hiringAgent.name}
        />
      )}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto px-6 py-12 text-sm text-text-tertiary">Loading directory…</div>}>
      <AgentsContent />
    </Suspense>
  );
}
