"use client";

import { useState, useMemo } from "react";
import { parseUnits } from "viem";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Spinner } from "@/components/ui";
import { useLaunchpadActions, type LaunchpadListItem } from "@/hooks";
import { quoteBuy, applySlippage } from "@/lib/bondingCurve";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatCount } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import { checkOperationChain } from "@/lib/chainGuard";

const QUICK_AMOUNTS = ["5", "20", "50", "100", "250"];
const BONDING_CURVE_SLIPPAGE_BPS = 100n; // 1%

export function QuickBuyDialog({
  launch,
  open,
  onOpenChange,
  onSuccess,
}: {
  launch: LaunchpadListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { buyTokens } = useLaunchpadActions();
  const [usdcAmount, setUsdcAmount] = useState("20");
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const estimatedTokens = useMemo(() => {
    if (!launch || !usdcAmount || isNaN(Number(usdcAmount)) || Number(usdcAmount) <= 0) {
      return 0n;
    }
    try {
      const usdcIn = parseUnits(usdcAmount, 6);
      const curveLaunch = {
        tokensSold: BigInt(launch.tokensSold || "0"),
        usdcRaised: BigInt(launch.usdcRaised || "0"),
        // Default initial virtual reserve is 4000 USDC ($4k starting FDV)
        initialVirtualUsdcReserve: 4_000_000_000n,
      };
      return quoteBuy(curveLaunch, usdcIn);
    } catch {
      return 0n;
    }
  }, [launch, usdcAmount]);

  if (!launch) return null;

  async function handleBuy() {
    if (!launch || !usdcAmount || Number(usdcAmount) <= 0) return;
    if (!checkOperationChain(launch.chain, "buy this token")) return;
    setError(null);
    setBuying(true);
    try {
      const usdcIn = parseUnits(usdcAmount, 6);
      const minTokensOut = applySlippage(estimatedTokens, BONDING_CURVE_SLIPPAGE_BPS);
      await buyTokens(launch.launchChainId, usdcIn, minTokensOut);
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError(describeActionError(err, "Quick buy failed."));
    } finally {
      setBuying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={robotAvatarUrl(launch.token)}
              alt=""
              className="h-10 w-10 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
            />
            <div>
              <DialogTitle className="text-base flex items-center gap-1.5">
                <span>Quick Buy ${launch.symbol}</span>
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/25">
                  Instant
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-text-tertiary">
                Swap USDC directly on {launch.name}&apos;s bonding curve.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick preset amount buttons */}
          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1.5">
              Select Amount (USDC)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setUsdcAmount(amt)}
                  className={`py-1.5 rounded-[8px] text-xs font-bold border transition-all cursor-pointer ${
                    usdcAmount === amt
                      ? "bg-accent-violet text-white border-accent-violet shadow-xs"
                      : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div className="bg-bg-raised border border-border-strong rounded-[12px] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span>You Pay</span>
              <span>USDC</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-xl font-bold font-mono text-text-primary outline-none"
              />
              <span className="text-xs font-bold text-text-quaternary bg-bg-surface3 px-2 py-1 rounded-md">
                USDC
              </span>
            </div>
          </div>

          {/* Estimated Output */}
          <div className="bg-bg-surface3/60 border border-border-subtle rounded-[12px] p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-text-tertiary">You Receive (Est.)</span>
              <span className="text-sm font-bold font-mono text-emerald">
                ≈ {formatCount(estimatedTokens / 10n ** 18n)} ${launch.symbol}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-text-quaternary block">Max Slippage</span>
              <span className="text-[11px] font-mono text-text-tertiary font-semibold">1.0%</span>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red/10 border border-red/20 rounded-[8px] flex items-center gap-2 text-xs text-red">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-[#0c2a1d] border border-[#1FD487]/30 rounded-[8px] flex items-center gap-2 text-xs text-[#1FD487]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Purchase confirmed successfully!</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={buying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleBuy}
            disabled={buying || success || !usdcAmount || Number(usdcAmount) <= 0}
            className="gap-1.5"
          >
            {buying && <Spinner className="h-3.5 w-3.5" />}
            <ArrowRight className="h-3.5 w-3.5" />
            <span>{buying ? "Confirming..." : `Buy $${launch.symbol}`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
