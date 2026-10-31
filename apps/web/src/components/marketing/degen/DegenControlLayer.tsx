"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Sliders,
  Play,
  Pause,
  AlertTriangle,
  Lock,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { appUrl } from "@/lib/appUrl";

export interface DegenControlLayerProps {
  venueType?: "perpetuals" | "predictions" | "memecoins" | "sportsbook" | "casino" | "hub";
}

export function DegenControlLayer({ venueType = "hub" }: DegenControlLayerProps) {
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [leverage, setLeverage] = useState<number>(10);
  const [maxPosition, setMaxPosition] = useState<number>(500);
  const [dailyDrawdown, setDailyDrawdown] = useState<number>(100);
  const [panicTriggered, setPanicTriggered] = useState<boolean>(false);

  const isWageringVenue = venueType === "sportsbook" || venueType === "casino";

  return (
    <section className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-10 shadow-2xl relative overflow-hidden">
      {/* Background Ambient */}
      <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />

      <div className="relative z-10 max-w-280 mx-auto">
        {/* Header */}
        <div className="text-center max-w-180 mx-auto mb-8">
          <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
            Cross-Market Control Layer
          </div>
          <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
            Your Agent. Your Capital Rules.
          </h2>
          <p className="text-[14px] md:text-[15px] text-text-secondary leading-[1.65]">
            Circuits is autonomous capital deployment with cryptographic guardrails. Configure hard risk limits, test in zero-risk Paper Mode, and enforce instant kill switches.
          </p>
        </div>

        {/* Interactive Control Panel Mockup */}
        <div className="bg-bg-raised border border-border-subtle rounded-2xl p-5 md:p-7 shadow-xl font-mono text-[12px] space-y-6">
          {/* Top Mode Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
            <div>
              <div className="text-[11px] text-text-quaternary uppercase font-bold">EXECUTION ENVIRONMENT</div>
              <div className="text-[14px] font-bold text-text-primary mt-0.5">
                {mode === "paper" ? "Paper Simulation Mode" : "Live Trading Vault Mode"}
              </div>
            </div>

            {/* Mode Switcher Buttons */}
            <div className="flex items-center p-1 rounded-xl bg-bg-surface3 border border-border-subtle">
              <button
                type="button"
                onClick={() => setMode("paper")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-[11.5px] transition-all ${
                  mode === "paper"
                    ? "bg-accent-dark text-accent-violet border border-accent-violet/30 shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-accent-violet animate-pulse" />
                <span>● PAPER ($100k Virtual)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("live")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-[11.5px] transition-all ${
                  mode === "live"
                    ? "bg-emerald/10 text-emerald border border-emerald/30 shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald" />
                <span>○ LIVE (Real USDC)</span>
              </button>
            </div>
          </div>

          {/* Form Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Leverage or Stake Per Bet */}
            {!isWageringVenue ? (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-tertiary">MAX LEVERAGE CAP</span>
                  <span className="text-accent-violet font-bold">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-accent-violet cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-text-quaternary">
                  <span>1x (Spot)</span>
                  <span>25x</span>
                  <span>50x (Max)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-tertiary">MAX STAKE PER WAGER</span>
                  <span className="text-accent-violet font-bold">{maxPosition} USDC</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="1000"
                  step="5"
                  value={maxPosition}
                  onChange={(e) => setMaxPosition(Number(e.target.value))}
                  className="w-full accent-accent-violet cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-text-quaternary">
                  <span>5 USDC</span>
                  <span>500 USDC</span>
                  <span>1,000 USDC</span>
                </div>
              </div>
            )}

            {/* Max Position / Session Budget */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-text-tertiary">
                  {isWageringVenue ? "SESSION BANKROLL CAP" : "MAX POSITION SIZE"}
                </span>
                <span className="text-text-primary font-bold">
                  {isWageringVenue ? maxPosition * 5 : maxPosition} USDC
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="5000"
                step="50"
                value={maxPosition}
                onChange={(e) => setMaxPosition(Number(e.target.value))}
                className="w-full accent-accent-violet cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-quaternary">
                <span>$50</span>
                <span>$2,500</span>
                <span>$5,000</span>
              </div>
            </div>

            {/* Daily Drawdown Stop */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-text-tertiary">DAILY DRAWDOWN STOP LOSS</span>
                <span className="text-accent-orange font-bold">-{dailyDrawdown} USDC</span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="20"
                value={dailyDrawdown}
                onChange={(e) => setDailyDrawdown(Number(e.target.value))}
                className="w-full accent-accent-orange cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-quaternary">
                <span>-$20 (Tight)</span>
                <span>-$500</span>
                <span>-$1,000</span>
              </div>
            </div>
          </div>

          {/* Action Row & Kill Switch */}
          <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11.5px] text-text-secondary">
              <ShieldAlert className="h-4 w-4 text-emerald shrink-0" />
              <span>
                Vault Firewall Active: Losses bounded to{" "}
                <span className="text-emerald font-bold">{dailyDrawdown} USDC/day</span> max.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPanicTriggered(!panicTriggered)}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all ${
                  panicTriggered
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "bg-bg-surface3 text-text-tertiary hover:text-red-400 hover:bg-red-500/10 border border-border-subtle"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{panicTriggered ? "EMERGENCY HALTED" : "PANIC KILL SWITCH"}</span>
              </button>

              <Link
                href={appUrl("/degen")}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-center transition-all shadow-xs whitespace-nowrap"
              >
                Save Risk Policy →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
