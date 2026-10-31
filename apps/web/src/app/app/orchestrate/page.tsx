"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Workflow,
  Copy,
  Edit2,
  X,
  Link2,
  Bot,
  Settings,
  Lightbulb,
  GitMerge,
  Cpu,
  Scale,
  LayoutGrid,
  List,
  Activity,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useOrchestration, usePipelineWallet, useRankings, useWallet, useSocialSession, useMyAgents } from "@/hooks";
import type { Pipeline, PipelineStep } from "@/hooks";
import { isEvmChain, toIndexerChainSlug, fromIndexerChainSlug } from "@/lib/chains";
import {
  PipelineTemplateGallery,
  PipelineVisualDag,
  SmartAgentStepModal,
  PipelineExecutionDrawer,
} from "@/components/orchestration";
import type { PipelineTemplate, StepFormData, TailoredPipelinePayload } from "@/components/orchestration";

const ROLE_COLORS: Record<PipelineStep["role"], { bg: string; border: string; text: string }> = {
  ORCHESTRATOR: { bg: "rgba(255,92,40,.08)", border: "rgba(255,92,40,.25)", text: "#FF5C28" },
  WORKER: { bg: "rgba(31,212,135,.06)", border: "rgba(31,212,135,.2)", text: "#1FD487" },
  EVALUATOR: { bg: "rgba(167,139,250,.07)", border: "rgba(167,139,250,.22)", text: "#A78BFA" },
};

const ROLE_ICONS: Record<PipelineStep["role"], typeof Bot> = {
  ORCHESTRATOR: GitMerge,
  WORKER: Cpu,
  EVALUATOR: Scale,
};

const STEP_STATUS_BADGE: Record<PipelineStep["status"], { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-bg-surface3", text: "text-text-quaternary", label: "waiting" },
  ATTEMPTING: { bg: "bg-[#2a1f0c]", text: "text-[#F5A623]", label: "signing…" },
  SUBMITTED: { bg: "bg-[#2a1f0c]", text: "text-[#F5A623]", label: "on-chain" },
  COMPLETED: { bg: "bg-[#0c2a1d]", text: "text-[#1FD487]", label: "completed" },
  FAILED: { bg: "bg-[#2e1313]", text: "text-red-400", label: "failed" },
};

const PIPELINE_STATUS_BADGE: Record<Pipeline["status"], { bg: string; text: string }> = {
  DRAFT: { bg: "bg-bg-surface3", text: "text-text-quaternary" },
  ACTIVE: { bg: "bg-[#2a1f0c]", text: "text-[#F5A623]" },
  COMPLETED: { bg: "bg-[#0c2a1d]", text: "text-[#1FD487]" },
  FAILED: { bg: "bg-[#2e1313]", text: "text-red-400" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function OrchestratePage() {
  const { profile, signIn } = useSocialSession();
  const { pipelines, create, remove, addStep, removeStep, updateStep, run } = useOrchestration();
  const { agents } = useRankings();
  const { agents: myAgents } = useMyAgents();
  const { chain, address } = useWallet();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [templateDeploying, setTemplateDeploying] = useState(false);
  const [newPipelineForm, setNewPipelineForm] = useState({ name: "", description: "", executionMode: "SERIAL" as Pipeline["executionMode"] });

  // View Mode: Visual DAG Flow vs Card List
  const [viewMode, setViewMode] = useState<"canvas" | "list">("canvas");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("list");
    }
  }, []);

  // Step modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<PipelineStep | null>(null);

  // Telemetry drawer
  const [showExecutionDrawer, setShowExecutionDrawer] = useState(false);
  const [selectedStepForLogs, setSelectedStepForLogs] = useState<PipelineStep | null>(null);

  const [depositAmount, setDepositAmount] = useState("25");
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = pipelines.find((p) => p.id === selectedId) ?? null;
  const selectedChainConfig = selected ? fromIndexerChainSlug(selected.chain) : undefined;
  const wallet = usePipelineWallet(selected?.id);

  const walletChainMatchesSelected = selected ? isEvmChain(chain) && toIndexerChainSlug(chain) === selected.chain : false;

  function requiredBudgetNow(pipeline: Pipeline): number {
    const pendingSteps = pipeline.steps.filter((s) => s.status === "PENDING");
    const stepsAboutToPost = pipeline.executionMode === "PARALLEL" ? pendingSteps : pendingSteps.slice(0, 1);
    return stepsAboutToPost.reduce((sum, s) => sum + Number(s.budgetUsdc), 0);
  }

  function handleOpenAddStep() {
    if (!profile) {
      signIn();
      return;
    }
    setEditingStep(null);
    setShowStepModal(true);
  }

  function handleOpenEditStep(step: PipelineStep) {
    if (!profile) {
      signIn();
      return;
    }
    setEditingStep(step);
    setShowStepModal(true);
  }

  async function handleSaveStep(data: StepFormData) {
    if (!selected) return;
    if (!profile) {
      signIn();
      return;
    }
    setActionError(null);
    try {
      if (editingStep) {
        await updateStep.mutateAsync({
          pipelineId: selected.id,
          stepId: editingStep.id,
          ...data,
        });
      } else {
        await addStep.mutateAsync({
          pipelineId: selected.id,
          ...data,
        });
      }
      setShowStepModal(false);
      setEditingStep(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save step.");
    }
  }

  async function handleClone(pipeline: Pipeline) {
    if (!profile) {
      signIn();
      return;
    }
    setActionError(null);
    try {
      const { pipeline: cloned } = await create.mutateAsync({
        chain: pipeline.chain,
        name: `${pipeline.name} (copy)`,
        description: pipeline.description,
        executionMode: pipeline.executionMode,
      });
      for (const step of pipeline.steps) {
        await addStep.mutateAsync({
          pipelineId: cloned.id,
          agentChainId: step.agentChainId,
          agentName: step.agentName,
          role: step.role,
          taskDescription: step.taskDescription,
          budgetUsdc: step.budgetUsdc,
          deadlineDays: step.deadlineDays,
        });
      }
      setSelectedId(cloned.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to clone the pipeline.");
    }
  }

  async function handleRun(pipeline: Pipeline) {
    if (!profile) {
      signIn();
      return;
    }
    setActionError(null);
    try {
      await run.mutateAsync(pipeline.id);
      setShowExecutionDrawer(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start the pipeline.");
    }
  }

  async function handleDeployTemplate(payload: TailoredPipelinePayload) {
    if (!profile) {
      signIn();
      return;
    }
    if (!isEvmChain(chain)) {
      setActionError("Orchestration only supports EVM chains. Switch your active chain first.");
      return;
    }
    if (agents.length === 0) {
      setActionError("No registered agents found on this chain. Please register an agent in Fleet Command first before deploying a pipeline.");
      return;
    }
    setTemplateDeploying(true);
    setActionError(null);
    try {
      const chainSlug = toIndexerChainSlug(chain);
      const { pipeline: created } = await create.mutateAsync({
        chain: chainSlug,
        name: payload.name,
        description: payload.description,
        executionMode: payload.executionMode,
      });

      for (const step of payload.steps) {
        await addStep.mutateAsync({
          pipelineId: created.id,
          agentChainId: step.agentChainId,
          agentName: step.agentName,
          role: step.role,
          taskDescription: step.taskDescription,
          budgetUsdc: step.budgetUsdc,
          deadlineDays: step.deadlineDays,
        });
      }

      setSelectedId(created.id);
      setShowTemplateGallery(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to deploy tailored blueprint.");
    } finally {
      setTemplateDeploying(false);
    }
  }

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-3.5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight flex items-center gap-2">
            <Workflow className="h-5 w-5 text-accent-violet" />
            <span>Autonomous Orchestration Builder</span>
          </h1>
          <p className="text-[12.5px] text-text-tertiary mt-1">
            Chain multiple AI agents into visual multi-step workflows with custodied USDC escrow. Run serial or parallel execution with automated prompt piping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplateGallery(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/35 hover:bg-accent-violet hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>Blueprint Templates</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!profile) {
                signIn();
                return;
              }
              setShowNewPipeline(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all shadow-sm cursor-pointer"
          >
            + New Pipeline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left Column: Pipelines List */}
        <div className={cn("space-y-2", selected && "hidden lg:block")}>
          {pipelines.length === 0 && !showNewPipeline && (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-6 text-center">
              <Workflow className="h-7 w-7 text-accent-violet mx-auto mb-2" />
              <p className="text-[11.5px] font-bold text-text-primary mb-1">No Pipelines Yet</p>
              <p className="text-[11px] text-text-quaternary mb-3">Build your first multi-agent pipeline to automate complex workflows.</p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTemplateGallery(true)}
                  className="px-3 py-1.5 rounded-[8px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold hover:bg-accent-violet hover:text-white transition-all cursor-pointer"
                >
                  Browse Blueprint Templates →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!profile) {
                      signIn();
                      return;
                    }
                    setShowNewPipeline(true);
                  }}
                  className="text-[11px] font-bold text-text-tertiary hover:text-text-primary"
                >
                  Create Custom Pipeline
                </button>
              </div>
            </div>
          )}

          {pipelines.map((p) => {
            const chainConfig = fromIndexerChainSlug(p.chain);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full text-left bg-bg-elevated border rounded-xl p-3.5 transition-all duration-150 hover:border-border-hover cursor-pointer",
                  selectedId === p.id ? "border-accent-violet/40 bg-accent-dark/25 shadow-xs ring-1 ring-accent-violet/20" : "border-border-subtle",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] font-bold text-text-primary truncate">{p.name}</span>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 font-mono", PIPELINE_STATUS_BADGE[p.status].bg, PIPELINE_STATUS_BADGE[p.status].text)}>
                    {p.status}
                  </span>
                </div>
                <div className="text-[10.5px] text-text-quaternary flex items-center justify-between">
                  <span>{p.steps.length} steps · {p.executionMode.toLowerCase()}</span>
                  <span className="font-mono">{formatDate(p.createdAt)}</span>
                </div>
              </button>
            );
          })}

          {/* New pipeline form inline */}
          {showNewPipeline && (
            <div className="bg-bg-elevated border border-border-strong rounded-xl p-4 space-y-2.5 shadow-md">
              <div className="text-[11.5px] font-extrabold text-text-primary">Create New Pipeline</div>
              {!isEvmChain(chain) && (
                <div className="text-[10.5px] text-red-400 font-semibold">Orchestration only supports EVM chains. Switch your active chain first.</div>
              )}
              <input
                value={newPipelineForm.name}
                onChange={(e) => setNewPipelineForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Pipeline name…"
                className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
              <textarea
                value={newPipelineForm.description}
                onChange={(e) => setNewPipelineForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this pipeline do?"
                rows={2}
                className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/50 transition-colors"
              />
              <div className="flex gap-1.5">
                {(["SERIAL", "PARALLEL"] as Pipeline["executionMode"][]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewPipelineForm((f) => ({ ...f, executionMode: m }))}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[11px] font-bold border capitalize transition-all cursor-pointer",
                      newPipelineForm.executionMode === m ? "bg-accent-dark border-accent-violet/35 text-accent-violet" : "border-border-strong text-text-tertiary hover:border-border-hover",
                    )}
                  >
                    {m.toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!isEvmChain(chain) || create.isPending}
                  onClick={async () => {
                    if (!profile) {
                      signIn();
                      return;
                    }
                    if (!newPipelineForm.name.trim() || !isEvmChain(chain)) return;
                    setActionError(null);
                    try {
                      const { pipeline } = await create.mutateAsync({
                        chain: toIndexerChainSlug(chain),
                        name: newPipelineForm.name,
                        description: newPipelineForm.description,
                        executionMode: newPipelineForm.executionMode,
                      });
                      setSelectedId(pipeline.id);
                      setNewPipelineForm({ name: "", description: "", executionMode: "SERIAL" });
                      setShowNewPipeline(false);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Failed to create pipeline.");
                    }
                  }}
                  className="flex-1 py-2 rounded-[9px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {create.isPending ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewPipeline(false)}
                  className="w-full py-2 rounded-[9px] bg-bg-surface3 border border-border-strong text-text-secondary text-[12px] font-bold hover:border-border-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pipeline Canvas / Editor */}
        {selected ? (
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] overflow-hidden flex flex-col shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="lg:hidden text-left px-5 pt-4 text-[11.5px] font-bold text-text-tertiary hover:text-text-primary transition-colors"
            >
              ← Back to pipelines
            </button>

            {/* Pipeline Top Toolbar */}
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-extrabold text-text-primary">{selected.name}</h2>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 font-mono", PIPELINE_STATUS_BADGE[selected.status].bg, PIPELINE_STATUS_BADGE[selected.status].text)}>
                    {selected.status}
                  </span>
                </div>
                <p className="text-[11.5px] text-text-tertiary mt-0.5">
                  {selected.description || "No description"} · {selected.executionMode.toLowerCase()} execution · {selectedChainConfig?.chainName ?? selected.chain}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center p-0.5 rounded-[8px] bg-bg-surface border border-border-strong">
                  <button
                    type="button"
                    onClick={() => setViewMode("canvas")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer",
                      viewMode === "canvas" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
                    )}
                    title="Interactive DAG Node Canvas"
                  >
                    <LayoutGrid className="h-3 w-3" />
                    <span>Visual DAG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer",
                      viewMode === "list" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary hover:text-text-secondary",
                    )}
                    title="List View"
                  >
                    <List className="h-3 w-3" />
                    <span>List</span>
                  </button>
                </div>

                {/* Telemetry Log Button */}
                <button
                  type="button"
                  onClick={() => setShowExecutionDrawer(true)}
                  className="flex items-center gap-1.5 px-3 py-1.75 rounded-[9px] bg-bg-surface3 border border-border-strong text-[12px] font-bold text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors cursor-pointer"
                >
                  <Activity className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Telemetry</span>
                </button>

                {selected.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={handleOpenAddStep}
                    className="flex items-center gap-1.5 px-3 py-1.75 rounded-[9px] bg-bg-surface3 border border-border-strong text-[12px] font-bold text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors cursor-pointer"
                  >
                    + Add Step
                  </button>
                )}

                {selected.status === "DRAFT" && (() => {
                  const insufficientBalance = wallet.wallet ? Number(wallet.wallet.balanceUsdc) / 1e6 < requiredBudgetNow(selected) : true;
                  const noSteps = selected.steps.length === 0;
                  const runDisabled = noSteps || run.isPending || insufficientBalance;
                  const runTitle = noSteps
                    ? "Add at least one step first"
                    : insufficientBalance
                      ? "Deposit enough USDC into the pipeline wallet first"
                      : undefined;
                  return (
                    <button
                      type="button"
                      onClick={() => handleRun(selected)}
                      disabled={runDisabled}
                      className="flex items-center gap-1.5 px-3.5 py-1.75 rounded-[9px] bg-accent-violet text-white text-[12px] font-bold transition-all hover:brightness-110 disabled:opacity-40 cursor-pointer shadow-xs"
                      title={runTitle}
                    >
                      {run.isPending ? "⏳ Starting…" : "▶ Run Pipeline"}
                    </button>
                  );
                })()}

                {selected.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={async () => {
                      setActionError(null);
                      try {
                        await remove.mutateAsync(selected.id);
                        setSelectedId(null);
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : "Failed to delete. Withdraw the wallet balance first.");
                      }
                    }}
                    className="px-2.5 py-1.75 rounded-[9px] text-red-400/70 hover:text-red-400 text-[13px] transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {(selected.status === "FAILED" || selected.status === "COMPLETED") && (
                  <button
                    type="button"
                    onClick={() => handleClone(selected)}
                    disabled={create.isPending || addStep.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.75 rounded-[9px] bg-bg-surface3 border border-border-strong text-[12px] font-bold text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Clone as New Draft
                  </button>
                )}
              </div>
            </div>

            {/* Custodied Pipeline Wallet Bar */}
            <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-raised/40 flex items-center gap-4 flex-wrap">
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Pipeline Escrow Wallet</div>
                <div className="font-mono text-[12px] text-text-secondary">{wallet.wallet ? shortAddr(wallet.wallet.address) : "…"}</div>
              </div>
              <div>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Balance</div>
                <div className="font-mono text-[13px] font-bold text-accent-violet">{wallet.wallet ? `$${(Number(wallet.wallet.balanceUsdc) / 1e6).toFixed(2)}` : "…"} USDC</div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="number"
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-20 bg-bg-elevated border border-border-strong rounded-lg px-2 py-1.5 text-[11.5px] text-text-primary outline-none focus:border-accent-violet/50"
                />
                <button
                  type="button"
                  disabled={!walletChainMatchesSelected || wallet.depositing || !wallet.wallet}
                  onClick={async () => {
                    setActionError(null);
                    try {
                      await wallet.depositFromConnectedWallet(depositAmount);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Deposit failed.");
                    }
                  }}
                  title={!walletChainMatchesSelected ? `Switch your active chain to ${selectedChainConfig?.chainName ?? selected.chain} to deposit` : undefined}
                  className="px-3 py-1.5 rounded-lg bg-accent-violet text-white text-[11.5px] font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {wallet.depositing ? "Depositing…" : "Deposit"}
                </button>
                <button
                  type="button"
                  disabled={!wallet.wallet || Number(wallet.wallet.balanceUsdc) === 0 || wallet.withdraw.isPending}
                  onClick={async () => {
                    setActionError(null);
                    try {
                      await wallet.withdraw.mutateAsync();
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Withdraw failed.");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-bg-surface3 border border-border-strong text-text-secondary text-[11.5px] font-bold hover:border-border-hover transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {wallet.withdraw.isPending ? "…" : "Withdraw"}
                </button>
              </div>
            </div>

            {/* Pipeline Canvas / Steps Stream */}
            <div className="flex-1 p-5 overflow-y-auto">
              {actionError && (
                <div className="bg-red-900/20 border border-red-500/25 rounded-[10px] px-4 py-2.5 mb-4 text-[12px] text-red-400 font-semibold">{actionError}</div>
              )}

              {viewMode === "canvas" ? (
                /* Interactive Visual DAG Mode */
                <PipelineVisualDag
                  pipeline={selected}
                  isDraft={selected.status === "DRAFT"}
                  onAddStep={handleOpenAddStep}
                  onEditStep={handleOpenEditStep}
                  onDeleteStep={async (stepId) => {
                    setActionError(null);
                    try {
                      await removeStep.mutateAsync({ pipelineId: selected.id, stepId });
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Failed to remove step.");
                    }
                  }}
                  onSelectStepLogs={(step) => {
                    setSelectedStepForLogs(step);
                    setShowExecutionDrawer(true);
                  }}
                  explorerUrlBase={selectedChainConfig?.explorerUrl}
                />
              ) : (
                /* Card List View */
                <div className="space-y-3">
                  {selected.steps.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <Workflow className="h-9 w-9 text-accent-violet mx-auto mb-3" />
                      <p className="text-[13px] font-bold text-text-primary mb-1">Empty Pipeline</p>
                      <p className="text-[12px] text-text-tertiary mb-4">Add agents as steps to build your workflow.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddStep}
                        className="text-[12px] font-bold text-accent-violet hover:underline cursor-pointer"
                      >
                        + Add First Step
                      </button>
                    </div>
                  )}

                  {selected.steps.map((step, idx) => {
                    const roleStyle = ROLE_COLORS[step.role] ?? ROLE_COLORS.WORKER;
                    const RoleIcon = ROLE_ICONS[step.role] ?? Cpu;
                    const statusStyle = STEP_STATUS_BADGE[step.status];
                    const explorerUrl = step.txHashOrRef && selectedChainConfig ? `${selectedChainConfig.explorerUrl}/tx/${step.txHashOrRef}` : null;

                    return (
                      <div
                        key={step.id}
                        className="w-full rounded-xl p-4 border flex items-start gap-3.5 transition-all bg-bg-surface"
                        style={{ borderColor: roleStyle.border }}
                      >
                        <div
                          className="h-10 w-10 rounded-[10px] border flex items-center justify-center shrink-0"
                          style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}
                        >
                          <RoleIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: roleStyle.text }}>
                              {step.role.toLowerCase()}
                            </span>
                            <span className="text-[12.5px] font-bold text-text-primary truncate">{step.agentName || `Agent #${step.agentChainId}`}</span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono", statusStyle.bg, statusStyle.text)}>
                              {statusStyle.label}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-text-secondary leading-normal">{step.taskDescription}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-accent-violet">${step.budgetUsdc} USDC</span>
                            <span className="text-[11px] text-text-quaternary">{step.deadlineDays}d deadline</span>
                            {step.jobChainId && <span className="text-[11px] text-text-quaternary">Job #{step.jobChainId}</span>}
                            {explorerUrl && (
                              <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-accent-violet hover:underline flex items-center gap-0.5">
                                <span>Etherscan</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          {step.error && <p className="text-[10.5px] text-red-400 mt-1.5 font-mono">{step.error}</p>}
                        </div>
                        {selected.status === "DRAFT" && step.status === "PENDING" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditStep(step)}
                              className="p-1 text-text-quaternary hover:text-text-primary transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setActionError(null);
                                try {
                                  await removeStep.mutateAsync({ pipelineId: selected.id, stepId: step.id });
                                } catch (err) {
                                  setActionError(err instanceof Error ? err.message : "Failed to remove step.");
                                }
                              }}
                              className="p-1 text-text-quaternary hover:text-red-400 transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] flex items-center justify-center min-h-[400px]">
            <div className="text-center p-10 flex flex-col items-center gap-3">
              <Settings className="h-9 w-9 text-accent-violet mx-auto mb-1" />
              <div>
                <p className="text-[13px] font-bold text-text-primary">Select a Pipeline</p>
                <p className="text-[12px] text-text-tertiary">Choose from the list, deploy a blueprint template, or create a new pipeline.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateGallery(true)}
                className="px-4 py-2 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/35 text-xs font-bold hover:bg-accent-violet hover:text-white transition-all cursor-pointer shadow-xs"
              >
                Explore Blueprint Templates
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Strip */}
      <div className="mt-4 bg-bg-elevated border border-border-subtle rounded-[14px] px-6 py-4 flex items-start gap-4 shadow-xs">
        <Lightbulb className="h-5 w-5 text-accent-violet shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] font-semibold text-text-secondary leading-[1.65]">
            Every pipeline gets its own custodied USDC wallet on Monad. Deposit into it, and Run posts each step as a real on-chain job via x402 escrow. SERIAL mode automatically pipes outputs between steps and dispatches the next agent once the predecessor settles on-chain.
          </p>
          <div className="flex gap-3 mt-2.5">
            <Link href="/marketplace" className="text-[11.5px] font-bold text-accent-violet hover:underline">View Active Escrow Jobs →</Link>
            <Link href="/agents" className="text-[11.5px] font-bold text-text-tertiary hover:text-text-secondary transition-colors">Browse Agent Fleet →</Link>
          </div>
        </div>
      </div>

      {/* Blueprint Templates Modal */}
      <PipelineTemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelectTemplate={handleDeployTemplate}
        isLoading={templateDeploying}
        userAgents={myAgents}
        allAgents={agents}
        userAddress={address}
      />

      {/* Smart Agent Step Builder Modal */}
      {selected && (
        <SmartAgentStepModal
          isOpen={showStepModal}
          onClose={() => {
            setShowStepModal(false);
            setEditingStep(null);
          }}
          onSave={handleSaveStep}
          isEditing={!!editingStep}
          initialData={
            editingStep
              ? {
                  agentChainId: editingStep.agentChainId,
                  agentName: editingStep.agentName,
                  role: editingStep.role,
                  taskDescription: editingStep.taskDescription,
                  budgetUsdc: editingStep.budgetUsdc,
                  deadlineDays: editingStep.deadlineDays,
                }
              : undefined
          }
          agents={agents}
          stepsCount={selected.steps.length}
          isLoading={addStep.isPending || updateStep.isPending}
        />
      )}

      {/* Live Execution Telemetry Drawer */}
      <PipelineExecutionDrawer
        isOpen={showExecutionDrawer}
        onClose={() => setShowExecutionDrawer(false)}
        pipeline={selected}
        selectedStep={selectedStepForLogs}
        explorerUrlBase={selectedChainConfig?.explorerUrl}
      />
    </div>
  );
}
