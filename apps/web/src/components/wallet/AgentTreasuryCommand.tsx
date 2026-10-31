"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  AlertTriangle,
  ArrowRight,
  Plus,
  Coins,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Fuel,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatUsdc, truncateAddress } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import { useAgentWallet, type MyAgentSummary } from "@/hooks";
import { agentUrlId } from "@/lib/agentSlug";
import { Card, CardHeader, CardTitle, CardDescription, Skeleton } from "@/components/ui";

interface AgentTreasuryCommandProps {
  chainSlug: string;
  agents: MyAgentSummary[];
  loading: boolean;
  onTotalBalanceUpdate?: (totalUsdc: number) => void;
}

function AgentTreasuryRow({
  chainSlug,
  agent,
  onBalanceChange,
}: {
  chainSlug: string;
  agent: MyAgentSummary;
  onBalanceChange: (id: string, amount: string | null) => void;
}) {
  const { address, claimableUsdc, depositFromConnectedWallet } = useAgentWallet(
    chainSlug as Parameters<typeof useAgentWallet>[0],
    agent.id,
  );

  useEffect(() => {
    onBalanceChange(agent.id, claimableUsdc);
  }, [agent.id, claimableUsdc, onBalanceChange]);

  const [fundAmount, setFundAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const balanceNumber = claimableUsdc !== null ? Number(claimableUsdc) / 1_000_000 : 0;
  const isLowBalance = claimableUsdc !== null && balanceNumber < 1.0;

  async function handleFund() {
    if (!fundAmount || Number(fundAmount) <= 0) return;
    setActionError(null);
    setActionNotice(null);
    setIsFunding(true);
    try {
      await depositFromConnectedWallet(fundAmount);
      setActionNotice(`Deposited ${fundAmount} USDC into agent operating treasury.`);
      setFundAmount("");
    } catch (err) {
      setActionError(describeActionError(err, "Funding failed."));
    } finally {
      setIsFunding(false);
    }
  }

  return (
    <div className="py-3.5 border-b border-border-subtle last:border-none space-y-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", agent.active ? "bg-emerald" : "bg-text-quaternary")} />
          <div className="min-w-0">
            <div className="text-[13.5px] text-text-primary font-bold truncate flex items-center gap-1.5">
              <span>{agent.name}</span>
              {isLowBalance && (
                <span className="text-[9.5px] font-mono px-1.5 py-0.25 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Low Balance
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-text-quaternary truncate">
              {address ? truncateAddress(address) : `Agent #${agent.id}`}
            </div>
          </div>
        </div>

        {/* Operating Treasury Balance */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono">
            <div className="text-[13.5px] font-extrabold text-emerald">
              {claimableUsdc !== null ? `${formatUsdc(BigInt(claimableUsdc))} USDC` : "···"}
            </div>
            <div className="text-[9.5px] text-text-quaternary font-sans">Autonomous Operating Treasury &amp; Buybacks</div>
          </div>

          <Link
            href={`/agents/${agentUrlId(agent.name, agent.id)}`}
            className="text-[11px] font-bold text-accent-violet hover:underline px-2.5 py-1 rounded-[7px] bg-accent-dark border border-accent-violet/25 hover:bg-accent-violet/20 transition-all flex items-center gap-1"
          >
            <span>Manage</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Inline Quick Fund Form */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="number"
          placeholder="Deposit operating treasury (USDC)"
          value={fundAmount}
          onChange={(e) => setFundAmount(e.target.value)}
          className="flex-1 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1 text-xs text-text-primary font-mono outline-none focus:border-accent-violet/50"
        />
        <button
          type="button"
          disabled={isFunding || !fundAmount || Number(fundAmount) <= 0}
          onClick={handleFund}
          className="px-3 py-1 rounded-[8px] bg-accent-violet text-white text-[11px] font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 shrink-0 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          <span>{isFunding ? "Depositing…" : "+ Deposit Treasury"}</span>
        </button>
      </div>

      {actionError && <p className="text-[11px] text-red-400 font-semibold">{actionError}</p>}
      {actionNotice && <p className="text-[11px] text-emerald font-semibold">{actionNotice}</p>}
    </div>
  );
}

export function AgentTreasuryCommand({
  chainSlug,
  agents,
  loading,
  onTotalBalanceUpdate,
}: AgentTreasuryCommandProps) {
  const [balances, setBalances] = useState<Record<string, string | null>>({});

  const handleBalanceChange = useCallback((id: string, amount: string | null) => {
    setBalances((prev) => {
      const next = { ...prev, [id]: amount };
      const rawTotal = Object.values(next).reduce((sum, v) => sum + (v ? Number(v) : 0), 0);
      onTotalBalanceUpdate?.(rawTotal / 1_000_000);
      return next;
    });
  }, [onTotalBalanceUpdate]);

  const totalRaw = Object.values(balances).reduce((sum, v) => sum + (v ? Number(v) : 0), 0);
  const totalUsdc = totalRaw / 1_000_000;

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-[15px] font-extrabold flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent-violet" />
              <span>Agent Operating Treasuries</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {loading ? "Loading agents…" : `${agents.length} agent${agents.length === 1 ? "" : "s"} deployed on this network`}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Total Operating Treasuries</div>
            <div className="font-mono text-[16px] font-black text-emerald">${totalUsdc.toFixed(2)} USDC</div>
          </div>
        </div>
      </CardHeader>
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : agents.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-tertiary bg-bg-surface rounded-[12px] border border-border-subtle space-y-2">
            <Bot className="h-6 w-6 text-text-quaternary mx-auto" />
            <p>No agents registered on this network yet.</p>
            <Link href="/register" className="text-xs font-bold text-accent-violet hover:underline inline-block">
              Register an agent →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {agents.map((agent) => (
              <AgentTreasuryRow
                key={agent.id}
                chainSlug={chainSlug}
                agent={agent}
                onBalanceChange={handleBalanceChange}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Export alias for backward compatibility
export const FleetTreasuryCommand = AgentTreasuryCommand;
