"use client";

import Link from "next/link";
import {
  Trophy,
  Lock,
  ShieldCheck,
  ExternalLink,
  Clock,
  ArrowRight,
  Radio,
} from "lucide-react";

const SPORTYSTAKE_CONTRACTS = {
  bettingCore: "0x091E1Fe9576E4E090FE95eD8bB25a19B01FAbcf0",
  liquidityPool: "0x574DF566b98E6f3Cb7459b39BFD9afeD8694A154",
};

const PLANNED_SPORTS = [
  { name: "Premier League & Champions League", desc: "Full match result, over/under, and handicap markets with Kelly Criterion staking.", icon: "⚽" },
  { name: "NBA & NCAA Basketball", desc: "Moneyline, spread, and total points markets with real-time in-play odds.", icon: "🏀" },
  { name: "UFC & Boxing", desc: "Fight result and method-of-victory markets with sub-second live betting.", icon: "🥊" },
  { name: "Esports (CS2, LoL, Dota 2)", desc: "Map winner, outright, and first blood markets across major tournaments.", icon: "🎮" },
];

export default function DegenSportsbookPage() {
  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* Coming Soon Hero */}
      <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-8 sm:p-12 flex flex-col items-center text-center gap-6 shadow-xs">
        <div className="h-16 w-16 rounded-full bg-accent-dark/60 border border-accent-violet/30 flex items-center justify-center">
          <Trophy className="h-7 w-7 text-accent-violet" />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[10.5px] font-extrabold px-3 py-0.75 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              INTEGRATION IN PROGRESS
            </span>
          </div>
          <h2 className="text-[20px] sm:text-[24px] font-extrabold text-text-primary mb-1">
            Sportsbook Fixture Engine
          </h2>
          <p className="text-[12.5px] text-text-tertiary max-w-140 mx-auto leading-relaxed">
            Single and parlay betting with Kelly Criterion autonomous staking. Powered by <strong className="text-text-primary">SportyStake.com</strong>
          </p>
        </div>

        {/* What's Coming */}
        <div className="w-full max-w-160">
          <h3 className="text-[11px] uppercase font-bold text-text-quaternary tracking-wider mb-3">Planned Sport Verticals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLANNED_SPORTS.map((sport) => (
              <div
                key={sport.name}
                className="p-4 rounded-[12px] border border-border-subtle bg-bg-surface flex items-start gap-3 text-left"
              >
                <span className="text-[22px]">{sport.icon}</span>
                <div>
                  <div className="text-[12px] font-extrabold text-text-primary">{sport.name}</div>
                  <p className="text-[10.5px] text-text-quaternary leading-relaxed mt-0.5">{sport.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
