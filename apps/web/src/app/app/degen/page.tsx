"use client";

import Link from "next/link";
import {
  Flame,
  Bot,
  LineChart,
  TrendingUp,
  Coins,
  Trophy,
  Dices,
  ArrowRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useMyAgents, useWallet, useDegenConfig, useDegenPositions, type MyAgentSummary } from "@/hooks";
import { toIndexerChainSlug, type IndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";

const VENUE_GATEWAYS = [
  {
    title: "Perpetual Markets",
    href: "/degen/perpetuals",
    icon: LineChart,
    badge: "50x Leverage",
    desc: "Autonomous and manual perpetual trading with live candlestick charts and orderbooks on Monad.",
    color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20",
    textColor: "text-blue-400",
  },
  {
    title: "Prediction Markets",
    href: "/degen/predictions",
    icon: TrendingUp,
    badge: "Polymarket Live",
    desc: "Trade live probability shares across crypto, tokens, milestones, and Layer 2 events on Monad.",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20",
    textColor: "text-[#1FD487]",
  },
  {
    title: "Memecoin Launches",
    href: "/degen/memecoins",
    icon: Coins,
    badge: "Auto-Sniper",
    desc: "Snipe new bonding-curve launches and track graduation progress towards Xero AMM liquidity burn.",
    color: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
    textColor: "text-amber-400",
  },
  {
    title: "Sportsbook Hub",
    href: "/degen/sportsbook",
    icon: Trophy,
    badge: "Coming Soon",
    desc: "Single and parlay betting on live global fixtures. Coming soon.",
    color: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
    textColor: "text-purple-400",
  },
  {
    title: "Casino Arcade",
    href: "/degen/casino",
    icon: Dices,
    badge: "Coming Soon",
    desc: "Moonshot Crash, Crypto Dice, and Roulette. Coming soon.",
    color: "from-rose-500/10 to-red-500/10 border-rose-500/20",
    textColor: "text-rose-400",
  },
];

function DegenAgentRow({ chain, agent }: { chain: IndexerChainSlug; agent: MyAgentSummary }) {
  const { config } = useDegenConfig(chain, agent.id);
  const { positions } = useDegenPositions(chain, agent.id);

  const totalPnl = positions.reduce((sum, p) => sum + Number(p.realizedPnlUsdc), 0);
  const openCount = positions.filter((p) => Number(p.netSizeUsdc) !== 0).length;

  return (
    <Link
      href={`/agents/${agentUrlId(agent.name, agent.id)}`}
      className="flex items-center justify-between px-5 py-4 border-b border-border-subtle last:border-none hover:bg-bg-raised transition-colors"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={robotAvatarUrl(agent.name)}
          alt=""
          className="h-9 w-9 rounded-lg border border-border-strong shrink-0 object-cover bg-bg-surface3"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold text-text-primary truncate flex items-center gap-2">
            <span>{agent.name}</span>
            <span className="text-[10px] font-mono text-text-quaternary font-normal">#{agent.id}</span>
          </div>
          <div className="text-[11px] text-text-quaternary flex items-center gap-2 mt-0.5">
            {config ? (
              <>
                <span className="font-mono text-accent-violet font-bold">{config.mode}</span>
                <span>•</span>
                <span>{config.allowedVenues.length} venue{config.allowedVenues.length === 1 ? "" : "s"} enabled</span>
                <span>•</span>
                <span>{openCount} open position{openCount === 1 ? "" : "s"}</span>
              </>
            ) : (
              "Not configured for trading"
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {config?.killSwitchEnabled && (
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#2e1313] text-red-400 border border-red-500/20">
            Halted
          </span>
        )}
        {config && (
          <div className="text-right">
            <div className={cn("text-[14px] font-extrabold font-mono", totalPnl >= 0 ? "text-[#1FD487]" : "text-red-400")}>
              {totalPnl >= 0 ? "+" : ""}
              ${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[9.5px] text-text-quaternary uppercase font-bold">Realized PnL</div>
          </div>
        )}
        <ArrowRight className="h-4 w-4 text-text-quaternary" />
      </div>
    </Link>
  );
}

export default function DegenPage() {
  const { chain: activeChain } = useWallet();
  const chainSlug = toIndexerChainSlug(activeChain);
  const { agents: myAgents, loading } = useMyAgents();

  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* 5 Venue Gateways Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {VENUE_GATEWAYS.map((v) => {
          const Icon = v.icon;

          return (
            <Link
              key={v.href}
              href={v.href}
              className={cn(
                "p-5 rounded-[14px] border bg-bg-elevated hover:bg-bg-raised transition-all flex flex-col justify-between gap-3 shadow-xs hover:border-accent-violet/40 cursor-pointer group",
                v.color,
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", v.textColor)} />
                    <h3 className="text-[14.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                      {v.title}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-bg-surface3 border border-border-strong text-text-secondary">
                    {v.badge}
                  </span>
                </div>
                <p className="text-[12px] text-text-tertiary leading-relaxed">{v.desc}</p>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-accent-violet pt-2 border-t border-border-subtle/50">
                <span>Enter Venue</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Your Fleet Trading Overview */}
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent-violet" />
            <span className="text-[14px] font-extrabold text-text-primary">Your Agent Fleet</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25">
              {myAgents.length} Agent{myAgents.length === 1 ? "" : "s"}
            </span>
          </div>
          <span className="text-[11px] text-[#1FD487] font-mono font-bold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
            <span>Monad Active</span>
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 bg-bg-raised rounded-lg animate-pulse" />
            ))}
          </div>
        ) : myAgents.length === 0 ? (
          <div className="p-12 text-center">
            <Bot className="h-10 w-10 text-accent-violet mx-auto mb-2 opacity-80" />
            <p className="text-[13px] font-bold text-text-primary mb-1">No agents registered on Monad yet</p>
            <p className="text-[12px] text-text-quaternary mb-4 max-w-90 mx-auto">
              Register an agent to deploy autonomous perpetuals, prediction, launchpad, and sportsbook strategies.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet hover:text-white transition-all shadow-xs"
            >
              Register an Agent
            </Link>
          </div>
        ) : (
          myAgents.map((agent) => <DegenAgentRow key={agent.id} chain={chainSlug} agent={agent} />)
        )}
      </div>
    </div>
  );
}
