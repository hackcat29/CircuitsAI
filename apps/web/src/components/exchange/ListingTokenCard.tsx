"use client";

import Link from "next/link";
import { Coins, ArrowUpRight, TrendingUp, Users, DollarSign, Flame } from "lucide-react";
import type { LaunchpadListItem } from "@/hooks";
import { formatUsdc, formatTokenPrice } from "@/lib/format";

function computeProgress(launch: LaunchpadListItem): number {
  if (launch.graduated) return 100;
  try {
    const raised = BigInt(launch.usdcRaised || "0");
    const threshold = BigInt(launch.graduationThreshold || "1");
    if (threshold <= 0n) return 0;
    return Math.min(99.9, Number((raised * 10000n) / threshold) / 100);
  } catch {
    return 0;
  }
}

export function ListingTokenCard({ launch }: { launch: LaunchpadListItem }) {
  const progress = computeProgress(launch);

  return (
    <div className="rounded-[16px] border border-accent-violet/30 bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-3.5 shadow-xs relative overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-accent-violet/20 border border-accent-violet/40 flex items-center justify-center text-accent-violet">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5">
                <span>${launch.symbol}</span>
                <span className="text-text-tertiary font-normal">· {launch.name}</span>
              </h3>
              {launch.graduated ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#1FD487]/20 text-[#1FD487] border border-[#1FD487]/30">
                  DEX Graduated
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-violet/20 text-accent-violet border border-accent-violet/30 flex items-center gap-1">
                  <Flame className="h-2.5 w-2.5" />
                  <span>Bonding Curve</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-quaternary mt-0.5">
              30% Creator royalties transferred upon settlement
            </p>
          </div>
        </div>

        <Link
          href={`/app/launchpad/${launch.launchChainId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-accent-violet text-white text-[11.5px] font-bold hover:bg-accent-violet/90 transition-all shadow-2xs cursor-pointer"
        >
          <span>Trade ${launch.symbol}</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-border-subtle/70 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Token Price</p>
          <p className="text-sm font-mono font-bold text-text-primary mt-0.5">{formatTokenPrice(launch.priceUsdc)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">FDV / Market Cap</p>
          <p className="text-sm font-mono font-bold text-accent-violet mt-0.5">
            {formatUsdc(BigInt(launch.fdvUsdc || launch.marketCapUsdc || "0"))}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Curve Status</p>
          <p className="text-sm font-mono font-bold text-text-secondary mt-0.5">
            {launch.graduated ? "DEX Graduated" : "Bonding Active"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Token Holders</p>
          <p className="text-sm font-mono font-bold text-text-secondary mt-0.5 flex items-center gap-1">
            <Users className="h-3 w-3 text-text-quaternary" />
            <span>{launch.holdersCount.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Bonding Curve Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-text-tertiary font-semibold flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-accent-violet" />
            <span>Bonding Curve Graduation</span>
          </span>
          <span className="font-mono font-bold text-accent-violet">
            {progress.toFixed(1)}% ({formatUsdc(BigInt(launch.usdcRaised || "0"))} /{" "}
            {formatUsdc(BigInt(launch.graduationThreshold || "0"))})
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-bg-surface3 overflow-hidden border border-border-subtle/80">
          <div
            className="h-full bg-accent-violet transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10.5px] text-text-quaternary mt-1.5">
          Upon 100% threshold reached, liquidity seeds automatically into Uniswap V3 with locked LP tokens.
        </p>
      </div>
    </div>
  );
}
