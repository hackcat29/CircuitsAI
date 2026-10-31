"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  useProtocolStats,
  useTotalProtocolVolume,
  useJobs,
  useMarketplaceActions,
  useSubscriptions,
  useSubscriptionWallet,
  useSubscriptionRuns,
  useWallet,
  useMyAgents,
  useRankings,
  useCognitiveLayer,
  useAllCognitiveLayers,
  useLaunchpadList,
  useAllHostedRuntimeConfigs,
  useSocialSession,
  useFormDraftState,
} from "@/hooks";
import type { Subscription, SubscriptionFrequency, MarketplaceJob, CognitiveLayer } from "@/hooks";
import { formatCount, formatUsdc, formatBps } from "@/lib/format";
import { isEvmChain, toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { STATUS_MAP, formatDeadline, truncateAddr, JobActionButtons } from "@/components/marketplace/JobShared";
import { MarketplaceHubDiscover } from "@/components/marketplace/MarketplaceHubDiscover";
import { PostJobWizardDialog } from "@/components/marketplace/PostJobWizardDialog";
import { MobileTaskCard } from "@/components/marketplace/MobileTaskCard";
import { UserAddressLink } from "@/components/profile/UserAddressLink";
import {
  ShieldCheck,
  BarChart3,
  ArrowLeftRight,
  Calculator,
  FileText,
  Rocket,
  Globe,
  Bot,
  Search,
  ClipboardList,
  Repeat,
  DollarSign,
  CheckCircle2,
  X,
  Send,
  Play,
  Activity,
  Coins,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowUpRight,
  Clock,
  Layers,
  Sparkles,
  Store,
  Brain,
  Database,
  ArrowRight,
  Plus,
} from "lucide-react";

export type MarketplaceTopTab = "discover" | "jobs" | "services" | "skills" | "knowledge";

interface DomainCategory {
  label: string;
  domain?: string;
  openOnly?: boolean;
}

const DOMAIN_CATEGORIES: DomainCategory[] = [
  { label: "All Tasks", domain: undefined, openOnly: false },
  { label: "Open Bounties", domain: undefined, openOnly: true },
  { label: "DeFi & Trading", domain: "DeFi & Trading", openOnly: false },
  { label: "Security & Audits", domain: "Security & Audits", openOnly: false },
  { label: "Market Research", domain: "Market Research", openOnly: false },
  { label: "Dev & Infra", domain: "Dev & Infra", openOnly: false },
  { label: "Content & Social", domain: "Content & Social", openOnly: false },
];

const STATUS_FILTERS = [
  "All",
  "Open",
  "By Agents (A2A)",
  "Active",
  "Completed",
  "Disputed",
];

type SortOption = "budget-desc" | "budget-asc" | "deadline-soon" | "newest";

function SubscriptionCard({
  sub,
  agentName,
  agentAvatar,
  onToggle,
  onRemove,
}: {
  sub: Subscription;
  agentName?: string;
  agentAvatar?: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [depositAmount, setDepositAmount] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const { wallet, depositFromConnectedWallet, withdraw, depositing } = useSubscriptionWallet(sub.id);
  const { runs, runNow } = useSubscriptionRuns(expanded ? sub.id : undefined);

  async function handle(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-4.5 shadow-xs flex flex-col justify-between gap-3">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {agentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agentAvatar}
                alt=""
                className="h-9 w-9 rounded-xl border border-border-strong object-cover bg-bg-surface3 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-bg-surface3 border border-border-strong flex items-center justify-center text-accent-violet shrink-0">
                <Bot className="h-4.5 w-4.5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-text-primary truncate">
                {sub.hiredAgentId === "0" ? (
                  "Open, any agent"
                ) : (
                  <Link
                    href={`/agents/${sub.hiredAgentId}`}
                    className="hover:text-accent-violet hover:underline"
                  >
                    {agentName || `Agent #${sub.hiredAgentId}`}
                  </Link>
                )}
              </div>
              <div className="text-[10px] font-bold text-text-quaternary capitalize">{sub.frequency.toLowerCase()}</div>
            </div>
          </div>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", sub.isActive ? "bg-[#0c2a1d] text-[#1FD487]" : "bg-bg-surface3 text-text-quaternary")}>
            {sub.isActive ? "Active" : "Paused"}
          </span>
        </div>
        <p className="text-[11.5px] text-text-tertiary leading-normal mb-3 line-clamp-2">{sub.taskDescription}</p>
        <div className="flex items-center justify-between pt-2.5 border-t border-border-subtle mb-2.5">
          <div>
            <div className="text-[12.5px] font-extrabold font-mono text-accent-violet">${sub.budgetUsdc} USDC</div>
            <div className="text-[10px] text-text-quaternary">per run · {sub.executionCount} runs</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-bold font-mono text-text-secondary">${sub.totalPaidUsdc}</div>
            <div className="text-[10px] text-text-quaternary">total paid</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button onClick={onToggle} className="flex-1 py-1.75 rounded-xl bg-bg-surface border border-border-strong text-[11px] font-bold text-text-secondary hover:border-border-hover transition-colors cursor-pointer">
          {sub.isActive ? "Pause" : "Resume"}
        </button>
        <button onClick={() => setExpanded((e) => !e)} className="flex-1 py-1.75 rounded-xl bg-bg-surface border border-border-strong text-[11px] font-bold text-text-secondary hover:border-border-hover transition-colors cursor-pointer">
          {expanded ? "Hide" : "Manage"}
        </button>
        <button onClick={onRemove} className="px-3 py-1.75 rounded-xl bg-bg-surface border border-border-strong text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:border-red-400/25 transition-colors cursor-pointer">
          Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pt-3 border-t border-border-subtle space-y-2">
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="text-[11px] text-text-tertiary font-mono">
            Wallet: {wallet ? truncateAddr(wallet.address) : "loading…"} · {wallet && formatUsdc(BigInt(wallet.balanceUsdc))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              className="w-20 bg-bg-raised border border-border-strong rounded-lg px-2 py-1.5 text-[11px] text-text-primary outline-none"
            />
            <button
              disabled={depositing}
              onClick={() => handle(() => depositFromConnectedWallet(depositAmount))}
              className="flex-1 py-1.5 rounded-lg bg-accent-dark border border-accent-violet/25 text-[11px] font-bold text-accent-violet hover:bg-accent-violet/20 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {depositing ? "Depositing…" : "Deposit"}
            </button>
            <button
              disabled={withdraw.isPending}
              onClick={() => handle(() => withdraw.mutateAsync())}
              className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border-strong text-[11px] font-bold text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40 cursor-pointer"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketplaceInner() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const agentParam = searchParams.get("agent") || searchParams.get("hire");
  const [targetAgentId, setTargetAgentId] = useState<string>(agentParam || "");

  useEffect(() => {
    if (agentParam) {
      setTargetAgentId(agentParam);
      setPostJobOpen(true);
    }
  }, [agentParam]);

  const [topTab, setTopTab] = useState<MarketplaceTopTab>(
    rawTab === "jobs" || rawTab === "tasks"
      ? "jobs"
      : rawTab === "services"
        ? "services"
        : rawTab === "skills"
          ? "skills"
          : rawTab === "knowledge"
            ? "knowledge"
            : "discover",
  );

  const [postJobOpen, setPostJobOpen] = useState(false);
  const [tasksSubTab, setTasksSubTab] = useState<"Tasks" | "Subscriptions">("Tasks");
  const [selectedDomainIdx, setSelectedDomainIdx] = useState(0);
  const [activeStatusFilter, setActiveStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards");
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  const { chain } = useWallet();
  const { profile, signIn } = useSocialSession();
  const { jobs, loading: jobsLoading } = useJobs();
  const { subs, create: createSub, toggle: toggleSub, remove: removeSub } = useSubscriptions();
  const { totals, perChain, loading: statsLoading } = useProtocolStats();
  const currentChainStats = useMemo(() => {
    const match = perChain.find((p) => p.chain.chainId === chain.chainId);
    return match?.stats || totals;
  }, [perChain, chain.chainId, totals]);
  const { totalUsdc: protocolVolumeUsdc, loading: volumeLoading } = useTotalProtocolVolume();
  const layers = useAllCognitiveLayers(toIndexerChainSlug(chain));
  const { agents } = useRankings();
  const { launches } = useLaunchpadList("top", 100);

  const layerMap = useMemo(() => Object.fromEntries(layers.map((l: CognitiveLayer) => [l.agentChainId, l])), [layers]);
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [String(a.id), a])), [agents]);
  const launchMap = useMemo(() => Object.fromEntries(launches.map((l) => [l.agentChainId, l])), [launches]);

  const [taskDescriptions, setTaskDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/marketplace/task-descriptions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.descriptions) setTaskDescriptions(data.descriptions);
      })
      .catch(() => { });
  }, [refreshKey]);

  const getTaskHeader = (job: MarketplaceJob) => {
    const hash = job.taskHash?.toLowerCase();
    const desc = hash ? taskDescriptions[hash] : undefined;
    if (desc) {
      const m = desc.match(/^#\s+(.+)$/m);
      if (m && m[1]?.trim()) return m[1].trim();
    }
    return `Task #${job.id}`;
  };

  const selectedCategory = DOMAIN_CATEGORIES[selectedDomainIdx] ?? DOMAIN_CATEGORIES[0];

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    if (activeStatusFilter === "Open") {
      result = result.filter((j) => j.status === 0 || j.hiredAgentId === "0");
    } else if (activeStatusFilter === "By Agents (A2A)") {
      result = result.filter((j) => Boolean(j.employerAgentId && j.employerAgentId !== "0"));
    } else if (activeStatusFilter === "Work by Agents") {
      result = result.filter((j) => Boolean(j.hiredAgentId && j.hiredAgentId !== "0"));
    } else if (activeStatusFilter === "Active") {
      result = result.filter((j) => j.status === 1);
    } else if (activeStatusFilter === "Completed") {
      result = result.filter((j) => j.status === 2);
    } else if (activeStatusFilter === "Disputed") {
      result = result.filter((j) => j.status === 3);
    }

    if (selectedCategory.openOnly) {
      result = result.filter((j) => j.hiredAgentId === "0");
    }
    if (selectedCategory.domain) {
      const d = selectedCategory.domain;
      result = result.filter((j) => {
        const desc = j.taskHash ? taskDescriptions[j.taskHash.toLowerCase()] || "" : "";
        if (d === "DeFi & Trading") return /swap|dex|liquidity|yield|token|arbitrage|defi/i.test(desc);
        if (d === "Security & Audits") return /audit|vulnerabilit|exploit|reentrancy|slither|security/i.test(desc);
        if (d === "Market Research") return /research|market|analysis|report|digest|brief/i.test(desc);
        if (d === "Dev & Infra") return /deploy|contract|infra|api|webhook|rpc|node/i.test(desc);
        if (d === "Content & Social") return /meme|content|narrative|social|campaign/i.test(desc);
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => {
        const agent = agentMap[j.hiredAgentId];
        const layer = layerMap[j.hiredAgentId];
        const name = agent?.name ?? "";
        const displayName = layer?.displayName ?? "";
        const title = getTaskHeader(j).toLowerCase();
        return (
          title.includes(q) ||
          j.id.toLowerCase().includes(q) ||
          j.employer.toLowerCase().includes(q) ||
          j.hiredAgentId.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          displayName.toLowerCase().includes(q)
        );
      });
    }
    return result.sort((a, b) => {
      if (sortBy === "budget-desc") return Number(b.budget - a.budget);
      if (sortBy === "budget-asc") return Number(a.budget - b.budget);
      if (sortBy === "deadline-soon") return Number(a.deadline - b.deadline);
      if (sortBy === "newest") return Number(b.id) - Number(a.id);
      return 0;
    });
  }, [jobs, activeStatusFilter, selectedCategory, search, sortBy, agentMap, layerMap, taskDescriptions]);
  // Jobs Pagination
  const [jobsPage, setJobsPage] = useState(1);
  const JOBS_PAGE_SIZE = 10;
  const totalJobPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PAGE_SIZE));
  const paginatedJobs = useMemo(() => {
    return filteredJobs.slice((jobsPage - 1) * JOBS_PAGE_SIZE, jobsPage * JOBS_PAGE_SIZE);
  }, [filteredJobs, jobsPage]);

  // Subscriptions Pagination
  const [subsPage, setSubsPage] = useState(1);
  const SUBS_PAGE_SIZE = 6;
  const totalSubPages = Math.max(1, Math.ceil(subs.length / SUBS_PAGE_SIZE));
  const paginatedSubs = useMemo(() => {
    return subs.slice((subsPage - 1) * SUBS_PAGE_SIZE, subsPage * SUBS_PAGE_SIZE);
  }, [subs, subsPage]);

  // Reset page when filters change
  useEffect(() => {
    setJobsPage(1);
  }, [activeStatusFilter, selectedDomainIdx, search, sortBy]);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16 flex flex-col gap-5 sm:gap-6" key={refreshKey}>
      <PostJobWizardDialog
        open={postJobOpen}
        onClose={() => {
          setPostJobOpen(false);
          setTargetAgentId("");
          bumpRefresh();
        }}
        initialAgentId={targetAgentId}
      />

      {/* ── TOP SEGMENTED NAVIGATION (DISCOVER HUB, TASK MARKET, DIRECT PORTALS) ── */}
      {/* Mobile only: on Desktop, Topbar already provides direct navigation to each commerce page */}
      <div className="md:hidden flex items-center justify-between gap-3 border-b border-border-subtle/70 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
          {/* 1. Discover */}
          <button
            type="button"
            onClick={() => setTopTab("discover")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              topTab === "discover"
                ? "bg-[#FF5C28] text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-raised border border-border-subtle",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Discover</span>
          </button>

          {/* 2. Task Market */}
          <button
            type="button"
            onClick={() => setTopTab("jobs")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              topTab === "jobs"
                ? "bg-[#FF5C28] text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-raised border border-border-subtle",
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Task Market</span>
            {jobs.length > 0 && (
              <span
                className={cn(
                  "text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded-full",
                  topTab === "jobs" ? "bg-white/20 text-white" : "bg-bg-surface3 text-accent-violet",
                )}
              >
                {jobs.length}
              </span>
            )}
          </button>

          {/* 3. x402 Services Portal */}
          <Link
            href="/x402-services"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-raised border border-border-subtle"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>x402 Services</span>
          </Link>

          {/* 4. Skills Portal */}
          <Link
            href="/skills"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-raised border border-border-subtle"
          >
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            <span>Skills</span>
          </Link>

          {/* 5. Knowledge Portal */}
          <Link
            href="/knowledge"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-raised border border-border-subtle"
          >
            <Database className="h-3.5 w-3.5 text-emerald" />
            <span>Knowledge</span>
          </Link>
        </div>
      </div>

      {/* ── TAB 1: THE DISCOVER COMMERCE HUB (Mobile only when topTab === "discover") ── */}
      {topTab === "discover" && (
        <div className="md:hidden">
          <MarketplaceHubDiscover
            onNavigateTab={(tab) => {
              if (tab === "jobs") setTopTab("jobs");
            }}
          />
        </div>
      )}

      {/* ── TAB 2: TASK MARKET & ESCROW INTERFACE (Always shown on Desktop; on Mobile when topTab === "jobs") ── */}
      <div className={cn("space-y-6 animate-in fade-in duration-150", topTab !== "jobs" && "hidden md:block")}>
        {/* ══════════════════════════════════════════════════════
            1. MOBILE TASK MARKET LAYOUT (block md:hidden)
            ══════════════════════════════════════════════════════ */}
        <div className="md:hidden flex flex-col gap-3.5">
          {/* Mobile Header with Title & Post Task */}
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle/70 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-[15px] font-black text-text-primary flex items-center gap-1.5">
                  <span>Task Market</span>
                </h1>
                <p className="text-[10px] text-text-quaternary">Trustless milestone escrow</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!profile) {
                  signIn();
                  return;
                }
                setPostJobOpen(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FF5C28] text-white text-xs font-bold shadow-2xs hover:bg-[#ff480e] transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post Task</span>
            </button>
          </div>

          {/* Mobile Horizontal Telemetry Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
              <span className="text-[10px] uppercase font-bold text-text-quaternary">Tasks:</span>
              <span className="font-mono font-bold text-text-primary">
                {statsLoading ? "···" : formatCount(currentChainStats.totalJobs)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
              <span className="text-[10px] uppercase font-bold text-text-quaternary">Active:</span>
              <span className="font-mono font-bold text-[#1FD487]">
                {statsLoading ? "···" : formatCount(currentChainStats.activeAgents)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
              <span className="text-[10px] uppercase font-bold text-text-quaternary">Fee Split:</span>
              <span className="font-mono font-bold text-text-secondary">50/30/20</span>
            </div>
          </div>

          {/* Sub-tab Switcher: Tasks vs Subscriptions */}
          <div className="flex items-center gap-1 p-1 bg-bg-surface border border-border-strong rounded-xl">
            <button
              type="button"
              onClick={() => setTasksSubTab("Tasks")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                tasksSubTab === "Tasks"
                  ? "bg-bg-elevated text-text-primary shadow-xs"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              On-Chain Tasks ({jobs.length})
            </button>
            <button
              type="button"
              onClick={() => setTasksSubTab("Subscriptions")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                tasksSubTab === "Subscriptions"
                  ? "bg-bg-elevated text-text-primary shadow-xs"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              Subscriptions ({subs.length})
            </button>
          </div>

          {tasksSubTab === "Tasks" && (
            <>
              {/* Mobile Search Input */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks, agents, employer..."
                  className="w-full bg-bg-elevated border border-border-strong rounded-[10px] pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-quaternary hover:text-text-primary p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Category Filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {DOMAIN_CATEGORIES.map((tab, idx) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setSelectedDomainIdx(idx)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer",
                      selectedDomainIdx === idx
                        ? "bg-accent-violet text-white shadow-xs"
                        : "bg-bg-surface text-text-tertiary hover:text-text-secondary border border-border-subtle",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Mobile Status Filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveStatusFilter(s)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10.5px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer",
                      activeStatusFilter === s
                        ? "bg-bg-elevated text-text-primary border border-border-strong"
                        : "text-text-quaternary hover:text-text-tertiary",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Mobile Task Cards Feed */}
              {jobsLoading ? (
                <div className="py-12 text-center text-xs text-text-tertiary font-mono">Loading tasks...</div>
              ) : filteredJobs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-bg-elevated border border-border-subtle text-xs text-text-tertiary space-y-2">
                  <p>No tasks found matching your filters.</p>
                  <button
                    type="button"
                    onClick={() => setPostJobOpen(true)}
                    className="inline-block text-accent-violet font-bold hover:underline"
                  >
                    + Post the first task
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {paginatedJobs.map((job) => {
                    const employerAgentName = job.employerAgentId && job.employerAgentId !== "0"
                      ? (layerMap[job.employerAgentId]?.displayName || agentMap[job.employerAgentId]?.name || `Agent #${job.employerAgentId}`)
                      : undefined;
                    return (
                      <MobileTaskCard
                        key={`${job.chain ?? ""}-${job.id}`}
                        job={job}
                        title={getTaskHeader(job)}
                        agent={agentMap[job.hiredAgentId]}
                        layer={layerMap[job.hiredAgentId]}
                        employerName={employerAgentName}
                      />
                    );
                  })}

                  {/* Mobile Pagination */}
                  {totalJobPages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs font-mono text-text-secondary">
                      <span>
                        {(jobsPage - 1) * JOBS_PAGE_SIZE + 1}–{Math.min(jobsPage * JOBS_PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={jobsPage <= 1}
                          onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-bold text-text-primary px-1.5">{jobsPage}/{totalJobPages}</span>
                        <button
                          type="button"
                          disabled={jobsPage >= totalJobPages}
                          onClick={() => setJobsPage((p) => Math.min(totalJobPages, p + 1))}
                          className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tasksSubTab === "Subscriptions" && (
            <div className="flex flex-col gap-3">
              {subs.length === 0 ? (
                <div className="py-10 text-center rounded-2xl bg-bg-elevated border border-border-subtle text-xs text-text-tertiary">
                  No active recurring subscriptions found.
                </div>
              ) : (
                paginatedSubs.map((sub) => {
                  const agent = agentMap[sub.hiredAgentId];
                  const layer = layerMap[sub.hiredAgentId];
                  const agentName = layer?.displayName || agent?.name || (sub.hiredAgentId === "0" ? undefined : `Agent #${sub.hiredAgentId}`);
                  const agentAvatar = layer?.avatarUrl || (sub.hiredAgentId !== "0" ? robotAvatarUrl(agent?.name || sub.hiredAgentId) : undefined);
                  return (
                    <SubscriptionCard
                      key={sub.id}
                      sub={sub}
                      agentName={agentName}
                      agentAvatar={agentAvatar}
                      onToggle={() => toggleSub.mutate(sub)}
                      onRemove={() => removeSub.mutate(sub.id)}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            2. DESKTOP TASK MARKET LAYOUT (hidden md:block)
            ══════════════════════════════════════════════════════ */}
        <div className="hidden md:block space-y-6">
          {/* Hero with Telemetry */}
          <div className="rounded-2xl p-6 sm:p-7 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
            <div className="flex items-start justify-between gap-6 flex-wrap relative z-10">
              <div>
                <h1 className="mb-1.5 text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5 text-text-primary">
                  <ClipboardList className="h-6 w-6 text-accent-violet" />
                  <span>Task Marketplace &amp; Escrow</span>
                </h1>
                <p className="max-w-xl text-xs sm:text-[13px] leading-relaxed text-text-secondary">
                  Hire autonomous agents or post open bounties with trustless on-chain milestone escrow. Settlements split 50% Creator, 30% Agent Treasury, and 20% Protocol.
                </p>

                {/* Telemetry Strip */}
                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4 pt-3.5 border-t border-border-subtle/60 text-xs font-mono">
                  <div>
                    <div className="text-[16px] font-extrabold text-text-primary">
                      {statsLoading ? "···" : formatCount(currentChainStats.totalJobs)}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-text-quaternary">Tasks Escrowed</div>
                  </div>
                  <div>
                    <div className="text-[16px] font-extrabold text-[#1FD487]">
                      {statsLoading ? "···" : formatCount(currentChainStats.activeAgents)}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-text-quaternary">Active Agents</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/negotiations"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-text-secondary border border-border-strong hover:bg-bg-surface bg-bg-surface3/40 transition-colors"
                >
                  Negotiate Terms →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (!profile) {
                      signIn();
                      return;
                    }
                    setPostJobOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] shadow-xs cursor-pointer"
                >
                  + Post Task
                </button>
              </div>
            </div>
          </div>

          {/* Sub Tab: Tasks vs Subscriptions */}
          <div className="flex items-center border-b border-border-subtle gap-6">
            {(["Tasks", "Subscriptions"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTasksSubTab(tab)}
                className={cn(
                  "pb-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer",
                  tasksSubTab === tab ? "text-text-primary border-accent-violet" : "text-text-tertiary border-transparent hover:text-text-secondary",
                )}
              >
                <span>{tab === "Tasks" ? `On-Chain Tasks (${jobs.length})` : `Subscriptions (${subs.length})`}</span>
              </button>
            ))}
          </div>

          {tasksSubTab === "Tasks" && (
            <div className="flex flex-col gap-4">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {DOMAIN_CATEGORIES.map((tab, idx) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setSelectedDomainIdx(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                      selectedDomainIdx === idx
                        ? "bg-bg-surface text-text-primary border border-border-strong shadow-xs"
                        : "text-text-tertiary hover:text-text-secondary bg-transparent",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Status Filters & Search Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-wrap">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveStatusFilter(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        activeStatusFilter === s
                          ? "bg-accent-violet text-white"
                          : "text-text-tertiary hover:text-text-secondary",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-quaternary" />
                    <input
                      type="text"
                      placeholder="Search tasks…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-bg-surface border border-border-strong rounded-lg pl-8 pr-3 py-1 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewLayout((l) => (l === "cards" ? "table" : "cards"))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-secondary hover:text-text-primary"
                    aria-label="Toggle layout"
                  >
                    {viewLayout === "cards" ? <TableIcon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Jobs List / Cards */}
              {jobsLoading ? (
                <div className="py-12 text-center text-xs text-text-tertiary font-mono">Loading task contracts…</div>
              ) : filteredJobs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-bg-elevated border border-border-subtle text-xs text-text-tertiary">
                  No tasks matching the selected filters.
                </div>
              ) : viewLayout === "cards" ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {paginatedJobs.map((job) => {
                      const statusInfo = STATUS_MAP[job.status] ?? STATUS_MAP[0];
                      const agent = agentMap[job.hiredAgentId];
                      const displayName = agent?.name || (job.hiredAgentId === "0" ? "Open Bounty" : `Agent #${job.hiredAgentId}`);
                      const employerAgentName = job.employerAgentId && job.employerAgentId !== "0"
                        ? (layerMap[job.employerAgentId]?.displayName || agentMap[job.employerAgentId]?.name || `Agent #${job.employerAgentId}`)
                        : null;

                      return (
                        <div key={`${job.chain ?? ""}-${job.id}`} className="p-4 rounded-2xl border border-border-subtle bg-bg-elevated flex flex-col justify-between gap-3 shadow-xs">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-sans text-xs font-bold text-text-primary line-clamp-2" title={getTaskHeader(job)}>
                                {getTaskHeader(job)}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                                {statusInfo.label}
                              </span>
                            </div>
                            <div className="text-[11px] font-medium text-text-secondary mb-1">
                              Task #{job.id} • {displayName}
                            </div>
                            <div className="text-[11px] font-mono text-text-quaternary truncate">
                              {employerAgentName ? (
                                <span>
                                  Employer:{" "}
                                  <Link
                                    href={`/agents/${job.employerAgentId}`}
                                    className="font-bold text-text-primary hover:text-accent-violet hover:underline"
                                  >
                                    {employerAgentName}
                                  </Link>{" "}
                                  (<UserAddressLink address={job.employer} className="text-text-secondary" />)
                                </span>
                              ) : (
                                <UserAddressLink address={job.employer} prefix="Employer: " />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
                            <div>
                              <div className="text-sm font-extrabold font-mono text-[#1FD487]">{formatUsdc(job.budget)}</div>
                              <div className="text-[10px] font-mono text-text-quaternary">{formatDeadline(job.deadline)}</div>
                            </div>
                            <Link href={`/app/marketplace/${job.id}${job.chain ? `?chain=${job.chain}` : ""}`} className="px-3 py-1 rounded-lg bg-bg-surface hover:bg-bg-raised text-text-secondary hover:text-text-primary border border-border-strong text-xs font-bold">
                              View →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalJobPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                      <span>Showing {(jobsPage - 1) * JOBS_PAGE_SIZE + 1}–{Math.min(jobsPage * JOBS_PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length} tasks</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={jobsPage <= 1}
                          onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 font-bold text-text-primary">Page {jobsPage} of {totalJobPages}</span>
                        <button
                          type="button"
                          disabled={jobsPage >= totalJobPages}
                          onClick={() => setJobsPage((p) => Math.min(totalJobPages, p + 1))}
                          className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          aria-label="Next page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border-subtle bg-bg-elevated overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-bg-surface border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Task</th>
                          <th className="py-3 px-4">Agent</th>
                          <th className="py-3 px-4">Employer</th>
                          <th className="py-3 px-4">Budget</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/50 font-mono">
                        {paginatedJobs.map((job) => {
                          const statusInfo = STATUS_MAP[job.status] ?? STATUS_MAP[0];
                          const headerTitle = getTaskHeader(job);
                          const employerAgentName = job.employerAgentId && job.employerAgentId !== "0"
                            ? (layerMap[job.employerAgentId]?.displayName || agentMap[job.employerAgentId]?.name || `Agent #${job.employerAgentId}`)
                            : null;
                          return (
                            <tr key={`${job.chain ?? ""}-${job.id}`} className="hover:bg-bg-raised/60">
                              <td className="py-3 px-4">
                                <div className="font-sans font-bold text-text-primary line-clamp-1" title={headerTitle}>
                                  {headerTitle}
                                </div>
                                <div className="text-[10px] text-text-quaternary font-mono">
                                  Task #{job.id}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-text-secondary">{job.hiredAgentId === "0" ? "Open" : `Agent #${job.hiredAgentId}`}</td>
                              <td className="py-3 px-4 text-text-quaternary">
                                {employerAgentName ? (
                                  <div>
                                    <Link
                                      href={`/agents/${job.employerAgentId}`}
                                      className="font-bold text-text-primary hover:text-accent-violet hover:underline block"
                                    >
                                      {employerAgentName}
                                    </Link>
                                    <UserAddressLink address={job.employer} className="text-[10px] opacity-70" />
                                  </div>
                                ) : (
                                  <UserAddressLink address={job.employer} />
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-[#1FD487]">{formatUsdc(job.budget)}</td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/app/marketplace/${job.id}${job.chain ? `?chain=${job.chain}` : ""}`} className="text-xs font-bold text-accent-violet hover:underline">
                                  View →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalJobPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                      <span>Showing {(jobsPage - 1) * JOBS_PAGE_SIZE + 1}–{Math.min(jobsPage * JOBS_PAGE_SIZE, filteredJobs.length)} of {filteredJobs.length} tasks</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={jobsPage <= 1}
                          onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 font-bold text-text-primary">Page {jobsPage} of {totalJobPages}</span>
                        <button
                          type="button"
                          disabled={jobsPage >= totalJobPages}
                          onClick={() => setJobsPage((p) => Math.min(totalJobPages, p + 1))}
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
          )}

          {tasksSubTab === "Subscriptions" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subs.length === 0 ? (
                  <div className="col-span-full py-12 text-center rounded-2xl bg-bg-elevated border border-border-subtle text-xs text-text-tertiary">
                    No active recurring subscriptions found.
                  </div>
                ) : (
                  paginatedSubs.map((sub) => {
                    const agent = agentMap[sub.hiredAgentId];
                    const layer = layerMap[sub.hiredAgentId];
                    const agentName = layer?.displayName || agent?.name || (sub.hiredAgentId === "0" ? undefined : `Agent #${sub.hiredAgentId}`);
                    const agentAvatar = layer?.avatarUrl || (sub.hiredAgentId !== "0" ? robotAvatarUrl(agent?.name || sub.hiredAgentId) : undefined);
                    return (
                      <SubscriptionCard
                        key={sub.id}
                        sub={sub}
                        agentName={agentName}
                        agentAvatar={agentAvatar}
                        onToggle={() => toggleSub.mutate(sub)}
                        onRemove={() => removeSub.mutate(sub.id)}
                      />
                    );
                  })
                )}
              </div>

              {totalSubPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                  <span>Showing {(subsPage - 1) * SUBS_PAGE_SIZE + 1}–{Math.min(subsPage * SUBS_PAGE_SIZE, subs.length)} of {subs.length} subscriptions</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={subsPage <= 1}
                      onClick={() => setSubsPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 font-bold text-text-primary">Page {subsPage} of {totalSubPages}</span>
                    <button
                      type="button"
                      disabled={subsPage >= totalSubPages}
                      onClick={() => setSubsPage((p) => Math.min(totalSubPages, p + 1))}
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
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto p-6 md:p-10 text-sm text-text-tertiary">Loading Marketplace…</div>}>
      <MarketplaceInner />
    </Suspense>
  );
}
