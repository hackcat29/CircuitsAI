"use client";

import Link from "next/link";
import { Bot, ArrowUpRight, ShieldCheck, Coins, MessageSquare, Cpu, Clock, Users } from "lucide-react";
import type { JobDetail } from "@/hooks/useJob";
import type { CognitiveLayer, LaunchpadListItem } from "@/hooks";
import { robotAvatarUrl } from "@/lib/avatar";

export function TaskAgentCard({
  job,
  layer,
  launch,
}: {
  job: JobDetail;
  layer?: CognitiveLayer | null;
  launch?: LaunchpadListItem;
}) {
  const isOpenJob = job.hiredAgentId === "0";
  const avatar = layer?.avatarUrl || robotAvatarUrl(layer?.displayName || job.hiredAgentId);
  const displayName = layer?.displayName || (isOpenJob ? "Open Bounty" : `Agent #${job.hiredAgentId}`);

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 sm:p-5.5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent-dark text-accent-violet border border-accent-violet/30">
            {isOpenJob ? <Users className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>
          <div>
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-text-primary">
              {isOpenJob ? "Agent Assignment" : "Assigned Agent"}
            </h3>
            <p className="text-[11px] text-text-tertiary">
              {isOpenJob ? "Open task available for claim" : "Autonomous agent execution"}
            </p>
          </div>
        </div>

        {!isOpenJob && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>Assigned</span>
          </span>
        )}
      </div>

      {!isOpenJob ? (
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt=""
              className="h-12 w-12 rounded-[12px] border border-border-strong object-cover bg-bg-surface3 shrink-0 shadow-2xs"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-text-primary truncate">{displayName}</span>
                <span className="text-[10px] font-mono text-text-quaternary">#{job.hiredAgentId}</span>
              </div>
              <p className="text-[11px] text-text-quaternary line-clamp-1 mt-0.5">
                {layer?.worldview || "Autonomous agent registered on Circuits."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-[10px] bg-bg-surface3/40 border border-border-subtle">
              <span className="text-[10px] uppercase font-bold text-text-quaternary block flex items-center gap-1">
                <Cpu className="h-3 w-3 text-accent-violet" />
                <span>Model</span>
              </span>
              <span className="font-mono font-bold text-text-primary mt-0.5 block truncate">
                {layer?.foundationModel || "llama-3.3-70b"}
              </span>
            </div>

            <div className="p-2.5 rounded-[10px] bg-bg-surface3/40 border border-border-subtle">
              <span className="text-[10px] uppercase font-bold text-text-quaternary block flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#1FD487]" />
                <span>Target SLA</span>
              </span>
              <span className="font-mono font-bold text-text-primary mt-0.5 block truncate">
                {layer?.slaHours ? `${layer.slaHours}h Response` : "Standard SLA"}
              </span>
            </div>
          </div>

          {launch && (
            <div className="rounded-[10px] bg-accent-dark/40 border border-accent-violet/25 p-2.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-accent-violet">
                <Coins className="h-3.5 w-3.5" />
                <span>Agent Token: ${launch.symbol}</span>
              </span>
              <span className="text-[11px] font-mono text-text-tertiary">
                {launch.name}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/agents/${job.hiredAgentId}`}
              className="flex-1 py-2 px-3 rounded-[9px] bg-bg-surface3 border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1"
            >
              <span>View Agent</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>

            <Link
              href={`/app/terminal?agent=${job.hiredAgentId}`}
              className="py-2 px-3 rounded-[9px] bg-accent-dark border border-accent-violet/30 text-xs font-bold text-accent-violet hover:bg-accent-violet/20 transition-colors flex items-center justify-center gap-1"
            >
              <MessageSquare className="h-3 w-3" />
              <span>Terminal</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-[12px] bg-bg-surface3/40 border border-border-subtle space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
            <span className="h-2 w-2 rounded-full bg-amber" />
            <span>Open for Agent Claims</span>
          </div>
          <p className="text-[11.5px] text-text-secondary leading-relaxed">
            No agent has claimed this task yet. Qualifying agent operators or autonomous runtimes can accept this job from the console.
          </p>
        </div>
      )}
    </div>
  );
}
