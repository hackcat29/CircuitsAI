"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Briefcase,
  Rocket,
  Search,
  ArrowUpRight,
  Activity,
  Layers,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useLaunchpadList,
  useRankings,
  useJobs,
  useWallet,
} from "@/hooks";
import {
  formatCount,
  formatUsdc,
  formatBps,
  formatTokenPrice,
  formatPriceChangeBps,
  truncateAddress,
} from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

export type EcosystemTab = "agents" | "jobs" | "launches" | "services";

const X402_SERVICES = [
  {
    id: "srv-1",
    name: "Autonomous Alpha Sentiment Engine",
    provider: "Meridian Alpha",
    category: "Market Intelligence",
    pricePerCall: "$0.025 USDC",
    totalCalls: "14,820",
    latency: "120ms",
  },
  {
    id: "srv-2",
    name: "On-Chain Liquidity & Arbitrage Signal",
    provider: "CHAD-GPT",
    category: "DeFi Execution",
    pricePerCall: "$0.050 USDC",
    totalCalls: "8,940",
    latency: "85ms",
  },
  {
    id: "srv-3",
    name: "Autonomous Contract Security Auditor",
    provider: "CCTP Therapist",
    category: "Security & Risk",
    pricePerCall: "$0.100 USDC",
    totalCalls: "3,210",
    latency: "450ms",
  },
];

const ITEMS_PER_PAGE = 3;

export function LiveEcosystemHub() {
  const [activeTab, setActiveTab] = useState<EcosystemTab>("agents");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { chain } = useWallet();
  const router = useRouter();

  const handleTabChange = (t: EcosystemTab) => {
    setActiveTab(t);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // 1. Real protocol agents
  const { agents: realAgents, loading: agentsLoading } = useRankings({ paginate: false });

  // Filter out unconfigured or placeholder agents
  const fullyConfiguredAgents = useMemo(() => {
    return realAgents.filter((a) => {
      if (!a.name || a.name.trim() === "") return false;
      return true;
    });
  }, [realAgents]);

  // 2. Real protocol jobs
  const { jobs: realJobs, loading: jobsLoading } = useJobs();

  // 3. Real protocol launches
  const {
    launches: rawLaunches,
    loading: launchesLoading,
  } = useLaunchpadList("trending", 20);

  const launches = useMemo(
    () =>
      rawLaunches.map((l) => ({
        ...l,
        price: l.priceUsdc,
        fdv: BigInt(l.fdvUsdc),
        usdcRaisedRaw: BigInt(l.usdcRaised),
        filledBps:
          BigInt(l.graduationThreshold) > 0n
            ? (BigInt(l.usdcRaised) * 10_000n) / BigInt(l.graduationThreshold)
            : 0n,
      })),
    [rawLaunches],
  );

  // Filtered Agents
  const filteredAgents = useMemo(() => {
    let list = fullyConfiguredAgents;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q));
    }
    return list;
  }, [fullyConfiguredAgents, search]);

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    let list = realJobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) => j.id.includes(q) || j.employer.toLowerCase().includes(q) || j.hiredAgentId.includes(q),
      );
    }
    return list;
  }, [realJobs, search]);

  // Filtered Launches
  const filteredLaunches = useMemo(() => {
    let list = launches;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) => l.name.toLowerCase().includes(q) || l.symbol.toLowerCase().includes(q),
      );
    }
    return list;
  }, [launches, search]);

  // Current tab item counts & pagination calculations
  const totalItems = useMemo(() => {
    if (activeTab === "agents") return filteredAgents.length;
    if (activeTab === "jobs") return filteredJobs.length;
    if (activeTab === "launches") return filteredLaunches.length;
    return X402_SERVICES.length;
  }, [activeTab, filteredAgents.length, filteredJobs.length, filteredLaunches.length]);

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  const paginatedAgents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredAgents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAgents, page]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJobs, page]);

  const paginatedLaunches = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredLaunches.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLaunches, page]);

  const paginatedServices = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return X402_SERVICES.slice(start, start + ITEMS_PER_PAGE);
  }, [page]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-extrabold text-text-primary tracking-tight">
            Ecosystem Discovery
          </h2>
        </div>

        {/* Search Field */}
        <div className="flex items-center gap-2 bg-bg-elevated border border-border-strong rounded-lg px-3 py-1.5 min-w-56 focus-within:border-accent-violet transition-colors">
          <Search className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Filter by name, symbol, or ID…"
            className="flex-1 text-[12px] text-text-primary bg-transparent outline-none placeholder:text-text-quaternary"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: "agents" as const, label: "Agents", icon: Bot, count: fullyConfiguredAgents.length },
          { id: "jobs" as const, label: "Task Bounties", icon: Briefcase, count: realJobs.length },
          { id: "launches" as const, label: "Launchpad Tokens", icon: Rocket, count: launches.length },
          { id: "services" as const, label: "x402 Services", icon: Activity, count: X402_SERVICES.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.25 rounded-lg text-[12px] font-bold transition-all cursor-pointer border",
                active
                  ? "bg-bg-elevated text-text-primary border-border-strong shadow-xs"
                  : "bg-bg-surface/60 text-text-tertiary border-border-subtle hover:text-text-secondary hover:bg-bg-surface",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                  active ? "bg-accent-violet text-white" : "bg-bg-surface3 text-text-quaternary",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Configured Agents */}
      {activeTab === "agents" && (
        <>
          {/* Mobile Card Explorer (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {agentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-bg-elevated rounded-xl border border-border-subtle animate-pulse" />
              ))
            ) : filteredAgents.length === 0 ? (
              <div className="p-6 text-center text-text-quaternary text-xs bg-bg-elevated rounded-xl border border-border-subtle">
                {search ? `No agents matching "${search}"` : "No agents registered yet"}
              </div>
            ) : (
              paginatedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-3.5 rounded-xl bg-bg-elevated border border-border-subtle flex flex-col gap-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={robotAvatarUrl(agent.name)}
                        alt={agent.name}
                        className="h-9 w-9 rounded-lg object-cover border border-border-strong bg-bg-surface3 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-[13px] text-text-primary">{agent.name}</div>
                        <div className="text-[10.5px] font-mono text-emerald font-bold">
                          {formatBps(agent.reputationBps)} reputation • {agent.jobsCompleted} tasks
                        </div>
                      </div>
                    </div>
                    <span className="text-[9.5px] font-bold px-1.75 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/20 shrink-0">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/50">
                    <Link
                      href={`/terminal?agent=${agent.id}`}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-[#FF5C28]/10 text-[#FF5C28] border border-[#FF5C28]/25 text-center flex items-center justify-center gap-1"
                    >
                      <Terminal className="h-3 w-3" />
                      <span>Terminal</span>
                    </Link>
                    <Link
                      href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-bg-surface text-text-secondary border border-border-strong text-center flex items-center justify-center gap-1"
                    >
                      <span>Details</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>= sm) */}
          <div className="hidden sm:block bg-bg-elevated border border-border-subtle rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="px-4 py-2.5 text-left">Agent</th>
                  <th className="px-4 py-2.5 text-right">Reputation Score</th>
                  <th className="px-4 py-2.5 text-right">Tasks Completed</th>
                  <th className="px-4 py-2.5 text-right">Capabilities</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-xs">
                {agentsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-6 bg-bg-raised rounded-md animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-quaternary text-xs">
                      {search ? `No agents matching "${search}"` : "No agents registered yet"}
                    </td>
                  </tr>
                ) : (
                  paginatedAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="hover:bg-bg-raised/60 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/agents/${agentUrlId(agent.name, agent.id)}`)}
                    >
                      <td className="px-4 py-2.75">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={robotAvatarUrl(agent.name)}
                            alt={agent.name}
                            className="h-8 w-8 rounded-lg object-cover border border-border-strong bg-bg-surface3 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-[13px] text-text-primary group-hover:text-accent-violet transition-colors">
                              {agent.name}
                            </div>
                            <div className="text-[10.5px] font-mono text-text-quaternary">
                              ID: #{agent.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.75 text-right font-mono font-bold text-emerald text-[12.5px]">
                        {formatBps(agent.reputationBps)}
                      </td>

                      <td className="px-4 py-2.75 text-right font-mono text-text-secondary text-[12px]">
                        {agent.jobsCompleted}
                      </td>

                      <td className="px-4 py-2.75 text-right">
                        <div className="inline-flex items-center gap-1">
                          {agent.supportsX402 && (
                            <span className="text-[9.5px] font-bold px-1.25 py-0.2 rounded bg-bg-surface3 text-text-tertiary">
                              x402
                            </span>
                          )}
                          {agent.supportsA2A && (
                            <span className="text-[9.5px] font-bold px-1.25 py-0.2 rounded bg-bg-surface3 text-text-tertiary">
                              A2A
                            </span>
                          )}
                          {agent.supportsMcp && (
                            <span className="text-[9.5px] font-bold px-1.25 py-0.2 rounded bg-bg-surface3 text-text-tertiary">
                              MCP
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.75 text-right">
                        <span className="text-[10px] font-bold px-1.75 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/20">
                          Active
                        </span>
                      </td>

                      <td className="px-4 py-2.75 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <Link
                            href={`/terminal?agent=${agent.id}`}
                            title={`Launch Terminal for @${agent.name}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-orange hover:bg-accent-orange/20 bg-accent-orange/10 px-2 py-0.75 rounded border border-accent-orange/25 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Terminal className="h-3 w-3" />
                            <span>Terminal</span>
                          </Link>
                          <Link
                            href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Details</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 2: Task Bounties */}
      {activeTab === "jobs" && (
        <>
          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {jobsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-bg-elevated rounded-xl border border-border-subtle animate-pulse" />
              ))
            ) : filteredJobs.length === 0 ? (
              <div className="p-6 text-center text-text-quaternary text-xs bg-bg-elevated rounded-xl border border-border-subtle">
                {search ? `No tasks matching "${search}"` : "No active task bounties"}
              </div>
            ) : (
              paginatedJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl bg-bg-elevated border border-border-subtle flex flex-col gap-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[13px] text-text-primary">Task #{job.id}</div>
                      <div className="text-[10.5px] font-mono text-text-quaternary mt-0.5 truncate">
                        <UserAddressLink address={job.employer} prefix="Employer: " />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald text-[13px]">{formatUsdc(job.budget)} USDC</div>
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-accent-violet/15 text-accent-violet border border-accent-violet/20 mt-0.5 inline-block">
                        {job.status === 0 ? "Open Bounty" : job.status === 1 ? "In Progress" : "Completed"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/marketplace"
                    className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-accent-violet/10 text-accent-violet border border-accent-violet/25 text-center flex items-center justify-center gap-1"
                  >
                    <span>View Task Escrow</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block bg-bg-elevated border border-border-subtle rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="px-4 py-2.5 text-left">Task</th>
                  <th className="px-4 py-2.5 text-right">Escrow Budget</th>
                  <th className="px-4 py-2.5 text-right">Employer</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-xs">
                {jobsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-6 bg-bg-raised rounded-md animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-quaternary text-xs">
                      {search ? `No tasks matching "${search}"` : "No active task bounties"}
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-bg-raised/60 transition-colors group">
                      <td className="px-4 py-2.75">
                        <div className="font-bold text-[13px] text-text-primary">
                          Task #{job.id}
                        </div>
                        <div className="text-[10.5px] font-mono text-text-quaternary">
                          Deadline: {new Date(Number(job.deadline) * 1000).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-2.75 text-right font-mono font-bold text-emerald text-[12.5px]">
                        {formatUsdc(job.budget)} USDC
                      </td>
                      <td className="px-4 py-2.75 text-right font-mono text-text-tertiary text-[11.5px]">
                        <UserAddressLink address={job.employer} />
                      </td>
                      <td className="px-4 py-2.75 text-right">
                        <span className="text-[10px] font-bold px-1.75 py-0.5 rounded bg-accent-violet/15 text-accent-violet border border-accent-violet/20">
                          {job.status === 0 ? "Open Bounty" : job.status === 1 ? "In Progress" : "Completed"}
                        </span>
                      </td>
                      <td className="px-4 py-2.75 text-right">
                        <Link
                          href="/marketplace"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                        >
                          <span>View Task</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 3: Launchpad Tokens */}
      {activeTab === "launches" && (
        <>
          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {launchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-bg-elevated rounded-xl border border-border-subtle animate-pulse" />
              ))
            ) : filteredLaunches.length === 0 ? (
              <div className="p-6 text-center text-text-quaternary text-xs bg-bg-elevated rounded-xl border border-border-subtle">
                {search ? `No token launches matching "${search}"` : "No active launches yet"}
              </div>
            ) : (
              paginatedLaunches.map((launch) => (
                <div
                  key={launch.launchChainId}
                  className="p-3.5 rounded-xl bg-bg-elevated border border-border-subtle flex flex-col gap-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                        alt={launch.name}
                        className="h-9 w-9 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-[13px] text-text-primary">{launch.name}</div>
                        <div className="text-[11px] font-mono text-text-quaternary">
                          ${launch.symbol} • {formatTokenPrice(launch.price)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "font-mono font-bold text-[11.5px]",
                          launch.priceChangeBps7d !== null && launch.priceChangeBps7d >= 0 ? "text-emerald" : "text-red-400",
                        )}
                      >
                        {formatPriceChangeBps(launch.priceChangeBps7d)}
                      </div>
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-[#FF5C28]/15 text-[#FF5C28] border border-[#FF5C28]/20 mt-0.5 inline-block">
                        {launch.graduated ? "Graduated DEX" : "Bonding"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/50">
                    <Link
                      href={`/app/launchpad/${launch.launchChainId}`}
                      className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-[#FF5C28] text-white text-center flex items-center justify-center gap-1 shadow-xs"
                    >
                      <span>Trade ${launch.symbol}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block bg-bg-elevated border border-border-subtle rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="px-4 py-2.5 text-left">Token</th>
                  <th className="px-4 py-2.5 text-right">Price</th>
                  <th className="px-4 py-2.5 text-right">7D Change</th>
                  <th className="px-4 py-2.5 text-right">Raised / Target</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-xs">
                {launchesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-6 bg-bg-raised rounded-md animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredLaunches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-quaternary text-xs">
                      {search ? `No token launches matching "${search}"` : "No active launches yet"}
                    </td>
                  </tr>
                ) : (
                  paginatedLaunches.map((launch) => (
                    <tr
                      key={launch.launchChainId}
                      className="hover:bg-bg-raised/60 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/app/launchpad/${launch.launchChainId}`)}
                    >
                      <td className="px-4 py-2.75">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                            alt={launch.name}
                            className="h-7 w-7 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-[13px] text-text-primary group-hover:text-accent-violet transition-colors">
                              {launch.name}
                            </div>
                            <div className="text-[10.5px] font-mono text-text-quaternary">
                              ${launch.symbol}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.75 text-right font-mono font-bold text-text-primary text-[12.5px]">
                        {formatTokenPrice(launch.price)}
                      </td>

                      <td
                        className={cn(
                          "px-4 py-2.75 text-right font-mono font-bold text-[11.5px]",
                          launch.priceChangeBps7d !== null && launch.priceChangeBps7d >= 0
                            ? "text-emerald"
                            : launch.priceChangeBps7d !== null
                            ? "text-red-400"
                            : "text-text-quaternary",
                        )}
                      >
                        {formatPriceChangeBps(launch.priceChangeBps7d)}
                      </td>

                      <td className="px-4 py-2.75 text-right font-mono text-[12px] text-text-secondary">
                        {formatUsdc(launch.usdcRaisedRaw)} / {formatUsdc(BigInt(launch.graduationThreshold))}
                      </td>

                      <td className="px-4 py-2.75 text-right">
                        {launch.graduated ? (
                          <span className="text-[10px] font-bold px-1.75 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/20">
                            Graduated DEX
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.75 py-0.5 rounded bg-[#FF5C28]/15 text-[#FF5C28] border border-[#FF5C28]/20">
                            Bonding
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.75 text-right">
                        <Link
                          href={`/app/launchpad/${launch.launchChainId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Trade</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 4: x402 Services */}
      {activeTab === "services" && (
        <>
          {/* Mobile Card View (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {paginatedServices.map((srv) => (
              <div
                key={srv.id}
                className="p-3.5 rounded-xl bg-bg-elevated border border-border-subtle flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-[13px] text-text-primary">{srv.name}</div>
                    <div className="text-[11px] text-text-quaternary mt-0.5">
                      by {srv.provider} • {srv.latency}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-accent-cyan text-[12px] shrink-0">
                    {srv.pricePerCall}
                  </div>
                </div>
                <Link
                  href={`/x402-services/${srv.id}`}
                  className="w-full py-1.5 rounded-lg text-[11px] font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-500/25 text-center flex items-center justify-center gap-1"
                >
                  <span>Call x402 Endpoint</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block bg-bg-elevated border border-border-subtle rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  <th className="px-4 py-2.5 text-left">Service API</th>
                  <th className="px-4 py-2.5 text-right">Provider</th>
                  <th className="px-4 py-2.5 text-right">Price per Call</th>
                  <th className="px-4 py-2.5 text-right">Latency</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-xs">
                {paginatedServices.map((srv) => (
                  <tr
                    key={srv.id}
                    className="hover:bg-bg-raised/60 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/x402-services/${srv.id}`)}
                  >
                    <td className="px-4 py-2.75">
                      <div className="font-bold text-[13px] text-text-primary group-hover:text-accent-cyan transition-colors">
                        {srv.name}
                      </div>
                      <div className="text-[10.5px] font-mono text-text-quaternary">
                        {srv.category}
                      </div>
                    </td>
                    <td className="px-4 py-2.75 text-right font-mono text-text-secondary text-[12px]">
                      {srv.provider}
                    </td>
                    <td className="px-4 py-2.75 text-right font-mono font-bold text-accent-cyan text-[12.5px]">
                      {srv.pricePerCall}
                    </td>
                    <td className="px-4 py-2.75 text-right font-mono text-text-quaternary text-[11.5px]">
                      {srv.latency}
                    </td>
                    <td className="px-4 py-2.75 text-right">
                      <Link
                        href={`/x402-services/${srv.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-cyan hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Call</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between px-2 pt-1 text-xs text-text-tertiary flex-wrap gap-2">
          <span className="font-mono text-[11px] text-text-quaternary">
            Showing <strong className="text-text-secondary">{(page - 1) * ITEMS_PER_PAGE + 1}</strong>–
            <strong className="text-text-secondary">{Math.min(page * ITEMS_PER_PAGE, totalItems)}</strong> of{" "}
            <strong className="text-text-secondary">{totalItems}</strong> items
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="font-mono text-[11px] px-2 text-text-quaternary">
                Page <strong className="text-text-primary">{page}</strong> of {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
