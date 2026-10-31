"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from "@/components/ui";
import { useLaunchTrades, useWallet } from "@/hooks";
import { formatUsdc, formatRelativeTime } from "@/lib/format";
import { isEvmChain } from "@/lib/chains";
import { UserAddressLink } from "@/components/profile";

const TOKEN_DECIMALS_FACTOR = 1e18;
const PAGE_SIZE = 5;

/** All-traders activity feed for a single launch (as opposed to useLaunchpadTrades, which is
 * scoped to the connected wallet's own history) — see useLaunchTrades's own doc comment. Polls
 * every 15s for a semi-live feel, matching the "Live Trades" framing the backing route's doc
 * comment already describes for this exact panel. Paginated to 5 items per page to keep the
 * layout compact. */
export function RecentTrades({ launchChainId, symbol }: { launchChainId: string; symbol: string }) {
  const { chain } = useWallet();
  const { trades, isLoading } = useLaunchTrades(launchChainId);
  const explorerUrl = isEvmChain(chain) ? chain.explorerUrl : null;
  const [page, setPage] = useState(1);

  const totalTrades = trades.length;
  const totalPages = Math.ceil(totalTrades / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedTrades = trades.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-40 rounded-[10px]" />
        ) : trades.length === 0 ? (
          <p className="px-2 py-3 text-xs text-text-tertiary">No trades yet. Recent activity fills in once trading starts.</p>
        ) : (
          <div className="flex flex-col">
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
              <span>Side</span>
              <span>Trader</span>
              <span className="text-right">{symbol}</span>
              <span className="text-right">USDC</span>
              <span className="text-right">Time</span>
            </div>
            {pagedTrades.map((trade) => {
              const tokenAmount = Number(trade.tokenAmount) / TOKEN_DECIMALS_FACTOR;
              const row = (
                <>
                  {/* Mobile: the 5 auto-sized columns below have no room on a phone, so trades
                      stack as a 2-line card instead. */}
                  <div className="sm:hidden flex flex-col gap-1 rounded-md px-2 py-2 text-sm hover:bg-bg-surface3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={trade.side === "BUY" ? "emerald" : "default"}>{trade.side}</Badge>
                        <UserAddressLink address={trade.traderAddress} className="text-xs truncate max-w-[120px]" />
                      </div>
                      <span className="text-xs text-text-quaternary shrink-0">{formatRelativeTime(trade.createdAtChain)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-text-primary">{tokenAmount.toFixed(2)} {symbol}</span>
                      <span className="font-mono text-text-tertiary">{formatUsdc(BigInt(trade.usdcAmount))}</span>
                    </div>
                  </div>
                  {/* sm and up: the original dense row */}
                  <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-bg-surface3">
                    <Badge variant={trade.side === "BUY" ? "emerald" : "default"}>{trade.side}</Badge>
                    <UserAddressLink address={trade.traderAddress} className="text-xs" />
                    <span className="text-right font-mono text-text-primary">{tokenAmount.toFixed(2)}</span>
                    <span className="text-right font-mono text-text-tertiary">{formatUsdc(BigInt(trade.usdcAmount))}</span>
                    <span className="text-right text-xs text-text-quaternary">{formatRelativeTime(trade.createdAtChain)}</span>
                  </div>
                </>
              );
              return explorerUrl ? (
                <a key={trade.id} href={`${explorerUrl}/tx/${trade.txHash}`} target="_blank" rel="noreferrer" className="contents">
                  {row}
                </a>
              ) : (
                row
              );
            })}

            {totalTrades > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border-subtle pt-2.5 mt-1.5 px-2 text-xs text-text-tertiary">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalTrades)} of {totalTrades}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Previous trades page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-xs text-text-secondary px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Next trades page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
