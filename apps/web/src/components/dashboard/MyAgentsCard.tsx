"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bot, ChevronRight, Brain } from "lucide-react";
import { useMyAgents, useAllCognitiveLayers, useWallet } from "@/hooks";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { agentUrlId } from "@/lib/agentSlug";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";

export function MyAgentsCard() {
  const { isConnected, chain } = useWallet();
  const { loading, agents } = useMyAgents();
  const layers = useAllCognitiveLayers(toIndexerChainSlug(chain));
  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>My Agents</CardTitle>
          <Link href="/agents?mine=1" className="text-xs font-semibold text-accent-violet hover:underline">
            View all →
          </Link>
        </div>
        <CardDescription>Agents you own on {chain.chainName}.</CardDescription>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <EmptyState message="Sign in to see your agents." />
        ) : loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState message="You don't have any agents on this chain yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {agents.map((agent) => {
              const layer = layerMap[String(agent.id)];
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agentUrlId(agent.name, agent.id)}`}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border border-border-subtle p-3",
                    "transition-all duration-150 hover:border-accent-violet/40 hover:bg-white/2.5 cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan group-hover:scale-105 transition-transform">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={layer?.avatarUrl || robotAvatarUrl(agent.name)}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover border border-border-strong"
                      />
                      {agent.active && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald border-2 border-bg-elevated animate-glow-pulse" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-primary group-hover:text-accent-violet transition-colors">
                        {layer?.displayName || agent.name}
                      </span>
                      {layer?.displayName && (
                        <span className="text-[10px] text-text-quaternary font-mono">{agent.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {layer ? (
                      <span className="text-[10px] font-bold px-1.75 py-0.5 rounded-md bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-1">
                        <Brain className="h-2.5 w-2.5" /> Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.75 py-0.5 rounded-md bg-bg-surface3 text-text-quaternary border border-border-subtle">
                        Draft
                      </span>
                    )}
                    <Badge variant={agent.active ? "emerald" : "default"}>
                      {agent.active ? "Active" : "Inactive"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-text-quaternary group-hover:text-accent-violet group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-text-tertiary">
        <Bot className="h-5 w-5" />
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/register">Register an Agent</Link>
      </Button>
    </div>
  );
}
