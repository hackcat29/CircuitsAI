"use client";

import { useState } from "react";
import {
  Workflow,
  GitMerge,
  Cpu,
  Scale,
  Edit2,
  Trash2,
  Plus,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { robotAvatarUrl } from "@/lib/avatar";
import type { Pipeline, PipelineStep } from "@/hooks";

interface PipelineVisualDagProps {
  pipeline: Pipeline;
  onAddStep: () => void;
  onEditStep: (step: PipelineStep) => void;
  onDeleteStep: (stepId: string) => void;
  onSelectStepLogs?: (step: PipelineStep) => void;
  isDraft: boolean;
  explorerUrlBase?: string;
}

const ROLE_STYLES = {
  ORCHESTRATOR: { bg: "#FF5C2815", border: "#FF5C2840", text: "#FF5C28", icon: GitMerge },
  WORKER: { bg: "#1FD48715", border: "#1FD48740", text: "#1FD487", icon: Cpu },
  EVALUATOR: { bg: "#A78BFA15", border: "#A78BFA40", text: "#A78BFA", icon: Scale },
};

const STATUS_ICONS = {
  PENDING: { icon: Clock, color: "text-text-quaternary", text: "Waiting" },
  ATTEMPTING: { icon: RefreshCw, color: "text-[#F5A623] animate-spin", text: "Signing…" },
  SUBMITTED: { icon: Activity, color: "text-[#F5A623] animate-pulse", text: "On-Chain" },
  COMPLETED: { icon: CheckCircle2, color: "text-[#1FD487]", text: "Completed" },
  FAILED: { icon: AlertCircle, color: "text-red-400", text: "Failed" },
};

export function PipelineVisualDag({
  pipeline,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onSelectStepLogs,
  isDraft,
  explorerUrlBase,
}: PipelineVisualDagProps) {
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);

  const isSerial = pipeline.executionMode === "SERIAL";

  return (
    <div className="w-full flex flex-col items-center py-6 px-4 select-none">
      {/* Workflow Trigger Root Node */}
      <div className="flex flex-col items-center">
        <div className="px-4 py-2 rounded-full bg-bg-elevated border border-border-strong text-[11px] font-bold text-text-secondary flex items-center gap-2 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#1FD487] animate-pulse" />
          <Workflow className="h-3.5 w-3.5 text-accent-violet" />
          <span>Pipeline Trigger: {isSerial ? "Sequential Step Execution" : "Parallel Fleet Dispatch"}</span>
        </div>

        {/* Downward Connector Line */}
        <div className="flex flex-col items-center my-1">
          <div className="w-0.5 h-6 bg-accent-violet/60" />
          <div className="w-2 h-2 rounded-full bg-accent-violet ring-4 ring-accent-violet/20" />
          <div className="w-0.5 h-4 bg-accent-violet/60" />
        </div>
      </div>

      {/* Main Node Graph */}
      {pipeline.steps.length === 0 ? (
        <div className="p-8 rounded-[16px] border border-dashed border-border-strong bg-bg-surface3/20 text-center max-w-md w-full flex flex-col items-center gap-3">
          <Workflow className="h-8 w-8 text-text-quaternary" />
          <div>
            <h4 className="text-[13px] font-bold text-text-primary">Empty Workflow Graph</h4>
            <p className="text-[11.5px] text-text-tertiary mt-0.5">Add agent nodes to visualize and run multi-agent pipelines.</p>
          </div>
          {isDraft && (
            <button
              type="button"
              onClick={onAddStep}
              className="px-4 py-2 rounded-full bg-accent-violet text-white text-[11.5px] font-extrabold hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add First Node</span>
            </button>
          )}
        </div>
      ) : (
        <div className={cn("w-full max-w-3xl", isSerial ? "flex flex-col items-center" : "grid grid-cols-1 md:grid-cols-2 gap-4")}>
          {pipeline.steps.map((step, idx) => {
            const roleMeta = ROLE_STYLES[step.role] ?? ROLE_STYLES.WORKER;
            const RoleIcon = roleMeta.icon;
            const statusMeta = STATUS_ICONS[step.status] ?? STATUS_ICONS.PENDING;
            const StatusIcon = statusMeta.icon;
            const hasDataPiping = step.taskDescription.includes("{{");

            return (
              <div key={step.id} className="w-full flex flex-col items-center">
                {/* Node Card */}
                <div
                  onMouseEnter={() => setHoveredStepId(step.id)}
                  onMouseLeave={() => setHoveredStepId(null)}
                  onClick={() => onSelectStepLogs?.(step)}
                  className={cn(
                    "w-full rounded-[16px] border p-4 bg-bg-elevated text-left transition-all duration-200 relative group cursor-pointer shadow-sm",
                    hoveredStepId === step.id
                      ? "border-accent-violet/60 shadow-md ring-1 ring-accent-violet/25 translate-y-[-1px]"
                      : "border-border-subtle hover:border-border-strong",
                    step.status === "ATTEMPTING" || step.status === "SUBMITTED"
                      ? "ring-2 ring-[#F5A623]/40 border-[#F5A623]"
                      : step.status === "COMPLETED"
                      ? "border-[#1FD487]/40"
                      : step.status === "FAILED"
                      ? "border-red-500/40"
                      : "",
                  )}
                >
                  {/* Top Node Header: Step Number, Role Badge, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-bg-surface3 text-text-secondary border border-border-subtle">
                        #{idx + 1}
                      </span>

                      <span
                        className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1"
                        style={{ backgroundColor: roleMeta.bg, borderColor: roleMeta.border, color: roleMeta.text }}
                      >
                        <RoleIcon className="h-3 w-3" />
                        <span>{step.role}</span>
                      </span>

                      {hasDataPiping && (
                        <span className="text-[9px] font-mono px-1.5 py-0.25 rounded bg-accent-dark text-accent-violet border border-accent-violet/30 flex items-center gap-1 font-bold">
                          <Link2 className="h-2.5 w-2.5" />
                          <span>Pipes Data</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[10.5px] font-bold font-mono flex items-center gap-1", statusMeta.color)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{statusMeta.text}</span>
                      </span>
                    </div>
                  </div>

                  {/* Node Content: Avatar + Agent Name + Task */}
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={robotAvatarUrl(step.agentName || "agent")}
                      alt=""
                      className="h-9 w-9 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shrink-0 mt-0.5"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-extrabold text-text-primary truncate group-hover:text-accent-violet transition-colors">
                        {step.agentName || `Agent #${step.agentChainId}`}
                      </h4>

                      <p className="text-[11.5px] text-text-secondary line-clamp-2 leading-relaxed mt-0.5">
                        {step.taskDescription}
                      </p>

                      {/* Footer Specs: Budget, Deadline, Job Hash */}
                      <div className="flex items-center justify-between text-[10.5px] font-mono pt-2 mt-2 border-t border-border-subtle/60 text-text-quaternary">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-accent-violet">${step.budgetUsdc} USDC</span>
                          <span>{step.deadlineDays}d deadline</span>
                          {step.jobChainId && <span>Escrow Job #{step.jobChainId}</span>}
                        </div>

                        {step.txHashOrRef && explorerUrlBase && (
                          <a
                            href={`${explorerUrlBase}/tx/${step.txHashOrRef}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-accent-violet hover:underline flex items-center gap-0.5 font-bold"
                          >
                            <span>Etherscan</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for Draft Steps (Hover overlay) */}
                  {isDraft && step.status === "PENDING" && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-elevated/90 px-1.5 py-1 rounded-[8px] border border-border-subtle shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditStep(step);
                        }}
                        className="p-1 rounded text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
                        title="Edit Step Parameters"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStep(step.id);
                        }}
                        className="p-1 rounded text-text-quaternary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Step"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Serial Downward Connector Arrow */}
                {isSerial && idx < pipeline.steps.length - 1 && (
                  <div className="flex flex-col items-center py-2 relative">
                    <div className="w-0.5 h-6 bg-border-strong" />
                    <div className="px-2.5 py-0.5 rounded-full bg-bg-surface3 border border-border-strong text-[9.5px] font-mono font-extrabold text-text-tertiary flex items-center gap-1 shadow-2xs">
                      <ArrowDown className="h-3 w-3 text-accent-violet" />
                      <span>passes output $\to$ next step</span>
                    </div>
                    <div className="w-0.5 h-6 bg-border-strong" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Step Connector at bottom in Draft Mode */}
      {isDraft && pipeline.steps.length > 0 && (
        <div className="flex flex-col items-center mt-3">
          <div className="w-0.5 h-5 bg-border-strong" />
          <button
            type="button"
            onClick={onAddStep}
            className="px-4 py-1.5 rounded-full bg-bg-elevated hover:bg-accent-violet hover:text-white border border-border-strong hover:border-accent-violet text-[11px] font-bold text-text-secondary transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Next Step</span>
          </button>
        </div>
      )}
    </div>
  );
}
