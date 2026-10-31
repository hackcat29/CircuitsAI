"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Rocket, ArrowRight } from "lucide-react";
import { useWallet } from "@/hooks";
import { CreateLaunchDialog } from "@/components/launchpad/CreateLaunchDialog";
import { MarketPulse } from "@/components/launchpad/MarketPulse";
import { LaunchTable } from "@/components/launchpad/LaunchTable";
import { UpcomingLaunchesStrip } from "@/components/launchpad/UpcomingLaunchesStrip";
import { LaunchMechanicsModal } from "@/components/launchpad/LaunchMechanicsModal";

function LaunchpadContent() {
  const { chain } = useWallet();
  const searchParams = useSearchParams();
  const shouldAutoOpen = searchParams.get("create") === "1";
  const [showMechanicsModal, setShowMechanicsModal] = useState(false);
  const [createLaunchOpen, setCreateLaunchOpen] = useState(shouldAutoOpen);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-16 flex flex-col gap-5 sm:gap-6">
      {/* Dedicated Launch Mechanics Modal */}
      <LaunchMechanicsModal
        open={showMechanicsModal}
        onClose={() => setShowMechanicsModal(false)}
        onLaunchClick={() => setCreateLaunchOpen(true)}
      />

      {/* ── 1. LAUNCHPAD HEADER / HERO (DESKTOP & MOBILE) ── */}

      {/* Mobile Hero Header (< sm) */}
      <div className="sm:hidden rounded-2xl border border-border-subtle bg-bg-elevated p-4 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5C28]/15 text-[#FF5C28] border border-[#FF5C28]/25">
              <Rocket className="h-4 w-4" />
            </div>
            <h1 className="text-[17px] font-black tracking-tight text-text-primary">
              Agent Launchpad
            </h1>
          </div>
          <div className="text-[10px] font-mono font-bold text-emerald px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/20">
            {chain.chainName}
          </div>
        </div>

        <p className="text-[12px] text-text-tertiary leading-relaxed">
          Tokenize agents on bonding curves with automated DEX graduation.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1">
            <CreateLaunchDialog onCreated={() => setCreateLaunchOpen(false)} defaultOpen={createLaunchOpen} />
          </div>
          <button
            type="button"
            onClick={() => setShowMechanicsModal(true)}
            className="px-3 py-2.5 rounded-xl bg-bg-surface text-text-secondary border border-border-strong text-xs font-bold transition-colors cursor-pointer hover:text-text-primary"
          >
            How it works →
          </button>
        </div>
      </div>

      {/* Desktop Hero Header (>= sm) */}
      <div className="hidden sm:block rounded-2xl px-6 py-6 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-violet/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex items-start justify-between gap-6 flex-wrap relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/25 text-[11px] font-bold text-accent-violet mb-2.5">
              <Rocket className="h-3.5 w-3.5" />
              <span>AGENT TOKEN LAUNCHPAD</span>
              <span className="h-1 w-1 rounded-full bg-accent-violet/60" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text-primary mb-1.5">
              Tokenize AI Agents on Circuits
            </h1>

            <p className="text-[13px] text-text-secondary leading-relaxed max-w-xl">
              Bonding curves with on-chain liquidity on Monad. Automated revenue buybacks and locked DEX LP upon graduation.
            </p>

            <div className="mt-4 pt-3.5 border-t border-border-subtle/60 flex items-center">
              <button
                type="button"
                onClick={() => setShowMechanicsModal(true)}
                className="text-accent-violet font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>How launches work</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 2-Intention CTAs (Launch vs Explore) */}
          <div className="shrink-0 flex flex-col gap-2 mt-1">
            <CreateLaunchDialog onCreated={() => setCreateLaunchOpen(false)} defaultOpen={createLaunchOpen} />
            <a
              href="#market-explorer"
              className="px-4 py-2.5 rounded-xl bg-bg-surface hover:bg-bg-raised text-text-secondary hover:text-text-primary border border-border-strong text-xs font-bold text-center transition-colors"
            >
              Explore Tokens ↓
            </a>
          </div>
        </div>
      </div>

      {/* ── 2. UNIFIED MARKET PULSE (DESKTOP & MOBILE) ── */}
      <MarketPulse />

      {/* Upcoming Scheduled Launches (Only renders when upcoming launches exist) */}
      <UpcomingLaunchesStrip />

      {/* ── 3. CANONICAL MARKET EXPLORER (SEARCH, SORT, STATUS & LIST) ── */}
      <LaunchTable />

      {/* ── 4. BOTTOM LAUNCH CTA BANNER ── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base sm:text-lg font-black text-text-primary">
            Ready to launch an agent token?
          </h3>
          <p className="text-xs text-text-secondary max-w-md">
            Deploy a bonding curve token on Monad with 1B fixed supply and automated graduation.
          </p>
        </div>

        <div className="shrink-0">
          <CreateLaunchDialog onCreated={() => setCreateLaunchOpen(false)} defaultOpen={false} />
        </div>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto p-6 md:p-10 text-sm text-text-tertiary">Loading Launchpad…</div>}>
      <LaunchpadContent />
    </Suspense>
  );
}
