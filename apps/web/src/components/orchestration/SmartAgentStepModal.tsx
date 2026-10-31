"use client";

import { useState, useMemo } from "react";
import {
  X,
  Bot,
  GitMerge,
  Cpu,
  Scale,
  Search,
  Check,
  Link2,
  DollarSign,
  Clock,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatBps } from "@/lib/format";
import type { PipelineStep } from "@/hooks";

export interface StepFormData {
  agentChainId: string;
  agentName: string;
  role: PipelineStep["role"];
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
}

interface SmartAgentStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StepFormData) => Promise<void>;
  initialData?: StepFormData;
  isEditing?: boolean;
  agents: { id: string | number; name: string; reputationBps?: number; owner?: string }[];
  stepsCount: number;
  isLoading?: boolean;
}

const DOMAIN_TAGS = ["ALL", "Trading & Perps", "DeFi & Infra", "Security & Audit", "Social Alpha", "Predictions"];

const ROLE_OPTIONS: { id: PipelineStep["role"]; label: string; icon: typeof Cpu; color: string; desc: string }[] = [
  { id: "WORKER", label: "Worker", icon: Cpu, color: "#1FD487", desc: "Executes specialized computational, scraping, analysis, or creation tasks." },
  { id: "ORCHESTRATOR", label: "Orchestrator", icon: GitMerge, color: "#FF5C28", desc: "Delegates sub-tasks, dispatches on-chain contracts, and executes final actions." },
  { id: "EVALUATOR", label: "Evaluator", icon: Scale, color: "#A78BFA", desc: "Verifies deliverables, assesses quality/risk thresholds, and approves escrow release." },
];

export function SmartAgentStepModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isEditing = false,
  agents,
  stepsCount,
  isLoading = false,
}: SmartAgentStepModalProps) {
  const [form, setForm] = useState<StepFormData>(
    initialData ?? {
      agentChainId: agents[0] ? String(agents[0].id) : "",
      agentName: agents[0]?.name ?? "",
      role: "WORKER",
      taskDescription: "",
      budgetUsdc: "15",
      deadlineDays: 2,
    },
  );

  const [agentSearch, setAgentSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [maxRevisions, setMaxRevisions] = useState(3);

  if (!isOpen) return null;

  const filteredAgents = agents.filter((a) => {
    if (!agentSearch.trim()) return true;
    return a.name.toLowerCase().includes(agentSearch.toLowerCase()) || String(a.id).includes(agentSearch);
  });

  const selectedAgent = agents.find((a) => String(a.id) === form.agentChainId) || agents[0];

  function insertVariable(variableName: string) {
    setForm((f) => ({
      ...f,
      taskDescription: `${f.taskDescription} {{${variableName}}}`,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15.5px] font-extrabold text-text-primary">
                {isEditing ? "Edit Pipeline Step" : `Add Step #${stepsCount + 1}`}
              </h2>
              <p className="text-[11.5px] text-text-tertiary">Configure agent assignment, role type, prompt variables, and escrow budget.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[68vh]">
          {/* Section 1: Assigned Fleet Agent */}
          <div className="space-y-2">
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
              1. Select Assigned Agent
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6 relative">
                <Search className="h-3 w-3 text-text-quaternary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  placeholder="Search fleet agents…"
                  className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-7.5 pr-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-violet/50"
                />
              </div>

              <div className="sm:col-span-6">
                {agents.length === 0 ? (
                  <div className="text-[11px] text-red-400 font-semibold p-2 rounded bg-red-500/10 border border-red-500/20">
                    No registered agents found on this chain.
                  </div>
                ) : (
                  <select
                    value={form.agentChainId}
                    onChange={(e) => {
                      const found = agents.find((a) => String(a.id) === e.target.value);
                      setForm((f) => ({ ...f, agentChainId: e.target.value, agentName: found?.name ?? "" }));
                    }}
                    className="w-full bg-bg-surface border border-border-strong rounded-[8px] px-3 py-1.5 text-xs font-bold text-text-primary outline-none cursor-pointer"
                  >
                    {filteredAgents.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.name} (#{a.id}) {a.reputationBps ? `· ${formatBps(a.reputationBps)}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Typed Pipeline Role */}
          <div className="space-y-2">
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
              2. Assign Typed Role
            </label>

            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = form.role === opt.id;
                const Icon = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: opt.id }))}
                    className={cn(
                      "p-3 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col gap-1",
                      isSelected
                        ? "bg-bg-raised border-accent-violet/50 ring-1 ring-accent-violet/30 shadow-xs"
                        : "bg-bg-surface border-border-subtle hover:border-border-strong text-text-tertiary",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" style={{ color: opt.color }} />
                      <span className="text-[12px] font-extrabold text-text-primary">{opt.label}</span>
                    </div>
                    <p className="text-[10px] text-text-quaternary leading-tight line-clamp-2">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Task Description with Output Variable Chaining */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                3. Task Description &amp; Directives
              </label>
              <span className="text-[10px] font-mono text-accent-violet flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                <span>Prompt Chaining Supported</span>
              </span>
            </div>

            <textarea
              value={form.taskDescription}
              onChange={(e) => setForm((f) => ({ ...f, taskDescription: e.target.value }))}
              rows={4}
              placeholder="What should this agent do? Reference outputs from prior steps using {{previous_step_output}} or {{step_1.output}}..."
              className="w-full bg-bg-surface border border-border-strong rounded-[10px] p-3 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 leading-relaxed"
            />

            {/* Variable Insertion Chips */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] font-bold text-text-quaternary mr-1">Insert Pipe:</span>
              {[
                { label: "previous_step_output", title: "Passes previous step result" },
                { label: "step_1.output", title: "Passes Step 1 output" },
                { label: "evaluator_feedback", title: "Passes evaluator critique" },
                { label: "market_alpha", title: "Passes on-chain market feed" },
              ].map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => insertVariable(v.label)}
                  className="px-2 py-0.5 rounded-[6px] bg-bg-surface3 hover:bg-accent-violet/20 hover:text-accent-violet text-[10px] font-mono text-text-tertiary border border-border-subtle transition-colors cursor-pointer"
                  title={v.title}
                >
                  +{`{{${v.label}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Budget & Deadline */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                Escrow Budget (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={form.budgetUsdc}
                  onChange={(e) => setForm((f) => ({ ...f, budgetUsdc: e.target.value }))}
                  placeholder="15"
                  className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-3.5 pr-14 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-violet/50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                  USDC
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                Execution Deadline
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={form.deadlineDays}
                  onChange={(e) => setForm((f) => ({ ...f, deadlineDays: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-3.5 pr-14 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-violet/50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                  Days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[9px] bg-bg-surface3 border border-border-strong text-text-secondary text-xs font-bold hover:border-border-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isLoading || !form.agentChainId || !form.taskDescription.trim()}
            onClick={() => onSave(form)}
            className="px-5 py-2 rounded-[9px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
          >
            {isLoading ? "Saving Step…" : isEditing ? "Save Step Changes" : "Add Step to Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
