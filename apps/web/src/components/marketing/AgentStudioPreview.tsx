"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain,
  Shield,
  Wallet,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Database,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { appUrl } from "@/lib/appUrl";

export function AgentStudioPreview() {
  const [worldview, setWorldview] = useState("Alpha Hunter");
  const [riskProfile, setRiskProfile] = useState("Controlled (2.5x)");
  const [selectedModel, setSelectedModel] = useState("Claude 3.5 Sonnet");
  const [dailyLimit, setDailyLimit] = useState(500);
  const x402Price = "0.25";

  return (
    <div className="w-full rounded-3xl border border-border-strong bg-bg-surface p-5 sm:p-7 md:p-9 shadow-2xl relative overflow-hidden">
      {/* Top Header & Tag */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-7 border-b border-border-subtle">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/30 text-[11px] font-mono font-bold text-accent-violet mb-2">
            <Sparkles className="h-3 w-3" />
            <span>STUDIO RUNTIME BUILDER</span>
          </div>
          <h3 className="text-[22px] sm:text-[28px] font-black tracking-tight text-text-primary">
            Build Agents With Their Own Brain, Memory & Wallet.
          </h3>
          <p className="text-[14px] text-text-secondary mt-1 max-w-180 leading-relaxed">
            Configure verifiable onchain identity, multi-model cognition, ClawMem vector retrieval, and sovereign USDC smart custody in one visual studio.
          </p>
        </div>

        <Link
          href={appUrl("/register")}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-lg shadow-[#FF5C28]/25 shrink-0 cursor-pointer self-start md:self-auto"
        >
          <span>Create Agent</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 3 Configurable Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Column 1: IDENTITY */}
        <div className="rounded-2xl bg-bg-elevated border border-border-subtle p-5 flex flex-col justify-between hover:border-border-strong transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-violet">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[12px] font-mono font-black text-text-primary">01 IDENTITY</div>
                  <div className="text-[10px] text-text-quaternary font-mono">ERC-8004 Registry</div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-raised text-accent-violet border border-accent-violet/30">
                Sovereign
              </span>
            </div>

            <div className="space-y-4 text-[12px]">
              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Agent Handle & Role
                </label>
                <div className="bg-bg-raised border border-border-strong rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="font-bold text-text-primary">Alpha Trader</span>
                  <span className="text-[10px] font-mono text-accent-cyan">#042.arc</span>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Worldview & Heuristics
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Alpha Hunter", "Risk Neutral", "Arbitrageur", "Data Scout"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setWorldview(opt)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-left transition-all cursor-pointer",
                        worldview === opt
                          ? "bg-accent-violet/20 border border-accent-violet/50 text-text-primary font-bold"
                          : "bg-bg-raised border border-border-subtle text-text-secondary hover:border-border-strong",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Risk Profile & Mandate
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Conservative (1x)", "Controlled (2.5x)", "Degen (10x)", "Strict Hedged"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setRiskProfile(opt)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-left transition-all cursor-pointer",
                        riskProfile === opt
                          ? "bg-accent-cyan/20 border border-accent-cyan/50 text-text-primary font-bold"
                          : "bg-bg-raised border border-border-subtle text-text-secondary hover:border-border-strong",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border-subtle flex items-center gap-2 text-[10.5px] font-mono text-text-quaternary">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald shrink-0" />
            <span>Cryptographic ERC-721 token bound</span>
          </div>
        </div>

        {/* Column 2: COGNITION */}
        <div className="rounded-2xl bg-bg-elevated border border-border-subtle p-5 flex flex-col justify-between hover:border-border-strong transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[12px] font-mono font-black text-text-primary">02 COGNITION</div>
                  <div className="text-[10px] text-text-quaternary font-mono">19 Foundation Models</div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-raised text-accent-cyan border border-accent-cyan/30">
                Multi-Model
              </span>
            </div>

            <div className="space-y-4 text-[12px]">
              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Primary Foundation Model
                </label>
                <div className="space-y-1.5">
                  {[
                    { name: "Claude 3.5 Sonnet", note: "Best for tool execution & synthesis" },
                    { name: "GPT-4o", note: "High throughput reasoning" },
                    { name: "DeepSeek R1", note: "Specialized math & code verification" },
                  ].map((m) => (
                    <button
                      key={m.name}
                      onClick={() => setSelectedModel(m.name)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer",
                        selectedModel === m.name
                          ? "bg-bg-raised border border-accent-cyan/50 text-text-primary shadow-xs"
                          : "bg-bg-raised/40 border border-border-subtle text-text-secondary hover:border-border-strong",
                      )}
                    >
                      <span className="font-bold">{m.name}</span>
                      <span className="text-[10px] font-mono text-text-quaternary">{m.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Tool & Memory Integrations
                </label>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg-raised border border-border-subtle">
                    <span className="text-text-secondary flex items-center gap-1.5">
                      <Terminal className="h-3 w-3 text-accent-violet" /> MCP Tool Standard
                    </span>
                    <span className="text-emerald text-[10px] font-bold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg-raised border border-border-subtle">
                    <span className="text-text-secondary flex items-center gap-1.5">
                      <Database className="h-3 w-3 text-accent-cyan" /> ClawMem Vector State
                    </span>
                    <span className="text-emerald text-[10px] font-bold">Anchored</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border-subtle flex items-center gap-2 text-[10.5px] font-mono text-text-quaternary">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald shrink-0" />
            <span>Autonomous proactive + reactive ticks</span>
          </div>
        </div>

        {/* Column 3: ECONOMY */}
        <div className="rounded-2xl bg-bg-elevated border border-border-subtle p-5 flex flex-col justify-between hover:border-border-strong transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald/10 border border-emerald/30 flex items-center justify-center text-emerald">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[12px] font-mono font-black text-text-primary">03 ECONOMY</div>
                  <div className="text-[10px] text-text-quaternary font-mono">Circle Smart Custody</div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-raised text-emerald border border-emerald/30">
                Native USDC
              </span>
            </div>

            <div className="space-y-4 text-[12px]">
              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  Smart Wallet & Gas Token
                </label>
                <div className="bg-bg-raised border border-border-strong rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-quaternary">
                    <span>Native Gas</span>
                    <span className="text-emerald font-bold">USDC (Zero Volatility)</span>
                  </div>
                  <div className="text-[17px] font-mono font-black text-text-primary mt-1">
                    $42,281.00 <span className="text-[12px] text-accent-violet">USDC</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  <span>Daily Autonomous Spend Cap</span>
                  <span className="text-emerald">${dailyLimit} / day</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={2500}
                  step={50}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full accent-[#FF5C28] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono uppercase text-text-quaternary font-bold mb-1.5">
                  x402 Micropayment API Pricing
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-bg-raised border border-border-strong rounded-xl px-3 py-2 flex items-center justify-between font-mono">
                    <span className="text-text-secondary text-[11.5px]">Price per request:</span>
                    <span className="font-bold text-text-primary">{x402Price} USDC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-border-subtle flex items-center gap-2 text-[10.5px] font-mono text-text-quaternary">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald shrink-0" />
            <span>Ready for fair launch bonding curve</span>
          </div>
        </div>

      </div>
    </div>
  );
}
