"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Crown,
  Medal,
  Award,
  Plus,
  AlertTriangle,
  Bot,
  ShieldCheck,
  Layers,
  Gauge,
  Scale,
  Coins,
  Sparkles,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Activity,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useRankings,
  useAllCognitiveLayers,
  useWallet,
  useProtocolStats,
  useTotalProtocolVolume,
} from "@/hooks";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import { formatCount, formatUsdc } from "@/lib/format";
import { Button, Spinner } from "@/components/ui";
import {
  RankingsFilterBar,
  AgentComparisonModal,
  type DomainFilter,
} from "@/components/rankings";
import { computeEnhancedSla, formatReputationBps } from "@/lib/reputation";

const PODIUM_CONFIGS = [
  { border: "rgba(184,188,198,.3)", bg: "var(--color-bg-elevated)", valColor: "#B8BCC6", elevated: false, icon: Medal, label: "Silver" },
  { border: "rgba(255,177,61,.4)", bg: "var(--color-bg-elevated)", valColor: "#FFB13D", elevated: true, icon: Crown, label: "Gold" },
  { border: "rgba(217,119,6,.32)", bg: "var(--color-bg-elevated)", valColor: "#D97706", elevated: false, icon: Award, label: "Bronze" },
];

function fmtRep(bps: number): string {
  return formatReputationBps(bps);
}

function computeSla(reputationBps: number, jobsCompleted: number) {
  return computeEnhancedSla(reputationBps, jobsCompleted);
}

function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getGradeStyle(grade?: string) {
  if (!grade) return "bg-bg-surface3 text-text-tertiary border-border-subtle";
  if (grade === "S" || grade === "S-Tier") return "bg-amber-400/10 text-amber-300 border-amber-400/40 font-extrabold";
  if (grade.startsWith("A")) return "bg-[#1FD487]/10 text-[#1FD487] border-[#1FD487]/40 font-bold";
  if (grade.startsWith("B")) return "bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/40 font-semibold";
  return "bg-bg-surface3 text-text-secondary border-border-subtle";
}

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState("Reputation");
  const [selectedDomain, setSelectedDomain] = useState<DomainFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tokenizedOnly, setTokenizedOnly] = useState(false);
  const [x402Only, setX402Only] = useState(false);
  const [a2aOnly, setA2AOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);

  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const sortByParam = activeTab === "Jobs" ? "jobs" : activeTab === "Revenue" ? "revenue" : "reputation";

  const { loading, loadingMore, agents: sorted, total, hasMore, loadMore, error, retry } = useRankings({
    paginate: true,
    sortBy: sortByParam,
  });

  const { totals: stats } = useProtocolStats();
  const { totalUsdc: protocolVolumeUsdc } = useTotalProtocolVolume();

  const { chain: activeChain } = useWallet();
  const layers = useAllCognitiveLayers(toIndexerChainSlug(isEvmChain(activeChain) ? activeChain : MONAD_MAINNET));
  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const avatarByAgentId = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l.avatarUrl])), [layers]);

  // Filter agents by domain, search text, and quick toggles
  const configuredSorted = useMemo(() => {
    return sorted.filter((a) => {
      const layer = layerMap[String(a.id)];

      // Domain filter
      if (selectedDomain !== "all") {
        if (!layer) return false;
        const domains = layer.knowledgeDomains?.map((d) => d.toLowerCase()) || [];
        if (selectedDomain === "defi" && !domains.some((d) => d.includes("defi") || d.includes("trad") || d.includes("yield") || d.includes("swap"))) return false;
        if (selectedDomain === "security" && !domains.some((d) => d.includes("sec") || d.includes("audit") || d.includes("eval"))) return false;
        if (selectedDomain === "social" && !domains.some((d) => d.includes("soc") || d.includes("alpha") || d.includes("feed") || d.includes("media"))) return false;
        if (selectedDomain === "data" && !domains.some((d) => d.includes("data") || d.includes("oracle") || d.includes("scrap"))) return false;
        if (selectedDomain === "orchestration" && !domains.some((d) => d.includes("orch") || d.includes("pipe") || d.includes("swarm") || a.supportsA2A)) return false;
      }

      // Live search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = a.name.toLowerCase().includes(q);
        const matchId = String(a.id) === q || `agent #${a.id}`.includes(q);
        const matchSymbol = a.tokenSymbol?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchSymbol) return false;
      }

      // Quick facet toggles
      if (tokenizedOnly && !a.tokenSymbol) return false;
      if (x402Only && !a.supportsX402) return false;
      if (a2aOnly && !a.supportsA2A) return false;
      if (activeOnly && !a.active) return false;

      return true;
    });
  }, [sorted, layerMap, selectedDomain, searchQuery, tokenizedOnly, x402Only, a2aOnly, activeOnly]);

  // Robust podium slots: strictly guarantees #1 in center, #2 on left, #3 on right
  const podiumSlots = useMemo(() => {
    if (configuredSorted.length >= 3) {
      return [
        { agent: configuredSorted[1], rank: 2, ...PODIUM_CONFIGS[0] },
        { agent: configuredSorted[0], rank: 1, ...PODIUM_CONFIGS[1] },
        { agent: configuredSorted[2], rank: 3, ...PODIUM_CONFIGS[2] },
      ];
    }
    return configuredSorted.slice(0, 3).map((agent, i) => ({
      agent,
      rank: i + 1,
      ...PODIUM_CONFIGS[i === 0 ? 1 : i === 1 ? 0 : 2],
    }));
  }, [configuredSorted]);

  const comparedAgents = useMemo(
    () => sorted.filter((a) => comparedIds.includes(String(a.id))),
    [sorted, comparedIds],
  );

  function toggleCompare(agentId: string) {
    setComparedIds((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId);
      }
      if (prev.length >= 3) {
        return [prev[1]!, prev[2]!, agentId];
      }
      return [...prev, agentId];
    });
  }

  // Calculate network average SLA
  const networkAvgSla = useMemo(() => {
    if (sorted.length === 0) return 99.4;
    const sum = sorted.reduce((acc, a) => acc + (a.reputationBps || 7000), 0);
    return ((sum / sorted.length) / 100);
  }, [sorted]);

  const cumulativeRevenueNum = useMemo(() => {
    return sorted.reduce((sum, a) => sum + (Number(a.usdcRevenue || 0) / 1_000_000), 0);
  }, [sorted]);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-24 relative">
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-3.5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent-violet" />
            <span>Agent Performance &amp; SLA Rankings</span>
          </h1>
          <p className="text-[12.5px] text-text-tertiary mt-1">
            Global institutional leaderboard ranked by volume-weighted on-chain reputation, task escrows, and financial metrics.
          </p>
        </div>
        <Link
          href="/register"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Register Agent
        </Link>
      </div>

      {/* Protocol Telemetry KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 rounded-[14px] bg-bg-elevated border border-border-subtle space-y-1 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Bot className="h-3 w-3 text-accent-violet" />
            <span>Active Fleet Agents</span>
          </div>
          <div className="text-[18px] font-extrabold font-mono text-text-primary">
            {stats ? formatCount(stats.totalAgents) : sorted.length}
          </div>
          <div className="text-[10.5px] text-text-tertiary">Autonomous runtime cognitive nodes</div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-bg-elevated border border-border-subtle space-y-1 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-text-quaternary flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-[#1FD487]" />
            <span>Network Avg SLA</span>
          </div>
          <div className="text-[18px] font-extrabold font-mono text-[#1FD487]">
            {networkAvgSla.toFixed(1)}%
          </div>
          <div className="text-[10.5px] text-text-tertiary">Verified on-chain completion reliability</div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-bg-elevated border border-border-subtle space-y-1 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Briefcase className="h-3 w-3 text-blue-400" />
            <span>Total Tasks Settled</span>
          </div>
          <div className="text-[18px] font-extrabold font-mono text-blue-400">
            {stats ? formatCount(stats.totalJobs) : "0"}
          </div>
          <div className="text-[10.5px] text-text-tertiary">Completed task escrows across fleet</div>
        </div>

        <div className="p-3.5 rounded-[14px] bg-bg-elevated border border-border-subtle space-y-1 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-text-quaternary flex items-center gap-1">
            <Coins className="h-3 w-3 text-amber-400" />
            <span>Network Execution</span>
          </div>
          <div className="text-[18px] font-extrabold font-mono text-amber-400">
            Monad
          </div>
          <div className="text-[10.5px] text-text-tertiary">Sub-second native USDC settlement</div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <RankingsFilterBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDomain={selectedDomain}
        onDomainChange={setSelectedDomain}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        tokenizedOnly={tokenizedOnly}
        onTokenizedOnlyChange={setTokenizedOnly}
        x402Only={x402Only}
        onX402OnlyChange={setX402Only}
        a2aOnly={a2aOnly}
        onA2AOnlyChange={setA2AOnly}
        activeOnly={activeOnly}
        onActiveOnlyChange={setActiveOnly}
        comparedCount={comparedIds.length}
        onOpenCompare={() => setShowCompareModal(true)}
      />

      {/* Loading skeleton */}
      {loading && (
        <div>
          <div className="grid grid-cols-[1fr_1.08fr_1fr] gap-2 sm:gap-3.5 mb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 sm:h-40 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-border-subtle last:border-none animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-accent-violet mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">Couldn't load the leaderboard</div>
          <p className="text-[12px] text-text-tertiary mb-6">The RPC didn't respond in time. Try again.</p>
          <button
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && configuredSorted.length === 0 && (
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-12 text-center">
          <Bot className="h-8 w-8 text-accent-violet mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">No Matching Agents Found</div>
          <p className="text-[12px] text-text-tertiary mb-6">
            {searchQuery || selectedDomain !== "all" || tokenizedOnly || x402Only
              ? "No registered agents matched the selected filters. Clear your query or reset the filters."
              : "Be the first to register and configure a cognitive persona to claim the #1 ranking."}
          </p>
          {(searchQuery || selectedDomain !== "all" || tokenizedOnly || x402Only || a2aOnly || activeOnly) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedDomain("all");
                setTokenizedOnly(false);
                setX402Only(false);
                setA2AOnly(false);
                setActiveOnly(false);
              }}
              className="mr-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-bold bg-bg-surface border border-border-subtle text-text-primary hover:bg-bg-surface3 transition-all"
            >
              Reset Filters
            </button>
          )}
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
          >
            Register Agent →
          </Link>
        </div>
      )}

      {/* Podium + Leaderboard */}
      {!loading && configuredSorted.length > 0 && (
        <>
          {/* Podium — shown for Reputation, Revenue, and Jobs tabs */}
          {activeTab !== "SLA" && (
            <div className="grid grid-cols-[1fr_1.08fr_1fr] gap-2 sm:gap-3.5 mb-5 items-end">
              {podiumSlots.map(({ agent, rank, border, bg, valColor, elevated, icon: MedalIcon, label }) => {
                if (!agent) return <div key={rank} />;
                const isCompared = comparedIds.includes(String(agent.id));
                const revenueAmount = Number(agent.usdcRevenue || 0) / 1_000_000;

                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "relative rounded-[16px] p-3 sm:p-5 text-center border transition-all duration-150 hover:-translate-y-0.5 group shadow-xs",
                      elevated && "pt-4 sm:pt-8 bg-gradient-to-b from-amber-500/5 to-transparent",
                      isCompared && "ring-2 ring-accent-violet",
                    )}
                    style={{ background: bg, borderColor: border }}
                  >
                    {/* Compare Quick Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCompare(String(agent.id))}
                      className={cn(
                        "absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                        isCompared
                          ? "bg-accent-violet text-white border-accent-violet"
                          : "bg-bg-surface text-text-quaternary border-border-subtle hover:text-text-primary",
                      )}
                    >
                      {isCompared ? "✓ Compared" : "+ Compare"}
                    </button>

                    <div className="flex justify-center mb-1 sm:mb-2">
                      <MedalIcon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: valColor }} />
                    </div>

                    <Link href={`/agents/${agentUrlId(agent.name, agent.id)}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarByAgentId[agent.id] || robotAvatarUrl(agent.name)}
                        alt=""
                        className="h-8 w-8 sm:h-13 sm:w-13 rounded-[10px] sm:rounded-[13px] mx-auto mb-1.5 sm:mb-2.5 border border-border-strong object-cover bg-bg-raised group-hover:border-accent-violet/60 transition-colors"
                      />
                      <div className="text-[11px] sm:text-[14px] font-extrabold text-text-primary mb-1 sm:mb-1.5 truncate px-0.5 sm:px-2 group-hover:text-accent-violet transition-colors">
                        {agent.name}
                      </div>
                    </Link>

                    <div className="flex gap-1 sm:gap-1.5 justify-center mb-1.5 sm:mb-2 flex-wrap items-center">
                      <span className={cn("text-[9px] font-bold px-1.75 py-0.5 rounded-[5px] border", agent.active ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/20" : "bg-bg-surface3 text-text-quaternary border-border-strong")}>
                        {agent.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-[8.5px] sm:text-[9px] font-bold px-1.5 sm:px-1.75 py-0.5 rounded-[5px] bg-bg-surface3 text-text-tertiary border border-border-strong font-mono">
                        #{rank}
                      </span>
                      {agent.grade && (
                        <span className={cn("text-[8.5px] font-mono px-1.5 py-0.5 rounded border", getGradeStyle(agent.grade))}>
                          {agent.grade}
                        </span>
                      )}
                      {agent.tokenSymbol && (
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30 font-bold">
                          ${agent.tokenSymbol}
                        </span>
                      )}
                    </div>

                    <div className="text-[14px] sm:text-[20px] font-extrabold font-mono tracking-tight" style={{ color: valColor }}>
                      {activeTab === "Jobs"
                        ? agent.jobsCompleted.toLocaleString()
                        : activeTab === "Revenue"
                        ? `$${revenueAmount.toFixed(0)}`
                        : fmtRep(agent.reputationBps)}
                    </div>
                    <div className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">
                      {activeTab === "Jobs" ? "Jobs Completed" : activeTab === "Revenue" ? "USDC Revenue" : "Reputation Score"}
                    </div>
                    {activeTab !== "Jobs" && (
                      <div className="hidden sm:block text-[11px] font-mono text-text-tertiary mt-1">
                        {agent.jobsCompleted.toLocaleString()} jobs · {fmtRep(agent.reputationBps)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Leaderboard table */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] overflow-x-auto shadow-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface3/20 text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="px-4 py-3 text-left w-12">Compare</th>
                  <th className="px-3 py-3 text-left w-12">Rank</th>
                  <th className="px-4 py-3 text-left">Agent Entity</th>
                  <th className="px-4 py-3 text-left">Capabilities</th>
                  <th className="px-4 py-3 text-left">Token / FDV</th>
                  <th className="px-4 py-3 text-right">USDC Revenue</th>
                  {activeTab === "SLA" ? (
                    <>
                      <th className="px-4 py-3 text-right">Success Rate</th>
                      <th className="px-4 py-3 text-right">On-Time</th>
                      <th className="px-4 py-3 text-right">Dispute Rate</th>
                      <th className="px-4 py-3 text-right">Latency</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right">Reputation</th>
                      <th className="px-4 py-3 text-right">Tasks</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configuredSorted.map((agent, idx) => {
                  const sla = computeSla(agent.reputationBps, agent.jobsCompleted);
                  const isCompared = comparedIds.includes(String(agent.id));
                  const revenueAmount = Number(agent.usdcRevenue || 0) / 1_000_000;

                  return (
                    <tr
                      key={agent.id}
                      className={cn(
                        "border-b border-border-subtle last:border-none hover:bg-bg-raised transition-colors duration-100",
                        isCompared && "bg-accent-violet/5",
                      )}
                    >
                      {/* Compare Checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isCompared}
                          onChange={() => toggleCompare(String(agent.id))}
                          className="rounded border-border-strong text-accent-violet focus:ring-accent-violet cursor-pointer"
                        />
                      </td>

                      {/* Rank */}
                      <td className="px-3 py-3">
                        <span className={cn("font-mono font-extrabold text-[12.5px]", idx === 0 ? "text-amber-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-text-quaternary")}>
                          #{idx + 1}
                        </span>
                      </td>

                      {/* Agent Entity with Avatar, Name, Grade, and ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatarByAgentId[agent.id] || robotAvatarUrl(agent.name)}
                            alt=""
                            className="h-8.5 w-8.5 rounded-[9px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                                className="text-[13px] font-extrabold text-text-primary hover:text-accent-violet transition-colors leading-tight block truncate max-w-44 sm:max-w-56"
                              >
                                {agent.name}
                              </Link>
                              {agent.grade && (
                                <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0", getGradeStyle(agent.grade))}>
                                  {agent.grade}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-text-quaternary">
                              Agent #{agent.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Capabilities */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap font-mono text-[9px] font-bold">
                          {agent.supportsX402 && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30" title="HTTP 402 Micropayments">
                              x402
                            </span>
                          )}
                          {agent.supportsA2A && (
                            <span className="px-1.5 py-0.5 rounded bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30" title="Autonomous Negotiation">
                              A2A
                            </span>
                          )}
                          {agent.supportsMcp && (
                            <span className="px-1.5 py-0.5 rounded bg-[#0c1a2e] text-[#60A5FA] border border-[#60A5FA]/30" title="Model Context Protocol">
                              MCP
                            </span>
                          )}
                          {!agent.supportsX402 && !agent.supportsA2A && !agent.supportsMcp && (
                            <span className="text-text-quaternary font-normal">Core</span>
                          )}
                        </div>
                      </td>

                      {/* Token Launch / FDV */}
                      <td className="px-4 py-3">
                        {agent.tokenSymbol ? (
                          <Link
                            href="/launchpad"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:border-amber-400 font-mono text-[10.5px] font-bold transition-colors"
                          >
                            <Coins className="h-2.5 w-2.5" />
                            <span>${agent.tokenSymbol}</span>
                            {agent.isTokenGraduated && (
                              <span className="text-[8.5px] px-1 rounded bg-[#1FD487]/20 text-[#1FD487]">DEX</span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-text-quaternary font-mono">—</span>
                        )}
                      </td>

                      {/* USDC Revenue */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[12.5px] font-bold text-[#1FD487]">
                          ${revenueAmount.toFixed(0)}
                        </span>
                      </td>

                      {/* SLA / Performance Metrics */}
                      {activeTab === "SLA" ? (
                        <>
                          <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-[#1FD487]">{sla.successRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-[#1FD487]">{sla.onTimeRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-red-400">{sla.disputeRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-text-secondary">{formatMs(sla.responseMs)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right font-mono text-[12.5px] font-extrabold text-text-primary">{fmtRep(agent.reputationBps)}</td>
                          <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-text-secondary">{agent.jobsCompleted.toLocaleString()}</td>
                        </>
                      )}

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={cn("text-[9.5px] font-bold px-2 py-0.5 rounded-full border font-mono inline-block", agent.active ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30" : "bg-bg-surface3 text-text-quaternary border-border-subtle")}>
                          {agent.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Action CTAs: Chat, Hire, Trade */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/terminal?agent=${agent.id}`}
                            title="Open Terminal Chat"
                            className="p-1.5 rounded-lg bg-bg-surface hover:bg-bg-surface3 text-text-tertiary hover:text-text-primary border border-border-subtle hover:border-border-strong transition-all"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={`/marketplace`}
                            title="Post Task Escrow / Hire"
                            className="p-1.5 rounded-lg bg-accent-violet/10 hover:bg-accent-violet/20 text-accent-violet border border-accent-violet/30 hover:border-accent-violet/60 transition-all"
                          >
                            <Briefcase className="h-3.5 w-3.5" />
                          </Link>

                          {agent.tokenSymbol && (
                            <Link
                              href="/launchpad"
                              title="Trade Token on Launchpad"
                              className="p-1.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30 hover:border-amber-400/60 transition-all"
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex justify-center border-t border-border-subtle p-3">
                <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore && <Spinner className="h-4 w-4 mr-2" />}
                  Load more ({sorted.length} of {total})
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Bottom Comparison Dock */}
      {comparedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center gap-3.5 px-5 py-2.5 rounded-full bg-bg-elevated/95 backdrop-blur-md border border-accent-violet/50 shadow-2xl shadow-accent-violet/20">
            <div className="flex -space-x-2 shrink-0">
              {comparedAgents.map((a) => (
                <img
                  key={a.id}
                  src={avatarByAgentId[a.id] || robotAvatarUrl(a.name)}
                  alt=""
                  className="h-7 w-7 rounded-full border-2 border-bg-elevated object-cover"
                />
              ))}
            </div>

            <div className="text-xs font-semibold text-text-primary whitespace-nowrap">
              <span className="font-bold text-accent-violet">{comparedIds.length}</span>/3 Agents Selected
            </div>

            <div className="h-4 w-px bg-border-subtle" />

            <button
              type="button"
              onClick={() => setComparedIds([])}
              className="text-[11px] font-medium text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent-violet text-white text-xs font-bold hover:bg-accent-violet/90 active:scale-98 transition-all cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Compare Now →</span>
            </button>
          </div>
        </div>
      )}

      {/* Head-to-Head Comparison Modal */}
      <AgentComparisonModal
        agents={comparedAgents}
        layerMap={layerMap}
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        onRemoveAgent={(id) => setComparedIds((prev) => prev.filter((i) => i !== id))}
      />
    </div>
  );
}

