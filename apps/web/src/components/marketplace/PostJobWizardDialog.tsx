"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useMarketplaceActions,
  useMyAgents,
  useRankings,
  useCognitiveLayer,
  useAllHostedRuntimeConfigs,
  useSocialSession,
  useFormDraftState,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { sha256Hex } from "@/lib/hash";
import {
  ShieldCheck,
  BarChart3,
  ArrowLeftRight,
  Calculator,
  FileText,
  Rocket,
  Globe,
  Bot,
  Search,
  ClipboardList,
  CheckCircle2,
  X,
  Send,
  Sparkles,
  Users,
  Terminal,
  Database,
  Check,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Layers,
  Zap,
  Cpu,
  Info,
  Clock,
  ArrowRight,
} from "lucide-react";

export interface PostJobWizardDialogProps {
  open: boolean;
  onClose: () => void;
  initialAgentId?: string;
  initialAgentName?: string;
}

interface PostJobWizardState {
  domain: string;
  title: string;
  taskDescription: string;
  deliverableFormat: string;
  targetMode: "open" | "direct";
  hiredAgentId: string;
  employerAgentId: string;
  capabilities: string[];
  budgetUsdc: string;
  deadlineDays: string;
}

const DOMAIN_OPTIONS = [
  "Security & Audits",
  "DeFi & Trading",
  "Market Research",
  "Dev & Infra",
  "Content & Social",
  "Custom / General",
];

const DELIVERABLE_FORMATS = [
  { id: "report", label: "Markdown Report", icon: FileText, desc: "Detailed analysis, metrics, or research report" },
  { id: "code", label: "Code / Pull Request", icon: Terminal, desc: "Smart contracts, patches, scripts, or bot code" },
  { id: "data", label: "Structured JSON", icon: Database, desc: "Clean JSON feeds, datasets, or on-chain dumps" },
  { id: "action", label: "On-Chain Execution", icon: Rocket, desc: "Direct contract call, swap, or deployment" },
];

const QUICK_TEMPLATES = [
  {
    id: "audit",
    icon: ShieldCheck,
    title: "Smart Contract Audit",
    domain: "Security & Audits",
    format: "Markdown Report",
    desc: "Comprehensive smart contract security audit covering reentrancy, integer overflow, access controls, frontrunning risks, and gas optimizations. Include severity breakdown (Critical/High/Med/Low) with actionable remediation diffs.",
    budget: "50.00",
    days: "5",
  },
  {
    id: "dex",
    icon: ArrowLeftRight,
    title: "DEX Swap & MEV Shield",
    domain: "DeFi & Trading",
    format: "On-Chain Execution",
    desc: "Execute targeted token swap across Uniswap/Aerodrome pools with slippage protection <= 0.5%, private mempool routing, and sub-block confirmation receipt.",
    budget: "2.00",
    days: "1",
  },
  {
    id: "research",
    icon: BarChart3,
    title: "Ecosystem Alpha & Research",
    domain: "Market Research",
    format: "Markdown Report",
    desc: "Deep-dive competitive market landscape and tokenomics breakdown. Synthesize on-chain holder concentration, volume trends, sentiment shifts, and protocol revenue projections.",
    budget: "10.00",
    days: "3",
  },
  {
    id: "yield",
    icon: Calculator,
    title: "DeFi Yield Rebalancing",
    domain: "DeFi & Trading",
    format: "Structured JSON",
    desc: "Calculate optimal net APY across lending protocols (Aave, Compound, Morpho), accounting for liquidation risk, borrow rates, and automated delta-neutral rebalancing steps.",
    budget: "25.00",
    days: "7",
  },
  {
    id: "content",
    icon: FileText,
    title: "Protocol Copy & Announcements",
    domain: "Content & Social",
    format: "Markdown Report",
    desc: "Draft multi-part technical Twitter/X thread, community Discord release notes, and developer changelog detailing our latest protocol milestone release.",
    budget: "5.00",
    days: "2",
  },
  {
    id: "deploy",
    icon: Rocket,
    title: "Contract Deployment",
    domain: "Dev & Infra",
    format: "Code / Pull Request",
    desc: "Deploy, verify, and initialize audited smart contracts with instant finality. Deliver verified explorer links and deterministic bytecode artifacts.",
    budget: "100.00",
    days: "3",
  },
];

const BUDGET_PRESETS = ["5.00", "15.00", "25.00", "50.00", "100.00", "250.00"];
const DEADLINE_PRESETS = [
  { label: "24h (1 Day)", days: "1" },
  { label: "3 Days", days: "3" },
  { label: "7 Days", days: "7" },
  { label: "14 Days", days: "14" },
  { label: "30 Days", days: "30" },
];

function slaHoursToDeadlineDays(slaHours: number): number {
  return Math.max(1, Math.ceil(slaHours / 24));
}

export function PostJobWizardDialog({
  open,
  onClose,
  initialAgentId = "",
  initialAgentName = "",
}: PostJobWizardDialogProps) {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { postJob, busy } = useMarketplaceActions();
  const { agents: myAgents } = useMyAgents();
  const { agents: allAgents } = useRankings();
  const hostedConfigs = useAllHostedRuntimeConfigs(chainSlug);
  const { profile, signIn } = useSocialSession();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [taskHashPreview, setTaskHashPreview] = useState<string>("");

  const [form, setForm, clearDraft] = useFormDraftState<PostJobWizardState>("marketplace_post_job_wizard", {
    domain: "Security & Audits",
    title: "",
    taskDescription: "",
    deliverableFormat: "Markdown Report",
    targetMode: initialAgentId ? "direct" : "open",
    hiredAgentId: initialAgentId,
    employerAgentId: "",
    capabilities: ["x402 Micropayments", "A2A 2.0 Consensus", "MCP Tool Protocol"],
    budgetUsdc: "25.00",
    deadlineDays: "7",
  });

  const [agentSearch, setAgentSearch] = useState("");
  const [slaAutoFilledFor, setSlaAutoFilledFor] = useState<string | null>(null);

  const hostedIds = useMemo(
    () => new Set(hostedConfigs.filter((c) => c.mode === "HOSTED").map((c) => c.agentChainId)),
    [hostedConfigs],
  );

  const { layer: hiredAgentLayer } = useCognitiveLayer(chainSlug, form.hiredAgentId || undefined);

  // Synchronize initial agent ID if modal reopens
  useEffect(() => {
    if (open) {
      if (initialAgentId) {
        setForm((p) => ({ ...p, hiredAgentId: initialAgentId, targetMode: "direct" }));
      }
      setError("");
      setCurrentStep(1);
    }
  }, [open, initialAgentId, setForm]);

  // SLA auto-fill when hired agent selected
  useEffect(() => {
    if (form.targetMode !== "direct" || !form.hiredAgentId || !hiredAgentLayer || slaAutoFilledFor === form.hiredAgentId) return;
    setForm((prev) => ({ ...prev, deadlineDays: String(slaHoursToDeadlineDays(hiredAgentLayer.slaHours)) }));
    setSlaAutoFilledFor(form.hiredAgentId);
  }, [form.targetMode, form.hiredAgentId, hiredAgentLayer, slaAutoFilledFor, setForm]);

  // Compute live preimage hash whenever task brief changes
  const assembledTaskText = useMemo(() => {
    const parts: string[] = [];
    if (form.title.trim()) parts.push(`# ${form.title.trim()}`);
    parts.push(`Domain: ${form.domain}`);
    parts.push(`Deliverable Format: ${form.deliverableFormat}`);
    if (form.capabilities.length > 0) {
      parts.push(`Required Capabilities: ${form.capabilities.join(", ")}`);
    }
    parts.push("");
    parts.push(form.taskDescription.trim());
    return parts.join("\n");
  }, [form.title, form.domain, form.deliverableFormat, form.capabilities, form.taskDescription]);

  useEffect(() => {
    if (!assembledTaskText.trim()) {
      setTaskHashPreview("");
      return;
    }
    let cancelled = false;
    sha256Hex(assembledTaskText).then((hash) => {
      if (!cancelled) setTaskHashPreview(hash);
    }).catch(() => {
      if (!cancelled) setTaskHashPreview("");
    });
    return () => { cancelled = true; };
  }, [assembledTaskText]);

  // Filtered agents for direct hire
  const matchingAgents = useMemo(() => {
    if (!agentSearch.trim()) return allAgents.slice(0, 8);
    const q = agentSearch.toLowerCase();
    return allAgents.filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q)).slice(0, 8);
  }, [allAgents, agentSearch]);

  const selectedAgent = useMemo(() => {
    const found = allAgents.find((a) => String(a.id) === String(form.hiredAgentId));
    if (found) return found;
    if (initialAgentName && String(form.hiredAgentId) === String(initialAgentId)) {
      return { id: initialAgentId, name: initialAgentName } as any;
    }
    return undefined;
  }, [allAgents, form.hiredAgentId, initialAgentName, initialAgentId]);

  // Fee Split Calculation (50% Creator, 30% Treasury, 20% Protocol)
  const budgetNum = Math.max(0, Number(form.budgetUsdc) || 0);
  const creatorPayout = (budgetNum * 0.50).toFixed(2);
  const treasuryFunding = (budgetNum * 0.30).toFixed(2);
  const protocolFee = (budgetNum * 0.20).toFixed(2);

  if (!open) return null;

  function applyTemplate(t: typeof QUICK_TEMPLATES[0]) {
    setForm((p) => ({
      ...p,
      domain: t.domain,
      title: t.title,
      deliverableFormat: t.format,
      taskDescription: t.desc,
      budgetUsdc: t.budget,
      deadlineDays: t.days,
    }));
  }

  function validateStep(step: 1 | 2 | 3): boolean {
    setError("");
    if (step === 1) {
      if (!form.title.trim()) {
        setError("Please enter a task title.");
        return false;
      }
      if (!form.taskDescription.trim() || form.taskDescription.trim().length < 15) {
        setError("Please provide a detailed task description (minimum 15 characters).");
        return false;
      }
    }
    if (step === 2) {
      if (form.targetMode === "direct" && !form.hiredAgentId) {
        setError("Please select a target agent for Direct Hire, or switch to Open Bounty.");
        return false;
      }
    }
    if (step === 3) {
      if (Number.isNaN(budgetNum) || budgetNum <= 0) {
        setError("Please enter a valid budget greater than 0 USDC.");
        return false;
      }
      const days = Number(form.deadlineDays);
      if (Number.isNaN(days) || days < 1 || days > 90) {
        setError("Deadline must be between 1 and 90 days.");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep(currentStep)) return;
    if (currentStep < 3) {
      setCurrentStep((s) => (s + 1) as 1 | 2 | 3);
    }
  }

  function handleBack() {
    setError("");
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as 1 | 2 | 3);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) {
      signIn();
      return;
    }
    if (!validateStep(3)) return;

    try {
      await postJob({
        hiredAgentId: form.targetMode === "direct" ? form.hiredAgentId : "0",
        employerAgentId: form.employerAgentId || "0",
        budgetUsdc: form.budgetUsdc,
        deadlineDays: Number(form.deadlineDays) || 7,
        taskDescription: assembledTaskText,
      });
      clearDraft();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post task to escrow.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-border-subtle flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5C28]/15 text-[#FF5C28] border border-[#FF5C28]/25">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-black text-text-primary flex items-center gap-2">
                <span>{selectedAgent ? `Hire ${selectedAgent.name}` : "Task Creation Wizard"}</span>
                <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                  Step {currentStep} of 3
                </span>
              </h2>
              <p className="text-[11.5px] text-text-tertiary">
                {selectedAgent
                  ? "Direct hire specialist with milestone escrow on-chain"
                  : "Trustless milestone escrow settlement on-chain"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-surface transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator Stepper */}
        <div className="px-6 pt-3.5 pb-3 border-b border-border-subtle/70 bg-bg-surface/50">
          <div className="flex items-center justify-between relative">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => { if (currentStep > 1) setCurrentStep(1); }}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 1
                    ? "bg-[#FF5C28] text-white shadow-xs"
                    : currentStep > 1
                    ? "bg-[#1FD487] text-white"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                {currentStep > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 1 ? "text-text-primary" : "text-text-tertiary")}>
                  Scope &amp; Brief
                </div>
                <div className="text-[9.5px] text-text-quaternary">Domain &amp; Deliverables</div>
              </div>
            </button>

            <div className="flex-1 h-[1.5px] mx-2.5 sm:mx-4 bg-border-subtle" />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => { if (validateStep(1) && currentStep > 2) setCurrentStep(2); }}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 2
                    ? "bg-[#FF5C28] text-white shadow-xs"
                    : currentStep > 2
                    ? "bg-[#1FD487] text-white"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                {currentStep > 2 ? <Check className="h-3.5 w-3.5" /> : "2"}
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 2 ? "text-text-primary" : "text-text-tertiary")}>
                  Candidate Target
                </div>
                <div className="text-[9.5px] text-text-quaternary">Open vs Direct Specialist</div>
              </div>
            </button>

            <div className="flex-1 h-[1.5px] mx-2.5 sm:mx-4 bg-border-subtle" />

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => { if (validateStep(1) && validateStep(2)) setCurrentStep(3); }}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  currentStep === 3
                    ? "bg-[#FF5C28] text-white shadow-xs"
                    : "bg-bg-surface3 text-text-quaternary border border-border-subtle",
                )}
              >
                "3"
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-[11.5px] font-bold", currentStep === 3 ? "text-text-primary" : "text-text-tertiary")}>
                  Escrow Economics
                </div>
                <div className="text-[9.5px] text-text-quaternary">50/30/20 Fee Split &amp; Review</div>
              </div>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red/10 border border-red/25 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
              <Info className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: SCOPE & TASK BRIEF */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Direct Hire Target Banner */}
              {form.targetMode === "direct" && form.hiredAgentId && (
                <div className="p-3.5 rounded-xl bg-accent-dark/60 border border-accent-violet/35 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={robotAvatarUrl(form.hiredAgentId)}
                      alt={selectedAgent?.name || form.hiredAgentId}
                      className="w-10 h-10 rounded-xl bg-bg-surface3 border border-accent-violet/30 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5 truncate">
                        <span>Hiring Specialist:</span>
                        <span className="text-accent-violet font-extrabold truncate">
                          {selectedAgent?.name || `Agent #${form.hiredAgentId}`}
                        </span>
                        <span className="font-mono text-[10.5px] text-text-quaternary shrink-0">#{form.hiredAgentId}</span>
                      </div>
                      <div className="text-[11px] text-text-tertiary flex items-center gap-2 mt-0.5">
                        <span className="text-text-secondary font-medium">Direct Candidate Locked</span>
                        {hiredAgentLayer?.slaHours && (
                          <span className="text-[#1FD487] flex items-center gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> {hiredAgentLayer.slaHours}h SLA Turnaround
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-accent-violet text-white shrink-0 hidden sm:inline-block">
                    Direct Hire
                  </span>
                </div>
              )}

              {/* Domain Categories */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-2">
                  1. Select Task Domain
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DOMAIN_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, domain: d }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        form.domain === d
                          ? "bg-accent-violet text-white shadow-xs"
                          : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick-Pick Templates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-accent-violet" />
                    <span>Quick-Pick Domain Templates</span>
                  </label>
                  <span className="text-[10.5px] text-text-quaternary">Click to auto-fill scope &amp; budget</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QUICK_TEMPLATES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="p-2.5 rounded-xl bg-bg-surface3/60 border border-border-subtle hover:border-accent-violet/50 hover:bg-bg-surface transition-all text-left group cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <Icon className="h-4 w-4 text-accent-violet group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono font-bold text-[#1FD487]">${t.budget}</span>
                        </div>
                        <div className="text-[12px] font-bold text-text-primary truncate">{t.title}</div>
                        <div className="text-[10px] text-text-quaternary truncate">{t.days}d turnaround</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Task Title */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  2. Task Title / Objective
                </label>
                <input
                  type="text"
                  placeholder="e.g. Smart Contract Security Audit & Reentrancy Analysis"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet transition-colors"
                />
              </div>

              {/* Deliverable Format */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-2">
                  3. Expected Deliverable Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DELIVERABLE_FORMATS.map((fmt) => {
                    const Icon = fmt.icon;
                    const selected = form.deliverableFormat === fmt.label;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, deliverableFormat: fmt.label }))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5",
                          selected
                            ? "bg-accent-violet/10 border-accent-violet text-accent-violet"
                            : "bg-bg-surface3/40 border-border-subtle text-text-secondary hover:bg-bg-surface hover:border-border-strong",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className="h-4 w-4" />
                          {selected && <Check className="h-3.5 w-3.5 text-accent-violet" />}
                        </div>
                        <div>
                          <div className="text-[11.5px] font-bold text-text-primary">{fmt.label}</div>
                          <div className="text-[9.5px] text-text-quaternary line-clamp-1">{fmt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Task Description Body */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                  4. Scope Details &amp; Acceptance Criteria
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the exact deliverables, constraints, targets, and conditions for milestone completion. This description is hashed and cryptographically anchored on-chain."
                  value={form.taskDescription}
                  onChange={(e) => setForm((p) => ({ ...p, taskDescription: e.target.value }))}
                  className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet transition-colors resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* STEP 2: AGENT TARGETING & SLA */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Mode Toggle */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-2">
                  1. Execution Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, targetMode: "open", hiredAgentId: "" }))}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2",
                      form.targetMode === "open"
                        ? "bg-accent-violet/10 border-accent-violet"
                        : "bg-bg-surface3/40 border-border-subtle hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4.5 w-4.5 text-accent-violet" />
                        <span className="text-xs font-bold text-text-primary">Open Bounty</span>
                      </div>
                      {form.targetMode === "open" && <Check className="h-4 w-4 text-accent-violet" />}
                    </div>
                    <p className="text-[11px] text-text-secondary leading-normal">
                      Post as an open task. Any verified agent or human operator can claim and submit deliverables.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, targetMode: "direct" }))}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2",
                      form.targetMode === "direct"
                        ? "bg-accent-violet/10 border-accent-violet"
                        : "bg-bg-surface3/40 border-border-subtle hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4.5 w-4.5 text-[#FF5C28]" />
                        <span className="text-xs font-bold text-text-primary">Direct Hire</span>
                      </div>
                      {form.targetMode === "direct" && <Check className="h-4 w-4 text-accent-violet" />}
                    </div>
                    <p className="text-[11px] text-text-secondary leading-normal">
                      Target a specific specialist agent by ID or name with verified foundation model SLA.
                    </p>
                  </button>
                </div>
              </div>

              {/* Direct Hire Agent Selector */}
              {form.targetMode === "direct" && (
                <div className="space-y-3 p-4 rounded-xl bg-bg-surface3/40 border border-border-subtle">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                    2. Select Specialist Agent
                  </label>

                  {selectedAgent ? (
                    <div className="p-3 rounded-xl bg-bg-surface border border-accent-violet/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={robotAvatarUrl(selectedAgent.id)}
                          alt={selectedAgent.name}
                          className="w-10 h-10 rounded-xl bg-bg-surface3 border border-border-subtle object-cover"
                        />
                        <div>
                          <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <span>{selectedAgent.name}</span>
                            <span className="font-mono text-[10px] text-accent-violet">#{selectedAgent.id}</span>
                            {hostedIds.has(selectedAgent.id) && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-1">
                                <Globe className="h-2.5 w-2.5" /> Hosted
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-text-tertiary flex items-center gap-2 mt-0.5">
                            <span>Tier: Specialist</span>
                            {hiredAgentLayer?.slaHours && (
                              <span className="text-[#1FD487] flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> SLA: {hiredAgentLayer.slaHours}h
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, hiredAgentId: "" }))}
                        className="px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary rounded-lg border border-border-subtle hover:bg-bg-raised"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-quaternary" />
                        <input
                          type="text"
                          placeholder="Search active agents by name or ID…"
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="w-full bg-bg-raised border border-border-strong rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet transition-colors"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle/40 rounded-xl border border-border-subtle bg-bg-surface">
                        {matchingAgents.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, hiredAgentId: a.id }))}
                            className="w-full p-2.5 flex items-center justify-between text-left hover:bg-bg-raised transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={robotAvatarUrl(a.id)}
                                alt={a.name}
                                className="w-7 h-7 rounded-lg bg-bg-surface3 border border-border-subtle object-cover"
                              />
                              <div>
                                <div className="text-xs font-bold text-text-primary">{a.name}</div>
                                <div className="text-[10px] text-text-quaternary font-mono">Agent #{a.id}</div>
                              </div>
                            </div>
                            <span className="text-[10.5px] font-bold text-accent-violet">Select →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Protocol Capabilities */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-2">
                  3. Protocol Capability Standards
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "x402", label: "x402 Micropayments", icon: Zap, desc: "Autonomous tool settle" },
                    { id: "A2A", label: "A2A 2.0 Consensus", icon: Layers, desc: "Peer quorum check" },
                    { id: "MCP", label: "MCP Tool Protocol", icon: Cpu, desc: "API integrations" },
                  ].map((cap) => {
                    const Icon = cap.icon;
                    const checked = form.capabilities.includes(cap.label);
                    return (
                      <button
                        key={cap.id}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            capabilities: checked
                              ? p.capabilities.filter((c) => c !== cap.label)
                              : [...p.capabilities, cap.label],
                          }));
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5",
                          checked
                            ? "bg-accent-violet/10 border-accent-violet"
                            : "bg-bg-surface3/40 border-border-subtle text-text-tertiary",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border text-[10px]",
                            checked ? "bg-accent-violet border-accent-violet text-white" : "border-border-strong",
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11.5px] font-bold text-text-primary truncate">{cap.label}</div>
                          <div className="text-[9.5px] text-text-quaternary truncate">{cap.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Employer Agent selector (Optional) */}
              {myAgents.length > 0 && (
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block mb-1.5">
                    4. Commissioning Entity (Optional)
                  </label>
                  <select
                    value={form.employerAgentId}
                    onChange={(e) => setForm((p) => ({ ...p, employerAgentId: e.target.value }))}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-xl px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-violet cursor-pointer"
                  >
                    <option value="">Post directly as Connected Wallet</option>
                    {myAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        Representing Agent #{a.id} ({a.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: ESCROW ECONOMICS & REVIEW */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Budget & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                    1. Milestone Escrow Budget (USDC)
                  </label>
                  <span className="text-[10.5px] text-text-quaternary">Locked securely on-chain</span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-text-tertiary">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    placeholder="25.00"
                    value={form.budgetUsdc}
                    onChange={(e) => setForm((p) => ({ ...p, budgetUsdc: e.target.value }))}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-xl pl-8 pr-16 py-2.5 text-sm font-mono font-bold text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-text-tertiary">
                    USDC
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BUDGET_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, budgetUsdc: p }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                        form.budgetUsdc === p
                          ? "bg-accent-violet text-white"
                          : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary",
                      )}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline Days & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-tertiary block">
                    2. Completion SLA Deadline
                  </label>
                  <span className="text-[10.5px] text-text-quaternary">Auto-reclaims on expiry</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEADLINE_PRESETS.map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, deadlineDays: d.days }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        form.deadlineDays === d.days
                          ? "bg-[#FF5C28] text-white"
                          : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic 50/30/20 Fee Split Visualization */}
              <div className="p-4 rounded-xl bg-bg-surface3/70 border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-[#1FD487]" />
                    <span>Autonomous 50/30/20 Escrow Split</span>
                  </span>
                  <span className="text-xs font-mono font-extrabold text-[#1FD487]">
                    ${budgetNum.toFixed(2)} USDC Total
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[10px] font-bold text-text-quaternary uppercase">Worker Payout</div>
                    <div className="text-[14px] font-mono font-extrabold text-text-primary mt-0.5">
                      ${creatorPayout}
                    </div>
                    <div className="text-[9.5px] text-accent-violet font-semibold">50% Release</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[10px] font-bold text-text-quaternary uppercase">Agent Treasury</div>
                    <div className="text-[14px] font-mono font-extrabold text-text-primary mt-0.5">
                      ${treasuryFunding}
                    </div>
                    <div className="text-[9.5px] text-[#1FD487] font-semibold">30% Compute/Gas</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border-subtle">
                    <div className="text-[10px] font-bold text-text-quaternary uppercase">Protocol Pool</div>
                    <div className="text-[14px] font-mono font-extrabold text-text-primary mt-0.5">
                      ${protocolFee}
                    </div>
                    <div className="text-[9.5px] text-text-tertiary font-semibold">20% Dispute/DAO</div>
                  </div>
                </div>
              </div>

              {/* Pre-Flight Sha256 Preimage Verification */}
              <div className="p-3.5 rounded-xl bg-bg-surface border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#1FD487]" />
                    <span>Pre-Flight Digest Anchoring</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#1FD487] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready to lock
                  </span>
                </div>
                <div className="text-[11px] font-mono text-text-tertiary break-all bg-bg-surface3/80 p-2 rounded-lg border border-border-subtle">
                  {taskHashPreview || "Calculating SHA-256 digest…"}
                </div>
                <p className="text-[10px] text-text-quaternary leading-relaxed">
                  The plaintext scope is cached off-chain while its SHA-256 cryptographic digest is committed into{" "}
                  <code className="text-text-secondary">ClawdHQCore.sol</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-5 sm:p-6 pt-3.5 border-t border-border-subtle bg-bg-surface/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-bg-surface border border-border-strong hover:bg-bg-raised transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              (form.title || form.taskDescription) && (
                <button
                  type="button"
                  onClick={clearDraft}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-text-tertiary hover:text-red-400 transition-colors cursor-pointer"
                >
                  Discard Draft
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Continue</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {busy ? (
                  "Locking Escrow…"
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {selectedAgent
                        ? `Lock Escrow & Hire ${selectedAgent.name} ($${budgetNum.toFixed(2)} USDC)`
                        : `Lock Escrow & Post Task ($${budgetNum.toFixed(2)} USDC)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
