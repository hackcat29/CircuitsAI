"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, ScrollText, Check, X, Sliders, Coins, ArrowUpCircle, Blocks, FileText, Brain, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useGovernance,
  useProtocolStats,
  useMyAgents,
  useGovernanceActions,
  useEvmGovernorAdapter,
  useWallet,
  type ProposalCategory,
  type Proposal,
} from "@/hooks";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { checkOperationChain } from "@/lib/chainGuard";
import { GovernanceQuorumGauge, ProposalAiAnalysisModal } from "@/components/governance";

const CATEGORY_STYLE: Record<ProposalCategory, { label: string; bg: string; color: string; icon: LucideIcon }> = {
  parameters: { label: "Parameters", bg: "#1a1a2e", color: "#A78BFA", icon: Sliders },
  treasury: { label: "Treasury", bg: "#2e2210", color: "#FFB13D", icon: Coins },
  upgrade: { label: "Upgrade", bg: "#0c1a2e", color: "#60A5FA", icon: ArrowUpCircle },
  skill: { label: "Skill", bg: "#0c2a1d", color: "#1FD487", icon: Blocks },
  other: { label: "Other", bg: "#1a1a1a", color: "#9ca3af", icon: FileText },
};

// Matches ClawdHQGovernor.sol's `category` uint8 ordering exactly.
const CATEGORY_TO_INDEX: Record<ProposalCategory, number> = { parameters: 0, treasury: 1, upgrade: 2, skill: 3, other: 4 };

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "#2e2210", color: "#FFB13D" },
  passed: { label: "Passed", bg: "#0c2a1d", color: "#1FD487" },
  rejected: { label: "Rejected", bg: "#2e1313", color: "#FF4D4D" },
  quorum_not_met: { label: "Quorum Not Met", bg: "#2a2a2a", color: "#9ca3af" },
  canceled: { label: "Canceled", bg: "#2e1313", color: "#FF4D4D" },
  executed: { label: "Executed", bg: "#0c2a1d", color: "#1FD487" },
};

// Mirrors ClawdHQGovernor.sol's EXECUTION_DELAY constant — the timelock buffer after a
// proposal succeeds, before {execute} may be called.
const EXECUTION_DELAY_MS = 1 * 86_400_000;
const DEFAULT_MIN_JOBS_TO_PROPOSE = 10;
const DEFAULT_MIN_JOBS_TO_VOTE = 1;

function timeLeft(endTime: number): string {
  const diff = endTime - Date.now();
  if (diff <= 0) return "Ended";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m left`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h left`;
  return `${Math.floor(diff / 86400_000)}d left`;
}

function fmtUsdc(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// A separate top-level helper (rather than an inline `Date.now()` in the component body) so
// the "now" read stays out of the render function itself — same pattern as `timeLeft` above.
function isExecutable(p: Proposal): boolean {
  return p.status === "passed" && Date.now() >= p.endTime + EXECUTION_DELAY_MS;
}

// Passed proposals sit behind a 1-day timelock before `execute()` will succeed — without this,
// a passed-but-not-yet-executable proposal renders with no button and no explanation, reading
// as broken rather than "wait a bit longer."
function timeUntilExecutable(p: Proposal): string | null {
  if (p.status !== "passed") return null;
  const diff = p.endTime + EXECUTION_DELAY_MS - Date.now();
  if (diff <= 0) return null;
  if (diff < 3600_000) return `Executable in ${Math.ceil(diff / 60_000)}m`;
  return `Executable in ${Math.ceil(diff / 3600_000)}h`;
}

export default function GovernancePage() {
  const { proposals, activeProposals, completedProposals, refetch } = useGovernance();
  const { totals: stats } = useProtocolStats();
  const { chain, isConnected } = useWallet();
  const { agents: myAgents, loading: agentsLoading } = useMyAgents();
  const governanceActions = useGovernanceActions();
  const governorAdapter = useEvmGovernorAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);

  const [activeTab, setActiveTabRaw] = useState<"active" | "history" | "new">("active");
  function setActiveTab(tab: "active" | "history" | "new") {
    setActionError(null);
    setActiveTabRaw(tab);
  }
  const [newForm, setNewForm] = useState({ title: "", description: "", category: "parameters" as ProposalCategory, durationDays: 7 });
  const [proposerAgentId, setProposerAgentId] = useState<string>("");
  const [voterAgentByProposal, setVoterAgentByProposal] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null); // proposal id currently mid-tx, or "new"/"execute:<id>"
  const [minJobsToPropose, setMinJobsToPropose] = useState(DEFAULT_MIN_JOBS_TO_PROPOSE);
  const [minJobsToVote, setMinJobsToVote] = useState(DEFAULT_MIN_JOBS_TO_VOTE);

  // AI impact modal state
  const [selectedProposalForAi, setSelectedProposalForAi] = useState<Proposal | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  function handleOpenAiAnalysis(proposal: Proposal) {
    setSelectedProposalForAi(proposal);
    setShowAiModal(true);
  }

  useEffect(() => {
    if (!governorAdapter) return;
    let cancelled = false;
    Promise.all([governorAdapter.getMinJobsCompletedToPropose(), governorAdapter.getMinJobsCompletedToVote()])
      .then(([toPropose, toVote]) => {
        if (cancelled) return;
        setMinJobsToPropose(Number(toPropose));
        setMinJobsToVote(Number(toVote));
      })
      .catch(() => {
        // Falls back to the contract's own documented defaults — cosmetic only, the on-chain
        // call itself enforces the real threshold regardless of what's displayed here.
      });
    return () => {
      cancelled = true;
    };
  }, [governorAdapter]);

  const eligibleToPropose = useMemo(() => myAgents.filter((a) => a.jobsCompleted >= minJobsToPropose), [myAgents, minJobsToPropose]);
  const eligibleToVote = useMemo(() => myAgents.filter((a) => a.jobsCompleted >= minJobsToVote), [myAgents, minJobsToVote]);
  // Falls back to the first eligible agent until the user picks a different one — derived at
  // render time rather than synced into state via an effect, since it's a pure function of
  // `eligibleToPropose`.
  const effectiveProposerAgentId = proposerAgentId || eligibleToPropose[0]?.numericId || "";

  function voterAgentFor(proposalId: string): string {
    return voterAgentByProposal[proposalId] ?? eligibleToVote[0]?.numericId ?? "";
  }

  async function handleCreate() {
    if (!newForm.title || !newForm.description || !effectiveProposerAgentId) return;
    setActionError(null);
    setPendingAction("new");
    try {
      await governanceActions.createProposal({
        proposerAgentId: effectiveProposerAgentId,
        title: newForm.title,
        description: newForm.description,
        category: CATEGORY_TO_INDEX[newForm.category],
        votingPeriodDays: newForm.durationDays,
      });
      setSubmitted(true);
      await refetch();
      setTimeout(() => {
        setSubmitted(false);
        setNewForm({ title: "", description: "", category: "parameters", durationDays: 7 });
        setActiveTab("active");
      }, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to submit proposal.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleVote(p: Proposal, support: boolean) {
    if (!checkOperationChain(p.chain, "cast a vote")) return;
    const agentId = voterAgentFor(p.id);
    if (!agentId) return;
    setActionError(null);
    setPendingAction(p.id);
    try {
      await governanceActions.vote(p.chainProposalId, agentId, support);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cast vote.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleExecute(p: Proposal) {
    if (!checkOperationChain(p.chain, "execute this proposal")) return;
    setActionError(null);
    setPendingAction(`execute:${p.id}`);
    try {
      await governanceActions.execute(p.chainProposalId);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to execute proposal.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
      {/* Hero */}
      <div
        className="rounded-[14px] px-7.5 py-7 mb-5 border border-border-subtle bg-bg-elevated shadow-xs"
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight mb-2 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-accent-violet" />
              <span>Protocol Governance</span>
            </h1>
            <p className="text-[12.5px] text-text-tertiary leading-[1.6] max-w-130">
              On-chain governance for the Circuits Protocol. Agents vote with real USDC-bond weight on parameter changes, treasury allocations, upgrades, and ecosystem decisions. A passed proposal sits
              behind a 1-day execution timelock, then any connected wallet can ratify it on-chain, permissionless, same as most
              production DAOs' execute step.
            </p>
            <div className="flex flex-wrap gap-x-7 gap-y-3 mt-4">
              {[
                [String(activeProposals.length), "Active"],
                [String(proposals.length), "Total Proposals"],
                [stats ? String(Number(stats.totalAgents)) : "···", "Registered Agents"],
              ].map(([val, lbl]) => (
                <div key={lbl}>
                  <div className="text-[20px] font-extrabold font-mono">{val}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setActiveTab("new")}
            className="shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            + Submit Proposal
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="mb-5 px-4 py-2.5 rounded-[10px] bg-bg-elevated border border-border-subtle text-[12px] text-text-tertiary">
          Sign in to propose or vote. Proposals and votes are cast on-chain by whichever agent you own.
        </div>
      )}

      {actionError && (
        <div className="mb-5 px-4 py-2.5 rounded-[10px] bg-[#2e1313] border border-[#FF4D4D]/25 text-[12px] text-[#FF4D4D]">{actionError}</div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-border-subtle mb-5 gap-0 overflow-x-auto">
        {([["active", "Active Proposals"], ["history", "History"], ["new", "+ New Proposal"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pt-2.5 pb-2.5 mr-5.5 text-[13px] font-semibold border-b-2 transition-all duration-150 whitespace-nowrap shrink-0",
              activeTab === tab ? "text-text-primary border-accent-violet" : "text-text-tertiary border-transparent hover:text-text-secondary",
            )}
          >
            {label}
            {tab === "active" && activeProposals.length > 0 && (
              <span className="ml-1.5 text-[9.5px] font-bold bg-accent-dark text-accent-violet px-1.5 py-0.5 rounded-full">{activeProposals.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Active proposals */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {activeProposals.length === 0 && (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
              <Landmark className="h-8 w-8 text-accent-violet mx-auto mb-3" />
              <div className="text-[14px] font-bold text-text-primary mb-2">No Active Proposals</div>
              <p className="text-[12px] text-text-tertiary mb-5">Submit a proposal to improve the protocol. Any agent with {minJobsToPropose}+ completed jobs can propose.</p>
              <button onClick={() => setActiveTab("new")} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs cursor-pointer">
                Submit Proposal →
              </button>
            </div>
          )}
          {activeProposals.map((p) => {
            const total = p.votesFor + p.votesAgainst;
            const forPct = total ? Math.round((p.votesFor / total) * 100) : 50;
            const quorumPct = Math.min(100, Math.round((total / p.quorumRequired) * 100));
            const catStyle = CATEGORY_STYLE[p.category];
            const alreadyVotedAgentIds = eligibleToVote.filter((a) => p.votedAgentChainIds.includes(a.numericId));
            const votableAgents = eligibleToVote.filter((a) => !p.votedAgentChainIds.includes(a.numericId));
            const selectedVoter = voterAgentFor(p.id);
            const busy = pendingAction === p.id;
            return (
              <div key={p.id} className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: catStyle.bg, color: catStyle.color }}>
                        <catStyle.icon className="h-3 w-3" />
                        <span>{catStyle.label}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono" style={{ background: STATUS_STYLE.active.bg, color: STATUS_STYLE.active.color }}>Active</span>
                      <span className="text-[11px] text-text-quaternary font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{timeLeft(p.endTime)}</span>
                      </span>
                    </div>
                    <h3 className="text-[14.5px] font-extrabold text-text-primary mb-1">{p.title}</h3>
                    <p className="text-[12px] text-text-tertiary leading-[1.6] line-clamp-2">{p.description}</p>
                    <div className="text-[11px] text-text-quaternary mt-1.5">
                      Proposed by <span className="text-text-secondary font-semibold">agent #{p.proposerAgentChainId}</span> ({p.proposer.slice(0, 6)}…{p.proposer.slice(-4)})
                    </div>
                  </div>

                  {/* AI Analysis Trigger */}
                  <button
                    type="button"
                    onClick={() => handleOpenAiAnalysis(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white text-[11px] font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span>AI Analysis</span>
                  </button>
                </div>

                {/* Quorum & Vote Weight Gauge */}
                <GovernanceQuorumGauge
                  votesFor={p.votesFor}
                  votesAgainst={p.votesAgainst}
                  quorumRequired={p.quorumRequired}
                  status={p.status}
                />

                {isConnected && votableAgents.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {votableAgents.length > 1 && (
                      <select
                        value={selectedVoter}
                        onChange={(e) => setVoterAgentByProposal((m) => ({ ...m, [p.id]: e.target.value }))}
                        className="w-full bg-bg-raised border border-border-strong rounded-lg px-2.5 py-1.5 text-[11.5px] text-text-primary outline-none cursor-pointer"
                      >
                        {votableAgents.map((a) => (
                          <option key={a.numericId} value={a.numericId}>
                            Vote as {a.name} (#{a.numericId})
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        disabled={busy}
                        onClick={() => handleVote(p, true)}
                        className="flex-1 py-2 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/25 text-[12px] font-bold text-[#1FD487] hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {busy ? "Voting…" : (
                          <>
                            <Check className="h-3.5 w-3.5" /> Vote For
                          </>
                        )}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => handleVote(p, false)}
                        className="flex-1 py-2 rounded-[10px] bg-[#2e1313] border border-[#FF4D4D]/25 text-[12px] font-bold text-[#FF4D4D] hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {busy ? "Voting…" : (
                          <>
                            <X className="h-3.5 w-3.5" /> Vote Against
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 px-3 rounded-[10px] bg-bg-surface3 border border-border-strong text-[11.5px] font-bold text-text-quaternary text-center flex items-center justify-center gap-1.5">
                    {!isConnected
                      ? "Sign in to vote"
                      : alreadyVotedAgentIds.length > 0
                        ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-accent-violet" /> You voted with agent #{alreadyVotedAgentIds[0]?.numericId}
                          </>
                        )
                        : agentsLoading
                          ? "Loading your agents…"
                          : `Needs an owned agent with ${minJobsToVote}+ completed jobs and a posted USDC bond`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {completedProposals.length === 0 ? (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
              <ScrollText className="h-8 w-8 text-text-quaternary mx-auto mb-3" />
              <div className="text-[14px] font-bold text-text-primary mb-2">No Past Proposals</div>
              <p className="text-[12px] text-text-tertiary">Finished proposals will appear here.</p>
            </div>
          ) : completedProposals.map((p) => {
            const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.rejected;
            const catStyle = CATEGORY_STYLE[p.category];
            const total = p.votesFor + p.votesAgainst;
            const forPct = total ? Math.round((p.votesFor / total) * 100) : 50;
            const canExecute = isExecutable(p);
            const executing = pendingAction === `execute:${p.id}`;
            return (
              <div key={p.id} className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4.5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: catStyle.bg, color: catStyle.color }}>
                        <catStyle.icon className="h-3 w-3" />
                        <span>{catStyle.label}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full font-mono" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    <h3 className="text-[13.5px] font-bold text-text-primary mb-0.5">{p.title}</h3>
                    <p className="text-[11.5px] text-text-tertiary line-clamp-2">{p.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenAiAnalysis(p)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-bg-surface hover:bg-bg-surface3 border border-border-subtle text-[10.5px] font-bold text-text-secondary transition-colors cursor-pointer"
                    >
                      <Brain className="h-3 w-3 text-accent-violet" />
                      <span>Analysis</span>
                    </button>

                    <div className="text-right">
                      <div className="text-[13px] font-extrabold font-mono text-[#1FD487]">{forPct}% For</div>
                      <div className="text-[10px] text-text-quaternary font-mono">{fmtUsdc(total)} USDC</div>
                    </div>
                  </div>
                </div>

                {/* Quorum Progress Bar for Historical proposal */}
                <GovernanceQuorumGauge
                  votesFor={p.votesFor}
                  votesAgainst={p.votesAgainst}
                  quorumRequired={p.quorumRequired}
                  status={p.status}
                />

                {canExecute && (
                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                    <span className="text-[11px] text-[#1FD487] font-bold">Timelock buffer passed. Ready to ratify.</span>
                    <button
                      disabled={executing}
                      onClick={() => handleExecute(p)}
                      className="px-4 py-1.5 rounded-full text-[11px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      {executing ? "Ratifying…" : "Ratify on-chain"}
                    </button>
                  </div>
                )}
                {!canExecute && timeUntilExecutable(p) && (
                  <div className="pt-1.5 border-t border-border-subtle text-[11px] font-mono font-bold text-amber-400">
                    {timeUntilExecutable(p)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New proposal */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {submitted ? (
              <div className="bg-bg-elevated border border-[#1FD487]/25 rounded-[14px] p-12 text-center">
                <Landmark className="h-8 w-8 text-accent-violet mx-auto mb-3" />
                <div className="text-[15px] font-extrabold text-[#1FD487] mb-2">Proposal Submitted On-Chain</div>
                <p className="text-[12px] text-text-tertiary">The community can now vote for {newForm.durationDays} days. Quorum is tracked live once the indexer picks up your transaction.</p>
              </div>
            ) : (
              <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-6 space-y-4">
                {isConnected && !agentsLoading && eligibleToPropose.length === 0 && (
                  <div className="px-3.5 py-2.5 rounded-[10px] bg-bg-raised border border-border-strong text-[12px] text-text-tertiary">
                    You need an owned agent with {minJobsToPropose}+ completed jobs to submit a proposal. {myAgents.length > 0 && "None of your agents qualify yet."}
                  </div>
                )}

                {eligibleToPropose.length > 0 && (
                  <div>
                    <label className="text-[10.5px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">Proposing Agent</label>
                    <select
                      value={effectiveProposerAgentId}
                      onChange={(e) => setProposerAgentId(e.target.value)}
                      className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.25 text-[12.5px] text-text-primary outline-none"
                    >
                      {eligibleToPropose.map((a) => (
                        <option key={a.numericId} value={a.numericId}>
                          {a.name} (#{a.numericId}), {a.jobsCompleted} jobs completed
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10.5px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">Proposal Title</label>
                  <input
                    value={newForm.title}
                    onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Short, descriptive title for the proposal"
                    maxLength={120}
                    className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.25 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CATEGORY_STYLE) as ProposalCategory[]).map((cat) => {
                      const s = CATEGORY_STYLE[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => setNewForm((f) => ({ ...f, category: cat }))}
                          className={cn("px-3 py-1.5 rounded-full text-[11.5px] font-bold border capitalize transition-all", newForm.category === cat ? "border-accent-violet/35 bg-accent-dark text-accent-violet" : "border-border-strong bg-bg-raised text-text-tertiary hover:border-border-hover")}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">Voting Duration</label>
                  <div className="flex gap-1.5">
                    {[3, 7, 14].map((d) => (
                      <button key={d} onClick={() => setNewForm((f) => ({ ...f, durationDays: d }))} className={cn("px-4 py-1.75 rounded-[9px] text-[12px] font-bold border transition-all", newForm.durationDays === d ? "bg-accent-dark border-accent-violet/35 text-accent-violet" : "border-border-strong text-text-tertiary hover:border-border-hover")}>
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-text-quaternary uppercase tracking-wider block mb-1.5">Full Description</label>
                  <textarea
                    rows={5}
                    value={newForm.description}
                    onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Explain the motivation, expected impact, and any technical details. Clear proposals with strong rationale pass more easily."
                    maxLength={4000}
                    className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/50 transition-colors"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!newForm.title || !newForm.description || !effectiveProposerAgentId || pendingAction === "new"}
                  className="w-full py-2.75 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {pendingAction === "new" ? (
                    "Submitting…"
                  ) : (
                    <>
                      <Landmark className="h-3.5 w-3.5" /> Submit Proposal On-Chain
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-border-subtle bg-bg-elevated p-4.5">
              <div className="text-[12px] font-bold text-text-primary mb-2.5">Before you submit</div>
              <ul className="flex flex-col gap-2 text-[11.5px] text-text-tertiary leading-[1.6]">
                <li>• You need an owned agent with {minJobsToPropose}+ completed jobs to propose — reputation-gated, not just a funded wallet.</li>
                <li>• Voting power is identity- and bond-weighted, not simple one-token-one-vote.</li>
                <li>• A passed proposal sits behind a 1-day execution timelock before anyone can ratify it on-chain.</li>
                <li>• Clear proposals with strong rationale in the description pass more easily.</li>
              </ul>
            </div>
            <div className="rounded-[14px] border border-border-subtle bg-bg-elevated p-4.5">
              <div className="text-[12px] font-bold text-text-primary mb-2.5">Categories</div>
              <div className="flex flex-col gap-2">
                {(Object.keys(CATEGORY_STYLE) as ProposalCategory[]).map((cat) => (
                  <div key={cat} className="flex items-center gap-2 text-[11.5px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0")} style={{ background: CATEGORY_STYLE[cat].color }} />
                    <span className="font-semibold text-text-secondary capitalize">{CATEGORY_STYLE[cat].label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Impact Analysis Modal */}
      <ProposalAiAnalysisModal
        isOpen={showAiModal}
        onClose={() => {
          setShowAiModal(false);
          setSelectedProposalForAi(null);
        }}
        proposal={selectedProposalForAi}
      />
    </div>
  );
}
