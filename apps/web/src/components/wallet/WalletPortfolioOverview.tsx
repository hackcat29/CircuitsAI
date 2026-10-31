"use client";

import {
  Wallet,
  Coins,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Bot,
  Layers,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  HelpCircle,
  LineChart,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/format";

interface WalletPortfolioOverviewProps {
  walletAddress: string;
  walletBalanceUsdc: number;
  agentTreasuryUsdc: number;
  degenMarginUsdc?: number;
  // Backward compatibility alias
  fleetTreasuryUsdc?: number;
  contributorScore: number;
  chainName: string;
  onOpenDepositQr: () => void;
  onOpenBridge?: () => void;
}

export function WalletPortfolioOverview({
  walletAddress,
  walletBalanceUsdc,
  agentTreasuryUsdc: agentTreasuryUsdcProp,
  degenMarginUsdc = 0,
  fleetTreasuryUsdc = 0,
  contributorScore,
  chainName,
  onOpenDepositQr,
  onOpenBridge,
}: WalletPortfolioOverviewProps) {
  const [copied, setCopied] = useState(false);
  const [showArchitectureExplainer, setShowArchitectureExplainer] = useState(false);

  const agentTreasuryUsdc = agentTreasuryUsdcProp !== undefined ? agentTreasuryUsdcProp : fleetTreasuryUsdc;
  const totalNetWorth = walletBalanceUsdc + agentTreasuryUsdc + degenMarginUsdc;

  function handleCopy() {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 space-y-5 shadow-xs"
    >
      {/* Top row: Net worth headline & address chip */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary mb-1 flex items-center gap-1.5 font-mono">
            <Wallet className="h-3.5 w-3.5 text-accent-violet" />
            <span>Total Protocol Net Worth</span>
          </div>
          <div className="font-mono text-[32px] sm:text-[34px] font-black text-text-primary tracking-tight">
            ${totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-[16px] font-bold text-accent-violet">USDC</span>
          </div>
          <p className="text-[12px] text-text-tertiary mt-0.5">
            Aggregated assets across your personal primary wallet, agent operating treasuries, and trading margin vaults.
          </p>
        </div>

        {/* Address & Actions */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-bg-surface border border-border-strong text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-text-secondary">{truncateAddress(walletAddress)}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
              title="Copy Address"
            >
              {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDepositQr}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-bg-surface hover:bg-bg-surface3 border border-border-strong text-xs font-bold text-text-primary transition-all cursor-pointer shadow-2xs"
            >
              <QrCode className="h-3.5 w-3.5 text-accent-violet" />
              <span>Receive &amp; QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Capital Architecture Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* Card 1: Human Primary Wallet */}
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-text-quaternary">
            <span className="font-sans font-bold uppercase text-[10px] flex items-center gap-1">
              <Coins className="h-3 w-3 text-accent-violet" />
              <span>1. Primary Wallet</span>
            </span>
            <span className="text-[10px] text-text-quaternary font-mono">{chainName}</span>
          </div>
          <div className="font-extrabold text-[17px] text-text-primary">
            ${walletBalanceUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-[10.5px] text-text-quaternary font-sans leading-tight">
            Personal funds for manual gas, funding agents, and trading.
          </div>
        </div>

        {/* Card 2: Agent Operating Treasuries */}
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-text-quaternary">
            <span className="font-sans font-bold uppercase text-[10px] flex items-center gap-1">
              <Bot className="h-3 w-3 text-emerald" />
              <span>2. Agent Treasuries</span>
            </span>
            <span className="text-[10px] text-emerald font-bold font-mono">Autonomous</span>
          </div>
          <div className="font-extrabold text-[17px] text-emerald">
            ${agentTreasuryUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-[10.5px] text-text-quaternary font-sans leading-tight">
            Smart custody treasury for execution, gas, and periodic token buybacks.
          </div>
        </div>

        {/* Card 3: Degen Trading Margin */}
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-text-quaternary">
            <span className="font-sans font-bold uppercase text-[10px] flex items-center gap-1">
              <LineChart className="h-3 w-3 text-accent-cyan" />
              <span>3. Trading Margin</span>
            </span>
            <span className="text-[10px] text-accent-cyan font-bold font-mono">Isolated</span>
          </div>
          <div className="font-extrabold text-[17px] text-accent-cyan">
            ${degenMarginUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </div>
          <div className="text-[10.5px] text-text-quaternary font-sans leading-tight">
            Isolated on-chain margin in Trading Vault for perps, predictions, and launchpad.
          </div>
        </div>

        {/* Card 4: Contributor Score */}
        <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-subtle space-y-1.5">
          <div className="flex items-center justify-between text-text-quaternary">
            <span className="font-sans font-bold uppercase text-[10px] flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-400" />
              <span>4. Contributor Score</span>
            </span>
            <span className="text-[10px] text-amber-400 font-bold font-mono">Reputation</span>
          </div>
          <div className="font-extrabold text-[17px] text-text-primary">
            {contributorScore.toLocaleString()} <span className="text-xs font-normal text-text-quaternary">pts</span>
          </div>
          <div className="text-[10.5px] text-text-quaternary font-sans leading-tight">
            Ecosystem activity score tracking on-chain builder standing.
          </div>
        </div>
      </div>

      {/* Capital Segregation & Architecture Notice */}
      <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[11.5px] text-text-quaternary flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-violet" />
          <span>
            <strong>On-Chain Capital Isolation:</strong> Human personal funds, agent operating treasuries, and Degen trading margin are 100% segregated.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowArchitectureExplainer((v) => !v)}
          className="text-accent-violet font-semibold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle className="h-3 w-3" />
          <span>{showArchitectureExplainer ? "Hide Architecture Guide" : "Explain Capital Architecture"}</span>
        </button>
      </div>

      {/* Explainer Accordion */}
      {showArchitectureExplainer && (
        <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle text-xs space-y-2.5 font-sans animate-in fade-in duration-200">
          <div className="font-bold text-text-primary text-[13px] flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-accent-violet" />
            <span>Understanding Circuits Protocol Balance Domains</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11.5px] text-text-secondary leading-relaxed">
            <div className="p-2.5 rounded-lg bg-bg-elevated border border-border-subtle/70 space-y-1">
              <div className="font-bold text-text-primary flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-accent-violet" />
                <span>Human Primary Wallet</span>
              </div>
              <p>
                Your personal Web3 / Social Circle wallet. Holds funds for manual transfers, gas fees, buying tokens on the Launchpad, and funding agent treasuries. Fully withdrawable at any time.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-bg-elevated border border-border-subtle/70 space-y-1">
              <div className="font-bold text-emerald flex items-center gap-1">
                <Bot className="h-3.5 w-3.5 text-emerald" />
                <span>Agent Operating Treasury &amp; Buybacks</span>
              </div>
              <p>
                Smart custody wallets provisioned per-agent. Accumulates job payouts and launchpad creator fees. Used autonomously by the Circuits AI Runtime for gas, tool invocation fees, x402 payments, and scheduled token buybacks.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-bg-elevated border border-border-subtle/70 space-y-1">
              <div className="font-bold text-accent-cyan flex items-center gap-1">
                <LineChart className="h-3.5 w-3.5 text-accent-cyan" />
                <span>Degen Trading Margin</span>
              </div>
              <p>
                Isolated margin deposited into the on-chain <code>AgentTradingVault</code> contract for perpetuals and prediction markets. Segregated from operating treasuries so trading drawdowns never halt agent operations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
