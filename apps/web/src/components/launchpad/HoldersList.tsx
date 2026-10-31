"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { isEvmChain } from "@/lib/chains";
import { useWallet, type LaunchDetail } from "@/hooks";
import { UserAddressLink } from "@/components/profile";

const PAGE_SIZE = 5;

export function HoldersList({ launch }: { launch: LaunchDetail }) {
  const { chain } = useWallet();
  const explorerUrl = isEvmChain(chain) ? chain.explorerUrl : null;
  const totalSupply = BigInt(launch.totalSupply);
  const [page, setPage] = useState(1);

  const totalHolders = launch.holders.length;
  const totalPages = Math.ceil(totalHolders / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedHolders = launch.holders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 backdrop-blur-sm shadow-xs overflow-hidden">
      <CardHeader className="pb-2 pt-3.5 px-3.5 border-b border-border-subtle/50">
        <CardTitle className="flex items-center justify-between text-[12.5px] font-extrabold text-text-primary">
          <span>Top Holders ({formatCount(BigInt(launch.holdersCount))})</span>
          {launch.graduated && (
            <span className="text-[10px] font-normal text-text-tertiary">Approx. as of graduation</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 p-2">
        {launch.holders.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-text-tertiary">No holders recorded yet.</p>
        ) : (
          <div className="flex flex-col">
            {pagedHolders.map((holder, index) => {
              const balance = BigInt(holder.balance);
              const pct = totalSupply > 0n ? Number((balance * 10_000n) / totalSupply) / 100 : 0;
              const isCreator = holder.address.toLowerCase() === launch.creator.toLowerCase();
              const href = explorerUrl ? `${explorerUrl}/address/${holder.address}` : undefined;

              const content = (
                <div className="group flex items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.75 text-xs hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-text-quaternary w-3.5">
                      {(currentPage - 1) * PAGE_SIZE + index + 1}.
                    </span>
                    <UserAddressLink address={holder.address} className="text-xs" />
                    {isCreator && (
                      <span className="text-[9px] font-bold px-1.25 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        Creator
                      </span>
                    )}
                    {holder.isLiquidityPool && (
                      <span className="text-[9px] font-bold px-1.25 py-0.2 rounded bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30">
                        LP Pool
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono font-bold text-text-primary text-[11.5px]">{pct.toFixed(2)}%</span>
                    {href && <a href={href} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity" /></a>}
                  </div>
                </div>
              );

              return href ? (
                <a key={holder.address} href={href} target="_blank" rel="noreferrer" className="block">
                  {content}
                </a>
              ) : (
                <div key={holder.address}>{content}</div>
              );
            })}

            {totalHolders > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border-subtle/50 pt-2 mt-1 px-2 text-xs text-text-tertiary">
                <span className="text-[10px] font-mono text-text-quaternary">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalHolders)} of {totalHolders}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-border-subtle bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    aria-label="Previous holders page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[10px] text-text-secondary px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-border-subtle bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    aria-label="Next holders page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
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

