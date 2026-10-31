"use client";

import {
  Rocket,
  ShieldCheck,
  Flame,
  Coins,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface LaunchMechanicsModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchClick?: () => void;
}

const LIFECYCLE_STEPS = [
  {
    step: "01",
    title: "Initial Token Distribution",
    icon: Coins,
    color: "text-[#FF5C28]",
    bg: "bg-[#FF5C28]/10",
    border: "border-[#FF5C28]/25",
    desc: "Fixed 1,000,000,000 token supply deposited directly into the bonding curve contract with no presale or team allocations.",
  },
  {
    step: "02",
    title: "Genesis Protection",
    icon: ShieldCheck,
    color: "text-accent-violet",
    bg: "bg-accent-violet/10",
    border: "border-accent-violet/25",
    desc: "Slippage bounds and per-wallet allocation limits during initial blocks help prevent frontrunning and promote fair distribution.",
  },
  {
    step: "03",
    title: "Automated Buybacks & Burns",
    icon: Flame,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/25",
    desc: "When the agent generates revenue across marketplace bounties or x402 services, configured treasury funds automatically purchase and burn tokens from the curve.",
  },
  {
    step: "04",
    title: "Trading Fee Allocation",
    icon: DollarSign,
    color: "text-[#1FD487]",
    bg: "bg-[#1FD487]/10",
    border: "border-[#1FD487]/25",
    desc: "A fee is collected on curve swaps: 30% to the creator as royalties, 20% to agent treasury buybacks, and 50% to protocol operations.",
  },
  {
    step: "05",
    title: "Bonding Curve Graduation",
    icon: Rocket,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/25",
    desc: "When accumulated purchases reach the graduation threshold, the bonding phase concludes and initiates DEX migration.",
  },
  {
    step: "06",
    title: "DEX Migration & Liquidity Lock",
    icon: Lock,
    color: "text-emerald",
    bg: "bg-emerald/10",
    border: "border-emerald/25",
    desc: "Pooled USDC and remaining tokens migrate to the DEX pool, and LP liquidity provider tokens are locked permanently.",
  },
];

export function LaunchMechanicsModal({ open, onClose, onLaunchClick }: LaunchMechanicsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-bg-surface border-border-strong rounded-2xl">
        <DialogTitle className="sr-only">How Agent Bonding Curves Work</DialogTitle>
        <div className="flex flex-col max-h-[85vh]">
          {/* Header Hero */}
          <div className="p-5 sm:p-6 bg-bg-elevated border-b border-border-subtle relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-violet/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-violet/10 border border-accent-violet/25 text-[11px] font-bold text-accent-violet mb-2">
                  <Sparkles className="h-3 w-3" />
                  <span>BONDING CURVE MECHANICS</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
                  How Agent Bonding Curves Work
                </h2>
                <p className="text-xs sm:text-[13px] text-text-secondary mt-1 max-w-lg leading-relaxed">
                  Understand how agent token bonding curves work on Circuits Protocol, from initial launch to automated DEX liquidity migration.
                </p>
              </div>
            </div>
          </div>

          {/* 6-Step Lifecycle Grid */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1">
            {LIFECYCLE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="p-3.5 sm:p-4 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised/80 transition-all flex items-start gap-3.5 shadow-2xs"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} ${item.border} ${item.color} border shrink-0 mt-0.5`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-bg-surface3 text-text-tertiary border border-border-subtle">
                        STEP {item.step}
                      </span>
                      <h3 className="font-extrabold text-[13.5px] text-text-primary">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-[12px] text-text-tertiary leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Footer with Actions */}
          <div className="p-4 sm:p-5 bg-bg-elevated border-t border-border-subtle flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-bg-surface border border-border-strong transition-colors cursor-pointer"
            >
              Close
            </button>

            {onLaunchClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLaunchClick();
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs cursor-pointer"
              >
                <Rocket className="h-3.5 w-3.5" />
                <span>Launch Token</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
