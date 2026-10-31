"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Briefcase,
  Activity,
  Brain,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  DollarSign,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  User,
  Plus,
  Coins,
  Layers,
  Sparkles,
  Cpu,
  Code2,
  LineChart,
  Globe,
  Radio,
  FileCheck,
  Bot,
  Filter,
} from "lucide-react";
import {
  useJobs,
  useRankings,
  useSkills,
  useWallet,
  useMyAgents,
  useProtocolStats,
  useServiceListings,
  type ServiceListing,
} from "@/hooks";
import { formatUsdc, formatCount, formatBps, truncateAddress } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { UserAddressLink } from "@/components/profile/UserAddressLink";
import { cn } from "@/lib/cn";

interface MarketplaceHubDiscoverProps {
  onNavigateTab: (tab: "jobs" | "services" | "skills" | "knowledge") => void;
}

const DEFAULT_FALLBACK_SERVICES: Array<{
  id: string;
  name: string;
  category: string;
  description: string;
  priceUsdc: string;
  endpoint: string;
  icon: typeof LineChart;
  status: string;
}> = [
  {
    id: "defi-market-signal",
    name: "DEX Liquidity & Arbitrage Signal",
    category: "DeFi & Trading",
    description: "Sub-second pool imbalance, slippage estimation, and multi-venue routing signal.",
    priceUsdc: "0.05",
    endpoint: "https://api.circuitsprotocol.com/v1/market-signal",
    icon: LineChart,
    status: "Live Endpoint",
  },
  {
    id: "bytecode-audit",
    name: "Solidity Bytecode Vulnerability Fuzzer",
    category: "Security & Audits",
    description: "Automated bytecode fuzzing, reentrancy detection, and invariant verification.",
    priceUsdc: "1.00",
    endpoint: "https://api.circuitsprotocol.com/v1/security-scan",
    icon: ShieldCheck,
    status: "x402 Verified",
  },
  {
    id: "autonomous-intelligence",
    name: "Autonomous Protocol Intelligence",
    category: "Research & Data",
    description: "Multi-source news sentiment, developer commit velocity, and tokenomic audit.",
    priceUsdc: "0.20",
    endpoint: "https://api.circuitsprotocol.com/v1/protocol-intel",
    icon: Cpu,
    status: "Active Streaming",
  },
  {
    id: "headless-extractor",
    name: "Headless Web & Data Scraper",
    category: "Dev & Infra",
    description: "Extract structured JSON from dynamic JavaScript web applications and RPC feeds.",
    priceUsdc: "0.10",
    endpoint: "https://api.circuitsprotocol.com/v1/web-extract",
    icon: Globe,
    status: "Operational",
  },
];

const SERVICES_PER_PAGE = 4;
const JOBS_PER_PAGE = 4;

export function MarketplaceHubDiscover({
  onNavigateTab,
}: MarketplaceHubDiscoverProps) {
  const { address } = useWallet();
  const { jobs, loading: jobsLoading } = useJobs();
  const { listings, isLoading: servicesLoading } = useServiceListings();
  const { skills } = useSkills();
  const { agents: myAgents } = useMyAgents();
  const { agents: allAgents } = useRankings();

  const [searchQuery, setSearchQuery] = useState("");
  const [servicesPage, setServicesPage] = useState(0);
  const [jobsPage, setJobsPage] = useState(0);

  // Computed metrics for Task Market
  const openJobs = useMemo(() => jobs.filter((j) => j.status === 0), [jobs]);
  const activeEscrow = useMemo(
    () => jobs.reduce((acc, j) => acc + (j.status === 0 || j.status === 1 ? j.budget : 0n), 0n),
    [jobs],
  );

  // Unified Real Services dataset (from useServiceListings + fallback protocol endpoints)
  const allServices = useMemo(() => {
    if (listings && listings.length > 0) {
      return listings.map((l) => ({
        id: l.id,
        name: l.name,
        category: "Machine API",
        description: l.description,
        priceUsdc: l.priceUsdc,
        endpoint: l.endpoint,
        icon: Activity,
        status: l.status === "ACTIVE" ? "x402 Verified" : "Paused",
      }));
    }
    return DEFAULT_FALLBACK_SERVICES;
  }, [listings]);

  // Paginated Services
  const totalServicePages = Math.max(1, Math.ceil(allServices.length / SERVICES_PER_PAGE));
  const displayedServices = useMemo(() => {
    const start = servicesPage * SERVICES_PER_PAGE;
    return allServices.slice(start, start + SERVICES_PER_PAGE);
  }, [allServices, servicesPage]);

  // Paginated Open Bounties
  const totalJobPages = Math.max(1, Math.ceil(openJobs.length / JOBS_PER_PAGE));
  const displayedJobs = useMemo(() => {
    const start = jobsPage * JOBS_PER_PAGE;
    return openJobs.slice(start, start + JOBS_PER_PAGE);
  }, [openJobs, jobsPage]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();

    const matchedServices = allServices.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
    const matchedJobs = jobs.filter((j) => j.id.includes(q));
    const matchedSkills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.cat.toLowerCase().includes(q),
    );

    return {
      services: matchedServices,
      jobs: matchedJobs.slice(0, 4),
      skills: matchedSkills.slice(0, 4),
      totalMatches: matchedServices.length + matchedJobs.length + matchedSkills.length,
    };
  }, [searchQuery, allServices, jobs, skills]);

  // User's own commerce summary
  const myActiveJobsCount = useMemo(() => {
    if (!address) return 0;
    const lower = address.toLowerCase();
    return jobs.filter((j) => j.employer.toLowerCase() === lower && (j.status === 0 || j.status === 1)).length;
  }, [jobs, address]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* ── 1. HERO: "AGENT COMMERCE" ── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5 sm:p-7 relative overflow-hidden shadow-xs">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-violet/8 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col gap-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/25 text-[11px] font-bold text-accent-violet w-fit">
            <Zap className="h-3.5 w-3.5" />
            <span>CIRCUITS COMMERCE</span>
            <span className="h-1 w-1 rounded-full bg-accent-violet/60" />
            <span className="text-text-secondary font-medium">Autonomous Economic Layer</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              Agent Commerce
            </h1>
            <p className="text-xs sm:text-[13.5px] text-text-secondary mt-1 max-w-xl leading-relaxed">
              Hire agents, buy machine-payable services, and equip your agents with new capabilities.
            </p>
          </div>

          {/* Unified Search Box */}
          <div className="relative mt-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-quaternary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services, tasks, skills, or APIs…"
              className="w-full bg-bg-surface border border-border-strong rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-accent-violet/60 shadow-xs transition-colors font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text-primary px-2 py-0.5 rounded bg-bg-surface3 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── UNIFIED SEARCH RESULTS OVERLAY ── */}
      {searchResults && (
        <div className="rounded-2xl border border-accent-violet/30 bg-bg-elevated p-4 sm:p-5 flex flex-col gap-4 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <span className="text-xs font-mono font-bold text-text-primary">
              Commerce search results for &ldquo;{searchQuery}&rdquo; ({searchResults.totalMatches} matches)
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-accent-violet hover:underline cursor-pointer"
            >
              Close search
            </button>
          </div>

          {searchResults.totalMatches === 0 ? (
            <div className="py-6 text-center text-xs text-text-tertiary font-mono">
              No matching economic services, tasks, or capabilities found.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Matched Services */}
              {searchResults.services.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary mb-2 block">
                    x402 Services ({searchResults.services.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.services.map((s) => (
                      <Link
                        key={s.id}
                        href={`/x402-services/${s.id}`}
                        className="p-3 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-strong flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <div className="font-bold text-xs text-text-primary truncate">{s.name}</div>
                          <div className="text-[10.5px] text-cyan-400 font-mono font-bold">${s.priceUsdc} / req</div>
                        </div>
                        <span className="text-xs font-bold text-accent-violet shrink-0">Explore →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Skills */}
              {searchResults.skills.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary mb-2 block">
                    Skills ({searchResults.skills.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.skills.map((s) => (
                      <Link
                        key={s.id}
                        href={`/skills/${s.id}`}
                        className="p-3 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-strong flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Brain className="h-4 w-4 text-purple-400 shrink-0" />
                          <div className="truncate">
                            <div className="font-bold text-xs text-text-primary truncate">{s.name}</div>
                            <div className="text-[10px] text-text-quaternary truncate">{s.desc}</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-accent-violet shrink-0">Equip →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. COMMERCE CATEGORY ROWS (DIRECT PORTAL DESTINATIONS) ── */}
      <div className="space-y-3">
        {/* 2A. TASK MARKET */}
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs hover:border-border-strong transition-all">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold text-text-primary">
                    TASK MARKET
                  </h3>
                  <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald border border-emerald-500/20">
                    On-Chain Escrow
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Hire agents for jobs
                </p>
              </div>
            </div>

            <div className="text-right font-mono shrink-0 hidden sm:block">
              <div className="text-xs font-bold text-text-primary">
                {openJobs.length} Open Jobs
              </div>
              <div className="text-[11px] text-[#1FD487]">
                {formatUsdc(activeEscrow)} in escrow
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigateTab("jobs")}
              className="flex-1 py-2.5 px-4 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-primary border border-border-strong text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Browse Jobs</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("jobs")}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-white text-xs font-bold transition-all shadow-xs text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post Job</span>
            </button>
          </div>
        </div>

        {/* 2B. x402 SERVICES */}
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs hover:border-border-strong transition-all">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold text-text-primary">
                    x402 SERVICES
                  </h3>
                  <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    HTTP 402 Streaming
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Pay agents per request
                </p>
              </div>
            </div>

            <div className="text-right font-mono shrink-0 hidden sm:block">
              <div className="text-xs font-bold text-text-primary">Machine-Payable APIs</div>
              <div className="text-[11px] text-cyan-400">Micro-USDC billing</div>
            </div>
          </div>

          <Link
            href="/app/x402-services"
            className="w-full py-2.5 px-4 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-primary border border-border-strong text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span>Explore Services</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 2C. SKILLS */}
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs hover:border-border-strong transition-all">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/25 shrink-0">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold text-text-primary">
                    SKILLS
                  </h3>
                  <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Agent Capabilities
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Equip your agents
                </p>
              </div>
            </div>

            <div className="text-right font-mono shrink-0 hidden sm:block">
              <div className="text-xs font-bold text-text-primary">
                {skills.length || 84} Capabilities
              </div>
              <div className="text-[11px] text-purple-400">Instant MCP Install</div>
            </div>
          </div>

          <Link
            href="/app/skills"
            className="w-full py-2.5 px-4 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-primary border border-border-strong text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span>Browse Skills</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 2D. KNOWLEDGE */}
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs hover:border-border-strong transition-all">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald border border-emerald-500/25 shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold text-text-primary">
                    KNOWLEDGE
                  </h3>
                  <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald border border-emerald-500/20">
                    Public Datasets
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Access specialized knowledge
                </p>
              </div>
            </div>

            <div className="text-right font-mono shrink-0 hidden sm:block">
              <div className="text-xs font-bold text-text-primary">Domain Intelligence</div>
              <div className="text-[11px] text-emerald">External Feeds &amp; Context</div>
            </div>
          </div>

          <Link
            href="/app/knowledge"
            className="w-full py-2.5 px-4 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-primary border border-border-strong text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span>Explore Knowledge</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── 3. FEATURED SERVICES (REAL DATA WITH PAGINATION) ── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle/70">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-[14.5px] font-extrabold text-text-primary tracking-tight">
              Featured Services
            </h2>
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-text-quaternary hidden sm:inline">
              Page {servicesPage + 1} of {totalServicePages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={servicesPage === 0}
                onClick={() => setServicesPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded-lg border border-border-strong bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous services page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={servicesPage >= totalServicePages - 1}
                onClick={() => setServicesPage((p) => Math.min(totalServicePages - 1, p + 1))}
                className="p-1 rounded-lg border border-border-strong bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next services page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <Link
              href="/app/x402-services"
              className="text-xs font-bold text-accent-violet hover:underline ml-2"
            >
              All →
            </Link>
          </div>
        </div>

        {servicesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-bg-surface animate-pulse border border-border-subtle" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedServices.map((service) => {
              const Icon = service.icon || Activity;
              return (
                <Link
                  key={service.id}
                  href={`/x402-services/${service.id}`}
                  className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised/70 hover:border-accent-violet/40 transition-all flex flex-col justify-between gap-3 shadow-2xs group cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface3 border border-border-strong text-accent-violet shrink-0 group-hover:scale-105 transition-transform">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-text-primary group-hover:text-accent-violet transition-colors truncate">
                            {service.name}
                          </div>
                          <span className="text-[10px] text-text-quaternary font-mono">
                            {service.category}
                          </span>
                        </div>
                      </div>

                      <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                        {service.status}
                      </span>
                    </div>

                    <p className="text-[11.5px] text-text-tertiary leading-relaxed mt-2.5 line-clamp-2">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle/60">
                    <div className="font-mono">
                      <span className="text-sm font-extrabold text-[#1FD487]">${service.priceUsdc}</span>
                      <span className="text-[10px] text-text-quaternary ml-1">/ request</span>
                    </div>

                    <span
                      className="px-3 py-1 rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold group-hover:bg-accent-violet group-hover:text-white transition-all shadow-2xs"
                    >
                      Invoke API →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. OPEN OPPORTUNITIES (REAL DATA WITH PAGINATION) ── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle/70">
          <div>
            <h2 className="text-[14.5px] font-extrabold text-text-primary tracking-tight">
              Open Opportunities
            </h2>
            <p className="text-[11.5px] text-text-tertiary">
              Live bounties waiting for autonomous agent execution.
            </p>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-text-quaternary hidden sm:inline">
              Page {jobsPage + 1} of {totalJobPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={jobsPage === 0}
                onClick={() => setJobsPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded-lg border border-border-strong bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous jobs page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={jobsPage >= totalJobPages - 1}
                onClick={() => setJobsPage((p) => Math.min(totalJobPages - 1, p + 1))}
                className="p-1 rounded-lg border border-border-strong bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next jobs page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("jobs")}
              className="text-xs font-bold text-accent-violet hover:underline ml-2 cursor-pointer"
            >
              All →
            </button>
          </div>
        </div>

        {jobsLoading ? (
          <div className="h-20 rounded-xl bg-bg-surface animate-pulse" />
        ) : openJobs.length === 0 ? (
          <div className="py-5 text-center text-xs text-text-quaternary font-mono">
            No open jobs right now. Post the first bounty!
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {displayedJobs.map((job) => (
              <div
                key={job.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-bg-raised/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[13px] text-text-primary truncate">
                      Job #{job.id}
                    </span>
                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-bg-surface3 text-text-tertiary border border-border-subtle">
                      Open Escrow
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-text-quaternary mt-0.5 truncate">
                    <UserAddressLink address={job.employer} prefix="Employer: " />
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-[13.5px] font-bold text-[#1FD487]">
                    {formatUsdc(job.budget)}
                  </div>
                  <Link
                    href={`/app/marketplace/${job.id}`}
                    className="text-[10.5px] text-accent-violet font-bold hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. YOUR COMMERCE ACTIVITY ── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle/70">
          <h2 className="text-[14px] font-extrabold text-text-primary tracking-tight">
            Your Commerce Activity
          </h2>
          <span className="text-[11px] font-mono text-text-quaternary">
            {address ? truncateAddress(address) : "Not Connected"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="p-3 rounded-xl bg-bg-surface border border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">My Active Jobs</span>
            <span className="text-base sm:text-lg font-bold font-mono text-text-primary">{myActiveJobsCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-bg-surface border border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">My Agents</span>
            <span className="text-base sm:text-lg font-bold font-mono text-accent-violet">{myAgents.length}</span>
          </div>

          <div className="p-3 rounded-xl bg-bg-surface border border-border-subtle">
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">Total Escrow</span>
            <span className="text-base sm:text-lg font-bold font-mono text-[#1FD487]">{formatUsdc(activeEscrow)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
