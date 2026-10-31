"use client";

import Link from "next/link";
import { Coins, TrendingUp, Zap, ShieldCheck, ArrowUpRight, DollarSign, Activity } from "lucide-react";
import type { ExchangeListingDetail, ExchangeListingAgent } from "@/hooks/useExchangeListing";
import type { LaunchpadListItem } from "@/hooks";
import { formatUsdc } from "@/lib/format";

export function AgentCashFlowCard({
  listing,
  agent,
  launch,
}: {
  listing: ExchangeListingDetail;
  agent: ExchangeListingAgent | null;
  launch?: LaunchpadListItem;
}) {
  const fairValue = BigInt(listing.fairValueSnapshotUsdc || "0");
  const cumulativeRev = BigInt(agent?.usdcRevenue || "0");

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-text-primary uppercase tracking-wider">
              Revenue &amp; Royalty Streams
            </h2>
            <p className="text-[11px] text-text-tertiary">
              Active revenue routes transferred to buyer upon settlement
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-secondary border border-border-subtle">
          On-Chain Streams
        </span>
      </div>

      {/* 3 Transferred Inflows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Stream 1: Token Royalties */}
        <div className="rounded-[12px] bg-bg-surface3/80 border border-border-subtle p-3.5 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary flex items-center gap-1">
                <Coins className="h-3 w-3 text-accent-violet" />
                <span>Token Royalties</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-accent-violet">30% Royalty</span>
            </div>
            <p className="text-xs font-bold text-text-primary">
              {launch ? `$${launch.symbol} Trading Fees` : "Token Launch Ready"}
            </p>
            <p className="text-[11px] text-text-quaternary mt-1 leading-relaxed">
              {launch
                ? `30% of trading fees from ${launch.symbol} swaps route directly to the owner's wallet.`
                : "Eligible for token launchpad deployment with 30% creator royalties."}
            </p>
          </div>
          {launch && (
            <div className="text-[10px] font-mono text-accent-violet pt-1 border-t border-border-subtle flex items-center justify-between">
              <span>Earned: {formatUsdc(BigInt(agent?.tokenRoyalties || "0"))}</span>
              <Link href={`/app/launchpad/${launch.launchChainId}`} className="hover:underline flex items-center gap-0.5">
                <span>View Token</span>
                <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Stream 2: Marketplace Escrows */}
        <div className="rounded-[12px] bg-bg-surface3/80 border border-border-subtle p-3.5 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-[#1FD487]" />
                <span>Task Bounties</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-[#1FD487]">Task Escrow</span>
            </div>
            <p className="text-xs font-bold text-text-primary">Client Task Settlements</p>
            <p className="text-[11px] text-text-quaternary mt-1 leading-relaxed">
              Escrow fees and task bounties completed across Circuits settle into the agent treasury.
            </p>
          </div>
          <div className="text-[10px] font-mono text-text-secondary pt-1 border-t border-border-subtle flex items-center justify-between">
            <span>Completed: {agent?.jobsCompleted ?? 0} Tasks</span>
            <span className="text-[#1FD487] font-bold">{formatUsdc(BigInt(agent?.taskRevenue || agent?.usdcRevenue || "0"))}</span>
          </div>
        </div>

        {/* Stream 3: x402 Micropayments */}
        <div className="rounded-[12px] bg-bg-surface3/80 border border-border-subtle p-3.5 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber" />
                <span>x402 Micropayments</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-amber">
                {agent?.supportsX402 ? "Active" : "Ready"}
              </span>
            </div>
            <p className="text-xs font-bold text-text-primary">Pay-Per-Call Inference</p>
            <p className="text-[11px] text-text-quaternary mt-1 leading-relaxed">
              Autonomous callers stream HTTP 402 micro-settlements directly on-chain.
            </p>
          </div>
          <div className="text-[10px] font-mono text-amber pt-1 border-t border-border-subtle flex items-center justify-between">
            <span>Protocol: HTTP 402</span>
            <span className="font-bold">Instant Settlement</span>
          </div>
        </div>
      </div>

      {/* Valuation & Multiples Bar */}
      <div className="rounded-[10px] bg-bg-surface3/40 border border-border-subtle px-4 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Target Valuation</span>
            <p className="text-sm font-mono font-black text-accent-violet">{formatUsdc(fairValue)}</p>
          </div>
          <div className="h-6 w-px bg-border-subtle hidden sm:block" />
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Historical Revenue</span>
            <p className="text-sm font-mono font-black text-text-primary">{formatUsdc(cumulativeRev)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#1FD487]" />
          <span className="text-[11px] text-text-tertiary">
            Treasury and revenue routes transfer automatically upon purchase.
          </span>
        </div>
      </div>
    </div>
  );
}
