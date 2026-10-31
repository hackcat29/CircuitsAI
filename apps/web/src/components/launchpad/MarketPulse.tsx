"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Flame,
  TrendingUp,
  Clock,
  Target,
  CheckCircle2,
  Activity,
  ArrowRight,
  Sparkles,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLaunchpadList, useWallet, type LaunchpadListItem } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { formatPriceChangeBps, formatTokenPrice, formatUsdc, truncateAddress, formatRelativeTime } from "@/lib/format";
import { launchSlug } from "@/lib/launchSlug";
import { robotAvatarUrl } from "@/lib/avatar";
import { UserAddressLink } from "@/components/profile";
import { cn } from "@/lib/cn";
import type { LaunchTrade } from "@/hooks/useLaunchpadTrades";

export type PulseTab = "trending" | "new" | "gainers" | "near_graduation" | "graduated" | "swaps";

const SWAPS_PAGE_SIZE = 4;

export function MarketPulse() {
  const [activeTab, setActiveTab] = useState<PulseTab>("trending");
  const [swapsPage, setSwapsPage] = useState(1);
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);

  // Queries for launch datasets
  const { launches: trendingLaunches, loading: trendingLoading } = useLaunchpadList("trending", 10);
  const { launches: newLaunches, loading: newLoading } = useLaunchpadList("new", 10);
  const { launches: gainersLaunches, loading: gainersLoading } = useLaunchpadList("gainers", 10);
  const { launches: graduatedLaunches, loading: graduatedLoading } = useLaunchpadList("graduated", 10);
  const { launches: allLaunches, loading: allLoading } = useLaunchpadList("top", 100);

  // Lookup map to get token details (name, symbol, token address) for any trade
  const launchMap = useMemo(() => {
    const map = new Map<string, LaunchpadListItem>();
    for (const l of allLaunches) {
      map.set(l.launchChainId, l);
      if (l.id) map.set(l.id, l);
    }
    return map;
  }, [allLaunches]);

  // Calculate "Near Graduation" tokens (non-graduated tokens sorted by highest bonding % completion)
  // Contract default graduation threshold is $900 USDC (900_000_000n micros)
  const nearGraduationLaunches = useMemo(() => {
    return allLaunches
      .filter((l) => !l.graduated)
      .map((l) => {
        const raised = BigInt(l.usdcRaised || "0");
        const threshold = BigInt(l.graduationThreshold || "900000000");
        const pct = threshold > 0n ? Math.min(99.9, Number((raised * 10000n) / threshold) / 100) : 0;
        return { ...l, computedPct: pct, raisedBig: raised, thresholdBig: threshold };
      })
      .sort((a, b) => b.computedPct - a.computedPct)
      .slice(0, 4);
  }, [allLaunches]);

  // Query for live swaps ticker
  const [swaps, setSwaps] = useState<LaunchTrade[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchSwaps() {
      try {
        const res = await fetch(`/api/launchpad/trades?limit=24&chain=${chainSlug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.trades) {
          setSwaps(data.trades);
        }
      } catch {
        // quiet
      } finally {
        if (!cancelled) setSwapsLoading(false);
      }
    }
    fetchSwaps();
    const interval = setInterval(fetchSwaps, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainSlug]);

  const tabs: { id: PulseTab; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: "trending", label: "Trending", icon: Flame, color: "text-[#FF5C28]" },
    { id: "new", label: "New", icon: Clock, color: "text-amber-400" },
    { id: "gainers", label: "Top Gainers", icon: TrendingUp, color: "text-[#1FD487]" },
    { id: "near_graduation", label: "Near Graduation", icon: Target, color: "text-cyan-400" },
    { id: "graduated", label: "Graduated", icon: CheckCircle2, color: "text-accent-violet" },
    { id: "swaps", label: "Live Swaps", icon: Activity, color: "text-purple" },
  ];

  const currentLaunches = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return trendingLaunches.slice(0, 4);
      case "new":
        return newLaunches.slice(0, 4);
      case "gainers":
        return gainersLaunches.slice(0, 4);
      case "near_graduation":
        return nearGraduationLaunches;
      case "graduated":
        return graduatedLaunches.slice(0, 4);
      default:
        return [];
    }
  }, [activeTab, trendingLaunches, newLaunches, gainersLaunches, nearGraduationLaunches, graduatedLaunches]);

  const isLoading =
    (activeTab === "trending" && trendingLoading) ||
    (activeTab === "new" && newLoading) ||
    (activeTab === "gainers" && gainersLoading) ||
    (activeTab === "near_graduation" && allLoading) ||
    (activeTab === "graduated" && graduatedLoading) ||
    (activeTab === "swaps" && swapsLoading);

  // Pagination for live swaps to keep UI height steady
  const totalSwapsPages = Math.ceil(swaps.length / SWAPS_PAGE_SIZE) || 1;
  const currentSwapsPage = Math.min(swapsPage, totalSwapsPages);
  const pagedSwaps = useMemo(() => {
    return swaps.slice((currentSwapsPage - 1) * SWAPS_PAGE_SIZE, currentSwapsPage * SWAPS_PAGE_SIZE);
  }, [swaps, currentSwapsPage]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-3.5 sm:p-5 shadow-xs flex flex-col gap-3.5">
      {/* Header with Title & Horizontal Scrollable Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-border-subtle/70">
        <div className="flex items-center gap-2">

        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-bg-surface border border-border-strong text-text-primary shadow-xs"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-bg-surface/50",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? tab.color : "text-text-quaternary")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area: Single View Displayed */}
      <div className="min-h-[110px]">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-bg-surface animate-pulse border border-border-subtle" />
            ))}
          </div>
        ) : activeTab === "swaps" ? (
          /* Live Swaps: ONLY LIST MODE with compact pagination */
          swaps.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-quaternary font-mono">
              No live swaps recorded on Monad in this window.
            </div>
          ) : (
            <div className="flex flex-col bg-bg-surface rounded-xl border border-border-subtle overflow-hidden">
              <div className="divide-y divide-border-subtle/50">
                {pagedSwaps.map((s, idx) => {
                  const token = launchMap.get(s.launchChainId);
                  const tokenName = token?.name || `Token #${s.launchChainId}`;
                  const tokenSymbol = token?.symbol || "TOKEN";
                  const usdcFormatted = formatUsdc(BigInt(s.usdcAmount || "0"));
                  const tokenAmountNum = Number(BigInt(s.tokenAmount || "0")) / 1e18;
                  const tokenAmountFormatted = tokenAmountNum > 0
                    ? tokenAmountNum.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : "";

                  return (
                    <div
                      key={s.id || idx}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-bg-raised/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={cn(
                            "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0",
                            s.side === "BUY"
                              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                              : "bg-[#2e1313] text-red-400 border-red-500/30",
                          )}
                        >
                          {s.side}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-mono font-bold text-text-primary flex items-center gap-1.5 flex-wrap">
                            <span className={s.side === "BUY" ? "text-[#1FD487]" : "text-text-primary"}>
                              {usdcFormatted}
                            </span>
                            <Link
                              href={`/app/launchpad/${launchSlug(tokenSymbol, s.launchChainId)}`}
                              className="text-text-primary hover:text-accent-violet transition-colors font-extrabold"
                            >
                              ${tokenSymbol.replace(/^\$/, "")}
                            </Link>
                            <span className="text-text-tertiary font-normal">
                              {s.side === "BUY" ? "bought by" : "sold by"}
                            </span>
                            <UserAddressLink address={s.traderAddress} className="text-xs" />
                          </div>
                          {tokenAmountFormatted && (
                            <div className="text-[10.5px] text-text-quaternary font-mono mt-0.5">
                              {tokenAmountFormatted} ${tokenSymbol.replace(/^\$/, "")} • {tokenName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono text-[11px] text-text-quaternary">
                        {s.createdAtChain ? formatRelativeTime(s.createdAtChain) : "just now"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Swaps Pagination Footer */}
              {totalSwapsPages > 1 && (
                <div className="flex items-center justify-between px-3.5 py-2 bg-bg-surface3/30 border-t border-border-subtle text-xs text-text-tertiary">
                  <span className="text-[10.5px] font-mono text-text-quaternary">
                    Showing {(currentSwapsPage - 1) * SWAPS_PAGE_SIZE + 1}–{Math.min(currentSwapsPage * SWAPS_PAGE_SIZE, swaps.length)} of {swaps.length} trades
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentSwapsPage <= 1}
                      onClick={() => setSwapsPage((p) => Math.max(1, p - 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      aria-label="Previous swaps page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-mono text-[11px] text-text-secondary px-1">
                      {currentSwapsPage} / {totalSwapsPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentSwapsPage >= totalSwapsPages}
                      onClick={() => setSwapsPage((p) => Math.min(totalSwapsPages, p + 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      aria-label="Next swaps page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : currentLaunches.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-quaternary font-mono">
            {activeTab === "graduated"
              ? "No tokens have graduated to Uniswap yet. Tokens migrate at $900 liquidity threshold."
              : "No tokens found in this market category yet."}
          </div>
        ) : (
          /* Cards Grid: 1 col on mobile, 2 cols on tablet, 4 cols on desktop */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {currentLaunches.map((launch) => {
              const raised = BigInt(launch.usdcRaised || "0");
              const threshold = BigInt(launch.graduationThreshold || "900000000");
              const progress = launch.graduated
                ? 100
                : threshold > 0n
                  ? Math.min(99.9, Number((raised * 10000n) / threshold) / 100)
                  : 0;

              return (
                <Link
                  key={launch.launchChainId}
                  href={`/app/launchpad/${launchSlug(launch.symbol, launch.launchChainId)}`}
                  className="group p-3 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:border-border-strong transition-all flex flex-col justify-between gap-2 shadow-2xs cursor-pointer"
                >
                  {/* Top: Avatar, Name, Change */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                        alt=""
                        className="h-7 w-7 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-[12.5px] text-text-primary truncate group-hover:text-accent-violet transition-colors">
                            {launch.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-text-tertiary">
                            ${launch.symbol}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "text-[10.5px] font-mono font-bold shrink-0",
                        launch.priceChangeBps7d !== null && launch.priceChangeBps7d >= 0
                          ? "text-[#1FD487]"
                          : launch.priceChangeBps7d !== null
                            ? "text-red-400"
                            : "text-text-quaternary",
                      )}
                    >
                      {formatPriceChangeBps(launch.priceChangeBps7d)}
                    </span>
                  </div>

                  {/* Mid: Price & FDV */}
                  <div className="flex items-baseline justify-between text-xs font-mono pt-1 border-t border-border-subtle/50">
                    <span className="text-[11.5px] font-bold text-text-primary">
                      {formatTokenPrice(launch.priceUsdc)}
                    </span>
                    <span className="text-[10.5px] text-text-quaternary">
                      FDV {formatUsdc(BigInt(launch.fdvUsdc))}
                    </span>
                  </div>

                  {/* Bottom: Progress Bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9.5px] font-mono">
                      <span className="text-text-quaternary">
                        {launch.graduated ? "Uniswap DEX" : `${formatUsdc(raised)} / ${formatUsdc(threshold)}`}
                      </span>
                      <span className={cn("font-bold", launch.graduated ? "text-emerald" : "text-accent-violet")}>
                        {launch.graduated ? "GRADUATED" : `${progress.toFixed(0)}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          launch.graduated ? "bg-emerald" : "bg-[#1FD487]",
                        )}
                        style={{ width: `${Math.max(4, progress)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── LIVE TRADES TICKER STRIP BENEATH MARKET PULSE (MOVING RIGHT TO LEFT) ── */}
      <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between gap-3 overflow-hidden text-[11px] font-mono">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FF5C28]/10 border border-[#FF5C28]/20 text-[#FF5C28] font-extrabold text-[10px] shrink-0 z-10">
            <Zap className="h-2.5 w-2.5 animate-pulse" />
            <span>LIVE TRADES</span>
          </div>

          {swaps.length === 0 ? (
            <span className="text-text-quaternary text-[10.5px] truncate">
              Streaming real-time swaps on Monad bonding curves…
            </span>
          ) : (
            <div className="relative flex-1 overflow-hidden">
              <div className="flex items-center gap-6 whitespace-nowrap animate-tick hover:[animation-play-state:paused]">
                {/* Render duplicate items for continuous smooth infinite scrolling from right to left */}
                {[...swaps, ...swaps].map((s, i) => {
                  const token = launchMap.get(s.launchChainId);
                  const tokenSymbol = token?.symbol || token?.name || "TOKEN";
                  const usdcFormatted = formatUsdc(BigInt(s.usdcAmount || "0"));

                  return (
                    <div key={`${s.id || s.txHash}-${i}`} className="flex items-center gap-1.5 shrink-0 text-[11px]">
                      <span className="text-text-quaternary font-bold">•</span>
                      <span className={cn("font-bold", s.side === "BUY" ? "text-[#1FD487]" : "text-text-primary")}>
                        {usdcFormatted}
                      </span>
                      <Link
                        href={`/app/launchpad/${launchSlug(tokenSymbol, s.launchChainId)}`}
                        className="font-extrabold text-text-primary hover:text-accent-violet transition-colors"
                      >
                        ${tokenSymbol.replace(/^\$/, "")}
                      </Link>
                      <span className="text-text-tertiary">
                        {s.side === "BUY" ? "bought by" : "sold by"}
                      </span>
                      <UserAddressLink address={s.traderAddress} className="text-[11px] font-semibold text-text-secondary" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <a
          href="#market-explorer"
          className="text-[10.5px] font-bold text-accent-violet hover:underline shrink-0 hidden sm:flex items-center gap-1 z-10"
        >
          <span>Explore All</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
