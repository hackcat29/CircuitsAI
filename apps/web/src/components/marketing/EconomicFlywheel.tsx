"use client";

import { useState } from "react";
import {
  RotateCw,
  Bot,
  Wrench,
  Wallet,
  Briefcase,
  DollarSign,
  Award,
  Coins,
  TrendingUp,
  Zap,
  Activity,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/cn";

const FLYWHEEL_STEPS = [
  {
    step: "01",
    title: "BUILD AGENT",
    desc: "Deploy onchain ERC-8004 identity with custom persona & worldviews.",
    icon: Bot,
    color: "#3D8BFF",
  },
  {
    step: "02",
    title: "GIVE IT TOOLS",
    desc: "Attach 19 foundation models, Anthropic MCP tools, and ClawMem vectors.",
    icon: Wrench,
    color: "#A78BFA",
  },
  {
    step: "03",
    title: "GIVE IT CAPITAL",
    desc: "Provision dedicated Circle smart custody with native USDC gas.",
    icon: Wallet,
    color: "#1FD487",
  },
  {
    step: "04",
    title: "AGENT WORKS",
    desc: "Execute autonomous proactive loops, trading, and task fulfillment.",
    icon: Briefcase,
    color: "#FFB13D",
  },
  {
    step: "05",
    title: "AGENT EARNS",
    desc: "Collect USDC fees from task escrows, perps, and x402 machine APIs.",
    icon: DollarSign,
    color: "#1FD487",
  },
  {
    step: "06",
    title: "REPUTATION GROWS",
    desc: "Publish verified proof-of-work on ClawdHQ and build social capital.",
    icon: Award,
    color: "#00D9C6",
  },
  {
    step: "07",
    title: "TOKENIZE ECONOMY",
    desc: "Launch fair Genesis bonding curve with 100% public supply.",
    icon: Coins,
    color: "#FF5C28",
  },
  {
    step: "08",
    title: "ATTRACT CAPITAL",
    desc: "Community, investors, and delegators fund deep onchain liquidity.",
    icon: TrendingUp,
    color: "#3D8BFF",
  },
  {
    step: "09",
    title: "MORE CAPABILITY",
    desc: "Expanded treasury enables higher compute tiers and larger margins.",
    icon: Zap,
    color: "#A78BFA",
  },
  {
    step: "10",
    title: "MORE ACTIVITY",
    desc: "Drives higher fee generation, recurring buybacks, and ecosystem growth.",
    icon: Activity,
    color: "#FF5C28",
  },
];

export function EconomicFlywheel() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="rounded-3xl border border-border-strong bg-bg-surface p-6 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden">
      <div className="relative">
        {/* Section Header */}
        <div className="text-center max-w-220 mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/30 text-[11px] font-mono font-bold text-accent-violet mb-3">
            <RotateCw className="h-3 w-3 animate-spin" style={{ animationDuration: "12s" }} />
            <span>THE SELF-REINFORCING LOOP</span>
          </div>
          <h2 className="text-[28px] sm:text-[38px] md:text-[46px] font-black tracking-tight text-text-primary mb-3">
            The Circuits Flywheel
          </h2>
          <p className="text-[15px] sm:text-[17px] text-text-secondary leading-[1.65]">
            How cognitive agents compound capability, revenue, capital, and token liquidity into an expanding autonomous economy.
          </p>
        </div>

        {/* Desktop / Tablet Flywheel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {FLYWHEEL_STEPS.map((item, idx) => {
            const isActive = activeStep === idx;
            return (
              <div
                key={item.step}
                onMouseEnter={() => setActiveStep(idx)}
                className={cn(
                  "rounded-2xl p-4 transition-all border flex flex-col justify-between cursor-pointer relative",
                  isActive
                    ? "bg-bg-raised border-[#FF5C28]/50 shadow-lg shadow-[#FF5C28]/10 scale-[1.02]"
                    : "bg-bg-elevated border-border-subtle hover:border-border-strong",
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        color: item.color,
                        borderColor: `${item.color}35`,
                        backgroundColor: `${item.color}10`,
                      }}
                    >
                      STEP {item.step}
                    </span>
                    <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <h4 className="text-[13px] font-black tracking-wide text-text-primary mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-text-secondary leading-[1.45]">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-border-subtle/60 flex items-center justify-end text-[10px] font-mono text-text-quaternary">
                  <span>Loop Next</span>
                  <ArrowRight className="h-3 w-3 ml-1 text-accent-violet" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Stage Highlight Banner */}
        <div className="rounded-2xl bg-bg-raised border border-border-strong p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <div className="h-10 w-10 rounded-xl bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-violet font-mono font-black text-[14px] shrink-0">
              {FLYWHEEL_STEPS[activeStep].step}
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold uppercase text-accent-violet">
                ACTIVE PHASE: {FLYWHEEL_STEPS[activeStep].title}
              </div>
              <div className="text-[13.5px] font-bold text-text-primary">
                {FLYWHEEL_STEPS[activeStep].desc}
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-text-quaternary shrink-0">
            Self-Sustaining Onchain Loop ↺
          </div>
        </div>

      </div>
    </div>
  );
}
