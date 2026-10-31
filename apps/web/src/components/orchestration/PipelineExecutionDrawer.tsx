"use client";

import { useState } from "react";
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Bot,
  Copy,
  Check,
  Terminal,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { robotAvatarUrl } from "@/lib/avatar";
import type { Pipeline, PipelineStep } from "@/hooks";

interface PipelineExecutionDrawerProps {
  pipeline: Pipeline | null;
  selectedStep: PipelineStep | null;
  isOpen: boolean;
  onClose: () => void;
  explorerUrlBase?: string;
}

export function PipelineExecutionDrawer({
  pipeline,
  selectedStep,
  isOpen,
  onClose,
  explorerUrlBase = "https://monadscan.com",
}: PipelineExecutionDrawerProps) {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  if (!isOpen || !pipeline) return null;

  const currentStep = selectedStep || pipeline.steps[0] || null;

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  }

  const completedSteps = pipeline.steps.filter((s) => s.status === "COMPLETED").length;
  const progressPercent = pipeline.steps.length > 0 ? Math.round((completedSteps / pipeline.steps.length) * 100) : 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-bg-elevated border-l border-border-strong shadow-2xl flex flex-col animate-slideInRight">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/40">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent-violet animate-pulse" />
          <h3 className="text-[14px] font-extrabold text-text-primary">Execution Telemetry</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-[6px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pipeline Status Summary Card */}
      <div className="p-4 border-b border-border-subtle bg-bg-surface space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-text-primary">{pipeline.name}</span>
          <span
            className={cn(
              "text-[9.5px] font-mono font-extrabold px-2 py-0.5 rounded-full border",
              pipeline.status === "ACTIVE"
                ? "bg-[#2a1f0c] text-[#F5A623] border-[#F5A623]/30"
                : pipeline.status === "COMPLETED"
                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                : pipeline.status === "FAILED"
                ? "bg-[#2e1313] text-red-400 border-red-500/30"
                : "bg-bg-surface3 text-text-quaternary border-border-subtle",
            )}
          >
            {pipeline.status}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10.5px] font-mono text-text-quaternary">
            <span>Progress: {completedSteps} / {pipeline.steps.length} Steps</span>
            <span className="font-bold text-accent-violet">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-bg-surface3 overflow-hidden">
            <div
              className="h-full bg-accent-violet transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step List & Telemetry Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1">
          Step Execution Breakdown
        </div>

        {pipeline.steps.map((step, idx) => {
          const isSelected = currentStep?.id === step.id;
          const isSuccess = step.status === "COMPLETED";
          const isFailed = step.status === "FAILED";
          const isRunning = step.status === "ATTEMPTING" || step.status === "SUBMITTED";

          return (
            <div
              key={step.id}
              className={cn(
                "p-3.5 rounded-[12px] border transition-all text-xs flex flex-col gap-2",
                isSelected
                  ? "bg-bg-raised border-accent-violet/50 shadow-xs"
                  : "bg-bg-surface border-border-subtle",
              )}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={robotAvatarUrl(step.agentName || "agent")}
                    alt=""
                    className="h-6 w-6 rounded-[6px] border border-border-strong object-cover bg-bg-surface3"
                  />
                  <span className="font-bold text-text-primary">
                    #{idx + 1} {step.agentName || `Agent #${step.agentChainId}`}
                  </span>
                </div>

                <span
                  className={cn(
                    "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border",
                    isRunning
                      ? "bg-[#2a1f0c] text-[#F5A623] border-[#F5A623]/30 animate-pulse"
                      : isSuccess
                      ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                      : isFailed
                      ? "bg-[#2e1313] text-red-400 border-red-500/30"
                      : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                  )}
                >
                  {step.status}
                </span>
              </div>

              {/* Task Text */}
              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                {step.taskDescription}
              </p>

              {/* On-Chain Transaction & Escrow Link */}
              <div className="pt-2 border-t border-border-subtle/50 flex items-center justify-between text-[10px] font-mono text-text-quaternary">
                <span>Budget: ${step.budgetUsdc} USDC</span>

                {step.txHashOrRef ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`${explorerUrlBase}/tx/${step.txHashOrRef}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-violet hover:underline flex items-center gap-0.5 font-bold"
                    >
                      <span>Tx: {step.txHashOrRef.slice(0, 6)}…</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(step.txHashOrRef!, step.id)}
                      className="hover:text-text-primary"
                    >
                      {copiedTx === step.id ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ) : (
                  <span>Awaiting On-Chain Execution</span>
                )}
              </div>

              {step.error && (
                <div className="p-2 rounded-[6px] bg-red-500/10 border border-red-500/20 text-[10.5px] text-red-400 font-mono">
                  {step.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-between text-xs">
        <span className="font-mono text-[11px] text-text-quaternary">
          Chain: {pipeline.chain} · Escrow Secured
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-[8px] bg-bg-surface3 border border-border-strong text-text-secondary text-xs font-bold hover:border-border-hover transition-colors cursor-pointer"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
}
