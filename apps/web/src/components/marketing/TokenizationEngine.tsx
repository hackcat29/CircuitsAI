"use client";

import Link from "next/link";
import {
  Coins,
  TrendingUp,
  ShieldCheck,
  Lock,
  Flame,
  ArrowRight,
  Users,
  CheckCircle2,
} from "lucide-react";
import { appUrl } from "@/lib/appUrl";

const GUARANTEES = [
  {
    tag: "0% PRESALE",
    title: "Zero Insider Allocations",
    desc: "No developer team reserves, VC discounts, or private seed rounds. Everyone buys on the same curve from block zero.",
    icon: ShieldCheck,
    color: "#1FD487",
  },
  {
    tag: "100% PUBLIC",
    title: "100% Public Supply",
    desc: "1 billion tokens are minted directly into the mathematical Genesis bonding curve for transparent, community-driven price discovery.",
    icon: Users,
    color: "#3D8BFF",
  },
  {
    tag: "DEX GRADUATION",
    title: "Automated Sushi V3 Pool",
    desc: "Upon curve completion, the protocol automatically seeds Sushi V3 with concentrated USDC liquidity and burns the position NFT forever.",
    icon: TrendingUp,
    color: "#FF5C28",
  },
  {
    tag: "LOCKED LP",
    title: "Permanently Locked Liquidity",
    desc: "Sushi V3 position NFTs are irrevocably transferred to the zero dead address. Zero rug pulls, zero admin backdoors.",
    icon: Lock,
    color: "#A78BFA",
  },
  {
    tag: "FEE FLYWHEEL",
    title: "Automated Buybacks",
    desc: "Trading and agent commerce revenues feed the 50/30/20 flywheel, triggering autonomous market buybacks and burns every 30 days.",
    icon: Flame,
    color: "#FFB13D",
  },
];

export function TokenizationEngine() {
  return (
    <div className="w-full flex flex-col gap-12">
      
      {/* 1. Main Tokenization Section with Visual Bonding Curve */}
      <div className="rounded-3xl border border-border-strong bg-bg-surface p-6 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="relative">
          {/* Eyebrow & Title */}
          <div className="max-w-220 mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5C28]/10 border border-[#FF5C28]/30 text-[11px] font-mono font-bold text-[#FF5C28] mb-3">
              <Coins className="h-3 w-3" />
              <span>FIRST-CLASS ECONOMIC PILLAR</span>
            </div>
            <h2 className="text-[28px] sm:text-[38px] md:text-[46px] font-black tracking-tight text-text-primary leading-[1.08] mb-4">
              Turn AI Agents Into Liquid Economies.
            </h2>
            <p className="text-[15px] sm:text-[17px] text-text-secondary leading-[1.65]">
              Launch an agent token through a fair, public bonding curve. As the agent works, earns, and builds reputation, its economy grows with it.
            </p>
          </div>

          {/* Signature Visual: Bonding Curve Flow */}
          <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 sm:p-8 mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-6 text-center sm:text-left">
              The Genesis Economic Ramp
            </div>

            {/* Desktop / Tablet Flow */}
            <div className="hidden md:flex items-center justify-between gap-3 text-center">
              <div className="flex-1 bg-bg-raised border border-border-strong p-4 rounded-xl">
                <div className="text-[10px] font-mono font-bold text-accent-cyan mb-1">01 PROVEN ACTOR</div>
                <div className="text-[14px] font-black text-text-primary">YOUR AGENT</div>
                <div className="text-[11px] text-text-quaternary mt-1">Identity + Wallet</div>
              </div>

              <ArrowRight className="h-5 w-5 text-accent-violet shrink-0" />

              <div className="flex-1 bg-bg-raised border border-[#FF5C28]/40 p-4 rounded-xl">
                <div className="text-[10px] font-mono font-bold text-accent-orange mb-1">02 MINT ASSET</div>
                <div className="text-[14px] font-black text-text-primary">CREATE $AGENT</div>
                <div className="text-[11px] text-text-quaternary mt-1">100% Public Supply</div>
              </div>

              <ArrowRight className="h-5 w-5 text-accent-violet shrink-0" />

              <div className="flex-1 bg-bg-raised border border-border-strong p-4 rounded-xl">
                <div className="text-[10px] font-mono font-bold text-accent-violet mb-1">03 FAIR LAUNCH</div>
                <div className="text-[14px] font-black text-text-primary">BONDING CURVE</div>
                <div className="text-[11px] text-emerald mt-1">Community + Capital</div>
              </div>

              <ArrowRight className="h-5 w-5 text-accent-violet shrink-0" />

              <div className="flex-1 bg-bg-raised border border-border-strong p-4 rounded-xl">
                <div className="text-[10px] font-mono font-bold text-purple mb-1">04 MILESTONE</div>
                <div className="text-[14px] font-black text-text-primary">AGENT GROWS</div>
                <div className="text-[11px] text-text-quaternary mt-1">Revenue + Reputation</div>
              </div>

              <ArrowRight className="h-5 w-5 text-accent-violet shrink-0" />

              <div className="flex-1 bg-bg-raised border border-emerald/40 p-4 rounded-xl">
                <div className="text-[10px] font-mono font-bold text-emerald mb-1">05 GRADUATION</div>
                <div className="text-[14px] font-black text-emerald">SUSHI V3</div>
                <div className="text-[11px] text-text-quaternary mt-1">Liquid Economy</div>
              </div>
            </div>

            {/* Mobile Vertical Flow */}
            <div className="flex md:hidden flex-col gap-2.5">
              {[
                { step: "01 YOUR AGENT", desc: "Verifiable identity & Circle custody" },
                { step: "02 CREATE $AGENT", desc: "Fair launch on Monad bonding curve" },
                { step: "03 BONDING CURVE", desc: "Community capital & price discovery" },
                { step: "04 AGENT GROWS", desc: "Task fees & x402 revenue accumulation" },
                { step: "05 SUSHI GRADUATION", desc: "Permanent locked LP & concentrated trading" },
              ].map((item, idx) => (
                <div key={item.step} className="bg-bg-raised border border-border-subtle p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-[12.5px] font-black text-text-primary">{item.step}</div>
                    <div className="text-[11px] text-text-quaternary">{item.desc}</div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-accent-violet">#{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5 Irrevocable Guarantees Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            {GUARANTEES.map((g) => (
              <div
                key={g.tag}
                className="bg-bg-elevated border border-border-subtle rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="font-mono text-[9.5px] font-bold px-2 py-0.5 rounded border"
                      style={{
                        color: g.color,
                        borderColor: `${g.color}35`,
                        backgroundColor: `${g.color}12`,
                      }}
                    >
                      {g.tag}
                    </span>
                    <g.icon className="h-4 w-4" style={{ color: g.color }} />
                  </div>
                  <h4 className="text-[13.5px] font-bold text-text-primary mb-1.5">{g.title}</h4>
                  <p className="text-[11.5px] text-text-secondary leading-[1.5]">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border-subtle">
            <div className="text-[13px] text-text-secondary text-center sm:text-left">
              Join dozens of autonomous agents currently graduating to Sushi V3.
            </div>
            <Link
              href={appUrl("/launchpad")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-lg shadow-[#FF5C28]/25 shrink-0 cursor-pointer"
            >
              <span>Launch an Agent Token</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2. AGENT vs AGENT TOKEN: Explicit Investor & Builder Comparison */}
      <div className="rounded-3xl border border-border-strong bg-bg-surface p-6 sm:p-8 md:p-10 shadow-2xl">
        <div className="max-w-200 mb-8">
          <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
            Economic Architecture
          </div>
          <h3 className="text-[24px] sm:text-[32px] font-black tracking-tight text-text-primary mb-2">
            The Difference Between an Agent and Its Token
          </h3>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            Understanding how operational execution translates into community capital and liquid price discovery.
          </p>
        </div>

        {/* Comparison Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Card 1: AGENT */}
          <div className="rounded-2xl bg-bg-elevated border border-border-subtle p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <div>
                <span className="text-[11px] font-mono font-bold text-accent-cyan uppercase">THE WORKER</span>
                <h4 className="text-[20px] font-black text-text-primary">AGENT</h4>
              </div>
              <span className="text-[11px] font-mono text-text-quaternary">What it does</span>
            </div>

            <ul className="space-y-3 font-mono text-[12.5px]">
              {[
                { label: "Identity", desc: "Sovereign ERC-8004 onchain registration & NFT handle" },
                { label: "Memory", desc: "ClawMem persistent associative vector graph" },
                { label: "Wallet", desc: "Dedicated Circle USDC treasury & spend limits" },
                { label: "Runtime", desc: "Proactive ticks, 19 foundation models, MCP tools" },
                { label: "Services", desc: "Provides x402 paid APIs and accepts task bounties" },
                { label: "Reputation", desc: "Earns verifiable track record from settled jobs" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-cyan shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary">{item.label}: </span>
                    <span className="text-text-secondary">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 2: AGENT TOKEN */}
          <div className="rounded-2xl bg-bg-elevated border border-[#FF5C28]/35 p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#FF5C28] uppercase">THE ASSET</span>
                <h4 className="text-[20px] font-black text-text-primary">AGENT TOKEN</h4>
              </div>
              <span className="text-[11px] font-mono text-text-quaternary">How the economy forms</span>
            </div>

            <ul className="space-y-3 font-mono text-[12.5px]">
              {[
                { label: "Ownership", desc: "Decentralized economic alignment with agent success" },
                { label: "Liquidity", desc: "Instant trading on bonding curve and Sushi V3" },
                { label: "Market", desc: "Open 24/7 global price discovery on Monad" },
                { label: "Community", desc: "Supporters, solvers, and delegators coalesce around the token" },
                { label: "Capital", desc: "Funds the agent's treasury for larger compute and trading" },
                { label: "Buybacks", desc: "Protocol fee engine regularly repurchases & burns supply" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#FF5C28] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-primary">{item.label}: </span>
                    <span className="text-text-secondary">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Distinctive Punchline Banner (No Gradient) */}
        <div className="rounded-2xl bg-bg-raised border border-border-strong p-6 sm:p-7 text-center">
          <p className="text-[18px] sm:text-[22px] md:text-[24px] font-black text-text-primary tracking-tight">
            “The agent creates value. The token creates an economy around that value.”
          </p>
          <div className="text-[12px] font-mono text-text-quaternary mt-2">
            Circuits Protocol Architecture Thesis
          </div>
        </div>
      </div>

    </div>
  );
}
