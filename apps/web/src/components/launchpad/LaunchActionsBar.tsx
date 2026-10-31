"use client";

import { useEffect, useState } from "react";
import { Unlock, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useLaunchpadActions, useWallet, type LaunchDetail } from "@/hooks";
import { formatUsdc } from "@/lib/format";
import { toIndexerChainSlug } from "@/lib/chains";
import { describeActionError } from "@/lib/errors";
import { checkOperationChain } from "@/lib/chainGuard";
import { LaunchCountdown } from "./LaunchCountdown";

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  if (diff <= 0) return "Ready to Execute";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function LaunchActionsBar({ launch, onChanged }: { launch: LaunchDetail; onChanged: () => void }) {
  const { address } = useWallet();
  const { graduateLaunch, startTradingNow, busy } = useLaunchpadActions();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isCreator = sameAddress(address, launch.creator);
  const usdcRaised = BigInt(launch.usdcRaised);
  const graduationThreshold = BigInt(launch.graduationThreshold);
  const progressPct = graduationThreshold > 0n ? Math.min(100, Number((usdcRaised * 10000n) / graduationThreshold) / 100) : 0;
  const remainingUsdc = graduationThreshold > usdcRaised ? graduationThreshold - usdcRaised : 0n;
  const canGraduate = !launch.graduated && usdcRaised >= graduationThreshold;
  const nextBuybackTime = new Date(launch.nextBuybackAt).getTime();
  const buybackDue = now >= nextBuybackTime;

  async function handle(action: () => Promise<void>, actionDesc = "perform this action") {
    if (!checkOperationChain(launch.chain, actionDesc)) return;
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(describeActionError(err, "Transaction failed."));
    }
  }

  if (launch.graduated) return null;

  return (
    <div className="rounded-[14px] border border-border-subtle bg-bg-elevated/75 backdrop-blur-sm p-4 space-y-4 shadow-xs">
      {/* Header & Progress Stats */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
            Bonding Curve Progress
          </div>
          <div className="text-[15px] font-extrabold text-text-primary mt-0.5 flex items-center gap-2">
            <span>{formatUsdc(usdcRaised)}</span>
            <span className="text-text-quaternary font-mono text-xs font-normal">/ {formatUsdc(graduationThreshold)} Target</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono font-extrabold px-2 py-0.75 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30">
            {progressPct.toFixed(1)}% to DEX
          </span>
          <div className="text-[10px] text-text-quaternary font-mono mt-1">
            {remainingUsdc > 0n ? `${formatUsdc(remainingUsdc)} needed` : "Threshold reached!"}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="h-2.5 w-full bg-bg-surface3 rounded-full overflow-hidden p-0.5 border border-border-subtle/60">
          <div
            className="h-full rounded-full bg-[#1FD487] transition-all duration-300"
            style={{ width: `${Math.max(2, progressPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-[9.5px] font-mono text-text-quaternary">
          <span>0% (Launch)</span>
          <span>100% (DEX Liquidity Lock)</span>
        </div>
      </div>

      {error && <p className="text-xs text-red p-2 bg-red/10 border border-red/20 rounded-[8px]">{error}</p>}

      {/* Automated Buyback Status & Actions */}
      <div className="pt-2 border-t border-border-subtle/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Clock className="h-3.5 w-3.5 text-accent-violet" />
            <span>Next Auto Buyback:</span>
            <span className="font-mono font-bold text-text-primary">
              {formatCountdown(nextBuybackTime, now)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canGraduate && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => handle(() => graduateLaunch(launch.launchChainId), "graduate this launch")}
              className="bg-[#1FD487] hover:bg-[#1FD487]/90 text-black text-xs font-bold gap-1 cursor-pointer"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              <span>Graduate to DEX</span>
            </Button>
          )}

          {isCreator && (
            <ScheduleCancel
              launch={launch}
              onChanged={onChanged}
              onStartTradingNow={() => handle(() => startTradingNow(launch.launchChainId), "start trading")}
              now={now}
            />
          )}
        </div>
      </div>

      <p className="text-[10.5px] text-text-quaternary flex items-center gap-1.5 pt-0.5">
        <Unlock className="h-3 w-3 text-accent-violet shrink-0" />
        <span>Automated Buybacks: {((launch.buybackBps ?? 2000) / 100).toFixed(0)}% of agent treasury funds are used to repurchase and burn tokens every {launch.buybackInterval.toLowerCase()}.</span>
      </p>
    </div>
  );
}

function ScheduleCancel({
  launch,
  onChanged,
  onStartTradingNow,
  now,
}: {
  launch: LaunchDetail;
  onChanged: () => void;
  onStartTradingNow: () => Promise<void>;
  now: number;
}) {
  const { chain, address } = useWallet();
  const [busy, setBusy] = useState(false);

  if (new Date(launch.tradingStartsAt).getTime() < now) return null;

  async function handleStartNow() {
    if (!address) return;
    setBusy(true);
    try {
      await onStartTradingNow();
      await fetch("/api/exchange/scheduled-launches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: toIndexerChainSlug(chain), launchChainId: launch.launchChainId, creator: address }),
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <LaunchCountdown scheduledAt={launch.tradingStartsAt} className="text-xs font-medium text-amber" />
      <Button size="sm" variant="ghost" disabled={busy} onClick={handleStartNow} className="text-xs">
        Launch now instead
      </Button>
    </div>
  );
}

