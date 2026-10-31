"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bot,
  Brain,
  ArrowRight,
  ShieldCheck,
  Plus,
  Clock,
  ExternalLink,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";
import { useMyAgents, useAllCognitiveLayers, useAllHostedRuntimeConfigs, useWallet } from "@/hooks";
import { agentUrlId } from "@/lib/agentSlug";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatUsdc, formatBps, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Skeleton, Badge, Button } from "@/components/ui";

const AGENTS_PER_PAGE = 2;

export function MyAgentsFleetGrid() {
  const { isConnected, chain } = useWallet();
  const { loading, agents, error, retry } = useMyAgents();
  const [agentPage, setAgentPage] = useState(1);
  const chainSlug = toIndexerChainSlug(chain);
  const layers = useAllCognitiveLayers(chainSlug);
  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const runtimeConfigs = useAllHostedRuntimeConfigs(chainSlug);
  const runtimeMap = useMemo(() => Object.fromEntries(runtimeConfigs.map((r) => [r.agentChainId, r])), [runtimeConfigs]);

  const totalAgentPages = Math.max(1, Math.ceil(agents.length / AGENTS_PER_PAGE));
  const paginatedAgents = useMemo(() => {
    const start = (agentPage - 1) * AGENTS_PER_PAGE;
    return agents.slice(start, start + AGENTS_PER_PAGE);
  }, [agents, agentPage]);

  return (
    <div className="flex flex-col gap-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-emerald/15 text-emerald">
            <Bot className="h-3 w-3" />
          </div>
          <h2 className="text-[14px] font-extrabold text-text-primary tracking-tight">
            Your Agents
          </h2>
          {isConnected && agents.length > 0 && (
            <span className="text-[11px] font-mono font-bold text-text-quaternary">
              ({agents.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected && totalAgentPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={agentPage === 1}
                onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                ←
              </button>
              <span className="text-[10.5px] font-mono text-text-quaternary px-1">
                {agentPage}/{totalAgentPages}
              </span>
              <button
                type="button"
                disabled={agentPage === totalAgentPages}
                onClick={() => setAgentPage((p) => Math.min(totalAgentPages, p + 1))}
                className="px-2 py-0.5 rounded text-[11px] font-semibold border border-border-subtle bg-bg-surface hover:bg-bg-raised text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                →
              </button>
            </div>
          )}

          <Link
            href="/register"
            className="flex items-center gap-1 text-[11.5px] font-bold text-accent-violet hover:underline px-2.5 py-1 rounded-md bg-accent-dark/40 border border-accent-violet/20"
          >
            <Plus className="h-3 w-3" />
            <span>New Agent</span>
          </Link>
          {isConnected && agents.length > 0 && (
            <Link
              href="/agents?mine=1"
              className="text-[11.5px] font-semibold text-text-tertiary hover:text-text-primary transition-colors"
            >
              View all →
            </Link>
          )}
        </div>
      </div>

      {/* State Rendering */}
      {!isConnected ? (
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface3 text-text-tertiary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-text-primary">Sign In to View Your Agents</div>
            <p className="text-[12px] text-text-tertiary mt-1 max-w-sm">
              Sign in to inspect your autonomous agents, review operating balances, and manage cognitive parameters on {chain.chainName}.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Button asChild size="sm" variant="secondary">
              <Link href="/agents">Explore Agent Directory</Link>
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red/30 bg-red/5 p-6 text-center flex flex-col items-center justify-center gap-2">
          <div className="text-[13px] font-bold text-red">Failed to load agents</div>
          <p className="text-[11.5px] text-text-tertiary">There was an issue querying the agent indexer on {chain.chainName}.</p>
          <Button size="sm" variant="outline" onClick={retry} className="mt-1">
            Retry
          </Button>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-8 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface3 text-text-tertiary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[14px] font-bold text-text-primary">Your autonomous workforce starts here</div>
            <p className="text-[12px] text-text-tertiary mt-1 max-w-md">
              You haven't registered any autonomous agents on {chain.chainName} yet. Deploy your first agent with smart custody wallet and cognitive runtime.
            </p>
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <Button asChild size="sm">
              <Link href="/register">
                <Plus className="h-3.5 w-3.5 mr-1" /> Register Agent
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/agents">Explore Agent Directory</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Top 1 Single Agent Card (< sm) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {agents.slice(0, 1).map((agent) => {
              const layer = layerMap[String(agent.id)];
              const runtime = runtimeMap[String(agent.id)];
              const revenueMicros = BigInt(agent.usdcRevenue || "0");

              return (
                <div
                  key={agent.id}
                  className="rounded-xl border border-border-subtle bg-bg-elevated p-3.5 flex flex-col gap-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={layer?.avatarUrl || robotAvatarUrl(agent.name)}
                          alt={agent.name}
                          className="h-10 w-10 rounded-lg object-cover border border-border-strong bg-bg-surface3 shrink-0"
                        />
                        {agent.active && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald border-2 border-bg-elevated animate-pulse" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                          className="text-[14px] font-bold text-text-primary hover:text-accent-violet transition-colors truncate block"
                        >
                          {layer?.displayName || agent.name}
                        </Link>
                        <div className="text-[10.5px] font-mono text-text-quaternary">
                          ID: #{agent.numericId} • Tier {agent.tier}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/terminal?agent=${agent.id}`}
                        title={`Open Terminal for @${agent.name}`}
                        className="p-2 rounded-lg text-accent-orange bg-accent-orange/10 border border-accent-orange/25"
                      >
                        <Terminal className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-text-secondary bg-bg-surface border border-border-strong"
                      >
                        Studio →
                      </Link>
                    </div>
                  </div>

                  {/* Proactive State */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-bg-surface border border-border-subtle text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-emerald font-bold truncate">
                        {agent.active ? (runtime?.mode === "HOSTED" ? "Watching jobs & mempool" : "Endpoint active") : "Agent idle"}
                      </span>
                    </div>
                    <div className="text-text-tertiary shrink-0">
                      {formatUsdc(revenueMicros)}
                    </div>
                  </div>
                </div>
              );
            })}

            {agents.length > 1 && (
              <Link
                href="/agents?mine=1"
                className="w-full py-2.5 rounded-xl bg-bg-surface text-text-secondary hover:text-text-primary border border-border-strong text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>View all {agents.length} agents</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {/* Desktop: Paginated Agent Fleet (>= sm) */}
          <div className="hidden sm:flex flex-col gap-2.5">
            {paginatedAgents.map((agent) => {
              const layer = layerMap[String(agent.id)];
              const runtime = runtimeMap[String(agent.id)];
              const revenueMicros = BigInt(agent.usdcRevenue || "0");

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "group relative rounded-xl border border-border-subtle bg-bg-elevated p-3.5 sm:p-4",
                    "transition-all duration-150 hover:border-border-strong hover:bg-bg-raised/70 shadow-xs",
                    "flex flex-col gap-3",
                  )}
                >
                  {/* Top Row: Identity, Badges, Direct Link */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={layer?.avatarUrl || robotAvatarUrl(agent.name)}
                          alt={agent.name}
                          className="h-10 w-10 rounded-lg object-cover border border-border-strong bg-bg-surface3 shrink-0"
                        />
                        {agent.active && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald border-2 border-bg-elevated animate-pulse" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                            className="text-[14px] font-bold text-text-primary hover:text-accent-violet transition-colors flex items-center gap-1"
                          >
                            <span>{layer?.displayName || agent.name}</span>
                          </Link>

                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.75 py-0.5 rounded-[4px] border",
                              agent.active
                                ? "bg-emerald/15 text-emerald border-emerald/20"
                                : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                            )}
                          >
                            {agent.active ? "Active" : "Inactive"}
                          </span>

                          {runtime?.mode === "HOSTED" ? (
                            <span className="text-[10px] font-bold px-1.75 py-0.5 rounded-[4px] bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-1">
                              <Cpu className="h-2.5 w-2.5" /> Hosted Runtime
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.75 py-0.5 rounded-[4px] bg-bg-surface3 text-text-tertiary border border-border-subtle">
                              BYO Endpoint
                            </span>
                          )}

                          {layer && (
                            <span className="text-[10px] font-bold px-1.75 py-0.5 rounded-[4px] bg-purple/15 text-purple border border-purple/20 flex items-center gap-1">
                              <Brain className="h-2.5 w-2.5" /> Cognitive Brain
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-text-quaternary mt-0.5">
                          ID: #{agent.numericId} • Tier {agent.tier}
                        </div>
                      </div>
                    </div>

                    {/* Quick CTAs: Terminal & Studio */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Link
                        href={`/terminal?agent=${agent.id}`}
                        title={`Open Terminal for @${agent.name}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-accent-orange bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/25 transition-colors cursor-pointer"
                      >
                        <Terminal className="h-3 w-3" />
                        <span>Terminal</span>
                      </Link>

                      <Link
                        href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold text-text-secondary bg-bg-surface hover:bg-bg-surface3 hover:text-text-primary border border-border-strong transition-colors cursor-pointer"
                      >
                        <span>Studio</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Proactive State Strip */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-bg-surface border border-border-subtle text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-text-quaternary shrink-0">Current state:</span>
                      <span className="text-emerald font-bold truncate">
                        {agent.active ? (runtime?.mode === "HOSTED" ? "Watching jobs & mempool" : "Endpoint responding") : "Agent idle"}
                      </span>
                    </div>
                    <div className="text-text-tertiary shrink-0">
                      {agent.lastJobAt ? formatRelativeTime(agent.lastJobAt) : "Active now"}
                    </div>
                  </div>

                  {/* Bottom Row: Real Data Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-quaternary">
                        Operating Wallet
                      </div>
                      <div className="font-mono text-[13px] font-bold text-text-primary mt-0.5">
                        {formatUsdc(revenueMicros)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-quaternary">
                        Tasks Completed
                      </div>
                      <div className="font-mono text-[13px] font-bold text-text-secondary mt-0.5">
                        {agent.jobsCompleted} tasks
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-quaternary">
                        Reputation Score
                      </div>
                      <div className="font-mono text-[13px] font-bold text-emerald mt-0.5">
                        {formatBps(agent.reputationBps)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-quaternary">
                        Cognitive Tier
                      </div>
                      <div className="font-mono text-[12px] text-accent-violet font-bold mt-0.5">
                        Tier {agent.tier} (Monad)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
