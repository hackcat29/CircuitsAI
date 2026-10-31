"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useDegenWallet, type DegenVenue } from "@/hooks";
import type { IndexerChainSlug } from "@/lib/chains";
import { MONAD_MAINNET } from "@/lib/chains";
import { truncateAddress } from "@/lib/format";

/** One row per venue in the LIVE-mode wallets card — isolated trading wallet.
 * Ensures degen trading capital is 100% segregated from the Agent Operating Treasury. */
export function DegenWalletRow({
  chain,
  agentChainId,
  venue,
  label,
}: {
  chain: IndexerChainSlug;
  agentChainId: string;
  venue: DegenVenue;
  label: string;
}) {
  const { wallet, balanceUsdc, isBalanceLoading, provision, withdraw, depositFromConnectedWallet, depositing } = useDegenWallet(chain, agentChainId, venue);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeposit() {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setError(null);
    setResult(null);
    try {
      await depositFromConnectedWallet(depositAmount.trim());
      setResult(`Deposited $${depositAmount} USDC`);
      setDepositAmount("");
      setShowDeposit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    }
  }

  async function handleWithdraw() {
    setError(null);
    setResult(null);
    try {
      const res = await withdraw.mutateAsync();
      setResult(Number(res.amount) === 0 ? "Nothing to withdraw" : `Swept ${res.amount} ${res.asset} to owner`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    }
  }

  return (
    <div className="px-5 py-4 border-b border-border-subtle last:border-none space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-text-primary">{label}</span>
            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-bg-surface3 text-text-tertiary border border-border-subtle">
              Isolated Vault
            </span>
          </div>

          {wallet ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[11px] text-text-tertiary">
                {truncateAddress(wallet.address)}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-text-quaternary hover:text-text-secondary transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={`${MONAD_MAINNET.explorerUrl}/address/${wallet.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-text-quaternary hover:text-accent-violet transition-colors"
                title="View on Etherscan"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="text-[11px] text-text-quaternary mt-1">No trading wallet generated yet</div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {wallet && (
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Trading Balance</div>
              <div className="font-mono text-[14px] font-black text-accent-violet">
                {isBalanceLoading ? "…" : `$${Number(balanceUsdc).toFixed(2)} USDC`}
              </div>
            </div>
          )}

          {!wallet ? (
            <button
              onClick={() => provision.mutate()}
              disabled={provision.isPending}
              className="text-[11px] font-bold px-3 py-1.5 rounded-[8px] bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-all disabled:opacity-50"
            >
              {provision.isPending ? "Generating…" : "Generate Wallet"}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowDeposit((v) => !v)}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-[8px] bg-accent-violet text-white hover:brightness-110 transition-all flex items-center gap-1"
              >
                <ArrowDownLeft className="h-3 w-3" />
                <span>{showDeposit ? "Cancel" : "Deposit"}</span>
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdraw.isPending || Number(balanceUsdc) <= 0}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-[8px] bg-bg-raised text-text-secondary border border-border-strong hover:border-border-hover transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <ArrowUpRight className="h-3 w-3" />
                <span>{withdraw.isPending ? "…" : "Withdraw"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showDeposit && wallet && (
        <div className="p-3 rounded-[10px] bg-bg-raised border border-border-strong flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Amount USDC to deposit…"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="flex-1 bg-bg-surface3 border border-border-subtle rounded-[6px] px-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
          />
          <button
            type="button"
            onClick={handleDeposit}
            disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
            className="px-4 py-1.5 rounded-[6px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {depositing ? "Transferring…" : "Confirm Deposit"}
          </button>
        </div>
      )}

      {result && <div className="text-[11px] text-[#1FD487] font-semibold">{result}</div>}
      {error && <div className="text-[11px] text-red-400 font-semibold">{error}</div>}
    </div>
  );
}
