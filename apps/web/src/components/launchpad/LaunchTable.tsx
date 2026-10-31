"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  List,
  Search,
  ArrowRight,
  TrendingUp,
  Flame,
  Clock,
  BarChart3,
  CheckCircle2,
  Bot,
  Layers,
  Target,
  Filter,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Badge, Button, Skeleton } from "@/components/ui";
import { useLaunchpadList, type LaunchpadTab, type LaunchpadListItem } from "@/hooks";
import {
  formatTokenPrice,
  formatPriceChangeBps,
  formatUsdc,
  formatCount,
  formatRelativeTime,
  truncateAddress,
} from "@/lib/format";
import { launchSlug } from "@/lib/launchSlug";
import { robotAvatarUrl } from "@/lib/avatar";
import { UserAddressLink } from "@/components/profile";
import { QuickBuyDialog } from "./QuickBuyDialog";
import { checkOperationChain } from "@/lib/chainGuard";
import { cn } from "@/lib/cn";

export type MarketSortKey = "trending" | "market_cap" | "volume" | "gainers" | "near_graduation" | "newest";
export type MarketStatusFilter = "all" | "bonding" | "graduated";

function priceChangeClass(bps: number | null): string {
  if (bps === null) return "text-text-tertiary";
  return bps >= 0 ? "text-[#1FD487] font-bold" : "text-red-400 font-bold";
}

function computeProgress(launch: LaunchpadListItem): { pct: number; raisedFormatted: string; thresholdFormatted: string } {
  const raised = BigInt(launch.usdcRaised || "0");
  const threshold = BigInt(launch.graduationThreshold || "900000000"); // default $900 USDC (configurable by admin)
  const pct = launch.graduated
    ? 100
    : threshold > 0n
      ? Math.min(99.9, Number((raised * 10000n) / threshold) / 100)
      : 0;

  return {
    pct,
    raisedFormatted: formatUsdc(raised),
    thresholdFormatted: formatUsdc(threshold),
  };
}

function LaunchCard({
  launch,
  onQuickBuy,
}: {
  launch: LaunchpadListItem;
  onQuickBuy: (launch: LaunchpadListItem) => void;
}) {
  const router = useRouter();
  const href = `/app/launchpad/${launchSlug(launch.symbol, launch.launchChainId)}`;
  const { pct, raisedFormatted, thresholdFormatted } = computeProgress(launch);
  const isScheduled = new Date(launch.tradingStartsAt).getTime() > Date.now();

  return (
    <div
      onClick={() => router.push(href)}
      className="group rounded-2xl border border-border-subtle bg-bg-elevated hover:border-border-strong hover:bg-bg-raised/70 transition-all duration-150 p-4 flex flex-col justify-between shadow-xs cursor-pointer gap-3"
    >
      <div>
        {/* Card Header: Avatar, Name, Symbol, Status */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
              alt=""
              className="h-10 w-10 rounded-xl border border-border-strong object-cover bg-bg-surface3 shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-extrabold text-[14px] text-text-primary group-hover:text-accent-violet transition-colors truncate">
                  {launch.name}
                </span>
                <span className="text-[11px] font-mono text-text-tertiary shrink-0 font-bold">
                  ${launch.symbol}
                </span>
              </div>
              <div className="text-[11px] text-text-quaternary truncate mt-0.5 flex items-center gap-1">
                <Bot className="h-3 w-3 shrink-0 text-text-tertiary" />
                <span className="truncate flex items-center gap-1">
                  <span>by</span>
                  {launch.agentName ? (
                    <span className="font-semibold text-text-secondary">@{launch.agentName}</span>
                  ) : (
                    <UserAddressLink address={launch.creator} className="text-[11px]" />
                  )}
                </span>
              </div>
            </div>
          </div>

          {launch.graduated ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 shrink-0 font-mono">
              Graduated
            </span>
          ) : isScheduled ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0 font-mono">
              Scheduled
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20 shrink-0 font-mono">
              Bonding
            </span>
          )}
        </div>

        {/* Pricing & 24h Change */}
        <div className="flex items-baseline justify-between py-2 border-y border-border-subtle/60 mb-2.5">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Price</div>
            <div className="text-[14px] font-extrabold font-mono text-text-primary">
              {formatTokenPrice(launch.priceUsdc)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">7D Change</div>
            <div className={`text-[12.5px] font-mono ${priceChangeClass(launch.priceChangeBps7d)}`}>
              {formatPriceChangeBps(launch.priceChangeBps7d)}
            </div>
          </div>
        </div>

        {/* Key Metrics: FDV & Volume */}
        <div className="grid grid-cols-2 gap-2 text-center py-1.5 px-2 bg-bg-surface rounded-xl border border-border-subtle/50 mb-2.5">
          <div>
            <div className="text-[9px] text-text-quaternary uppercase font-bold">FDV</div>
            <div className="text-[11.5px] font-mono font-bold text-text-secondary">
              {formatUsdc(BigInt(launch.fdvUsdc))}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-text-quaternary uppercase font-bold">Holders</div>
            <div className="text-[11.5px] font-mono font-bold text-text-secondary">
              {launch.holdersCount || 1}
            </div>
          </div>
        </div>

        {/* Prominent Bonding Curve Progress Bar */}
        <div className="p-2.5 rounded-xl bg-bg-surface border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px] font-mono">
            <span className="text-text-tertiary">
              {launch.graduated ? "Uniswap LP Burned" : `Raised: ${raisedFormatted} / ${thresholdFormatted}`}
            </span>
            <span className={cn("font-extrabold", launch.graduated ? "text-emerald" : "text-accent-violet")}>
              {launch.graduated ? "100% LOCKED" : `${pct.toFixed(1)}%`}
            </span>
          </div>

          <div className="h-2 w-full bg-bg-surface3 rounded-full overflow-hidden border border-border-subtle">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                launch.graduated ? "bg-emerald" : "bg-[#1FD487]",
              )}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-border-subtle/60">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickBuy(launch);
          }}
          className="flex-1 py-2 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-white text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Buy ${launch.symbol}</span>
        </button>

        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="px-3 py-2 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-secondary hover:text-text-primary border border-border-strong text-xs font-bold transition-colors flex items-center justify-center"
        >
          <span>Chart</span>
          <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </div>
    </div>
  );
}

export function LaunchTable() {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<MarketSortKey>("trending");
  const [statusFilter, setStatusFilter] = useState<MarketStatusFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickBuyLaunch, setQuickBuyLaunch] = useState<LaunchpadListItem | null>(null);

  // Default to list/table mode on mobile viewports (< 768px)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("table");
    }
  }, []);

  // Map sortKey to underlying API tab if applicable
  const apiTab: LaunchpadTab =
    sortKey === "gainers"
      ? "gainers"
      : sortKey === "newest"
        ? "new"
        : sortKey === "market_cap"
          ? "top"
          : "trending";

  const { loading, launches, total } = useLaunchpadList(apiTab, 100);

  // Filter and sort launches in single canonical explorer
  const processedLaunches = useMemo(() => {
    let list = [...launches];

    // 1. Status Filter
    if (statusFilter === "bonding") {
      list = list.filter((l) => !l.graduated);
    } else if (statusFilter === "graduated") {
      list = list.filter((l) => l.graduated);
    }

    // 2. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.symbol.toLowerCase().includes(q) ||
          l.token.toLowerCase().includes(q) ||
          (l.agentName && l.agentName.toLowerCase().includes(q)) ||
          l.creator.toLowerCase().includes(q),
      );
    }

    // 3. Client Sorting
    if (sortKey === "near_graduation") {
      list.sort((a, b) => {
        const pctA = computeProgress(a).pct;
        const pctB = computeProgress(b).pct;
        return pctB - pctA;
      });
    } else if (sortKey === "volume") {
      list.sort((a, b) => Number(BigInt(b.volume24hUsdc || "0") - BigInt(a.volume24hUsdc || "0")));
    } else if (sortKey === "market_cap") {
      list.sort((a, b) => Number(BigInt(b.fdvUsdc || "0") - BigInt(a.fdvUsdc || "0")));
    }

    return list;
  }, [launches, statusFilter, searchQuery, sortKey]);

  return (
    <div id="market-explorer" className="space-y-4">
      <QuickBuyDialog
        launch={quickBuyLaunch}
        open={Boolean(quickBuyLaunch)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQuickBuyLaunch(null);
        }}
      />

      {/* Explorer Header & Controls */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-3.5 sm:p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-black text-text-primary tracking-tight">
              Market Explorer
            </h2>
            <span className="text-[11px] font-mono font-bold text-text-quaternary px-2 py-0.5 rounded-full bg-bg-surface border border-border-subtle">
              {processedLaunches.length} tokens
            </span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-bg-surface border border-border-subtle">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                viewMode === "grid" ? "bg-bg-raised text-text-primary shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                viewMode === "table" ? "bg-bg-raised text-text-primary shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
              )}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-2 border-t border-border-subtle/60">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-quaternary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tokens, symbols, agents, or creator addresses…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-surface border border-border-strong text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-[#FF5C28] transition-colors"
            />
          </div>

          {/* Status Filters & Sort Dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-bg-surface border border-border-subtle text-xs font-bold">
              {[
                { id: "all" as MarketStatusFilter, label: "All" },
                { id: "bonding" as MarketStatusFilter, label: "Bonding" },
                { id: "graduated" as MarketStatusFilter, label: "Graduated" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-[11.5px]",
                    statusFilter === pill.id
                      ? "bg-bg-raised text-text-primary shadow-2xs"
                      : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as MarketSortKey)}
                className="bg-bg-surface border border-border-strong rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary outline-none cursor-pointer pr-8 focus:border-[#FF5C28]"
              >
                <option value="trending">Sort: Trending</option>
                <option value="market_cap">Sort: Market Cap</option>
                <option value="volume">Sort: Trending</option>
                <option value="gainers">Sort: Top Gainers</option>
                <option value="near_graduation">Sort: Near Graduation</option>
                <option value="newest">Sort: Newest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main List Rendering */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : processedLaunches.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface text-text-tertiary">
            <Search className="h-6 w-6 text-text-quaternary" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-text-primary">No Matching Agent Tokens</div>
            <p className="text-[12px] text-text-tertiary mt-1 max-w-sm">
              {searchQuery
                ? `No tokens matched "${searchQuery}". Try searching by a different name or symbol.`
                : "No tokens found for the selected filter."}
            </p>
          </div>
          {searchQuery && (
            <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="mt-1">
              Clear Search
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {processedLaunches.map((launch) => (
            <LaunchCard key={launch.launchChainId} launch={launch} onQuickBuy={setQuickBuyLaunch} />
          ))}
        </div>
      ) : (
        /* List / Table View (Mobile-native compact cards on mobile, pro table on desktop) */
        <div>
          {/* Mobile-Native Compact List (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {processedLaunches.map((launch) => {
              const { pct, raisedFormatted, thresholdFormatted } = computeProgress(launch);
              const href = `/app/launchpad/${launchSlug(launch.symbol, launch.launchChainId)}`;

              return (
                <div
                  key={launch.launchChainId}
                  onClick={() => router.push(href)}
                  className="p-3.5 rounded-2xl border border-border-subtle bg-bg-elevated hover:bg-bg-raised transition-all flex flex-col gap-2.5 shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                        alt=""
                        className="h-8.5 w-8.5 rounded-xl border border-border-strong object-cover bg-bg-surface3 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-extrabold text-[13.5px] text-text-primary truncate">
                            {launch.name}
                          </span>
                          <span className="text-[10.5px] font-mono text-text-tertiary font-bold">
                            ${launch.symbol}
                          </span>
                        </div>
                        <div className="text-[10.5px] font-mono text-text-quaternary flex items-center gap-1">
                          <span>by</span>
                          {launch.agentName ? (
                            <span className="font-semibold text-text-secondary">@{launch.agentName}</span>
                          ) : (
                            <UserAddressLink address={launch.creator} className="text-[10.5px]" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <div className="text-[13px] font-bold text-text-primary">
                        {formatTokenPrice(launch.priceUsdc)}
                      </div>
                      <div className={`text-[10.5px] ${priceChangeClass(launch.priceChangeBps7d)}`}>
                        {formatPriceChangeBps(launch.priceChangeBps7d)}
                      </div>
                    </div>
                  </div>

                  {/* Progress & Quick Buy Row */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle/60">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[9.5px] font-mono mb-1">
                        <span className="text-text-quaternary">
                          {launch.graduated ? "DEX" : `${raisedFormatted} / ${thresholdFormatted}`}
                        </span>
                        <span className={cn("font-bold", launch.graduated ? "text-emerald" : "text-accent-violet")}>
                          {launch.graduated ? "Graduated" : `${pct.toFixed(0)}%`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            launch.graduated ? "bg-emerald" : "bg-[#1FD487]",
                          )}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>

                    {launch.graduated ? (
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3.5 py-1.5 rounded-xl bg-accent-violet hover:bg-accent-violet/90 text-white text-xs font-extrabold shrink-0 shadow-xs active:scale-98 transition-all inline-block"
                      >
                        Trade
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!checkOperationChain(launch.chain, "buy this token")) return;
                          setQuickBuyLaunch(launch);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#FF5C28] hover:bg-[#ff480e] text-white text-xs font-extrabold shrink-0 shadow-xs active:scale-98 transition-all cursor-pointer"
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Pro Table (>= sm) */}
          <div className="hidden sm:block rounded-2xl border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-surface border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Token & Agent</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">7D Change</th>
                    <th className="py-3 px-4">FDV</th>
                    <th className="py-3 px-4">Holders</th>
                    <th className="py-3 px-4">Bonding Progress</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {processedLaunches.map((launch) => {
                    const { pct, raisedFormatted, thresholdFormatted } = computeProgress(launch);
                    const href = `/app/launchpad/${launchSlug(launch.symbol, launch.launchChainId)}`;

                    return (
                      <tr key={launch.launchChainId} className="hover:bg-bg-raised/70 transition-colors group">
                        <td className="py-3 px-4">
                          <Link href={href} className="flex items-center gap-2.5 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                              alt=""
                              className="h-8 w-8 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0"
                            />
                            <div className="truncate">
                              <div className="font-extrabold text-[13px] text-text-primary group-hover:text-accent-violet transition-colors truncate">
                                {launch.name}
                              </div>
                              <div className="text-[10.5px] font-mono text-text-quaternary truncate flex items-center gap-1">
                                <span>${launch.symbol} • by</span>
                                {launch.agentName ? (
                                  <span className="font-semibold text-text-secondary">@{launch.agentName}</span>
                                ) : (
                                  <UserAddressLink address={launch.creator} className="text-[10.5px]" />
                                )}
                              </div>
                            </div>
                          </Link>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-text-primary">
                          {formatTokenPrice(launch.priceUsdc)}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <span className={priceChangeClass(launch.priceChangeBps7d)}>
                            {formatPriceChangeBps(launch.priceChangeBps7d)}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-text-secondary">
                          {formatUsdc(BigInt(launch.fdvUsdc))}
                        </td>

                        <td className="py-3 px-4 font-mono text-text-secondary">
                          {launch.holdersCount || 1}
                        </td>

                        <td className="py-3 px-4 min-w-[140px]">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-text-quaternary">{raisedFormatted}</span>
                              <span className="font-bold text-accent-violet">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#1FD487] rounded-full"
                                style={{ width: `${Math.max(4, pct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {launch.graduated ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 font-mono">
                              Graduated
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20 font-mono">
                              Bonding
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {launch.graduated ? (
                            <Link
                              href={href}
                              className="px-3 py-1 rounded-lg bg-accent-violet text-white text-xs font-bold hover:bg-accent-violet/90 transition-colors shadow-xs inline-block"
                            >
                              Trade
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!checkOperationChain(launch.chain, "buy this token")) return;
                                setQuickBuyLaunch(launch);
                              }}
                              className="px-3 py-1 rounded-lg bg-[#FF5C28] text-white text-xs font-bold hover:bg-[#ff480e] transition-colors cursor-pointer shadow-xs"
                            >
                              Buy
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
