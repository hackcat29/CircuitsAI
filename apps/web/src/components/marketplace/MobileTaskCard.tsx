"use client";

import { useRouter } from "next/navigation";
import { Clock, Zap, Users, ArrowRight } from "lucide-react";
import type { MarketplaceJob, CognitiveLayer, RankedAgent } from "@/hooks";
import { formatUsdc } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { STATUS_MAP, formatDeadline } from "@/components/marketplace/JobShared";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

export function MobileTaskCard({
  job,
  agent,
  layer,
  title,
  employerName,
}: {
  job: MarketplaceJob;
  agent?: RankedAgent;
  layer?: CognitiveLayer;
  title?: string;
  employerName?: string;
}) {
  const router = useRouter();
  const statusInfo = STATUS_MAP[job.status] ?? STATUS_MAP[0];
  const isOpenJob = job.hiredAgentId === "0";

  const displayName = layer?.displayName || agent?.name || (isOpenJob ? "Open Bounty" : `Agent #${job.hiredAgentId}`);
  const avatar = layer?.avatarUrl || robotAvatarUrl(agent?.name || job.hiredAgentId);
  const headerText = title || displayName;

  return (
    <div
      onClick={() => router.push(`/app/marketplace/${job.id}${job.chain ? `?chain=${job.chain}` : ""}`)}
      className="rounded-[16px] border border-border-subtle bg-bg-elevated p-3.5 sm:p-4 shadow-2xs active:scale-[0.99] transition-all cursor-pointer hover:border-accent-violet/40 flex flex-col gap-3"
    >
      {/* Top Row: Identity, Task ID & Status Badge */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isOpenJob ? (
            <div className="h-10 w-10 rounded-[11px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet shrink-0">
              <Users className="h-5 w-5" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="h-10 w-10 rounded-[11px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-text-primary truncate" title={headerText}>
                {headerText}
              </span>
              {isOpenJob ? (
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber/15 text-amber border border-amber/25 shrink-0">
                  Open
                </span>
              ) : (
                <span className="text-[9.5px] font-mono font-bold text-accent-violet shrink-0">
                  #{job.hiredAgentId}
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-text-quaternary font-mono truncate mt-0.5">
              <span>Task #{job.id} • Posted by </span>
              {job.employerAgentId && job.employerAgentId !== "0" ? (
                <span className="font-semibold text-text-primary">
                  {employerName || `Agent #${job.employerAgentId}`}
                </span>
              ) : (
                <UserAddressLink address={job.employer} className="text-text-secondary" />
              )}
            </div>
          </div>
        </div>

        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: statusInfo.bg, color: statusInfo.color }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Financial & Milestone SLA Strip */}
      <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-2.5 flex items-center justify-between gap-2">
        <div>
          <span className="text-[9.5px] uppercase font-bold text-text-quaternary block">
            Escrow Budget
          </span>
          <span className="text-[15px] font-black font-mono text-[#1FD487]">
            {formatUsdc(job.budget)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[9.5px] uppercase font-bold text-text-quaternary block">
            SLA Deadline
          </span>
          <span className="text-[11px] font-mono font-bold text-text-secondary flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3 text-accent-violet" />
            <span>{formatDeadline(job.deadline)}</span>
          </span>
        </div>
      </div>

      {/* Protocol Badges & Action Trigger */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-text-secondary">
            Circuits
          </span>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" /> x402
          </span>
        </div>

        <div className="text-xs font-bold text-accent-violet flex items-center gap-1">
          <span>View Task</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
