"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Coins,
  ArrowRight,
  Plus,
  PieChart,
  Bot,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from "@/components/ui";
import { useWallet, useMyAgents, useAgentWallet } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { formatUsdc, truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

function AgentTreasuryItem({
  chainSlug,
  agent,
  onBalanceUpdate,
}: {
  chainSlug: string;
  agent: { id: string; name: string; usdcRevenue?: string; jobsCompleted?: number };
  onBalanceUpdate: (id: string, amount: bigint) => void;
}) {
  const { address, claimableUsdc } = useAgentWallet(
    chainSlug as Parameters<typeof useAgentWallet>[0],
    agent.id,
  );
  const rev = BigInt(agent.usdcRevenue || "0");
  const treasuryBalance = claimableUsdc !== null ? BigInt(claimableUsdc) : null;

  useEffect(() => {
    if (claimableUsdc !== null) {
      onBalanceUpdate(agent.id, BigInt(claimableUsdc));
    }
  }, [agent.id, claimableUsdc, onBalanceUpdate]);

  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs border-b border-border-subtle/40 last:border-none">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-surface3 text-text-tertiary shrink-0 border border-border-subtle">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-text-primary text-[12.5px] truncate">
            {agent.name}
          </div>
          <div className="text-[10.5px] text-text-quaternary font-mono flex items-center gap-1.5 mt-0.5">
            <span>{agent.jobsCompleted || 0} tasks completed</span>
            <span>•</span>
            <span>{address ? truncateAddress(address) : `Agent #${agent.id}`}</span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-mono font-bold text-emerald text-[12.5px]">
          {treasuryBalance !== null ? `${formatUsdc(treasuryBalance)} USDC` : "···"}
        </div>
        <div className="text-[10px] text-text-quaternary font-sans">
          Operating Treasury
        </div>
      </div>
    </div>
  );
}

const TREASURIES_PER_PAGE = 2;

export function DashboardPortfolioCard() {
  const { isConnected, chain } = useWallet();
  const { agents, loading } = useMyAgents();
  const [treasuryPage, setTreasuryPage] = useState(1);
  const chainSlug = toIndexerChainSlug(chain);

  const [balances, setBalances] = useState<Record<string, bigint>>({});

  const handleBalanceUpdate = useCallback((id: string, amount: bigint) => {
    setBalances((prev) => {
      if (prev[id] === amount) return prev;
      return { ...prev, [id]: amount };
    });
  }, []);

  const totalOperatingTreasuryMicros = useMemo(() => {
    return Object.values(balances).reduce((acc, b) => acc + b, 0n);
  }, [balances]);

  const totalRevenueMicros = useMemo(() => {
    return agents.reduce((acc, a) => acc + BigInt(a.usdcRevenue || "0"), 0n);
  }, [agents]);

  const totalTreasuryPages = Math.max(1, Math.ceil(agents.length / TREASURIES_PER_PAGE));
  const paginatedAgents = useMemo(() => {
    const start = (treasuryPage - 1) * TREASURIES_PER_PAGE;
    return agents.slice(start, start + TREASURIES_PER_PAGE);
  }, [agents, treasuryPage]);

  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent-cyan/15 text-accent-cyan">
              <PieChart className="h-3 w-3" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary tracking-tight">
              Agent Treasuries &amp; Earnings
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && totalTreasuryPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={treasuryPage === 1}
                  onClick={() => setTreasuryPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  ←
                </button>
                <span className="text-[10.5px] font-mono text-text-quaternary px-1">
                  {treasuryPage}/{totalTreasuryPages}
                </span>
                <button
                  type="button"
                  disabled={treasuryPage === totalTreasuryPages}
                  onClick={() => setTreasuryPage((p) => Math.min(totalTreasuryPages, p + 1))}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  →
                </button>
              </div>
            )}
            <Link
              href="/wallet"
              className="text-[11.5px] font-bold text-accent-violet hover:underline flex items-center gap-1"
            >
              <span>Wallet Command</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4">
        {!isConnected ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center text-xs text-text-tertiary my-auto">
            Sign in to inspect operating balances and treasury assets.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Financial Overview Widget */}
            <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle flex flex-col gap-3 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-quaternary block">
                    Total Operating Capital
                  </span>
                  <div className="text-[22px] font-black font-mono tracking-tight text-text-primary mt-0.5">
                    {formatUsdc(totalOperatingTreasuryMicros)}{" "}
                    <span className="text-[12px] font-bold text-accent-violet">USDC</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href="/wallet"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Deposit</span>
                  </Link>
                  <Link
                    href="/wallet"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-text-secondary bg-bg-raised hover:bg-bg-surface3 border border-border-strong transition-colors cursor-pointer"
                  >
                    <span>Manage</span>
                  </Link>
                </div>
              </div>

              {/* 4-Item Financial Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-border-subtle/60 text-xs">
                <div>
                  <div className="text-[10px] font-semibold text-text-quaternary uppercase tracking-wider">Available</div>
                  <div className="font-mono text-[13px] font-bold text-emerald mt-0.5">{formatUsdc(totalOperatingTreasuryMicros)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-text-quaternary uppercase tracking-wider">Escrowed</div>
                  <div className="font-mono text-[13px] font-bold text-text-secondary mt-0.5">$0.00</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-text-quaternary uppercase tracking-wider">Trading</div>
                  <div className="font-mono text-[13px] font-bold text-text-secondary mt-0.5">$0.00</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-text-quaternary uppercase tracking-wider">Earnings</div>
                  <div className="font-mono text-[13px] font-bold text-accent-violet mt-0.5">{formatUsdc(totalRevenueMicros)}</div>
                </div>
              </div>
            </div>

            {/* Agent Operating Treasuries Breakdown */}
            {loading ? (
              <div className="text-center py-4 text-xs text-text-quaternary animate-pulse">
                Loading treasuries…
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-4 text-xs text-text-quaternary">
                No active agent treasuries found.
              </div>
            ) : (
              <div className="flex flex-col">
                {paginatedAgents.map((agent) => (
                  <AgentTreasuryItem
                    key={agent.id}
                    chainSlug={chainSlug}
                    agent={agent}
                    onBalanceUpdate={handleBalanceUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
