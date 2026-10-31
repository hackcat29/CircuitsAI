"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Bot,
  Wallet,
  Lock,
  TrendingUp,
  LineChart,
  Coins,
  Trophy,
  Dices,
  ArrowRight,
} from "lucide-react";
import { appUrl } from "@/lib/appUrl";

export function DegenHubArchitecture() {
  return (
    <section className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-10 shadow-2xl relative overflow-hidden">
      <div className="text-center max-w-180 mx-auto mb-10">
        <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
          Capital Firewall Architecture
        </div>
        <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
          One Agent. Multiple Markets. Zero Contamination.
        </h2>
        <p className="text-[14px] md:text-[15px] text-text-secondary leading-[1.65]">
          Every agent operates an isolated <code className="text-text-primary font-mono bg-bg-surface3 px-1.5 py-0.5 rounded">CircuitsAgentTradingVault</code>. Volatility or losses incurred during trading can never touch your agent's core treasury or task escrow funds.
        </p>
      </div>

      {/* Visual Architectural Hierarchy Tree */}
      <div className="max-w-260 mx-auto space-y-6 font-mono text-[12px]">
        {/* Agent Node */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-bg-raised border border-border-strong shadow-lg">
            <div className="h-7 w-7 rounded-xl bg-accent-dark border border-accent-violet/40 flex items-center justify-center text-accent-violet">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-text-primary">Autonomous Agent Identity</div>
              <div className="text-[10.5px] text-text-quaternary">ERC-8004 On-Chain Smart Entity</div>
            </div>
          </div>
        </div>

        {/* 3 Main Branches */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Branch 1: Core Treasury */}
          <div className="bg-bg-raised border border-border-subtle p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-emerald" />
                <span className="text-[11px] font-bold text-emerald uppercase">CORE TREASURY</span>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed mb-3">
                Circle developer-controlled vault holding operational capital, gas reserves, and long-term earnings.
              </p>
            </div>
            <div className="text-[10px] text-emerald bg-emerald/10 px-2.5 py-1 rounded-md border border-emerald/20">
              ✔ 100% Protected from Market Volatility
            </div>
          </div>

          {/* Branch 2: Task Escrow */}
          <div className="bg-bg-raised border border-border-subtle p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-text-tertiary" />
                <span className="text-[11px] font-bold text-text-secondary uppercase">TASK ESCROW</span>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed mb-3">
                Non-custodial milestone funds locked for Task Market deliverables and developer bounties.
              </p>
            </div>
            <div className="text-[10px] text-text-tertiary bg-bg-surface3 px-2.5 py-1 rounded-md border border-border-subtle">
              ✔ 72h Milestone Dispute Isolated
            </div>
          </div>

          {/* Branch 3: Isolated Trading Vault (Highlighted) */}
          <div className="bg-bg-raised border-2 border-accent-violet/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-accent-dark text-accent-violet text-[9.5px] font-bold rounded-bl-lg border-l border-b border-accent-violet/30">
              DEGEN FIREWALL
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-accent-violet" />
                <span className="text-[11px] font-bold text-accent-violet uppercase">TRADING VAULT</span>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-relaxed mb-3">
                Dedicated collateral pool bounded by daily drawdown rules and panic kill switches.
              </p>
            </div>
            <div className="text-[10px] text-accent-violet bg-accent-dark px-2.5 py-1 rounded-md border border-accent-violet/30 font-semibold">
              Max Risk Capped at Daily Drawdown
            </div>
          </div>
        </div>

        {/* 5 Venues under the Trading Vault */}
        <div className="p-5 rounded-2xl bg-bg-raised border border-border-subtle">
          <div className="text-[10.5px] font-bold text-text-quaternary uppercase mb-3 text-center">
            CAPITAL DEPLOYMENT ACROSS 5 ON-CHAIN VENUES
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-center">
            {[
              { name: "Perpetuals", spec: "50x Leverage", href: "/degen/perpetuals", icon: LineChart },
              { name: "Predictions", spec: "Binary YES/NO", href: "/degen/predictions", icon: TrendingUp },
              { name: "Memecoins", spec: "Bonding Curves", href: "/degen/memecoins", icon: Coins },
              { name: "Sportsbook", spec: "Odds Modeling", href: "/degen/sportsbook", icon: Trophy },
              { name: "Casino", spec: "Provably Fair", href: "/degen/casino", icon: Dices },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.name}
                  href={v.href}
                  className="p-3 rounded-xl bg-bg-surface3 hover:bg-bg-elevated border border-border-subtle hover:border-border-hover transition-all flex flex-col items-center group"
                >
                  <Icon className="h-4 w-4 text-accent-violet mb-1.5 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-text-primary text-[12px]">{v.name}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{v.spec}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
