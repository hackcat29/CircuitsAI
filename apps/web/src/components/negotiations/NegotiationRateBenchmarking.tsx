"use client";

import { TrendingUp, ShieldCheck, Coins, Cpu, Globe, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RateBenchmark {
  domain: string;
  icon: typeof TrendingUp;
  rangeUsdc: string;
  medianUsdc: string;
  avgSlaDays: string;
  color: string;
}

export const RATE_BENCHMARKS: RateBenchmark[] = [
  {
    domain: "DeFi & Trading Bots",
    icon: TrendingUp,
    rangeUsdc: "$25 - $75",
    medianUsdc: "45",
    avgSlaDays: "3",
    color: "#FF5C28",
  },
  {
    domain: "Smart Contract Audits",
    icon: ShieldCheck,
    rangeUsdc: "$50 - $150",
    medianUsdc: "75",
    avgSlaDays: "4",
    color: "#1FD487",
  },
  {
    domain: "Social Alpha & Threads",
    icon: Coins,
    rangeUsdc: "$10 - $30",
    medianUsdc: "15",
    avgSlaDays: "1",
    color: "#A78BFA",
  },
  {
    domain: "Data Feeds & Oracle Scrapers",
    icon: Cpu,
    rangeUsdc: "$15 - $45",
    medianUsdc: "25",
    avgSlaDays: "2",
    color: "#3B82F6",
  },
];

interface NegotiationRateBenchmarkingProps {
  onApplyBenchmark?: (budgetUsdc: string, deadlineDays: string) => void;
}

export function NegotiationRateBenchmarking({
  onApplyBenchmark,
}: NegotiationRateBenchmarkingProps) {
  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent-violet" />
          <h3 className="text-[13.5px] font-extrabold text-text-primary">Market Rate Benchmarking Guide</h3>
        </div>
        <span className="text-[10px] font-mono text-text-quaternary">Live Market Averages</span>
      </div>

      <p className="text-[11.5px] text-text-tertiary leading-relaxed">
        Real-time pricing guide based on historical escrow settlement rates to help clients and agents converge on mutually fair terms.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {RATE_BENCHMARKS.map((b) => {
          const Icon = b.icon;

          return (
            <div
              key={b.domain}
              className="p-3 rounded-[12px] bg-bg-surface border border-border-subtle hover:border-border-strong transition-all flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-primary">
                  <Icon className="h-3.5 w-3.5" style={{ color: b.color }} />
                  <span className="truncate">{b.domain}</span>
                </div>
                <div className="font-mono text-[13px] font-extrabold text-text-primary">{b.rangeUsdc} <span className="text-[10px] font-normal text-text-quaternary">USDC</span></div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[10px] font-mono">
                <span className="text-text-quaternary">SLA: ~{b.avgSlaDays} Days</span>
                {onApplyBenchmark && (
                  <button
                    type="button"
                    onClick={() => onApplyBenchmark(b.medianUsdc, b.avgSlaDays)}
                    className="text-accent-violet hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Use ${b.medianUsdc}</span>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
