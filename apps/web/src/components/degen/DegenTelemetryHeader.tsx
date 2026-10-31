"use client";

import { useMemo } from "react";
import {
  Flame,
  TrendingUp,
  ShieldAlert,
  Bot,
  Activity,
} from "lucide-react";
import { useMyAgents, useWallet, useTotalProtocolVolume } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { cn } from "@/lib/cn";

export function DegenTelemetryHeader({
  title,
  subtitle,
  icon,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents, loading: agentsLoading } = useMyAgents();
  const { totalUsdc, loading: volumeLoading } = useTotalProtocolVolume();

  const formattedVolume = useMemo(() => {
    if (volumeLoading) return "…";
    const val = Number(totalUsdc) / 1e6;
    if (val === 0) return "$0.00";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [totalUsdc, volumeLoading]);

  const agentCount = myAgents.length;

  return (
    <div
      className="rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs"
    >
      <div className="flex justify-between items-start gap-6 flex-wrap relative z-10">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight mb-2 flex items-center gap-2.5 text-text-primary">
            {icon ?? <Flame className="h-6 w-6 text-accent-violet" />}
            <span>{title ?? "Circuits Degen Arena"}</span>
          </h1>
          <p className="text-[13px] text-text-tertiary leading-[1.6] max-w-160">
            {subtitle ??
              "High-velocity autonomous trading suite. Equip agents with 50x Perpetual leverage, Prediction market arbitrage, Memecoin launch sniping, Sportsbook Kelly staking, and Provably Fair casino algorithms."}
          </p>

          {/* Telemetry Strip */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
            <div>
              <div className="text-[20px] font-extrabold font-mono text-accent-violet">Sub-Second</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Native USDC Settlement</div>
            </div>
            <div>
              <div className="text-[20px] font-extrabold font-mono text-amber">
                {agentsLoading ? "…" : `${agentCount} Agent${agentCount === 1 ? "" : "s"}`}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Active Fleet Size</div>
            </div>
            <div>
              <div className="text-[20px] font-extrabold font-mono text-cyan flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                <span>CircuitsAI Runtime</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Model Tier Credit Billing</div>
            </div>
            <div>
              <div className="text-[20px] font-extrabold font-mono text-[#1FD487] flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1FD487] animate-pulse" />
                <span>LIVE {chain?.chainName || "Monad"}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Chain {chain?.chainId || 5042}</div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-[#0c2a1d] border border-[#1FD487]/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1FD487] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#1FD487] animate-ping" />
            <span>LIVE Execution Active</span>
          </div>
          <span className="text-[10.5px] text-text-quaternary font-mono">Owner Degen Allocation (Isolated from Treasury)</span>
        </div>
      </div>
    </div>
  );
}
