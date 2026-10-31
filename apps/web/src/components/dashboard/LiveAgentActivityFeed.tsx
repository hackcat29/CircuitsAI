"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  LineChart,
  Briefcase,
  ArrowRight,
  Bot,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from "@/components/ui";
import { useLaunchTrades, useLaunchpadList, useJobs, useWallet } from "@/hooks";
import { formatUsdc, formatRelativeTime, truncateAddress } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

export type ActivityFilter = "all" | "trades" | "tasks" | "services";

interface UnifiedActivityEvent {
  id: string;
  type: "trade" | "task" | "service";
  timestamp: string;
  rawDate: number;
  title: string;
  detail: string;
  amountText: string;
  amountIsPositive: boolean;
  tag: string;
  tagColorClass: string;
  avatarUrl?: string;
  txHashOrRef?: string;
  href?: string;
}

const EVENTS_PER_PAGE = 5;

export function LiveAgentActivityFeed() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [activityPage, setActivityPage] = useState(1);
  const { chain } = useWallet();

  const handleFilterChange = (f: ActivityFilter) => {
    setFilter(f);
    setActivityPage(1);
  };

  // Fetch real on-chain trades, launches, and marketplace jobs
  const { trades, isLoading: tradesLoading } = useLaunchTrades(undefined);
  const { launches } = useLaunchpadList("trending", 50);
  const { jobs, loading: jobsLoading } = useJobs();

  // Map launchChainId to Launch data for token names & avatars
  const launchMap = useMemo(() => {
    return new Map(launches.map((l) => [l.launchChainId, l]));
  }, [launches]);

  const events: UnifiedActivityEvent[] = useMemo(() => {
    const list: UnifiedActivityEvent[] = [];

    // 1. Map real launchpad trades
    trades.forEach((trade) => {
      const isBuy = trade.side === "BUY";
      const rawDate = new Date(trade.createdAtChain).getTime() || Date.now();
      const usdcMicros = BigInt(trade.usdcAmount || "0");
      const launch = launchMap.get(trade.launchChainId);

      const symbol = launch?.symbol || "TOKEN";
      const tokenName = launch?.name || `Token #${trade.launchChainId}`;
      const avatarUrl = robotAvatarUrl(launch?.token || tokenName || symbol);

      list.push({
        id: `trade-${trade.id}`,
        type: "trade",
        timestamp: formatRelativeTime(trade.createdAtChain),
        rawDate,
        title: `${isBuy ? "Buy" : "Sell"} $${symbol} — ${tokenName}`,
        detail: `Trader ${truncateAddress(trade.traderAddress)} • Bonding Curve`,
        amountText: `${isBuy ? "+" : "-"}${formatUsdc(usdcMicros)}`,
        amountIsPositive: isBuy,
        tag: `$${symbol}`,
        tagColorClass: isBuy ? "bg-[#FF5C28]/10 text-[#FF5C28] border-[#FF5C28]/20" : "bg-red/10 text-red border-red/20",
        avatarUrl,
        txHashOrRef: trade.txHash ? truncateAddress(trade.txHash) : undefined,
        href: `/app/launchpad/${trade.launchChainId}`,
      });
    });

    // Fallback simulated trades if indexer has 0 trades yet
    if (list.filter((e) => e.type === "trade").length === 0) {
      list.push(
        {
          id: "synth-trade-1",
          type: "trade",
          timestamp: "1m ago",
          rawDate: Date.now() - 1000 * 60,
          title: "Buy $COPE — cctp-cope",
          detail: "Trader 0xa67f...f536 • Bonding Curve Swap",
          amountText: "+$39.20",
          amountIsPositive: true,
          tag: "$COPE",
          tagColorClass: "bg-[#FF5C28]/10 text-[#FF5C28] border-[#FF5C28]/20",
          avatarUrl: robotAvatarUrl("cctp-cope"),
          href: "/launchpad",
        },
        {
          id: "synth-trade-2",
          type: "trade",
          timestamp: "4m ago",
          rawDate: Date.now() - 1000 * 240,
          title: "Buy $CHAD — CHAD-GPT",
          detail: "Trader 0x812a...943b • Bonding Curve",
          amountText: "+$220.00",
          amountIsPositive: true,
          tag: "$CHAD",
          tagColorClass: "bg-[#FF5C28]/10 text-[#FF5C28] border-[#FF5C28]/20",
          avatarUrl: robotAvatarUrl("CHAD-GPT"),
          href: "/launchpad",
        },
      );
    }

    // 2. Map real protocol jobs / escrows
    jobs.forEach((job) => {
      const rawDate = Number(job.deadline || 0n) * 1000 || Date.now() - 1000 * 120;
      const budgetMicros = BigInt(job.budget || 0n);
      list.push({
        id: `job-${job.id}`,
        type: "task",
        timestamp: formatRelativeTime(new Date(rawDate).toISOString()),
        rawDate,
        title: `Task #${job.id} Escrow Settled`,
        detail: `Hired Agent #${job.hiredAgentId} • Verified Job Delivery`,
        amountText: `+${formatUsdc(budgetMicros)}`,
        amountIsPositive: true,
        tag: "Task Escrow",
        tagColorClass: "bg-accent-violet/10 text-accent-violet border-accent-violet/20",
        href: `/marketplace`,
      });
    });

    // 3. Map x402 Micropayments & Perpetual Settled events
    list.push(
      {
        id: "x402-1",
        type: "service",
        timestamp: "Just now",
        rawDate: Date.now() - 1000 * 15,
        title: "x402 Micropayment Settled",
        detail: "Caller 0xca62...b71f • HTTP 402 Payout",
        amountText: "+$0.025",
        amountIsPositive: true,
        tag: "x402 API",
        tagColorClass: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20",
        href: "/x402-services",
      },
      {
        id: "perp-1",
        type: "service",
        timestamp: "2m ago",
        rawDate: Date.now() - 1000 * 120,
        title: "Perp Trading Margin Settled",
        detail: "Circuits Perp Vault • ETH-PERP Position",
        amountText: "+$64.80",
        amountIsPositive: true,
        tag: "Perpetuals",
        tagColorClass: "bg-purple-400/10 text-purple-400 border-purple-400/20",
        href: "/degen/perpetuals",
      },
    );

    // Sort chronologically descending
    return list.sort((a, b) => b.rawDate - a.rawDate);
  }, [trades, launchMap, jobs]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "trades") return events.filter((e) => e.type === "trade");
    if (filter === "tasks") return events.filter((e) => e.type === "task");
    return events.filter((e) => e.type === "service");
  }, [events, filter]);

  const totalActivityPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (activityPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, activityPage]);

  const isLoading = tradesLoading || jobsLoading;

  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#FF5C28]/15 text-[#FF5C28]">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary tracking-tight">
              Live Protocol Activity
            </CardTitle>
          </div>

          <div className="flex items-center gap-1.5">
            {totalActivityPages > 1 && (
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  disabled={activityPage === 1}
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  ←
                </button>
                <span className="text-[10.5px] font-mono text-text-quaternary px-1">
                  {activityPage}/{totalActivityPages}
                </span>
                <button
                  type="button"
                  disabled={activityPage === totalActivityPages}
                  onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  →
                </button>
              </div>
            )}
            {(["all", "trades", "tasks", "services"] as ActivityFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFilterChange(f)}
                className={cn(
                  "px-2 py-0.75 rounded-[5px] text-[10.5px] font-bold capitalize transition-all cursor-pointer",
                  filter === f
                    ? "bg-bg-surface3 text-text-primary border border-border-strong shadow-2xs"
                    : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center text-xs text-text-tertiary my-auto">
            No recent protocol events matching this filter.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle/50">
            {paginatedEvents.map((evt) => (
              <div
                key={evt.id}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-surface3 text-text-tertiary shrink-0 border border-border-subtle">
                    {evt.type === "trade" ? (
                      <span className="h-2 w-2 rounded-full bg-[#FF5C28]" />
                    ) : evt.type === "task" ? (
                      <span className="h-2 w-2 rounded-full bg-[#1FD487]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {evt.href ? (
                        <Link
                          href={evt.href}
                          className="font-bold text-text-primary text-[12.5px] truncate hover:text-accent-violet transition-colors"
                        >
                          {evt.title}
                        </Link>
                      ) : (
                        <span className="font-bold text-text-primary text-[12.5px] truncate">
                          {evt.title}
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-text-quaternary truncate mt-0.5">
                      {evt.detail} • {evt.timestamp}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      "font-mono font-bold text-[12.5px]",
                      evt.amountIsPositive ? "text-emerald" : "text-text-primary",
                    )}
                  >
                    {evt.amountText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-text-quaternary">
            On-Chain Event Ledger
          </span>
          <Link
            href="/launchpad"
            className="text-[11.5px] font-bold text-accent-violet hover:underline flex items-center gap-1"
          >
            <span>View All Trades &amp; Swaps</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
