"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  LineChart,
  Shield,
  ArrowRight,
  Plus,
  Coins,
  TrendingUp,
  ExternalLink,
  Bot,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc, truncateAddress } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import { useAgentTradingCollateral, type MyAgentSummary } from "@/hooks";
import { agentUrlId } from "@/lib/agentSlug";
import { Card, CardHeader, CardTitle, CardDescription, Skeleton, Button } from "@/components/ui";

interface DegenTradingMarginCommandProps {
  agents: MyAgentSummary[];
  loading: boolean;
  onTotalMarginUpdate?: (totalUsdc: number) => void;
}

function AgentTradingMarginRow({
  agent,
  onMarginChange,
}: {
  agent: MyAgentSummary;
  onMarginChange: (id: string, amount: string) => void;
}) {
  const { collateral, isLoading, depositing, withdrawing, depositCollateral, withdrawCollateral } =
    useAgentTradingCollateral(agent.id);

  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const marginBalance = collateral.marginBalanceUsdc || "0.00";
  const marginNumber = Number(marginBalance);

  useEffect(() => {
    onMarginChange(agent.id, marginBalance);
  }, [agent.id, marginBalance, onMarginChange]);

  async function handleAction() {
    if (!amount || Number(amount) <= 0) return;
    setActionError(null);
    setActionNotice(null);

    try {
      if (activeTab === "DEPOSIT") {
        const hash = await depositCollateral(amount.trim());
        setActionNotice(`Deposited ${amount} USDC into trading margin. Tx: ${hash.slice(0, 10)}…`);
      } else {
        const hash = await withdrawCollateral(amount.trim());
        setActionNotice(`Withdrew ${amount} USDC from trading margin. Tx: ${hash.slice(0, 10)}…`);
      }
      setAmount("");
    } catch (err) {
      setActionError(describeActionError(err, `${activeTab === "DEPOSIT" ? "Deposit" : "Withdrawal"} failed.`));
    }
  }

  const isBusy = depositing || withdrawing;

  return (
    <div className="py-3.5 border-b border-border-subtle last:border-none space-y-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-7 w-7 rounded-[7px] bg-accent-cyan/15 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shrink-0">
            <LineChart className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] text-text-primary font-bold truncate flex items-center gap-1.5">
              <span>{agent.name}</span>
              <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 font-bold">
                Isolated Margin
              </span>
            </div>
            <div className="font-mono text-[11px] text-text-quaternary truncate">
              ID: #{agent.numericId ?? agent.id} • Lifetime Volume: ${Number(collateral.lifetimeVolumeUsdc || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Live Margin Balance */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono">
            <div className="text-[13.5px] font-extrabold text-accent-cyan">
              {isLoading ? "···" : `$${marginNumber.toFixed(2)} USDC`}
            </div>
            <div className="text-[9.5px] text-text-quaternary font-sans">Trading Margin Collateral</div>
          </div>

          <Link
            href="/degen"
            className="text-[11px] font-bold text-accent-cyan hover:underline px-2.5 py-1 rounded-[7px] bg-accent-cyan/10 border border-accent-cyan/25 hover:bg-accent-cyan/20 transition-all flex items-center gap-1"
          >
            <span>Degen Hub</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Inline Quick Margin Action Form */}
      <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
        <div className="inline-flex rounded-[7px] bg-bg-surface border border-border-strong p-0.5 text-[10.5px] font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("DEPOSIT")}
            className={cn(
              "px-2 py-0.75 rounded-[5px] transition-all cursor-pointer",
              activeTab === "DEPOSIT" ? "bg-bg-raised text-text-primary shadow-xs" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("WITHDRAW")}
            className={cn(
              "px-2 py-0.75 rounded-[5px] transition-all cursor-pointer",
              activeTab === "WITHDRAW" ? "bg-bg-raised text-text-primary shadow-xs" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            Withdraw
          </button>
        </div>

        <input
          type="number"
          placeholder="Amount (Native USDC)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 min-w-32 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1 text-xs text-text-primary font-mono outline-none focus:border-accent-cyan/50"
        />

        <button
          type="button"
          disabled={isBusy || !amount || Number(amount) <= 0}
          onClick={handleAction}
          className="px-3 py-1 rounded-[8px] bg-accent-cyan text-black text-[11px] font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 shrink-0"
        >
          {isBusy ? "Processing…" : activeTab === "DEPOSIT" ? "+ Deposit Margin" : "Withdraw Margin"}
        </button>
      </div>

      {actionError && <p className="text-[11px] text-red-400 font-semibold">{actionError}</p>}
      {actionNotice && <p className="text-[11px] text-[#1FD487] font-semibold">{actionNotice}</p>}
    </div>
  );
}

export function DegenTradingMarginCommand({
  agents,
  loading,
  onTotalMarginUpdate,
}: DegenTradingMarginCommandProps) {
  const [margins, setMargins] = useState<Record<string, string>>({});

  const handleMarginChange = useCallback((id: string, amount: string) => {
    setMargins((prev) => {
      const next = { ...prev, [id]: amount };
      const total = Object.values(next).reduce((sum, v) => sum + Number(v || 0), 0);
      onTotalMarginUpdate?.(total);
      return next;
    });
  }, [onTotalMarginUpdate]);

  const totalMargin = Object.values(margins).reduce((sum, v) => sum + Number(v || 0), 0);

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-[15px] font-extrabold flex items-center gap-2">
              <LineChart className="h-4 w-4 text-accent-cyan" />
              <span>Degen Trading Margin Vaults</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Isolated USDC margin in AgentTradingVault contracts. Powers autonomous perpetuals, prediction markets, and automated agent trading.
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Trading Margin Reserves</div>
            <div className="font-mono text-[16px] font-black text-accent-cyan">${totalMargin.toFixed(2)} USDC</div>
          </div>
        </div>
      </CardHeader>
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : agents.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-tertiary bg-bg-surface rounded-[12px] border border-border-subtle space-y-2">
            <LineChart className="h-6 w-6 text-text-quaternary mx-auto" />
            <p>No agent trading margin accounts found. Deploy an agent to start automated trading.</p>
            <Link href="/register" className="text-xs font-bold text-accent-cyan hover:underline inline-block">
              Register an agent →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {agents.map((agent) => (
              <AgentTradingMarginRow
                key={agent.id}
                agent={agent}
                onMarginChange={handleMarginChange}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
