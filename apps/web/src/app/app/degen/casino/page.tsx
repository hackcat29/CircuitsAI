"use client";

import Link from "next/link";
import {
  Dices,
  Lock,
  ShieldCheck,
  ExternalLink,
  Clock,
  ArrowRight,
  Rocket,
  Coins,
  Gamepad2,
} from "lucide-react";

const PLANNED_GAMES = [
  { name: "Moonshot Crash", desc: "Multiplier-based game with auto-cashout. CrashGame contract deployed and pending operator setup.", icon: Rocket },
  { name: "Crypto Dice", desc: "Adjustable win probability dice with provable fairness via VRF randomness.", icon: Dices },
  { name: "Coinflip", desc: "50/50 double-or-nothing with on-chain seed commitment.", icon: Coins },
  { name: "European Roulette", desc: "Full 37-number European roulette with inside/outside bets.", icon: Gamepad2 },
];

export default function DegenCasinoPage() {
  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* Coming Soon Hero */}
      <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-8 sm:p-12 flex flex-col items-center text-center gap-6 shadow-xs">
        <div className="h-16 w-16 rounded-full bg-accent-dark/60 border border-accent-violet/30 flex items-center justify-center">
          <Dices className="h-7 w-7 text-accent-violet" />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[10.5px] font-extrabold px-3 py-0.75 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              INTEGRATION IN PROGRESS
            </span>
          </div>
          <h2 className="text-[20px] sm:text-[24px] font-extrabold text-text-primary mb-1">
            Provably Fair Casino Arcade
          </h2>
          <p className="text-[12.5px] text-text-tertiary max-w-140 mx-auto leading-relaxed">
            Autonomous agent gameplay against on-chain games with VRF-verified randomness. Powered by <strong className="text-text-primary">SportyStake.com</strong>
          </p>
        </div>

        {/* What's Coming */}
        <div className="w-full max-w-160">
          <h3 className="text-[11px] uppercase font-bold text-text-quaternary tracking-wider mb-3">Planned Game Verticals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLANNED_GAMES.map((game) => {
              const Icon = game.icon;
              return (
                <div
                  key={game.name}
                  className="p-4 rounded-[12px] border border-border-subtle bg-bg-surface flex items-start gap-3 text-left"
                >
                  <div className="p-2 rounded-lg bg-bg-raised border border-border-subtle text-accent-violet shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[12px] font-extrabold text-text-primary">{game.name}</div>
                    <p className="text-[10.5px] text-text-quaternary leading-relaxed mt-0.5">{game.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
