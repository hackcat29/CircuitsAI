"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Crown,
  Award,
  Shield,
  Gem,
  Bot,
  User,
  Coins,
} from "lucide-react";
import {
  useProtocolStats,
  useWallet,
  useWalletSocialProfile,
  useLaunchpadTrades,
} from "@/hooks";
import { formatCount, formatUsdc, truncateAddress } from "@/lib/format";
import type { ContributorEntry } from "@/lib/server/contributorScore";
import {
  ContributorScoreBreakdown,
  ContributorQuestMatrix,
  ContributorTierPerks,
} from "@/components/contribute";
import { cn } from "@/lib/cn";

const TIERS = [
  { name: "Bronze", min: 0, max: 4, color: "#CD7F32", bg: "rgba(205,127,50,.08)", border: "rgba(205,127,50,.25)", icon: Shield },
  { name: "Silver", min: 5, max: 19, color: "#B8BCC6", bg: "rgba(184,188,198,.06)", border: "rgba(184,188,198,.2)", icon: Award },
  { name: "Gold", min: 20, max: 99, color: "#FFB13D", bg: "rgba(255,177,61,.07)", border: "rgba(255,177,61,.22)", icon: Crown },
  { name: "Diamond", min: 100, max: Infinity, color: "#7DD3FC", bg: "rgba(125,211,252,.07)", border: "rgba(125,211,252,.22)", icon: Gem },
];

interface LeaderboardResponse {
  entries: ContributorEntry[];
  generatedAt: string;
}

export default function ContributePage() {
  const { address } = useWallet();
  const { totals: stats } = useProtocolStats();
  const { data: mySocialProfile } = useWalletSocialProfile(address);
  const { trades: myTrades } = useLaunchpadTrades(address);

  const [leaderboardFilter, setLeaderboardFilter] = useState<"all" | "patrons" | "builders">("all");

  const leaderboardQuery = useQuery<LeaderboardResponse>({
    queryKey: ["contributor-leaderboard"],
    queryFn: () => fetch("/api/contribute/leaderboard").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const entries = useMemo(() => leaderboardQuery.data?.entries ?? [], [leaderboardQuery.data]);

  // Merge any recent client-side trades so points reflect buys immediately even before indexer cache revalidation
  const localBuyVolumeUsdc = useMemo(() => {
    if (!myTrades || myTrades.length === 0) return 0;
    return myTrades
      .filter((t) => t.side === "BUY")
      .reduce((sum, t) => sum + Number(t.usdcAmount) / 1_000_000, 0);
  }, [myTrades]);

  const rawFound = useMemo(() => {
    if (!address) return null;
    return entries.find((e) => e.address.toLowerCase() === address.toLowerCase()) ?? null;
  }, [entries, address]);

  const myEntry = useMemo(() => {
    const base = {
      agentsRegistered: rawFound?.agentsRegistered ?? 0,
      jobsCompleted: rawFound?.jobsCompleted ?? 0,
      pipelinesBuilt: rawFound?.pipelinesBuilt ?? 0,
      skillsPublished: rawFound?.skillsPublished ?? 0,
      projectsLaunched: rawFound?.projectsLaunched ?? 0,
      launchpadBuyVolumeUsdc: Math.max(rawFound?.launchpadBuyVolumeUsdc ?? 0, localBuyVolumeUsdc),
      escrowJobsFunded: rawFound?.escrowJobsFunded ?? 0,
      escrowFundedVolumeUsdc: rawFound?.escrowFundedVolumeUsdc ?? 0,
      serviceCallsCount: rawFound?.serviceCallsCount ?? 0,
      exchangeBidsVolumeUsdc: rawFound?.exchangeBidsVolumeUsdc ?? 0,
    };

    const bScore =
      base.agentsRegistered * 10 +
      base.pipelinesBuilt * 15 +
      base.skillsPublished * 20 +
      base.projectsLaunched * 25 +
      base.jobsCompleted * 5;

    const launchpadScore = Math.floor(base.launchpadBuyVolumeUsdc * 0.5);
    const escrowScore = base.escrowJobsFunded * 15 + Math.floor(base.escrowFundedVolumeUsdc * 0.5);
    const serviceScore = base.serviceCallsCount * 2;
    const exchangeScore = Math.floor(base.exchangeBidsVolumeUsdc * 0.2);
    const rScore = launchpadScore + escrowScore + serviceScore + exchangeScore;

    return {
      ...(rawFound ?? {
        address: address ?? "",
        username: null,
        displayName: null,
        avatarUrl: null,
      }),
      ...base,
      builderScore: rawFound?.builderScore ?? bScore,
      revenueScore: Math.max(rawFound?.revenueScore ?? 0, rScore),
      score: Math.max(rawFound?.score ?? 0, bScore + rScore),
    };
  }, [rawFound, address, localBuyVolumeUsdc]);

  const myUsername = myEntry.username || mySocialProfile?.profile?.username;
  const totalScore = myEntry.score;

  const totalLeaderboardScore = useMemo(() => {
    return Math.max(entries.reduce((sum, e) => sum + e.score, 0), totalScore);
  }, [entries, totalScore]);

  const tier = useMemo(() => {
    return TIERS.find((t) => totalScore >= t.min && totalScore <= t.max) ?? TIERS[0];
  }, [totalScore]);

  const nextTier = useMemo(() => {
    const idx = TIERS.findIndex((t) => t.name === tier.name);
    return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  }, [tier]);

  const progressToNext = useMemo(() => {
    if (!nextTier) return 100;
    const range = nextTier.min - tier.min;
    const current = totalScore - tier.min;
    return Math.min(100, Math.max(0, (current / range) * 100));
  }, [tier, nextTier, totalScore]);

  const TierIcon = tier.icon;

  const filteredLeaderboard = useMemo(() => {
    const list = [...entries];
    if (leaderboardFilter === "patrons") {
      list.sort((a, b) => (b.revenueScore ?? (b.launchpadBuyVolumeUsdc * 0.5)) - (a.revenueScore ?? (a.launchpadBuyVolumeUsdc * 0.5)));
    } else if (leaderboardFilter === "builders") {
      list.sort((a, b) => (b.builderScore ?? b.score) - (a.builderScore ?? a.score));
    } else {
      list.sort((a, b) => b.score - a.score);
    }
    return list;
  }, [entries, leaderboardFilter]);

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16 space-y-4 sm:space-y-5">
      {/* Hero */}
      <div className="rounded-[16px] px-5 sm:px-7.5 py-5 sm:py-7 border border-border-subtle bg-bg-elevated shadow-sm">
        <div className="flex items-start justify-between gap-4 sm:gap-6 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight mb-2 flex items-center gap-2">
              <Crown className="h-5 w-5 text-accent-violet shrink-0" />
              <span>Contributor Hub &amp; Builder Leaderboard</span>
            </h1>
            <p className="text-[12px] sm:text-[12.5px] text-text-tertiary leading-[1.6] max-w-160">
              Build, deploy, and scale autonomous agents on Monad. Earn verified contributor score by buying tokens on the Launchpad, funding task escrows, deploying agents, and executing pipelines.
            </p>
          </div>
          <div className="text-center shrink-0">
            <div
              className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl flex items-center justify-center mx-auto mb-1.5 sm:mb-2 border shadow-xs"
              style={{ background: tier.bg, borderColor: tier.border }}
            >
              <TierIcon className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: tier.color }} />
            </div>
            <div className="text-[12.5px] sm:text-[13px] font-extrabold" style={{ color: tier.color }}>
              {tier.name}
            </div>
            <div className="text-[9.5px] sm:text-[10px] font-bold text-text-quaternary uppercase tracking-wider">Tier</div>
          </div>
        </div>
      </div>



      {/* Contributor Score Breakdown */}
      <ContributorScoreBreakdown
        totalScore={totalScore}
        builderScore={myEntry.builderScore}
        revenueScore={myEntry.revenueScore}
        launchpadBuyVolumeUsdc={myEntry.launchpadBuyVolumeUsdc}
        escrowFundedVolumeUsdc={myEntry.escrowFundedVolumeUsdc}
        totalLeaderboardScore={totalLeaderboardScore}
        tierName={tier.name}
        tierColor={tier.color}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Score card */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-6 shadow-xs">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary mb-1 flex items-center gap-1.5">
                  <span>Your Contribution Score</span>
                  {myUsername && (
                    <span className="font-mono text-accent-violet lowercase font-medium">(@{myUsername})</span>
                  )}
                </div>
                <div className="text-[36px] font-extrabold font-mono text-text-primary">
                  {totalScore.toLocaleString()} <span className="text-[14px] text-text-quaternary font-normal">pts</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold text-text-quaternary mb-1">Current Tier</div>
                <div className="text-[16px] font-extrabold flex items-center justify-end gap-1.5" style={{ color: tier.color }}>
                  <TierIcon className="h-4 w-4" />
                  <span>{tier.name}</span>
                </div>
              </div>
            </div>
            {nextTier && (
              <div>
                <div className="flex justify-between text-[10.5px] font-semibold text-text-quaternary mb-1.5">
                  <span>{totalScore} pts</span>
                  <span>{nextTier.name} at {nextTier.min} pts</span>
                </div>
                <div className="h-2.5 bg-bg-surface3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-accent-violet"
                    style={{ width: `${Math.min(100, progressToNext)}%` }}
                  />
                </div>
                <div className="text-[10.5px] text-text-quaternary mt-1">
                  {nextTier.min - totalScore} pts to {nextTier.name}
                </div>
              </div>
            )}
          </div>

          {/* Quest Matrix */}
          <ContributorQuestMatrix entry={myEntry} />

          {/* Tier Privileges Card */}
          <ContributorTierPerks />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Protocol stats */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-5 shadow-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-3">Protocol On-Chain Telemetry</div>
            {[
              ["Total Registered Agents", stats ? formatCount(stats.totalAgents) : "···"],
              ["Total Task Escrows", stats ? formatCount(stats.totalJobs) : "···"],
              ["Active Fleet Agents", stats ? formatCount(stats.activeAgents) : "···"],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between items-center py-2.5 border-b border-border-subtle last:border-none">
                <span className="text-[12px] text-text-tertiary">{label}</span>
                <span className="font-mono text-[12.5px] font-bold text-text-primary">{val}</span>
              </div>
            ))}
          </div>

          {/* Revenue distribution breakdown */}
          <div className="rounded-[16px] p-5 border border-border-subtle bg-bg-elevated shadow-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-2">Protocol Fee Distribution</div>
            <p className="text-[11.5px] text-text-tertiary leading-[1.6] mb-4">
              Escrow settlements and contract actions distribute protocol fees:
            </p>
            {[
              ["50%", "Agent Creator / Owner", "#1FD487"],
              ["30%", "Autonomous Agent Wallet", "#60A5FA"],
              ["20%", "Protocol Treasury & Reserves", "#FF5C28"],
            ].map(([pct, label, color]) => (
              <div key={label as string} className="flex items-center gap-3 mb-2.5 last:mb-0">
                <div className="h-2 rounded-full flex-1" style={{ background: `${color}25` }}>
                  <div className="h-full rounded-full" style={{ width: pct as string, background: color as string }} />
                </div>
                <span className="font-mono text-[11px] font-bold text-text-primary w-8 shrink-0">{pct}</span>
                <span className="text-[11px] text-text-tertiary">{label}</span>
              </div>
            ))}
          </div>

          {/* Top Contributors Leaderboard with Dual-Track Filter */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                Top Ecosystem Contributors
              </span>
              <span className="font-mono text-[10px] text-accent-violet">Live Rankings</span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-bg-surface p-0.5 rounded-lg border border-border-subtle text-[10.5px] font-semibold">
              <button
                onClick={() => setLeaderboardFilter("all")}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-colors",
                  leaderboardFilter === "all" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
                )}
              >
                All
              </button>
              <button
                onClick={() => setLeaderboardFilter("patrons")}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-colors",
                  leaderboardFilter === "patrons" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
                )}
              >
                Patrons &amp; Capital
              </button>
              <button
                onClick={() => setLeaderboardFilter("builders")}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-colors",
                  leaderboardFilter === "builders" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
                )}
              >
                Builders
              </button>
            </div>

            {leaderboardQuery.isLoading && <p className="text-[11.5px] text-text-tertiary">Loading live contributors…</p>}
            {!leaderboardQuery.isLoading && filteredLeaderboard.length === 0 && (
              <p className="text-[11.5px] text-text-tertiary">No contributors yet. Complete quests to claim your rank on the leaderboard.</p>
            )}

            <div className="space-y-2">
              {filteredLeaderboard.slice(0, 10).map((c, idx) => {
                const displayName = c.username ? `@${c.username}` : c.displayName || truncateAddress(c.address);
                const profileHref = c.username ? `/${c.username}` : undefined;

                const scoreColor =
                  leaderboardFilter === "patrons" ? "#FFB13D" : leaderboardFilter === "builders" ? "#60A5FA" : "#1FD487";
                const scoreValue =
                  leaderboardFilter === "patrons"
                    ? c.revenueScore ?? Math.floor((c.launchpadBuyVolumeUsdc || 0) * 0.5)
                    : leaderboardFilter === "builders"
                    ? c.builderScore ?? c.score
                    : c.score;

                const subtitle =
                  leaderboardFilter === "patrons"
                    ? `$${(c.launchpadBuyVolumeUsdc || 0).toFixed(0)} buy vol · ${c.escrowJobsFunded || 0} escrows`
                    : leaderboardFilter === "builders"
                    ? `${c.agentsRegistered || 0} agents · ${c.pipelinesBuilt || 0} pipelines`
                    : `${c.agentsRegistered || 0} agents · $${(c.launchpadBuyVolumeUsdc || 0).toFixed(0)} vol`;

                return (
                  <div key={c.address} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-none">
                    <span className="text-[12px] font-mono font-bold text-text-quaternary w-4 shrink-0">#{idx + 1}</span>
                    <div className="h-7 w-7 rounded-lg bg-bg-surface3 border border-border-strong flex items-center justify-center shrink-0 overflow-hidden">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-text-tertiary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="text-[12px] font-bold text-text-primary hover:text-accent-violet transition-colors font-mono truncate block"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <div className="text-[12px] font-bold text-text-primary font-mono truncate">{displayName}</div>
                      )}
                      <div className="text-[10px] text-text-quaternary font-mono truncate">{subtitle}</div>
                    </div>
                    <span className="font-mono text-[12px] font-extrabold" style={{ color: scoreColor }}>
                      {scoreValue.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

