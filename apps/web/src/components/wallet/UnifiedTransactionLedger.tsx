"use client";

import { useState } from "react";
import {
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Rocket,
  TrendingUp,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc, formatRelativeTime, truncateAddress } from "@/lib/format";
import { useLaunchpadTrades } from "@/hooks";
import { Card, CardHeader, CardTitle, CardDescription, Skeleton, Badge } from "@/components/ui";

interface UnifiedTransactionLedgerProps {
  address: string | undefined;
  explorerUrl: string;
}

export function UnifiedTransactionLedger({
  address,
  explorerUrl,
}: UnifiedTransactionLedgerProps) {
  const { trades, isLoading } = useLaunchpadTrades(address);
  const [filter, setFilter] = useState<"all" | "trades" | "bridges">("all");

  const displayTrades = trades;

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-[15px] font-extrabold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent-violet" />
              <span>On-Chain Activity &amp; Settlement Ledger</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Live transaction stream across token trades, escrows, and CCTP bridges.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 bg-bg-surface p-0.5 rounded-full border border-border-strong text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-0.75 rounded-full font-bold transition-all cursor-pointer",
                filter === "all" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("trades")}
              className={cn(
                "px-2.5 py-0.75 rounded-full font-bold transition-all cursor-pointer",
                filter === "trades" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary",
              )}
            >
              Trades
            </button>
          </div>
        </div>
      </CardHeader>

      <div className="px-5 pb-5">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : displayTrades.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-tertiary bg-bg-surface rounded-[12px] border border-border-subtle">
            No on-chain activity recorded for this address yet.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle/50">
            {displayTrades.map((trade) => (
              <a
                key={trade.id}
                href={`${explorerUrl}/tx/${trade.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between py-3 hover:bg-bg-raised -mx-2 px-2 rounded-[8px] transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                      trade.side === "BUY"
                        ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                        : "bg-[#2e1313] text-[#FF4D4D] border-[#FF4D4D]/30",
                    )}
                  >
                    {trade.side}
                  </span>

                  <div>
                    <div className="text-[13px] font-bold text-text-primary group-hover:text-accent-violet transition-colors flex items-center gap-1">
                      <span>Token Launch #{trade.launchChainId}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10.5px] font-mono text-text-quaternary">
                      {(Number(trade.tokenAmount) / 1e18).toFixed(2)} tokens · {trade.txHash.slice(0, 8)}…
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-[13px] font-extrabold text-text-primary">
                    {formatUsdc(BigInt(trade.usdcAmount))} USDC
                  </div>
                  <div className="text-[10px] text-text-quaternary font-sans">
                    {formatRelativeTime(trade.createdAtChain)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
