"use client";

import { useState } from "react";
import { Shield, ArrowDownLeft, ArrowUpRight, Copy, Check, ExternalLink, Coins, TrendingUp } from "lucide-react";
import { useAgentTradingCollateral, useWallet } from "@/hooks";
import { MONAD_MAINNET } from "@/lib/chains";
import { truncateAddress } from "@/lib/format";

export function AgentTradingCollateralCard({
  agentId,
  isOwner,
}: {
  agentId: string;
  isOwner: boolean;
}) {
  const { collateral, isLoading, depositing, withdrawing, depositCollateral, withdrawCollateral, error } = useAgentTradingCollateral(agentId);
  const { address } = useWallet();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeAction, setActiveAction] = useState<"DEPOSIT" | "WITHDRAW" | null>(null);
  const [copied, setCopied] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  async function handleCopy() {
    if (!collateral.vaultAddress) return;
    await navigator.clipboard.writeText(collateral.vaultAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeposit() {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setTxSuccess(null);
    try {
      const hash = await depositCollateral(depositAmount.trim());
      setTxSuccess(`Deposit successful! Tx: ${hash.slice(0, 10)}…`);
      setDepositAmount("");
      setActiveAction(null);
    } catch {
      // Error state handled by hook
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
    setTxSuccess(null);
    try {
      const hash = await withdrawCollateral(withdrawAmount.trim());
      setTxSuccess(`Withdrawal successful! Tx: ${hash.slice(0, 10)}…`);
      setWithdrawAmount("");
      setActiveAction(null);
    } catch {
      // Error state handled by hook
    }
  }

  const marginNum = Number(collateral.marginBalanceUsdc || 0);

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs space-y-4 p-5">
      {/* Header & Badges */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-accent-violet" />
            <span>On-Chain Agent Trading Margin Vault</span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            Deterministic on-chain margin contract. Eliminates off-chain wallet limits and keeps your Agent Operating Treasury 100% blast-radius protected.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#1FD487]/10 border border-[#1FD487]/25 text-[10.5px] font-mono text-[#1FD487] font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
          <span>On-Chain Vault</span>
        </div>
      </div>

      {/* Live Vault Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <Coins className="h-3 w-3 text-accent-violet" />
            <span>Trading Margin Balance</span>
          </div>
          <div className="text-[22px] font-black font-mono text-accent-violet">
            {isLoading ? "…" : `$${marginNum.toFixed(2)} USDC`}
          </div>
          <div className="text-[10px] text-text-quaternary font-mono">Available for execution</div>
        </div>

        <div className="p-4 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-[#FFB13D]" />
            <span>Realized Trading Volume</span>
          </div>
          <div className="text-[22px] font-black font-mono text-text-primary">
            {isLoading ? "…" : `$${Number(collateral.lifetimeVolumeUsdc || 0).toFixed(2)}`}
          </div>
          <div className="text-[10px] text-text-quaternary font-mono">Perps &amp; Predictions</div>
        </div>

        <div className="p-4 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-text-quaternary flex items-center gap-1">
            <Shield className="h-3 w-3 text-emerald" />
            <span>Vault Target Address</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="font-mono text-[11.5px] text-text-secondary font-bold">
              {truncateAddress(collateral.vaultAddress)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-text-quaternary hover:text-text-secondary transition-colors"
              title="Copy Contract Address"
            >
              {copied ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={`${MONAD_MAINNET.explorerUrl}/address/${collateral.vaultAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-text-quaternary hover:text-accent-violet transition-colors"
              title="View on Etherscan"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="text-[10px] text-text-quaternary font-mono">Verified Contract</div>
        </div>
      </div>

      {/* Owner Action Buttons */}
      {isOwner && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveAction((v) => (v === "DEPOSIT" ? null : "DEPOSIT"))}
              className="flex-1 py-2.5 rounded-[10px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>{activeAction === "DEPOSIT" ? "Cancel Deposit" : "Deposit Margin (USDC)"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAction((v) => (v === "WITHDRAW" ? null : "WITHDRAW"))}
              disabled={marginNum <= 0}
              className="flex-1 py-2.5 rounded-[10px] bg-bg-surface3 border border-border-strong text-text-primary text-xs font-bold hover:border-border-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>{activeAction === "WITHDRAW" ? "Cancel Withdraw" : "Withdraw Collateral"}</span>
            </button>
          </div>

          {/* Deposit Form */}
          {activeAction === "DEPOSIT" && (
            <div className="p-3.5 rounded-[12px] bg-bg-raised border border-border-strong space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                  Deposit Native USDC Collateral to Agent #{agentId}
                </label>
                <span className="text-[10px] text-text-quaternary font-mono">Native Gas · No ERC20 Approval Needed</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount USDC (e.g. 50.00)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 bg-bg-surface3 border border-border-subtle rounded-[8px] px-3.5 py-2 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                />
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
                  className="px-5 py-2 rounded-[8px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-xs"
                >
                  {depositing ? "Confirming…" : "Confirm Deposit"}
                </button>
              </div>
            </div>
          )}

          {/* Withdraw Form */}
          {activeAction === "WITHDRAW" && (
            <div className="p-3.5 rounded-[12px] bg-bg-raised border border-border-strong space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                  Withdraw Collateral &amp; Realized Profits
                </label>
                <span className="text-[10px] text-text-quaternary font-mono">Max: ${marginNum.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Max: ${marginNum.toFixed(2)}`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-bg-surface3 border border-border-subtle rounded-[8px] px-3.5 py-2 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(marginNum.toFixed(2))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent-violet hover:brightness-110 uppercase"
                  >
                    Max
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) <= 0}
                  className="px-5 py-2 rounded-[8px] bg-bg-surface3 border border-border-strong text-text-primary text-xs font-bold hover:border-border-hover disabled:opacity-50 transition-all"
                >
                  {withdrawing ? "Withdrawing…" : "Confirm Withdraw"}
                </button>
              </div>
            </div>
          )}

          {txSuccess && (
            <div className="p-2.5 rounded-[8px] bg-[#1FD487]/10 border border-[#1FD487]/25 text-[11px] text-[#1FD487] font-semibold flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{txSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/25 text-[11px] text-red-400 font-semibold">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
