"use client";

import type React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { useMyAgents, useWallet, useDegenConfig, useDegenPositions, useDegenOrders, type MyAgentSummary, type DegenVenue } from "@/hooks";
import { toIndexerChainSlug, type IndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";

/** One row per owned agent, scoped to a single venue — same "each instance owns its own hook
 * calls" shape as /degen's own DegenAgentRow (React's rules of hooks rule out fanning this out
 * from the parent), just filtered down to `venue` since positions/orders are fetched per-agent
 * across all venues, not per-venue server-side. */
function VenueAgentRow({ chain, agent, venue }: { chain: IndexerChainSlug; agent: MyAgentSummary; venue: DegenVenue }) {
  const { config } = useDegenConfig(chain, agent.id);
  const { positions } = useDegenPositions(chain, agent.id);
  const { orders } = useDegenOrders(chain, agent.id);

  const enabled = Boolean(config?.allowedVenues.includes(venue));
  const venuePositions = positions.filter((p) => p.venue === venue);
  const venueOrders = orders.filter((o) => o.venue === venue).slice(0, 3);
  const totalPnl = venuePositions.reduce((sum, p) => sum + Number(p.realizedPnlUsdc), 0);
  const openCount = venuePositions.filter((p) => Number(p.netSizeUsdc) !== 0).length;

  return (
    <div className="border-b border-border-subtle last:border-none">
      <Link href={`/agents/${agentUrlId(agent.name, agent.id)}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-bg-raised transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- deterministic per-agent DiceBear URL */}
          <img src={robotAvatarUrl(agent.name)} alt="" className="h-8 w-8 rounded-lg border border-border-strong shrink-0 object-cover bg-bg-surface3" />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-text-primary truncate">{agent.name}</div>
            <div className="text-[10.5px] text-text-quaternary">
              {!config ? "Not configured for trading" : !enabled ? "Not enabled for this venue" : `${config.mode} · ${openCount} open`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {enabled && config?.killSwitchEnabled && (
            <span className="text-[9.5px] font-bold px-1.75 py-0.5 rounded-full bg-[#2e1313] text-red-400 border border-red-500/20">Halted</span>
          )}
          {enabled ? (
            <div className={cn("text-[13px] font-extrabold font-mono", totalPnl >= 0 ? "text-[#1FD487]" : "text-red-400")}>
              {totalPnl >= 0 ? "+" : ""}
              {totalPnl.toFixed(2)}
            </div>
          ) : (
            <span className="text-[10.5px] font-bold text-accent-violet">Enable →</span>
          )}
        </div>
      </Link>
      {enabled && venueOrders.length > 0 && (
        <div className="px-5 pb-3 -mt-1 space-y-1">
          {venueOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between text-[10.5px] text-text-quaternary">
              <span>
                {o.action} <span className="font-mono">{o.market}</span> · {formatRelativeTime(o.createdAt)}
              </span>
              <span className={cn("font-bold", o.status === "FILLED" ? "text-[#1FD487]" : o.status === "REJECTED" ? "text-text-quaternary" : "text-red-400")}>{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VenuePage({ venue, icon, title, description }: { venue: DegenVenue; icon?: React.ReactNode; title: string; description: string }) {
  const { chain: activeChain } = useWallet();
  const chainSlug = toIndexerChainSlug(activeChain);
  const { agents: myAgents, loading } = useMyAgents();

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
      <div
        className="rounded-[14px] px-7.5 py-7 mb-5 flex justify-between items-center gap-6 border border-border-subtle bg-bg-elevated shadow-xs"
      >
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight mb-2 flex items-center gap-2">
            {icon}
            <span>{title}</span>
          </h2>
          <p className="text-[12.5px] text-text-tertiary leading-[1.6] max-w-130">{description}</p>
        </div>
      </div>

      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Your Agents</div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-bg-raised rounded-lg animate-pulse" />
            ))}
          </div>
        ) : myAgents.length === 0 ? (
          <div className="p-10 text-center">
            <Bot className="h-8 w-8 text-accent-violet mx-auto mb-2" />
            <p className="text-[12px] text-text-quaternary mb-4">You don&apos;t own any agents on this chain yet.</p>
            <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-colors">
              Register an Agent
            </Link>
          </div>
        ) : (
          myAgents.map((agent) => <VenueAgentRow key={agent.id} chain={chainSlug} agent={agent} venue={venue} />)
        )}
      </div>
    </div>
  );
}
