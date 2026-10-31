"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock, Play, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import type { JobDetail } from "@/hooks/useJob";
import { formatDeadline } from "@/components/marketplace/JobShared";
import { cn } from "@/lib/cn";

export function TaskLifecycleTimeline({ job }: { job: JobDetail }) {
  // Statuses: 0: Open, 1: Active, 2: Completed, 3: Disputed, 4: Cancelled, 5: Resolved
  const status = job.status;

  const currentStep = useMemo(() => {
    if (status === 4) return 0; // Cancelled
    if (status === 0) return 1; // Open (Escrow Funded)
    if (status === 1) {
      // Active (if deliverable submitted, step 3; else step 2)
      return job.deliverableHash && job.deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
        ? 3
        : 2;
    }
    if (status === 2 || status === 5) return 4; // Completed or Resolved
    if (status === 3) return 3; // Disputed
    return 1;
  }, [status, job.deliverableHash]);

  const steps = [
    {
      id: 1,
      title: "Escrow Locked",
      desc: "USDC deposited into non-custodial contract escrow",
      icon: ShieldCheck,
      isDone: currentStep > 1,
      isCurrent: currentStep === 1,
    },
    {
      id: 2,
      title: "Assigned & In Progress",
      desc: job.hiredAgentId === "0" ? "Open bounty awaiting qualifying agent" : `Claimed by Agent #${job.hiredAgentId}`,
      icon: Play,
      isDone: currentStep > 2,
      isCurrent: currentStep === 2,
    },
    {
      id: 3,
      title: "Deliverables Review",
      desc: job.deliverableHash && job.deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? "Deliverable hash anchored on-chain" : "Agent working on task deliverables",
      icon: FileCheck2,
      isDone: currentStep > 3,
      isCurrent: currentStep === 3,
    },
    {
      id: 4,
      title: status === 3 ? "Under Dispute Arbitration" : "Settled & Released",
      desc:
        status === 3
          ? "Referred to staked dispute evaluator pool"
          : status === 2 || status === 5
          ? `Settled with ${job.rating ? `${job.rating}-star` : "verified"} review`
          : "Full payment released to agent & creator",
      icon: status === 3 ? Scale : CheckCircle2,
      isDone: currentStep === 4 && status !== 3,
      isCurrent: currentStep === 4,
      isDispute: status === 3,
    },
  ];

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-violet" />
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-text-primary">
            On-Chain Execution Lifecycle
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-text-quaternary">SLA:</span>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface3 border border-border-strong text-text-secondary">
            {formatDeadline(job.deadline)}
          </span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={cn(
                "rounded-[12px] p-3.5 border transition-all flex flex-col justify-between gap-2.5",
                step.isDone
                  ? "bg-[#0c2a1d]/60 border-[#1FD487]/30 text-text-primary"
                  : step.isCurrent
                  ? step.isDispute
                    ? "bg-[#2e1313]/70 border-[#FF4D4D]/40 text-text-primary"
                    : "bg-accent-dark/80 border-accent-violet/50 text-text-primary shadow-xs"
                  : "bg-bg-surface3/40 border-border-subtle text-text-quaternary opacity-70"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-mono font-bold",
                    step.isDone
                      ? "bg-[#1FD487] text-bg-page"
                      : step.isCurrent
                      ? step.isDispute
                        ? "bg-[#FF4D4D] text-white"
                        : "bg-accent-violet text-white"
                      : "bg-bg-raised text-text-quaternary border border-border-subtle"
                  )}
                >
                  {step.isDone ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" /> : step.id}
                </span>

                <Icon
                  className={cn(
                    "h-4 w-4",
                    step.isDone
                      ? "text-[#1FD487]"
                      : step.isCurrent
                      ? step.isDispute
                        ? "text-[#FF4D4D]"
                        : "text-accent-violet"
                      : "text-text-quaternary"
                  )}
                />
              </div>

              <div>
                <p
                  className={cn(
                    "text-[12px] font-extrabold leading-tight",
                    step.isCurrent ? (step.isDispute ? "text-red-400" : "text-text-primary") : ""
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-text-quaternary mt-1 leading-normal">
                  {step.desc}
                </p>
              </div>

              {step.isCurrent && !step.isDone && (
                <div className="pt-1 border-t border-border-subtle">
                  <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-accent-violet flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-pulse" />
                    <span>In Progress</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
