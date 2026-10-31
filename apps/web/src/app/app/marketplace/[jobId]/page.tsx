"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui";
import { useJob, useMyAgents, useCognitiveLayer, useLaunchpadList, useWallet } from "@/hooks";
import { STATUS_MAP, truncateAddr } from "@/components/marketplace/JobShared";
import { formatUsdc } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { toIndexerChainSlug, fromIndexerChainSlug, type IndexerChainSlug } from "@/lib/chains";
import { MessageSquare, ShieldCheck, Scale, ExternalLink } from "lucide-react";
import { TaskLifecycleTimeline } from "@/components/marketplace/TaskLifecycleTimeline";
import { TaskSpecificationCard } from "@/components/marketplace/TaskSpecificationCard";
import { TaskEscrowSplitCard } from "@/components/marketplace/TaskEscrowSplitCard";
import { TaskAgentCard } from "@/components/marketplace/TaskAgentCard";
import { TaskDeliverablesConsole } from "@/components/marketplace/TaskDeliverablesConsole";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

function JobDetailSkeleton() {
  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-17.5 space-y-4">
      <Skeleton className="h-10 w-48 rounded-lg" />
      <Skeleton className="h-64 rounded-[16px]" />
    </div>
  );
}

function JobDetailPageInner() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const queryChain = searchParams.get("chain") ?? undefined;
  const { chain } = useWallet();
  const { job, loading, refetch } = useJob(jobId, queryChain);
  const effectiveChainSlug = (job?.chain as IndexerChainSlug) || toIndexerChainSlug(chain);
  const { layer } = useCognitiveLayer(effectiveChainSlug, job?.hiredAgentId && job.hiredAgentId !== "0" ? job.hiredAgentId : undefined);
  const isAgentEmployer = Boolean(job?.employerAgentId && job.employerAgentId !== "0");
  const { layer: employerLayer } = useCognitiveLayer(effectiveChainSlug, isAgentEmployer ? job?.employerAgentId : undefined);
  const { launches } = useLaunchpadList("top", 100);
  const launch = launches.find((l) => l.agentChainId === job?.hiredAgentId);
  const employerLaunch = launches.find((l) => l.agentChainId === job?.employerAgentId);

  if (loading && !job) {
    return <JobDetailSkeleton />;
  }

  if (!job) {
    return (
      <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-17.5 text-center space-y-3">
        <p className="text-sm font-bold text-text-secondary">Task not found.</p>
        <Link href="/app/marketplace" className="inline-block text-[12px] text-accent-violet font-semibold hover:underline">
          ← Back to Task Market
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[job.status] ?? STATUS_MAP[0];
  const isOpenJob = job.hiredAgentId === "0";
  const avatar = layer?.avatarUrl || robotAvatarUrl(layer?.displayName || job.hiredAgentId);
  const displayName = layer?.displayName || (isOpenJob ? "Open Bounty (Competitive Claim)" : `Agent #${job.hiredAgentId}`);
  const employerDisplayName =
    employerLayer?.displayName ||
    employerLaunch?.name ||
    (job?.employerAgentId && job.employerAgentId !== "0" ? `Agent #${job.employerAgentId}` : null);

  const taskTitle = job.description
    ? job.description.split("\n")[0].replace(/^#+\s*/, "").trim() || `Task #${job.id}`
    : `Task #${job.id}`;

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-5.5 pb-17.5 space-y-6">
      {/* Top Breadcrumb & Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href="/app/marketplace"
          className="inline-flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-primary font-semibold transition-colors"
        >
          <span>← Back to Task Market</span>
        </Link>

        <div className="flex items-center gap-2">
          {job && (
            <a
              href={`${(job.chain ? fromIndexerChainSlug(job.chain as IndexerChainSlug)?.explorerUrl : chain.explorerUrl)}/tx/${job.taskHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-mono text-text-tertiary hover:text-text-primary flex items-center gap-1 bg-bg-surface3 px-2.5 py-1 rounded-[7px] border border-border-subtle transition-colors"
            >
              <span>Contract Tx</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-bg-elevated border border-border-subtle rounded-[18px] p-5 sm:p-6 shadow-xs flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            className="h-16 w-16 shrink-0 rounded-[14px] border border-border-strong object-cover bg-bg-surface3 shadow-xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] sm:text-[22px] font-black text-text-primary font-sans tracking-tight">
                {taskTitle}
              </h1>
              <span className="text-xs text-text-tertiary font-mono">
                #{job.id}
              </span>
              <span
                className="text-[11px] font-bold px-3 py-1 rounded-full shrink-0 whitespace-nowrap"
                style={{ background: statusInfo.bg, color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <span className="text-[12px] font-mono font-bold px-2.5 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                {formatUsdc(job.budget)} Escrow
              </span>
            </div>
            <div className="text-[12px] text-text-quaternary mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>Assigned to:</span>
              <span className="font-bold text-text-primary">{displayName}</span>
              <span>•</span>
              <span>Posted by:</span>
              {job.employerAgentId && job.employerAgentId !== "0" ? (
                <span>
                  <Link
                    href={`/agents/${job.employerAgentId}`}
                    className="font-bold text-text-primary hover:text-accent-violet hover:underline"
                  >
                    {employerDisplayName}
                  </Link>{" "}
                  <span className="text-text-quaternary">(via <UserAddressLink address={job.employer} className="text-text-secondary" />)</span>
                </span>
              ) : (
                <UserAddressLink address={job.employer} className="text-text-secondary" />
              )}
            </div>
          </div>
        </div>

        {!isOpenJob && (
          <Link
            href={`/app/terminal?agent=${job.hiredAgentId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold hover:bg-accent-violet hover:text-white transition-all shadow-xs"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Brief Agent in Terminal</span>
          </Link>
        )}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
        {/* Left Column: Lifecycle, Specification & Deliverables */}
        <div className="space-y-5 min-w-0">
          <TaskLifecycleTimeline job={job} />
          <TaskSpecificationCard job={job} />
          <TaskDeliverablesConsole job={job} onChanged={refetch} />
        </div>

        {/* Right Column: Escrow Economics, Agent Card & Dispute Guard */}
        <div className="space-y-5 min-w-0">
          <TaskEscrowSplitCard job={job} />
          <TaskAgentCard job={job} layer={layer} launch={launch} />

          {/* On-Chain Dispute Arbitration Card */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-text-primary font-extrabold text-[12.5px] uppercase tracking-wider">
              <Scale className="h-4 w-4 text-accent-violet" />
              <span>Dispute Protection</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Escrow is locked on-chain until deliverables are accepted. Either party can submit a dispute for staked community arbitration if needed.
            </p>
            <Link
              href={`/disputes?jobId=${job.id}`}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-[9px] bg-bg-surface3 border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              <span>Dispute Console</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={<JobDetailSkeleton />}>
      <JobDetailPageInner />
    </Suspense>
  );
}

