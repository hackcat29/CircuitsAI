"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Handshake,
  Brain,
  ArrowRight,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatUnits } from "viem";
import { useWallet, useEvmNegotiationAdapter, useNegotiationActions, useFormDraftState } from "@/hooks";
import type { NegotiationSummary } from "@clawdhq/sdk";
import { formatUsdc } from "@/lib/format";
import { describeActionError } from "@/lib/errors";
import {
  NegotiationTimelineTree,
  NegotiationRateBenchmarking,
  NegotiationAiAssistantModal,
} from "@/components/negotiations";

const STATUS_LABEL = ["Proposed", "Countered", "Agreed", "Committed", "Withdrawn"];
const MAX_RECENT = 20;

function sameAddress(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase() === b.toLowerCase();
}

interface ProposeFormState {
  employerAgentId: string;
  counterpartyAgentId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: string;
}

function ProposeForm({ onDone }: { onDone: () => void }) {
  const { chain } = useWallet();
  const { proposeJob, busy } = useNegotiationActions();
  const [form, setForm, clearDraft] = useFormDraftState<ProposeFormState>("negotiation_propose", {
    employerAgentId: "",
    counterpartyAgentId: "",
    taskDescription: "",
    budgetUsdc: "25",
    deadlineDays: "3",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await proposeJob({ ...form, deadlineDays: Number(form.deadlineDays) || 3 });
      clearDraft();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose negotiation.");
    }
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Benchmark Rate Guidance */}
      <NegotiationRateBenchmarking
        onApplyBenchmark={(budget, deadline) => {
          setForm((f) => ({ ...f, budgetUsdc: budget, deadlineDays: deadline }));
        }}
      />

      <form onSubmit={handleSubmit} className="bg-bg-elevated border border-border-strong rounded-[16px] p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-accent-violet" />
            <h3 className="text-[14.5px] font-extrabold text-text-primary">Propose New Pre-Escrow Negotiation</h3>
          </div>
          <span className="text-[11px] font-mono text-text-quaternary">
            Chain: <span className="font-bold text-text-secondary">{chain.chainName}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
              Your Agent ID (Employer, optional)
            </label>
            <input
              value={form.employerAgentId}
              onChange={(e) => setForm((f) => ({ ...f, employerAgentId: e.target.value }))}
              placeholder="e.g. 1"
              className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
              Target Agent ID (optional: leave open for anyone)
            </label>
            <input
              value={form.counterpartyAgentId}
              onChange={(e) => setForm((f) => ({ ...f, counterpartyAgentId: e.target.value }))}
              placeholder="e.g. 2 (or leave empty for open bid)"
              className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
            Task Description &amp; Requirements
          </label>
          <textarea
            rows={3}
            required
            value={form.taskDescription}
            onChange={(e) => setForm((f) => ({ ...f, taskDescription: e.target.value }))}
            placeholder="Describe the desired deliverables, specifications, and scope..."
            className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/60 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
              Opening Budget (USDC)
            </label>
            <input
              required
              value={form.budgetUsdc}
              onChange={(e) => setForm((f) => ({ ...f, budgetUsdc: e.target.value }))}
              className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent-violet/60 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">
              Opening SLA Deadline (days)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              required
              value={form.deadlineDays}
              onChange={(e) => setForm((f) => ({ ...f, deadlineDays: e.target.value }))}
              className="w-full bg-bg-raised border border-border-strong rounded-[9px] px-3 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent-violet/60 transition-colors font-mono"
            />
          </div>
        </div>

        {error && <p className="text-[11.5px] text-red-400 font-semibold p-2.5 rounded bg-red-500/10 border border-red-500/20">{error}</p>}

        <div className="flex items-center gap-2">
          {(form.taskDescription || form.employerAgentId || form.counterpartyAgentId) && (
            <button
              type="button"
              onClick={clearDraft}
              className="py-2.75 px-3.5 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-red hover:bg-red/10 transition-all cursor-pointer"
            >
              Discard Draft
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.75 rounded-full text-[13px] font-extrabold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {busy ? "Proposing Terms On-Chain…" : "Propose Negotiation on Monad"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NegotiationPanel({ negotiationId }: { negotiationId: string }) {
  const { address } = useWallet();
  const adapter = useEvmNegotiationAdapter(useWallet().chain);
  const { counterOffer, acceptTerms, commit, withdraw, busy } = useNegotiationActions();
  const [n, setN] = useState<NegotiationSummary | null>(null);
  const [counterForm, setCounterForm] = useState({ providerAgentId: "", taskDescription: "", budgetUsdc: "", deadlineDays: "3" });
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);

  // AI assistant modal state
  const [showAiModal, setShowAiModal] = useState(false);

  const refresh = useCallback(async () => {
    if (!adapter) return;
    try {
      setN(await adapter.getNegotiation(BigInt(negotiationId)));
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }, [adapter, negotiationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!adapter) {
    return <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center text-[12px] text-text-tertiary">Negotiation isn&apos;t configured on this chain.</div>;
  }
  if (!n) {
    return (
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center text-[12px] text-text-tertiary">
        {refreshError ? (
          <>
            Couldn&apos;t load negotiation #{negotiationId}. The RPC didn&apos;t respond in time.{" "}
            <button onClick={() => refresh()} className="font-bold text-amber-400 hover:underline">
              Retry
            </button>
          </>
        ) : (
          `Loading negotiation #${negotiationId}…`
        )}
      </div>
    );
  }

  const isClient = sameAddress(address, n.client);
  const isOpen = n.counterpartyAgentId === "0";
  const active = n.status === 0 || n.status === 1;
  const canAccept = active && !isOpen && ((isClient && !n.lastProposerIsClient) || (!isClient && n.lastProposerIsClient));
  const canCounterAsClient = active && isClient && !n.lastProposerIsClient;
  const canCounterAsProvider = active && (!isClient || isOpen);

  async function handle(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeActionError(err, "Transaction failed."));
      return;
    }
    await refresh();
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-6 mb-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-text-primary">Negotiation #{negotiationId}</h2>
          {refreshError && (
            <button onClick={() => refresh()} className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.75 rounded-full bg-bg-surface3 text-text-primary border border-border-subtle">
            {STATUS_LABEL[n.status] ?? "Active"}
          </span>
          <Link href="/negotiations" className="text-xs text-accent-violet hover:underline font-bold">
            ← All Negotiations
          </Link>
        </div>
      </div>

      {/* Visual Timeline Tree */}
      <NegotiationTimelineTree negotiation={n} />

      {/* AI Assistant Button */}
      {active && (
        <div className="flex items-center justify-between p-3.5 rounded-[12px] bg-accent-dark/40 border border-accent-violet/30">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Brain className="h-4 w-4 text-accent-violet shrink-0" />
            <span>Need assistance formulating balanced counter-offer terms?</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="px-3 py-1.5 rounded-[8px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shrink-0 shadow-xs"
          >
            AI Formulator →
          </button>
        </div>
      )}

      {error && <p className="text-[11.5px] text-red-400 font-semibold p-2.5 rounded bg-red-500/10 border border-red-500/20">{error}</p>}

      {/* 1-Click Escrow Commit when Terms Agreed */}
      {n.status === 2 /* Agreed */ && isClient && (
        <div className="p-4 rounded-[14px] bg-[#0c2a1d] border border-[#1FD487]/30 space-y-2.5">
          <div className="flex items-center gap-2 text-[#1FD487] text-[13px] font-bold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Terms Mutually Agreed! Ready to Commit Escrow.</span>
          </div>
          <button
            onClick={() => handle(() => commit(negotiationId, formatUnits(n.budget, 6)))}
            disabled={busy}
            className="w-full py-2.5 rounded-full bg-[#1FD487] text-bg-surface text-[12.5px] font-extrabold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            {busy ? "Securing Escrow on Monad…" : `Deposit Escrow & Create Job (${formatUsdc(n.budget)})`}
          </button>
        </div>
      )}

      {/* Counter-Offer / Acceptance Actions */}
      {active && (
        <div className="space-y-3">
          {canAccept && (
            <button
              onClick={() => handle(() => acceptTerms(negotiationId))}
              disabled={busy}
              className="w-full py-2.5 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-[12.5px] font-bold text-[#1FD487] hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              {busy ? "Accepting…" : "Accept Current Terms"}
            </button>
          )}

          {(canCounterAsClient || canCounterAsProvider) && (
            <div className="border border-border-strong rounded-[14px] p-4 space-y-2.5 bg-bg-surface">
              <div className="text-[11.5px] font-bold text-text-primary uppercase tracking-wider">Submit Counter-Offer</div>
              {!isClient && (
                <input
                  value={counterForm.providerAgentId}
                  onChange={(e) => setCounterForm((f) => ({ ...f, providerAgentId: e.target.value }))}
                  placeholder="Your Provider Agent ID (e.g. 2)"
                  className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-xs text-text-primary outline-none focus:border-accent-violet/50"
                />
              )}
              <textarea
                rows={2}
                value={counterForm.taskDescription}
                onChange={(e) => setCounterForm((f) => ({ ...f, taskDescription: e.target.value }))}
                placeholder="Revised task scope and terms..."
                className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-2 text-xs text-text-primary resize-none outline-none focus:border-accent-violet/50 leading-relaxed"
              />
              <div className="flex gap-2">
                <input
                  value={counterForm.budgetUsdc}
                  onChange={(e) => setCounterForm((f) => ({ ...f, budgetUsdc: e.target.value }))}
                  placeholder="Counter Budget (USDC)"
                  className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-xs text-text-primary font-mono outline-none focus:border-accent-violet/50"
                />
                <input
                  type="number"
                  value={counterForm.deadlineDays}
                  onChange={(e) => setCounterForm((f) => ({ ...f, deadlineDays: e.target.value }))}
                  placeholder="Days"
                  className="w-24 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-xs text-text-primary font-mono outline-none focus:border-accent-violet/50"
                />
              </div>
              <button
                onClick={() => handle(() => counterOffer(negotiationId, counterForm.providerAgentId, { taskDescription: counterForm.taskDescription, budgetUsdc: counterForm.budgetUsdc, deadlineDays: Number(counterForm.deadlineDays) || 3 }))}
                disabled={busy || !counterForm.taskDescription || !counterForm.budgetUsdc}
                className="w-full py-2.25 rounded-[9px] bg-accent-violet text-xs font-bold text-white hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {busy ? "Submitting Counter…" : "Submit Counter-Offer On-Chain"}
              </button>
            </div>
          )}

          <button
            onClick={() => handle(() => withdraw(negotiationId))}
            disabled={busy}
            className="w-full py-1.75 rounded-[9px] bg-bg-surface3 border border-border-strong text-xs font-bold text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Withdraw Negotiation
          </button>
        </div>
      )}

      {n.status === 3 /* Committed */ && (
        <div className="rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 p-3.5 text-xs text-[#1FD487] flex items-center justify-between">
          <span>Agreed terms became an active escrow job on Monad.</span>
          <Link href="/marketplace" className="underline font-bold">
            View in Task Market →
          </Link>
        </div>
      )}

      {/* AI Assistant Modal */}
      <NegotiationAiAssistantModal
        negotiation={n}
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onApplyTerms={(budget, deadline, rationale) => {
          setCounterForm((f) => ({
            ...f,
            budgetUsdc: budget,
            deadlineDays: deadline,
            taskDescription: `${f.taskDescription ? f.taskDescription + " " : ""}${rationale}`,
          }));
        }}
      />
    </div>
  );
}

function NegotiationsPageContent() {
  const searchParams = useSearchParams();
  const negotiationId = searchParams.get("negotiationId");
  const { chain } = useWallet();
  const adapter = useEvmNegotiationAdapter(chain);
  const [showForm, setShowForm] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const refreshList = useCallback(async () => {
    if (!adapter) return;
    const total = await adapter.getTotalNegotiations();
    const from = total > BigInt(MAX_RECENT) ? total - BigInt(MAX_RECENT) + 1n : 1n;
    const ids: string[] = [];
    for (let i = total; i >= from && i > 0n; i--) ids.push(i.toString());
    setRecentIds(ids);
  }, [adapter]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5 space-y-6">
      <div className="flex items-end justify-between gap-3.5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight flex items-center gap-2">
            <Handshake className="h-5 w-5 text-accent-violet" />
            <span>Pre-Escrow Terms Negotiations</span>
          </h1>
          <p className="text-[12.5px] text-text-tertiary mt-1">
            Propose, counter-offer, and converge on task specifications on Monad before committing funds to escrow.
          </p>
        </div>
        {adapter && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            {showForm ? "Close Form" : "+ Propose Terms"}
          </button>
        )}
      </div>

      {!adapter && (
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-12 text-center text-[12px] text-text-tertiary">
          Negotiation isn&apos;t configured on {chain.chainName} yet.
        </div>
      )}

      {showForm && <ProposeForm onDone={() => { setShowForm(false); refreshList(); }} />}

      {negotiationId ? (
        <NegotiationPanel negotiationId={negotiationId} />
      ) : (
        adapter && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13.5px] font-extrabold text-text-primary">Recent On-Chain Negotiations</h3>
              <span className="font-mono text-xs text-text-quaternary">{recentIds.length} Total</span>
            </div>

            {recentIds.length === 0 && (
              <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-10 text-center text-xs text-text-tertiary">
                No negotiations recorded on {chain.chainName} yet. Click &ldquo;+ Propose Terms&rdquo; to start the first negotiation.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recentIds.map((id) => (
                <Link
                  key={id}
                  href={`/negotiations?negotiationId=${id}`}
                  className="block bg-bg-elevated border border-border-subtle hover:border-accent-violet/40 rounded-[14px] p-4 transition-all shadow-2xs hover:shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                      Negotiation #{id}
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-accent-violet">Monad</span>
                  </div>
                  <span className="text-[11px] text-text-quaternary font-mono">View Terms &amp; Timeline →</span>
                </Link>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function NegotiationsPage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5 text-[12px] text-text-tertiary">Loading Negotiations…</div>}>
      <NegotiationsPageContent />
    </Suspense>
  );
}
