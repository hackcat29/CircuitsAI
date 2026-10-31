"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Flame, CheckCircle2, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from "@/components/ui";
import { useLaunchpadList, useWallet, type LaunchpadListItem } from "@/hooks";
import { toIndexerChainSlug, isEvmChain } from "@/lib/chains";
import { formatPriceChangeBps, formatUsdc, truncateAddress, formatRelativeTime } from "@/lib/format";
import { launchSlug } from "@/lib/launchSlug";
import { robotAvatarUrl } from "@/lib/avatar";
import type { LaunchTrade } from "@/hooks/useLaunchpadTrades";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

const ITEMS_PER_PAGE = 5;

function computeProgress(launch: LaunchpadListItem): number {
  if (launch.graduated) return 100;
  const raised = BigInt(launch.usdcRaised || "0");
  const threshold = BigInt(launch.graduationThreshold || "1");
  if (threshold <= 0n) return 0;
  return Math.min(99.9, Number((raised * 10000n) / threshold) / 100);
}

function MiniLaunchRow({ launch, trailing }: { launch: LaunchpadListItem; trailing: React.ReactNode }) {
  const progress = computeProgress(launch);

  return (
    <Link
      href={`/app/launchpad/${launchSlug(launch.symbol, launch.launchChainId)}`}
      className="group flex items-center justify-between gap-2.5 rounded-[10px] px-2.5 py-2 text-sm hover:bg-white/5 border border-transparent hover:border-border-subtle transition-all"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={robotAvatarUrl(launch.token)}
          alt=""
          className="h-7.5 w-7.5 rounded-[8px] border border-border-strong object-cover bg-bg-surface3 shrink-0 group-hover:scale-105 transition-transform"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate text-[12.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
              {launch.name}
            </span>
            <span className="text-[10.5px] font-mono text-text-tertiary shrink-0">
              ${launch.symbol}
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="flex items-center gap-1.5 mt-0.5 w-full max-w-[120px]">
            <div className="h-1 flex-1 bg-bg-surface3 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1FD487] rounded-full"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-text-quaternary shrink-0">
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        {trailing}
      </div>
    </Link>
  );
}

function MiniPanel({
  title,
  tab,
  icon: Icon,
}: {
  title: string;
  tab: "trending" | "gainers" | "graduated";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const { loading, launches } = useLaunchpadList(tab, 25);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(launches.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedLaunches = useMemo(() => {
    return launches.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  }, [launches, currentPage]);

  return (
    <Card className="border border-border-subtle bg-bg-elevated/70 backdrop-blur-sm shadow-xs overflow-hidden flex flex-col justify-between">
      <div>
        <CardHeader className="pb-2 pt-3.5 px-3.5 border-b border-border-subtle/50 flex flex-row items-center justify-between">
          <CardTitle className="text-[12.5px] font-extrabold flex items-center gap-1.5 text-text-primary">
            <Icon className="h-3.5 w-3.5 text-accent-violet" />
            <span>{title}</span>
          </CardTitle>
          <span className="text-[10px] font-mono text-text-quaternary font-bold">
            {launches.length > 0 ? `${launches.length} total` : ""}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-2">
          {loading ? (
            [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full rounded-[8px]" />)
          ) : launches.length === 0 ? (
            <div className="py-7 px-3 text-center flex flex-col items-center justify-center gap-1.5">
              <div className="text-[11.5px] font-bold text-text-primary">Graduation Zone</div>
              <p className="text-[10px] text-text-quaternary max-w-[170px] leading-tight">
                Tokens that reach 100% funding threshold graduate directly to DEX liquidity pools.
              </p>
            </div>
          ) : (
            pagedLaunches.map((launch) => (
              <MiniLaunchRow
                key={launch.id}
                launch={launch}
                trailing={
                  tab === "gainers" ? (
                    <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-[5px] ${
                      launch.priceChangeBps7d !== null && launch.priceChangeBps7d < 0
                        ? "text-red bg-red/10 border border-red/20"
                        : "text-emerald bg-emerald/10 border border-emerald/20"
                    }`}>
                      {formatPriceChangeBps(launch.priceChangeBps7d)}
                    </span>
                  ) : tab === "graduated" ? (
                    <span className="text-[11px] font-mono font-bold text-text-secondary">
                      {formatUsdc(BigInt(launch.usdcRaised))}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono font-bold text-text-secondary">
                      {launch.holdersCount || 1} {launch.holdersCount === 1 ? "holder" : "holders"}
                    </span>
                  )
                }
              />
            ))
          )}
        </CardContent>
      </div>

      {/* Pagination Footer */}
      {!loading && launches.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle/40 bg-bg-surface3/20">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-0.5 text-[10.5px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </button>
          <span className="text-[10px] font-mono text-text-quaternary font-semibold">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="flex items-center gap-0.5 text-[10.5px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Card>
  );
}

function useLiveTrades(limit = 25) {
  const { chain } = useWallet();
  const [trades, setTrades] = useState<LaunchTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isEvmChain(chain)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/launchpad/trades?chain=${toIndexerChainSlug(chain)}&pageSize=${limit}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: { trades: LaunchTrade[] }) => {
        if (!cancelled) setTrades(data.trades);
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, limit]);

  return { trades, loading };
}

function LiveTradesPanel() {
  const { chain } = useWallet();
  const { trades, loading } = useLiveTrades(25);
  const { launches } = useLaunchpadList("top", 50);
  const [page, setPage] = useState(0);

  const explorerUrl = isEvmChain(chain) ? chain.explorerUrl : null;

  const tokenByChainId = useMemo(() => {
    return Object.fromEntries(launches.map((l) => [l.launchChainId, l]));
  }, [launches]);

  const totalPages = Math.max(1, Math.ceil(trades.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedTrades = useMemo(() => {
    return trades.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  }, [trades, currentPage]);

  return (
    <Card className="border border-border-subtle bg-bg-elevated/70 backdrop-blur-sm shadow-xs overflow-hidden flex flex-col justify-between">
      <div>
        <CardHeader className="pb-2 pt-3.5 px-3.5 border-b border-border-subtle/50 flex flex-row items-center justify-between">
          <CardTitle className="text-[12.5px] font-extrabold flex items-center gap-2 text-text-primary">
            <Activity className="h-3.5 w-3.5 text-emerald" />
            <span>Live Swaps</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
            </span>
          </CardTitle>
          <span className="text-[10px] font-mono text-text-quaternary font-bold">Real-time</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-2">
          {loading ? (
            [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full rounded-[8px]" />)
          ) : trades.length === 0 ? (
            <p className="py-7 text-center text-xs text-text-tertiary">No trades yet.</p>
          ) : (
            pagedTrades.map((trade) => {
              const launch = tokenByChainId[trade.launchChainId];
              const isBuy = trade.side === "BUY";
              const txUrl = explorerUrl && trade.txHash ? `${explorerUrl}/tx/${trade.txHash}` : `/app/launchpad/${trade.launchChainId}`;

              return (
                <a
                  key={trade.id}
                  href={txUrl}
                  target={explorerUrl ? "_blank" : undefined}
                  rel={explorerUrl ? "noreferrer" : undefined}
                  className="group flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.75 text-xs hover:bg-white/5 border border-transparent hover:border-border-subtle transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-bold px-1.25 py-0.2 rounded font-mono ${
                      isBuy ? "bg-emerald/15 text-emerald border border-emerald/30" : "bg-red/15 text-red border border-red/30"
                    }`}>
                      {isBuy ? "BUY" : "SELL"}
                    </span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-extrabold text-[11.5px] text-text-primary group-hover:text-accent-violet transition-colors truncate">
                        {launch?.symbol ? `$${launch.symbol}` : `#${trade.launchChainId}`}
                      </span>
                      <UserAddressLink address={trade.traderAddress} asSpan className="text-[10px] text-text-quaternary font-mono" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono font-bold text-[11.5px] ${isBuy ? "text-emerald" : "text-red"}`}>
                      {isBuy ? "+" : "-"}
                      {formatUsdc(BigInt(trade.usdcAmount))}
                    </span>
                    <span className="text-[9.5px] text-text-quaternary font-mono">
                      {formatRelativeTime(trade.createdAtChain)}
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </CardContent>
      </div>

      {/* Pagination Footer */}
      {!loading && trades.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle/40 bg-bg-surface3/20">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-0.5 text-[10.5px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </button>
          <span className="text-[10px] font-mono text-text-quaternary font-semibold">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="flex items-center gap-0.5 text-[10.5px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Card>
  );
}

export function LaunchpadPanels() {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      <MiniPanel title="Trending" tab="trending" icon={TrendingUp} />
      <MiniPanel title="Just Graduated" tab="graduated" icon={CheckCircle2} />
      <MiniPanel title="Top Gainers" tab="gainers" icon={Flame} />
      <LiveTradesPanel />
    </div>
  );
}


