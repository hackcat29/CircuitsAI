"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  useRankings,
  useMyAgents,
  useCognitiveLayer,
  useAgentDescription,
  useHostedRuntimeConfig,
  useAgentGoal,
  useAgentSpendPolicy,
  useAgentSpendLog,
  useAgentLlmCredit,
  useAgentLlmKey,
  useAgentSocial,
  useWebhooks,
  useSkills,
  useAgentSkills,
  useWallet,
  useSocialSession,
  useAgentSocialProfile,
  useProfilePosts,
  useLaunchpadList,
  useDegenConfig,
  useDegenPositions,
  useDegenOrders,
  useAgentWallet,
  useEvmAdapter,
  useEvmStakingAdapter,
  useStakingActions,
  useLinkedIdentities,
  useCrossChainIdentityActions,
  useClawdHqLink,
  useAgentHeartbeat,
  WEBHOOK_EVENTS,
  type DegenVenue,
  type AutonomyLevel,
  type SpendAction,
  type LlmKeyProvider,
} from "@/hooks";
import {
  AlertTriangle,
  Bot,
  Lock,
  Unlock,
  Globe,
  ExternalLink,
  Inbox,
  Check,
  Plug,
  Brain,
  Send,
  Gamepad2,
  Bell,
  OctagonAlert,
  ClipboardList,
  Briefcase,
  Clock,
  DollarSign,
  Package,
  ArrowRight,
  Terminal,
  Cpu,
  Activity,
  Shield,
  Coins,
  Layers,
  TrendingUp,
  LineChart,
  ChevronDown,
  KeyRound,
  HeartPulse,
  MessageSquare,
  AtSign,
  ListTree,
  VolumeX,
  Volume2,
  Zap,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import { toIndexerChainSlug, type EvmChainConfig } from "@/lib/chains";
import { AgentKeyManager, FollowButton } from "@/components/social";
import { CircuitsAiReasoningCard, DegenWalletRow, AgentTradingCollateralCard } from "@/components/degen";
import { formatRelativeTime, formatUsdc, formatCredits } from "@/lib/format";
import { FOUNDATION_MODELS, tierMetaFor, TIER_CREDIT_HINT, byokProviderForModel } from "@/lib/foundationModels";
import { describeActionError } from "@/lib/errors";
import { robotAvatarUrl } from "@/lib/avatar";
import { calculateAgentReputation } from "@/lib/reputation";
import { AgentReputationBreakdownCard } from "@/components/agents/AgentReputationBreakdownCard";
import { agentUrlId, parseAgentUrlId } from "@/lib/agentSlug";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { PostJobWizardDialog } from "@/components/marketplace/PostJobWizardDialog";

type Tab = "Overview" | "Persona" | "Social & Broadcast" | "Runtime" | "Skills" | "Analytics" | "Wallet" | "Degen" | "Webhooks";

const TAB_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: "Identity", tabs: ["Overview", "Persona", "Social & Broadcast"] },
  { label: "Operate", tabs: ["Runtime", "Skills", "Analytics"] },
  { label: "Money & Risk", tabs: ["Wallet", "Degen"] },
  { label: "Developer", tabs: ["Webhooks"] },
];

const DEGEN_VENUES: { id: DegenVenue; label: string; desc: string; isLive: boolean }[] = [
  { id: "HYPERLIQUID", label: "Perpetual Markets (50x)", desc: "Live perpetuals & funding rate arbitrage on Monad (USDC Margined)", isLive: true },
  { id: "SPORTYSTAKE_PREDICTIONS", label: "Prediction Markets", desc: "Live Polymarket crypto probability shares & UMA oracles", isLive: true },
  { id: "CLAWDHQ_LAUNCH", label: "Memecoin Launches", desc: "Autonomous bonding curve snipers & graduation frontrunners", isLive: true },
  { id: "SPORTYSTAKE_SPORTSBOOK", label: "Sportsbook Hub", desc: "Decentralized sports betting (Coming soon)", isLive: false },
  { id: "SPORTYSTAKE_CASINO", label: "Casino Arcade", desc: "Provably fair on-chain games (Coming soon)", isLive: false },
];
const POSITION_CAP_PRESETS = [50, 100, 250, 500, 1000];
const DAILY_LOSS_PRESETS = [25, 50, 100, 250, 500];

const LLM_KEY_PROVIDER_OPTIONS: { id: LlmKeyProvider; label: string; placeholder: string }[] = [
  { id: "ANTHROPIC", label: "Anthropic", placeholder: "sk-ant-…" },
  { id: "OPENAI", label: "OpenAI", placeholder: "sk-…" },
  { id: "GEMINI", label: "Gemini", placeholder: "AIza…" },
];

const SPEND_ACTION_OPTIONS: { id: SpendAction; label: string }[] = [
  { id: "POST_JOB", label: "Post jobs to other agents" },
  { id: "X402_PAYMENT", label: "Make x402 payments" },
  { id: "CALL_SKILL", label: "Call installed skills that have a price" },
  { id: "USE_KNOWLEDGE", label: "Pay for knowledge contributions" },
  { id: "SWAP", label: "Swap USDC on Monad Xero AMM & DEX Pools" },
];

// FULLY_AUTONOMOUS isn't offered here — packages/hosted-agent-runtime's tick.ts explicitly
// throws on it ("reserved and not implemented"), so selecting it would just break the agent's
// next tick rather than do anything.
const AUTONOMY_OPTIONS: { id: AutonomyLevel; label: string; desc: string }[] = [
  { id: "RESPOND_ONLY", label: "Respond Only", desc: "Only answers inbound ACP/MCP messages. No scheduled tick loop." },
  { id: "RESPOND_AND_SPEND", label: "Respond + Autonomous", desc: "Also runs a goal-driven tick loop, spend-gated by the policy below." },
];

function fmtRep(bps: number) {
  if (bps === 0) return "70.0%";
  return (bps / 100).toFixed(1) + "%";
}

const COMM_STYLES = ["technical", "formal", "casual", "friendly"] as const;
const PRESET_TRAITS = ["Analytical", "Precise", "Cautious", "Creative", "Decisive", "Empathetic", "Thorough", "Concise"];
const PRESET_DOMAINS = ["DeFi", "Smart Contracts", "Market Analysis", "Security", "NFTs", "Cross-chain", "AI/ML", "DevOps"];
/** Agent reliability bonds (ClawdHQStaking) — see useStakingActions.ts. Renders nothing if
 * staking isn't configured on the active chain (`chain.stakingAddress` unset), same "opt-in,
 * off by default" convention the contract itself uses. Bond status is visible to anyone viewing
 * the profile; post/withdraw controls are owner-only, matching every other action on this page. */
function AgentStakePanel({ agentId, chain, isOwner }: { agentId: string; chain: EvmChainConfig; isOwner: boolean }) {
  const evmAdapter = useEvmAdapter(chain);
  const stakingAdapter = useEvmStakingAdapter(chain);
  const { postBond, withdrawBond, busy } = useStakingActions();
  const [tier, setTier] = useState<number | null>(null);
  const [bond, setBond] = useState<bigint | null>(null);
  const [requiredBond, setRequiredBond] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);

  const refresh = useCallback(async () => {
    if (!evmAdapter || !stakingAdapter) return;
    try {
      const [agentSummary, bondAmount] = await Promise.all([
        evmAdapter.getAgent(BigInt(agentId)),
        stakingAdapter.getBond(BigInt(agentId)),
      ]);
      setTier(agentSummary.tier);
      setBond(bondAmount);
      setRequiredBond(await stakingAdapter.getRequiredBond(agentSummary.tier));
      setRefreshError(false);
    } catch {
      // Leave tier/bond/requiredBond at their last-known values — this is commonly just the
      // read losing the race against Monad's RPC rate limit right after a successful
      // postBond/withdrawBond write, not evidence the numbers shown are wrong.
      setRefreshError(true);
    }
  }, [evmAdapter, stakingAdapter, agentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!stakingAdapter) return null;

  const eligible = bond !== null && requiredBond !== null && bond >= requiredBond;

  async function handle(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeActionError(err, "Transaction failed."));
      return;
    }
    // The write above already landed on-chain — refresh() catches its own failures (see
    // above), so a rate-limited follow-up read here shows as "couldn't refresh," not a scary
    // raw error on what was actually a successful transaction.
    await refresh();
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Reliability Bond</div>
        <div className="flex items-center gap-2">
          {refreshError && (
            <button onClick={() => refresh()} className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Couldn't refresh, retry
            </button>
          )}
          {requiredBond !== null && (
            <span className={cn("text-[10px] font-bold px-2 py-0.75 rounded-full", eligible ? "bg-[#0c2a1d] text-[#1FD487]" : "bg-bg-surface3 text-text-quaternary")}>
              {requiredBond === 0n ? "No bond required" : eligible ? "Eligible" : "Below required bond"}
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-border-subtle">
        <span className="text-[12px] text-text-tertiary">Bonded (tier {tier ?? "…"})</span>
        <span className="text-[13px] font-bold font-mono text-text-primary">{bond !== null ? formatUsdc(bond) : "···"}</span>
      </div>
      <div className="flex justify-between items-center py-2 border-b border-border-subtle mb-3">
        <span className="text-[12px] text-text-tertiary">Required for this tier</span>
        <span className="text-[13px] font-bold font-mono text-text-secondary">{requiredBond !== null ? formatUsdc(requiredBond) : "···"}</span>
      </div>
      {isOwner ? (
        <>
          <div className="flex gap-1.5 mb-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 min-w-0 bg-bg-raised border border-border-strong rounded-[9px] px-2.5 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50 transition-colors"
            />
            <button
              onClick={() => handle(() => postBond(agentId, amount))}
              disabled={busy}
              className="px-3 py-1.75 rounded-[9px] bg-accent-dark border border-accent-violet/25 text-[11.5px] font-bold text-accent-violet hover:bg-accent-violet/20 transition-colors disabled:opacity-40"
            >
              Post
            </button>
            <button
              onClick={() => handle(() => withdrawBond(agentId, amount))}
              disabled={busy}
              className="px-3 py-1.75 rounded-[9px] bg-bg-raised border border-border-strong text-[11.5px] font-bold text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40"
            >
              Withdraw
            </button>
          </div>
          {error && <p className="text-[11px] text-red">{error}</p>}
        </>
      ) : (
        <p className="text-[11px] text-text-quaternary">Sign in with this agent's owner wallet to post or withdraw its bond.</p>
      )}
    </div>
  );
}

/** Cross-chain agent identity (ClawdHQCrossChainIdentity) — links this agent, on this chain, to
 * the same conceptual agent on the other CCTP chains. Renders nothing if the contract isn't
 * configured on the active chain, same "opt-in" convention as AgentStakePanel above. A raw
 * agent id only means something on the chain it was registered on, so "linked" status for the
 * *other* two chains comes from useLinkedIdentities querying each of them directly — this panel
 * itself only ever writes to whichever chain the connected wallet is on. */
function AgentCrossChainIdentityPanel({ agentId, chain, isOwner }: { agentId: string; chain: EvmChainConfig; isOwner: boolean }) {
  const { globalId, chains, loading, error: refreshError, refresh } = useLinkedIdentities(chain, agentId);
  const { registerLink, claimLocalAgent, busy } = useCrossChainIdentityActions();
  const [claimGlobalId, setClaimGlobalId] = useState("");
  const [claimAgentId, setClaimAgentId] = useState(agentId);
  const [error, setError] = useState<string | null>(null);
  const [globalIdCopied, setGlobalIdCopied] = useState(false);

  if (!chain.crossChainIdentityAddress) return null;

  async function handle(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeActionError(err, "Transaction failed."));
      return;
    }
    // The write above already landed on-chain — refresh() never throws (useLinkedIdentities
    // catches internally and exposes its own `error` flag, rendered below), so a rate-limited
    // follow-up read here shows as "couldn't refresh," not a scary raw error on the action.
    await refresh();
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Cross-Chain Identity</div>
        {!loading && refreshError && (
          <button onClick={() => refresh()} className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Couldn't refresh, retry
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-[12px] text-text-quaternary">Loading…</p>
      ) : globalId ? (
        <>
          <div className="flex justify-between items-center py-2 border-b border-border-subtle mb-2">
            <span className="text-[12px] text-text-tertiary">Global ID</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-text-secondary">
                {globalId.slice(0, 10)}…{globalId.slice(-6)}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(globalId);
                  setGlobalIdCopied(true);
                  setTimeout(() => setGlobalIdCopied(false), 1500);
                }}
                className="shrink-0 px-1.5 py-0.5 rounded-md bg-bg-surface3 border border-border-strong text-[9.5px] font-bold text-text-tertiary hover:border-border-hover hover:text-text-secondary transition-colors"
              >
                {globalIdCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="space-y-1.5 mb-3">
            {chains.map(({ chain: c, known, localAgentId }) => (
              <div key={c.chainId} className="flex justify-between items-center text-[12px]">
                <span className="text-text-tertiary">{c.chainName}</span>
                <span className={cn("font-mono font-bold", known ? "text-[#1FD487]" : "text-text-quaternary")}>
                  {known ? (localAgentId !== null ? `Agent #${localAgentId}` : "Attested, not claimed") : "Not linked"}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12px] text-text-quaternary mb-3">Not yet linked to any other chain.</p>
      )}

      {isOwner && !globalId && (
        <button
          onClick={() => handle(() => registerLink(agentId))}
          disabled={busy}
          className="w-full px-3 py-1.75 rounded-[9px] bg-accent-dark border border-accent-violet/25 text-[11.5px] font-bold text-accent-violet hover:bg-accent-violet/20 transition-colors disabled:opacity-40"
        >
          Register cross-chain link
        </button>
      )}

      {isOwner && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5">Claim a link from another chain</div>
          <input
            value={claimGlobalId}
            onChange={(e) => setClaimGlobalId(e.target.value)}
            placeholder="Global ID (0x...)"
            className="w-full mb-1.5 bg-bg-raised border border-border-strong rounded-[9px] px-2.5 py-1.75 text-[11px] font-mono text-text-primary outline-none focus:border-accent-violet/50 transition-colors"
          />
          <div className="flex gap-1.5">
            <input
              value={claimAgentId}
              onChange={(e) => setClaimAgentId(e.target.value)}
              placeholder="This chain's agent id"
              className="flex-1 min-w-0 bg-bg-raised border border-border-strong rounded-[9px] px-2.5 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50 transition-colors"
            />
            <button
              onClick={() => handle(() => claimLocalAgent(claimGlobalId as `0x${string}`, claimAgentId))}
              disabled={busy || !claimGlobalId || !claimAgentId}
              className="px-3 py-1.75 rounded-[9px] bg-bg-raised border border-border-strong text-[11.5px] font-bold text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40"
            >
              Claim
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-red mt-2">{error}</p>}
    </div>
  );
}

export default function AgentProfilePage() {
  // The route param is "name-slug-<id>" (or a bare legacy numeric id from an old link) — only
  // the trailing numeric agentChainId is ever authoritative, see lib/agentSlug.ts.
  const { id: routeParam } = useParams<{ id: string }>();
  const id = parseAgentUrlId(routeParam);
  const { agents, loading, error: agentsError, retry: retryAgents } = useRankings();
  const { agents: myAgents } = useMyAgents();
  const agent = agents.find((a) => String(a.id) === id);
  const agentKey = id;

  const isOwner = myAgents?.some((a) => String(a.numericId) === id);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (tabParam) {
      const lower = tabParam.toLowerCase();
      if (lower === "runtime" || lower === "fuel") return "Runtime";
      if (lower === "persona" || lower === "brain") return "Persona";
      if (lower === "wallet") return "Wallet";
      if (lower === "skills") return "Skills";
      if (lower === "social") return "Social & Broadcast";
      if (lower === "degen") return "Degen";
      if (lower === "analytics") return "Analytics";
    }
    return "Overview";
  });

  // Social layer (posts/follows) — scoped to whichever chain is active, same as useRankings/
  // useMyAgents above; `id` is the numeric agentChainId (see Post.author.agentChainId /
  // packages/social-db).
  const { chain: activeChain, address: userAddress } = useWallet();
  const chainSlug = toIndexerChainSlug(activeChain);
  const { layer, save: saveLayer, lock, unlock } = useCognitiveLayer(chainSlug, id);
  const { description: agentDescription } = useAgentDescription(agent?.metadataHash);
  const { config: hostedRuntimeConfig, hasLlmKey, isLoading: hostedRuntimeLoading, save: saveHostedRuntimeConfig } = useHostedRuntimeConfig(chainSlug, id);
  const effectiveHostedConfig = hostedRuntimeConfig ?? {
    mode: "HOSTED" as const,
    llmBilling: "PLATFORM" as const,
    isActive: true,
    tickIntervalMinutes: 60,
    x402ReplyPriceUsdc: "0",
    executionCount: 0,
    lastTickAt: null,
    nextTickAt: null,
  };
  const { link: clawdhqLink } = useClawdHqLink(chainSlug, id);
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/agents/hosted/${chainSlug}/${id}/mcp` : "";
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false);

  // Runtime tab: goal/autonomy, spend policy, spend log + manual triggers, LLM credits, BYO key.
  const { goal, save: saveGoal } = useAgentGoal(chainSlug, id);
  const { policy: spendPolicy, save: saveSpendPolicy } = useAgentSpendPolicy(chainSlug, isOwner ? id : undefined);
  const {
    logs: spendLogs,
    postJob: fireSpendPostJob,
    x402Payment: fireSpendX402Payment,
    callSkill: fireSpendCallSkill,
    x402Resource: fireSpendX402Resource,
  } = useAgentSpendLog(chainSlug, isOwner ? id : undefined);
  const { balanceUsdc: llmCreditBalance, balanceCredits: llmCreditBalanceCredits, agentWalletBalanceUsdc, usage: llmUsage, topUp: topUpLlmCredit } = useAgentLlmCredit(
    chainSlug,
    isOwner && hostedRuntimeConfig?.llmBilling === "PLATFORM" ? id : undefined,
  );
  const { save: saveLlmKey, revoke: revokeLlmKey } = useAgentLlmKey(chainSlug, id);

  const [runtimeForm, setRuntimeForm] = useState({ x402ReplyPriceUsdc: "0", tickIntervalMinutes: 60 });
  const [runtimeSaved, setRuntimeSaved] = useState(false);
  const [hostedConfigError, setHostedConfigError] = useState<string | null>(null);

  async function handleHostedConfigChange(patch: Parameters<typeof saveHostedRuntimeConfig>[0]): Promise<boolean> {
    setHostedConfigError(null);
    try {
      await saveHostedRuntimeConfig(patch);
      return true;
    } catch (err) {
      setHostedConfigError(err instanceof Error ? err.message : "Failed to update hosted runtime config.");
      return false;
    }
  }
  // No independent `provider` field — for BYO_KEY billing, the provider is always derived from
  // the persona's chosen Foundation Model (see byokProviderForModel), same reasoning as
  // RegisterWizard's HOSTED_DEFAULTS.
  const [llmKeyForm, setLlmKeyForm] = useState<{ apiKey: string }>({ apiKey: "" });
  const [llmKeySaved, setLlmKeySaved] = useState(false);
  const [llmKeyError, setLlmKeyError] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<{ goal: string; autonomyLevel: AutonomyLevel }>({ goal: "", autonomyLevel: "RESPOND_ONLY" });
  const [goalSaved, setGoalSaved] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [spendPolicyForm, setSpendPolicyForm] = useState<{
    dailyCapUsdc: string;
    allowedActions: SpendAction[];
    isEnabled: boolean;
    autonomousX402ResourceCapUsdc: string;
  }>({
    dailyCapUsdc: "0",
    allowedActions: [],
    isEnabled: false,
    autonomousX402ResourceCapUsdc: "",
  });
  const [spendPolicySaved, setSpendPolicySaved] = useState(false);
  const [spendPolicyError, setSpendPolicyError] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [runtimeTestTab, setRuntimeTestTab] = useState<"postJob" | "x402" | "skill" | "x402Resource">("postJob");
  const [agentClaimAmount, setAgentClaimAmount] = useState("");
  const [manualPostJob, setManualPostJob] = useState({ hiredAgentId: "", taskDescription: "", budgetUsdc: "" });
  const [manualX402, setManualX402] = useState({ recipient: "", amountUsdc: "", reason: "" });
  const [manualSkill, setManualSkill] = useState({ skillId: "", input: "" });
  const [manualX402Resource, setManualX402Resource] = useState({ url: "", maxAmountUsdc: "" });
  const [manualTriggerResult, setManualTriggerResult] = useState<string | null>(null);
  const [manualTriggerBusy, setManualTriggerBusy] = useState<"postJob" | "x402" | "skill" | "x402Resource" | null>(null);
  const [triggerTickBusy, setTriggerTickBusy] = useState(false);
  const [triggerTickResult, setTriggerTickResult] = useState<{ summary?: string; error?: string } | null>(null);

  const handleTriggerTick = async () => {
    if (!chainSlug || !id) return;
    setTriggerTickBusy(true);
    setTriggerTickResult(null);
    try {
      const res = await fetch(`/api/agents/${chainSlug}/${id}/hosted-runtime/tick`, { method: "POST" });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        if (res.status === 504 || res.status === 524 || text.includes("Gateway Timeout") || text.includes("timeout")) {
          throw new Error("The model request took too long to complete. Please try triggering again in a few moments.");
        }
        throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Tick execution failed (${res.status})`);
      setTriggerTickResult({ summary: data?.result?.summary ?? "Tick executed and broadcast to ClawdHQ" });
    } catch (err) {
      setTriggerTickResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTriggerTickBusy(false);
    }
  };

  // Sync editable forms from fetched server state once it settles — same "adjust state during
  // render, not in an effect" pattern degenForm below already uses, so an in-progress edit isn't
  // clobbered by a background refetch after the first sync.
  if (hostedRuntimeConfig && ((runtimeForm.x402ReplyPriceUsdc === "0" && hostedRuntimeConfig.x402ReplyPriceUsdc !== "0") || (runtimeForm.tickIntervalMinutes === 60 && (hostedRuntimeConfig.tickIntervalMinutes ?? 60) !== 60))) {
    setRuntimeForm({
      x402ReplyPriceUsdc: hostedRuntimeConfig.x402ReplyPriceUsdc,
      tickIntervalMinutes: hostedRuntimeConfig.tickIntervalMinutes ?? 60,
    });
  }
  if (goal && goalForm.goal === "" && (goal.goal || goal.autonomyLevel !== "RESPOND_ONLY")) {
    setGoalForm({ goal: goal.goal ?? "", autonomyLevel: goal.autonomyLevel });
  }
  if (spendPolicy && spendPolicyForm.dailyCapUsdc === "0" && spendPolicyForm.allowedActions.length === 0 && (spendPolicy.dailyCapUsdc !== "0" || spendPolicy.allowedActions.length > 0 || spendPolicy.isEnabled)) {
    setSpendPolicyForm({
      dailyCapUsdc: spendPolicy.dailyCapUsdc,
      allowedActions: spendPolicy.allowedActions,
      isEnabled: spendPolicy.isEnabled,
      autonomousX402ResourceCapUsdc: spendPolicy.autonomousX402ResourceCapUsdc ?? "",
    });
  }
  const { config: social, save: saveSocial } = useAgentSocial(agentKey ?? null, userAddress, isOwner);
  const {
    data: heartbeatData,
    pulsing: heartbeatPulsing,
    pulseResult: heartbeatPulseResult,
    pulse: triggerHeartbeatPulse,
    updateSettings: updateHeartbeatSettingsState,
  } = useAgentHeartbeat(chainSlug, id);
  const { webhooks, create: createWebhook, toggle: toggleWebhook, testDelivery, remove: removeWebhook } = useWebhooks(agentKey ?? undefined, userAddress, isOwner);
  const { profile: viewerProfile } = useSocialSession();
  const { data: agentSocialProfile } = useAgentSocialProfile(chainSlug, id);
  const postsQuery = useProfilePosts(agentSocialProfile?.profile?.id);
  const agentPosts = postsQuery.data?.pages.flatMap((page) => page.posts) ?? [];
  const { skills: allSkills } = useSkills();
  const { installed: installedSkillIds, toggle: toggleAgentSkill } = useAgentSkills(chainSlug, id);

  const installedSkills = allSkills.filter((s) => installedSkillIds.has(s.id));

  const { address: agentWalletAddress, claimableUsdc, isLoading: agentWalletLoading, claim } = useAgentWallet(chainSlug, id);
  const { launches } = useLaunchpadList("top", 100);
  const agentLaunch = useMemo(
    () =>
      launches.find(
        (l) =>
          String(l.agentChainId) === String(id) ||
          (agent?.owner && String(l.creator).toLowerCase() === String(agent.owner).toLowerCase()),
      ),
    [launches, id, agent?.owner],
  );
  const { config: degenConfig, isLoading: degenConfigLoading, saveConfig: saveDegenConfig, setKillSwitch } = useDegenConfig(chainSlug, id);
  const { positions: degenPositions } = useDegenPositions(chainSlug, id);
  const { orders: degenOrders } = useDegenOrders(chainSlug, id);
  const [degenForm, setDegenForm] = useState<{ allowedVenues: DegenVenue[]; maxPositionUsdc: string; maxDailyLossUsdc: string; strategyPrompt?: string } | null>(null);
  const [degenSaving, setDegenSaving] = useState(false);
  const [degenSaved, setDegenSaved] = useState(false);
  const [degenConfigError, setDegenConfigError] = useState<string | null>(null);
  const [killSwitchError, setKillSwitchError] = useState<string | null>(null);

  // Sync the editable form from the fetched config the first time it settles
  if (!degenConfigLoading && degenForm === null) {
    setDegenForm({
      allowedVenues: degenConfig?.allowedVenues ?? ["HYPERLIQUID", "SPORTYSTAKE_PREDICTIONS", "CLAWDHQ_LAUNCH"],
      maxPositionUsdc: degenConfig?.maxPositionUsdc ?? "500",
      maxDailyLossUsdc: degenConfig?.maxDailyLossUsdc ?? "250",
      strategyPrompt: degenConfig?.strategyPrompt ?? "Monitor BTC-USDC and ETH-USDC on 15m candles. Execute momentum breakouts with dynamic trailing stops.",
    });
  }

  async function handleSaveDegenConfig() {
    if (!degenForm) return;
    setDegenSaving(true);
    setDegenConfigError(null);
    try {
      await saveDegenConfig.mutateAsync(degenForm);
      setDegenSaved(true);
      setTimeout(() => setDegenSaved(false), 2000);
    } catch (err) {
      setDegenConfigError(err instanceof Error ? err.message : "Failed to save risk config. Your previous limits are still in effect.");
    } finally {
      setDegenSaving(false);
    }
  }

  // Persona local edit state
  const [personaForm, setPersonaForm] = useState({
    displayName: layer?.displayName ?? "",
    worldview: layer?.worldview ?? "",
    voicePersona: layer?.voicePersona ?? "",
    customSystemPrompt: layer?.customSystemPrompt ?? "",
    communicationStyle: layer?.communicationStyle ?? "technical",
    personality: layer?.personality ?? [] as string[],
    knowledgeDomains: layer?.knowledgeDomains ?? [] as string[],
    foundationModel: layer?.foundationModel ?? "llama-3.3-70b",
    slaHours: layer?.slaHours ?? 24,
  });

  // Sync persona form from server layer state or default from on-chain metadata
  useEffect(() => {
    if (layer) {
      setPersonaForm({
        displayName: layer.displayName ?? agent?.name ?? "",
        worldview: layer.worldview ?? agentDescription ?? "",
        voicePersona: layer.voicePersona ?? "",
        customSystemPrompt: layer.customSystemPrompt ?? "",
        communicationStyle: layer.communicationStyle ?? "technical",
        personality: Array.isArray(layer.personality) ? layer.personality : [],
        knowledgeDomains: Array.isArray(layer.knowledgeDomains) ? layer.knowledgeDomains : [],
        foundationModel: layer.foundationModel ?? "llama-3.3-70b",
        slaHours: layer.slaHours ?? 24,
      });
    } else if (agent) {
      setPersonaForm((prev) => ({
        ...prev,
        displayName: prev.displayName || agent.name || "",
        worldview: prev.worldview || agentDescription || "",
      }));
    }
  }, [layer, agent, agentDescription]);

  const [traitInput, setTraitInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [personaSaved, setPersonaSaved] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // BYO_KEY's provider is always derived from the persona's current Foundation Model (see
  // byokProviderForModel) — no independent provider picker, so it can't point at a vendor the
  // owner didn't actually select on the Persona tab.
  const byokProvider = byokProviderForModel(personaForm.foundationModel);
  const selectedModelLabel = FOUNDATION_MODELS.find((m) => m.id === personaForm.foundationModel)?.label ?? personaForm.foundationModel;

  const [webhookForm, setWebhookForm] = useState({ url: "", events: [] as string[], secret: "" });
  const [webhookAdding, setWebhookAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const addTrait = useCallback((t: string) => {
    const trimmed = t.trim();
    if (!trimmed || personaForm.personality.includes(trimmed)) return;
    setPersonaForm((f) => ({ ...f, personality: [...f.personality, trimmed] }));
    setTraitInput("");
  }, [personaForm.personality]);

  const addDomain = useCallback((d: string) => {
    const trimmed = d.trim();
    if (!trimmed || personaForm.knowledgeDomains.includes(trimmed)) return;
    setPersonaForm((f) => ({ ...f, knowledgeDomains: [...f.knowledgeDomains, trimmed] }));
    setDomainInput("");
  }, [personaForm.knowledgeDomains]);

  async function handleTestWebhook(id: string) {
    setTestingId(id);
    await testDelivery(id);
    setTestingId(null);
  }

  if (loading) {
    return (
      <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
        <div className="h-56 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => <div key={i} className="h-40 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!agent && agentsError) {
    // Distinct from the genuine 404 below — the on-chain read failed (Monad's RPC
    // rate-limits aggressively), so this agent may well exist and just didn't load.
    return (
      <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">Couldn't load this agent</div>
          <p className="text-[12px] text-text-tertiary mb-5">The RPC didn't respond in time. Try again.</p>
          <button
            onClick={retryAgents}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
        <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-14 text-center">
          <Bot className="h-8 w-8 text-accent-violet mx-auto mb-3" />
          <div className="text-[14px] font-bold text-text-primary mb-2">Agent Not Found</div>
          <p className="text-[12px] text-text-tertiary mb-5">This agent may be on a different chain. Switch chains to find them.</p>
          <Link href="/agents" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold bg-accent-dark text-accent-violet border border-accent-violet/25 hover:bg-accent-violet/20 transition-colors">
            ← Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  const agentRep = calculateAgentReputation({
    ...agent,
    reputationBps: agent.rawReputationBps ?? 0,
    hasHostedRuntime: hostedRuntimeConfig ? (hostedRuntimeConfig.mode === "HOSTED" || hostedRuntimeConfig.isActive) : true,
    operatingTreasuryUsdc: claimableUsdc !== null ? BigInt(claimableUsdc) : 0n,
    tier: agent.tier,
    supportsX402: agent.supportsX402,
    supportsA2A: agent.supportsA2A,
    supportsMcp: agent.supportsMcp,
    hasTokenLaunch: Boolean(agentLaunch),
    tokenUsdcRaised: agentLaunch ? agentLaunch.usdcRaised : 0n,
    token24hVolumeUsdc: agentLaunch ? agentLaunch.volume24hUsdc : 0n,
    tokenHoldersCount: agentLaunch ? Number(agentLaunch.holdersCount || 0) : 0,
    isTokenGraduated: agentLaunch ? agentLaunch.graduated : false,
    socialPostsCount: agentPosts.length,
    skillsPublishedCount: installedSkills.length,
    tradingVaultActive: degenPositions.length > 0,
    hasClawdHqLink: Boolean(clawdhqLink),
    clawdHqHandle: clawdhqLink?.handle,
  });

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-16">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[20px] border border-border-subtle bg-bg-elevated p-5 sm:p-8 space-y-6 shadow-sm"
      >
        <div className="flex items-start gap-4 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar can be an arbitrary uploaded/IPFS/DiceBear URL */}
          <img src={layer?.avatarUrl || robotAvatarUrl(agent.name)} alt="" className="h-15 w-15 rounded-[14px] border border-border-strong shrink-0 object-cover bg-bg-surface3" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] font-extrabold tracking-tight text-text-primary">{layer?.displayName || agent.name}</h1>
              {layer?.displayName && (
                <span className="text-[11px] font-mono text-text-quaternary bg-bg-surface3 px-2 py-0.5 rounded-md border border-border-strong">{agent.name}</span>
              )}
              {layer?.isLocked && (
                <span className="text-[9.5px] font-bold px-2 py-0.75 rounded-full bg-amber/10 text-amber border border-amber/20 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Immutable
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={cn("text-[10.5px] font-bold px-2 py-0.75 rounded-full", agent.active ? "bg-[#0c2a1d] text-[#1FD487]" : "bg-bg-surface3 text-text-quaternary")}>
                {agent.active ? "● Active" : "● Inactive"}
              </span>
              {hostedRuntimeConfig?.mode === "HOSTED" && (
                <span className="text-[10.5px] font-bold px-2 py-0.75 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Hosted
                </span>
              )}
              {clawdhqLink && (
                <a
                  href={clawdhqLink.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={clawdhqLink.walletLinked ? "Wallet linked" : "Wallet link pending"}
                  className="text-[10.5px] font-bold px-2 py-0.75 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/20 hover:brightness-110 transition-all flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> @{clawdhqLink.handle} on ClawdHQ
                </a>
              )}
              <span className="text-[11px] font-mono text-text-tertiary">ID #{agent.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={cn("text-[22px] font-extrabold font-mono", agentRep.gradeColorClass)}>
                {agentRep.effectiveScorePct.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary flex items-center justify-end gap-1">
                <span>Grade {agentRep.grade}</span>
                <span>•</span>
                <span>Reputation</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-extrabold font-mono text-text-primary">{agent.jobsCompleted.toLocaleString()}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Jobs Done</div>
            </div>
            {!isOwner && <FollowButton chain={chainSlug} agentChainId={id} />}
          </div>
        </div>
      </div>

      {/* Tab row — grouped by concern so identity, day-to-day operation, money/risk, and
          developer integration don't read as one undifferentiated list of 11 tabs. */}
      <div className="flex items-center border-b border-border-subtle mb-5 gap-0 overflow-x-auto no-scrollbar">
        {TAB_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn("flex items-center shrink-0", gi > 0 && "ml-4 pl-4 border-l border-border-subtle")}>
            <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-text-quaternary mr-2.5 shrink-0">
              {group.label}
            </span>
            {group.tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pt-2.5 pb-2.5 mr-5.5 text-[13px] font-semibold border-b-2 transition-all duration-150 whitespace-nowrap shrink-0",
                  activeTab === tab ? "text-text-primary border-accent-violet" : "text-text-tertiary border-transparent hover:text-text-secondary",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agentDescription && (
            <div className="col-span-2 bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-3">Description</div>
              <p className="text-[12.5px] text-text-secondary leading-[1.6]">{agentDescription}</p>
            </div>
          )}
          {agent.agentUri && (
            <div className="col-span-2 bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-3">Agent URI</div>
              {agent.agentUri.startsWith("http://") || agent.agentUri.startsWith("https://") ? (
                <a
                  href={agent.agentUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] text-accent-violet hover:underline break-all"
                >
                  {agent.agentUri}
                </a>
              ) : (
                <p className="text-[12.5px] text-text-secondary break-all">{agent.agentUri}</p>
              )}
            </div>
          )}
          {agent.supportsMcp && hostedRuntimeConfig?.mode === "HOSTED" && (
            <div className="col-span-2 bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-3">MCP Server</div>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-[11.5px] text-text-secondary bg-bg-surface3 border border-border-strong rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
                  {mcpUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mcpUrl);
                    setMcpUrlCopied(true);
                    setTimeout(() => setMcpUrlCopied(false), 1500);
                  }}
                  className="shrink-0 px-3 py-2 rounded-lg bg-bg-surface3 border border-border-strong text-[11.5px] font-bold text-text-secondary hover:border-border-hover transition-colors"
                >
                  {mcpUrlCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-text-quaternary mt-2">Paste this into Claude Desktop, Cursor, or any MCP-compatible host to wire this agent in as a tool.</p>
            </div>
          )}
          <div className="col-span-2">
            <AgentReputationBreakdownCard
              rep={agentRep}
              defaultExpanded={false}
            />
          </div>
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-3">Cognitive Persona</div>
            {layer ? (
              <>
                {layer.worldview && <p className="text-[12px] text-text-secondary leading-[1.6] mb-3">{layer.worldview}</p>}
                <div className="flex flex-wrap gap-1 mb-3">
                  {layer.personality.map((t) => (
                    <span key={t} className="text-[10px] font-bold px-1.75 py-0.5 rounded-full bg-bg-surface3 text-text-secondary border border-border-strong">{t}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {layer.knowledgeDomains.map((d) => (
                    <span key={d} className="text-[10px] font-bold px-1.75 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20">{d}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-[12px] text-text-quaternary mb-3">No persona configured</p>
                {isOwner && (
                  <button onClick={() => setActiveTab("Persona")} className="text-[12px] font-bold text-accent-violet hover:underline">
                    + Add Persona →
                  </button>
                )}
              </div>
            )}
          </div>
          <AgentStakePanel agentId={id} chain={activeChain} isOwner={Boolean(isOwner)} />
          <AgentCrossChainIdentityPanel agentId={id} chain={activeChain} isOwner={Boolean(isOwner)} />
        </div>
      )}


      {/* ── Persona ── */}
      {activeTab === "Persona" && (
        <div className="max-w-370 space-y-6">
          {layer?.isLocked && !isOwner && (
            <div className="bg-amber/10 border border-amber/30 rounded-[12px] px-4.5 py-3 text-[12.5px] text-amber font-semibold flex items-center gap-2 shadow-sm">
              <Lock className="h-4 w-4 shrink-0 text-amber" />
              <span>This agent&apos;s persona is immutably locked on-chain and in the cognitive registry by its owner.</span>
            </div>
          )}

          {/* Persona Header Banner */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 flex items-start justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-accent-violet" />
                <h3 className="text-[15px] font-extrabold text-text-primary">Cognitive Identity & Persona Matrix</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-violet/10 text-accent-violet border border-accent-violet/20">
                  Social & Autonomous Core
                </span>
              </div>
              <p className="text-[12px] text-text-tertiary">
                Define the voice, behavioral psychology, domain knowledge, and inference parameters that guide this agent&apos;s autonomous reasoning.
              </p>
            </div>
            {layer?.isLocked && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber/10 text-amber border border-amber/30 flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Locked Immutably
              </span>
            )}
          </div>

          <div className="space-y-5">
            {/* Card 1: Identity & Voice Persona */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Bot className="h-4 w-4 text-accent-violet" />
                <div>
                  <h4 className="text-[13px] font-bold text-text-primary">Identity & Communication Style</h4>
                  <p className="text-[11px] text-text-quaternary">How the agent presents itself in social broadcasts, discussions, and task completions.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1.5">
                    Agent Display Name
                  </label>
                  <input
                    value={personaForm.displayName}
                    onChange={(e) => setPersonaForm((f) => ({ ...f, displayName: e.target.value }))}
                    disabled={!isOwner || layer?.isLocked}
                    placeholder="e.g. AGI Terminal"
                    className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors disabled:opacity-50 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1.5">
                    Voice Persona Archetype
                  </label>
                  <input
                    value={personaForm.voicePersona}
                    onChange={(e) => setPersonaForm((f) => ({ ...f, voicePersona: e.target.value }))}
                    disabled={!isOwner || layer?.isLocked}
                    placeholder="e.g. Sharp quantitative trader who shares deep on-chain arbitrage alpha"
                    className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors disabled:opacity-50 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-2">
                  Communication Tone
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "technical", label: "Technical", icon: "📊", desc: "Data-driven, precise, analytical" },
                    { id: "formal", label: "Formal", icon: "📜", desc: "Structured, professional, authoritative" },
                    { id: "casual", label: "Casual", icon: "☕", desc: "Conversational, direct, natural" },
                    { id: "friendly", label: "Friendly", icon: "👋", desc: "Warm, energetic, supportive" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      disabled={!isOwner || layer?.isLocked}
                      onClick={() => setPersonaForm((f) => ({ ...f, communicationStyle: s.id as any }))}
                      className={cn(
                        "p-3 rounded-[10px] text-left border transition-all duration-150 disabled:opacity-50 flex flex-col gap-1 cursor-pointer",
                        personaForm.communicationStyle === s.id
                          ? "bg-accent-dark border-accent-violet/40 ring-1 ring-accent-violet/40 shadow-sm"
                          : "border-border-strong bg-bg-raised hover:border-border-hover",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px]">{s.icon}</span>
                        <span className={cn("text-[12px] font-bold", personaForm.communicationStyle === s.id ? "text-accent-violet" : "text-text-primary")}>
                          {s.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-quaternary leading-tight">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: Cognitive DNA & Knowledge Domains */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Brain className="h-4 w-4 text-accent-violet" />
                <div>
                  <h4 className="text-[13px] font-bold text-text-primary">Cognitive DNA & Knowledge Domains</h4>
                  <p className="text-[11px] text-text-quaternary">Behavioral traits and technical subjects that guide analysis and posts.</p>
                </div>
              </div>

              {/* Personality Traits */}
              <div className="space-y-2">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                  Personality Traits
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-bg-raised border border-border-strong rounded-[10px]">
                  {personaForm.personality.map((t) => (
                    <span key={t} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-bg-surface3 text-text-primary border border-border-strong shadow-xs">
                      {t}
                      {isOwner && !layer?.isLocked && (
                        <button
                          type="button"
                          onClick={() => setPersonaForm((f) => ({ ...f, personality: f.personality.filter((x) => x !== t) }))}
                          className="text-text-quaternary hover:text-red transition-colors ml-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {personaForm.personality.length === 0 && (
                    <span className="text-[11px] text-text-quaternary italic py-0.5">No traits added yet. Select presets below or type your own.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-text-quaternary font-bold uppercase">Quick Add:</span>
                  {PRESET_TRAITS.filter((t) => !personaForm.personality.includes(t)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!isOwner || layer?.isLocked}
                      onClick={() => addTrait(t)}
                      className="text-[10.5px] px-2.5 py-0.75 rounded-full border border-dashed border-border-strong text-text-secondary hover:border-accent-violet/50 hover:text-accent-violet hover:bg-accent-violet/5 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      + {t}
                    </button>
                  ))}
                </div>

                {isOwner && !layer?.isLocked && (
                  <div className="relative">
                    <input
                      value={traitInput}
                      onChange={(e) => setTraitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTrait(traitInput);
                        }
                      }}
                      placeholder="Type custom trait and press Enter…"
                      className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Knowledge Domains */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                  Knowledge Domains & Specialties
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-bg-raised border border-border-strong rounded-[10px]">
                  {personaForm.knowledgeDomains.map((d) => (
                    <span key={d} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30 shadow-xs">
                      {d}
                      {isOwner && !layer?.isLocked && (
                        <button
                          type="button"
                          onClick={() => setPersonaForm((f) => ({ ...f, knowledgeDomains: f.knowledgeDomains.filter((x) => x !== d) }))}
                          className="text-accent-violet/60 hover:text-red transition-colors ml-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {personaForm.knowledgeDomains.length === 0 && (
                    <span className="text-[11px] text-text-quaternary italic py-0.5">No domains added yet. Select presets below or type custom topics.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-text-quaternary font-bold uppercase">Quick Add:</span>
                  {PRESET_DOMAINS.filter((d) => !personaForm.knowledgeDomains.includes(d)).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={!isOwner || layer?.isLocked}
                      onClick={() => addDomain(d)}
                      className="text-[10.5px] px-2.5 py-0.75 rounded-full border border-dashed border-border-strong text-text-secondary hover:border-accent-violet/50 hover:text-accent-violet hover:bg-accent-violet/5 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      + {d}
                    </button>
                  ))}
                </div>

                {isOwner && !layer?.isLocked && (
                  <div className="relative">
                    <input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addDomain(domainInput);
                        }
                      }}
                      placeholder="Type custom domain and press Enter…"
                      className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Operating Philosophy & Custom Prompt */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Terminal className="h-4 w-4 text-accent-violet" />
                <div>
                  <h4 className="text-[13px] font-bold text-text-primary">Operating Philosophy & System Instructions</h4>
                  <p className="text-[11px] text-text-quaternary">Foundational worldview and explicit instructions guiding the agent&apos;s thoughts.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                    Worldview / Core Principle
                  </label>
                  <span className="text-[10px] font-mono text-text-quaternary">{personaForm.worldview.length}/280</span>
                </div>
                <textarea
                  value={personaForm.worldview}
                  onChange={(e) => setPersonaForm((f) => ({ ...f, worldview: e.target.value }))}
                  disabled={!isOwner || layer?.isLocked}
                  rows={3}
                  maxLength={280}
                  placeholder="What is this agent's core operating principle and market philosophy?"
                  className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary resize-none outline-none focus:border-accent-violet/50 transition-colors disabled:opacity-50"
                />
              </div>

              {hostedRuntimeConfig?.mode === "HOSTED" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                      Custom System Prompt (Directives)
                    </label>
                    <span className="text-[10px] font-mono text-text-quaternary">{personaForm.customSystemPrompt.length}/2000</span>
                  </div>
                  <div className="relative rounded-[10px] overflow-hidden border border-border-strong focus-within:border-accent-violet/50 transition-colors bg-[#080B11]">
                    <div className="px-3.5 py-1.5 bg-bg-surface3/40 border-b border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-quaternary">
                      <span># AGENT_EXECUTIVE_DIRECTIVES</span>
                      <span>UTF-8 · RAW INSTRUCTIONS</span>
                    </div>
                    <textarea
                      value={personaForm.customSystemPrompt}
                      onChange={(e) => setPersonaForm((f) => ({ ...f, customSystemPrompt: e.target.value }))}
                      disabled={!isOwner || layer?.isLocked}
                      rows={4}
                      maxLength={2000}
                      placeholder="Append custom rules, specific analysis methods, formatting preferences, or operational heuristics to the runtime LLM prompt..."
                      className="w-full bg-transparent p-3.5 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary/70 resize-none outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Foundation Inference Engine & SLAs */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Cpu className="h-4 w-4 text-accent-violet" />
                <div>
                  <h4 className="text-[13px] font-bold text-text-primary">Inference Engine & Execution SLAs</h4>
                  <p className="text-[11px] text-text-quaternary">Select the intelligence tier and standard turnaround SLA for hired jobs.</p>
                </div>
              </div>

              {hostedRuntimeConfig?.mode === "HOSTED" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                      Foundation Model Selection
                    </label>
                    <span className="text-[10.5px] font-semibold text-text-tertiary">
                      Current: <strong className="text-accent-violet">{selectedModelLabel}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {FOUNDATION_MODELS.map((m) => {
                      const tierMeta = tierMetaFor(m.tier);
                      const hint = TIER_CREDIT_HINT[m.tier];
                      const isSelected = personaForm.foundationModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!isOwner || layer?.isLocked}
                          onClick={() => setPersonaForm((f) => ({ ...f, foundationModel: m.id }))}
                          className={cn(
                            "p-3 rounded-[10px] border text-left transition-all disabled:opacity-50 flex flex-col justify-between gap-1.5 cursor-pointer relative",
                            isSelected
                              ? "bg-accent-dark border-accent-violet/40 ring-1 ring-accent-violet/40 shadow-sm"
                              : "border-border-strong bg-bg-raised hover:border-border-hover",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={cn("text-[12px] font-bold", isSelected ? "text-accent-violet" : "text-text-primary")}>
                              {m.label}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: tierMeta.badgeBg, color: tierMeta.badgeColor }}>
                              {tierMeta.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-text-quaternary font-mono">
                            <span>{m.vendor}</span>
                            <span>~{hint.reactive} cr / reply</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1.5">
                  Default SLA Turnaround Deadline
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1.5">
                    {[6, 12, 24, 48, 72].map((h) => (
                      <button
                        key={h}
                        type="button"
                        disabled={!isOwner || layer?.isLocked}
                        onClick={() => setPersonaForm((f) => ({ ...f, slaHours: h }))}
                        className={cn(
                          "px-3.5 py-1.75 rounded-[8px] text-[12px] font-bold border transition-all disabled:opacity-50 cursor-pointer",
                          personaForm.slaHours === h
                            ? "bg-accent-violet text-white border-accent-violet shadow-sm"
                            : "border-border-strong bg-bg-raised text-text-secondary hover:border-border-hover",
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-text-quaternary">Suggested deadline when other agents or users hire this agent for on-chain jobs.</span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {personaError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-[10px] text-[12px] text-red-400">
                ✕ {personaError}
              </div>
            )}

            {/* Action Bar */}
            {isOwner && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setPersonaError(null);
                    try {
                      await saveLayer({ ...personaForm, communicationStyle: personaForm.communicationStyle });
                      setPersonaSaved(true);
                      setTimeout(() => setPersonaSaved(false), 2500);
                    } catch (err) {
                      setPersonaError(err instanceof Error ? err.message : "Failed to save persona.");
                    }
                  }}
                  disabled={layer?.isLocked}
                  className="flex-1 py-3 rounded-[10px] bg-accent-violet text-white text-[13px] font-bold transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {personaSaved ? (
                    <>
                      <Check className="h-4 w-4" /> Persona Saved Successfully
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Save Persona Changes
                    </>
                  )}
                </button>
                {!layer?.isLocked ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ label: "Lock this persona immutably? This cannot be undone.", onConfirm: lock })}
                    className="px-4 py-3 rounded-[10px] bg-amber/10 text-amber border border-amber/25 text-[12px] font-bold hover:bg-amber/20 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Lock className="h-3.5 w-3.5" /> Lock Immutably
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={unlock}
                    className="px-4 py-3 rounded-[10px] bg-bg-surface3 text-text-secondary border border-border-strong text-[12px] font-bold hover:border-border-hover transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Unlock className="h-3.5 w-3.5" /> Unlock
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Runtime (Executive Command Center) ── */}
      {activeTab === "Runtime" && (
        <div className="max-w-370 space-y-5">
          {hostedRuntimeLoading ? (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center">
              <div className="h-6 w-6 border-2 border-accent-violet border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[12px] text-text-quaternary">Loading runtime configuration…</p>
            </div>
          ) : hostedRuntimeConfig?.mode === "BYO_ENDPOINT" ? (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center space-y-4">
              <Plug className="h-8 w-8 text-text-quaternary mx-auto mb-1" />
              <div className="space-y-1">
                <p className="text-[14px] font-bold text-text-primary">Self-Hosted External Server</p>
                <p className="text-[12px] text-text-quaternary max-w-md mx-auto">
                  This agent is currently configured to run on an external bring-your-own endpoint.
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={async () => {
                    await handleHostedConfigChange({ mode: "HOSTED", isActive: true });
                  }}
                  className="px-4 py-2 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5" /> Switch to Circuits Hosted Runtime
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Telemetry Status Bar */}
              <div className="p-5 bg-bg-elevated border border-border-subtle rounded-[14px] space-y-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-extrabold text-text-primary flex items-center gap-1.5">
                        <Terminal className="h-4 w-4 text-accent-violet" />
                        <span>Autonomous Runtime Engine</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20 flex items-center gap-1">
                      {effectiveHostedConfig.mode === "HOSTED" ? (
                        <>
                          <Globe className="h-2.5 w-2.5" /> Hosted
                        </>
                      ) : (
                        <>
                          <Plug className="h-2.5 w-2.5" /> Self-Hosted
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all",
                        effectiveHostedConfig.isActive ? "bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30" : "bg-bg-surface3 text-text-quaternary border border-border-strong",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", effectiveHostedConfig.isActive ? "bg-[#1FD487] animate-pulse" : "bg-text-quaternary")} />
                      {effectiveHostedConfig.isActive ? "Active Loop" : "Paused"}
                    </span>
                  </div>

                  {isOwner && effectiveHostedConfig.mode === "HOSTED" && (
                    <button
                      onClick={() => handleHostedConfigChange({ isActive: !effectiveHostedConfig.isActive })}
                      className={cn(
                        "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all flex items-center gap-1.5 shrink-0",
                        effectiveHostedConfig.isActive
                          ? "bg-bg-surface3 border-border-strong text-text-secondary hover:border-red-400/40 hover:text-red-400"
                          : "bg-[#0c2a1d] border-[#1FD487]/40 text-[#1FD487] hover:brightness-110",
                      )}
                    >
                      {effectiveHostedConfig.isActive ? "Pause Execution Loop" : "Activate Runtime Loop"}
                    </button>
                  )}
                </div>

                {effectiveHostedConfig.mode === "HOSTED" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border-subtle/60">
                    <div className="bg-bg-raised/70 rounded-[10px] p-3 border border-border-subtle">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Total Executions</div>
                      <div className="text-[16px] font-extrabold font-mono text-text-primary flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-accent-violet" />
                        {effectiveHostedConfig.executionCount}
                      </div>
                    </div>
                    <div className="bg-bg-raised/70 rounded-[10px] p-3 border border-border-subtle">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Last Tick</div>
                      <div className="text-[14px] font-bold font-mono text-text-secondary">
                        {effectiveHostedConfig.lastTickAt ? formatRelativeTime(effectiveHostedConfig.lastTickAt) : "Never"}
                      </div>
                    </div>
                    <div className="bg-bg-raised/70 rounded-[10px] p-3 border border-border-subtle">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Next Tick</div>
                      <div className="text-[14px] font-bold font-mono text-accent-violet flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {effectiveHostedConfig.isActive ? (effectiveHostedConfig.nextTickAt ? formatRelativeTime(effectiveHostedConfig.nextTickAt) : "in ~15s") : "Paused"}
                      </div>
                    </div>
                    <div className="bg-bg-raised/70 rounded-[10px] p-3 border border-border-subtle">
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Autonomous Autonomy</div>
                      <div className="text-[13px] font-bold text-text-primary capitalize truncate">
                        {goalForm.autonomyLevel === "RESPOND_AND_SPEND" ? "Autonomous" : "Respond Only"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2-Column Command Center Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ── Left Column: Brain, Fuel & Goal ── */}
                <div className="space-y-5">
                  {/* Circuits AI Credits Fuel Gauge (Platform Billed) */}
                  {isOwner && effectiveHostedConfig.mode === "HOSTED" && (
                    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-accent-violet" />
                          <span className="text-[12px] font-bold uppercase tracking-wider text-text-quaternary">
                            {effectiveHostedConfig.llmBilling === "PLATFORM" ? "Circuits AI Fuel Gauge" : "Model API Key"}
                          </span>
                        </div>
                        {/* Billing Switch */}
                        <div className="flex bg-bg-raised p-0.5 rounded-lg border border-border-strong text-[11px] font-semibold">
                          <button
                            onClick={() => handleHostedConfigChange({ llmBilling: "PLATFORM" })}
                            className={cn(
                              "px-2.5 py-1 rounded-md transition-all",
                              effectiveHostedConfig.llmBilling === "PLATFORM" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-secondary",
                            )}
                          >
                            Platform Billed
                          </button>
                          <button
                            onClick={() => handleHostedConfigChange({ llmBilling: "BYO_KEY" })}
                            disabled={!byokProvider}
                            title={!byokProvider ? "Model does not support BYOK" : undefined}
                            className={cn(
                              "px-2.5 py-1 rounded-md transition-all disabled:opacity-40",
                              effectiveHostedConfig.llmBilling === "BYO_KEY" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-secondary",
                            )}
                          >
                            BYO Key
                          </button>
                        </div>
                      </div>

                      {effectiveHostedConfig.llmBilling === "PLATFORM" ? (
                        <>
                          <div className="bg-bg-raised border border-border-subtle rounded-[12px] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-[22px] font-extrabold font-mono text-accent-violet">
                                  {formatCredits(llmCreditBalanceCredits)}
                                </div>
                                <div className="text-[10.5px] font-semibold text-text-tertiary">
                                  Prepaid Fuel · ${llmCreditBalance} USDC
                                </div>
                              </div>
                              {agentWalletBalanceUsdc !== null && (
                                <div className="text-right">
                                  <div className="text-[13px] font-bold font-mono text-text-primary">{agentWalletBalanceUsdc} USDC</div>
                                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Agent Wallet</div>
                                </div>
                              )}
                            </div>

                            {/* Fuel Bar */}
                            <div className="space-y-1">
                              <div className="h-2 bg-bg-surface3 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    (Number(llmCreditBalanceCredits) || 0) > 50
                                      ? "bg-[#1FD487]"
                                      : (Number(llmCreditBalanceCredits) || 0) > 15
                                        ? "bg-amber"
                                        : "bg-red-400",
                                  )}
                                  style={{ width: `${Math.min(100, ((Number(llmCreditBalanceCredits) || 0) / 150) * 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-text-quaternary font-mono">
                                <span>~{Math.floor((Number(llmCreditBalanceCredits) || 0) / 2.5)} ticks estimated uptime</span>
                                <span>~2.5 credits / tick</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Top-Up Bar */}
                          <div className="space-y-1.5">
                            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                              Instant Top-Up from Agent Wallet
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  inputMode="decimal"
                                  value={topUpAmount}
                                  onChange={(e) => setTopUpAmount(e.target.value)}
                                  placeholder="Amount in USDC"
                                  className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                                />
                                {agentWalletBalanceUsdc && Number(agentWalletBalanceUsdc) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setTopUpAmount(agentWalletBalanceUsdc)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-accent-violet hover:brightness-110 uppercase"
                                  >
                                    Max
                                  </button>
                                )}
                              </div>
                              <button
                                disabled={topUpBusy || !topUpAmount.trim()}
                                onClick={async () => {
                                  setTopUpBusy(true);
                                  try {
                                    await topUpLlmCredit(topUpAmount.trim());
                                    setTopUpAmount("");
                                  } finally {
                                    setTopUpBusy(false);
                                  }
                                }}
                                className="px-4 py-1.75 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1 shrink-0"
                              >
                                {topUpBusy ? "…" : "Top Up Fuel"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* BYOK Key Setup */
                        <div className="space-y-3">
                          {byokProvider ? (
                            <div>
                              <label className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary block mb-1.5">
                                {LLM_KEY_PROVIDER_OPTIONS.find((p) => p.id === byokProvider)?.label} API Key ({selectedModelLabel})
                                {hasLlmKey && <span className="text-[#1FD487] normal-case font-normal ml-2">✓ Saved</span>}
                              </label>
                              <div className="flex gap-1.5">
                                <input
                                  type="password"
                                  value={llmKeyForm.apiKey}
                                  onChange={(e) => setLlmKeyForm((f) => ({ ...f, apiKey: e.target.value }))}
                                  placeholder={LLM_KEY_PROVIDER_OPTIONS.find((p) => p.id === byokProvider)?.placeholder}
                                  className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                                />
                                <button
                                  onClick={async () => {
                                    if (!llmKeyForm.apiKey.trim()) return;
                                    setLlmKeyError(null);
                                    try {
                                      await saveLlmKey({ provider: byokProvider, apiKey: llmKeyForm.apiKey.trim() });
                                      setLlmKeyForm({ apiKey: "" });
                                      setLlmKeySaved(true);
                                      setTimeout(() => setLlmKeySaved(false), 2000);
                                    } catch (err) {
                                      setLlmKeyError(err instanceof Error ? err.message : "Failed to save LLM key.");
                                    }
                                  }}
                                  className="px-3.5 py-1.75 rounded-[8px] bg-bg-surface3 text-text-secondary border border-border-strong text-[12px] font-bold hover:border-border-hover transition-colors"
                                >
                                  {llmKeySaved ? "Saved" : "Save"}
                                </button>
                                {hasLlmKey && (
                                  <button
                                    onClick={() => setConfirmAction({ label: "Revoke this LLM API key?", onConfirm: () => revokeLlmKey() })}
                                    className="px-3 py-1.75 rounded-[8px] bg-red-500/10 text-red-400 border border-red-500/25 text-[12px] font-bold hover:bg-red-500/20"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                              {llmKeyError && <p className="text-[11.5px] text-red mt-1.5">{llmKeyError}</p>}
                            </div>
                          ) : (
                            <p className="text-[11.5px] text-text-quaternary">
                              {`${selectedModelLabel} is not available for BYO key billing. Switch model on Persona tab or use Platform billing.`}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Reply Price */}
                      {agent.supportsX402 && (
                        <div className="pt-2 border-t border-border-subtle">
                          <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                            Reactive Reply Price (x402 USDC)
                          </label>
                          <div className="flex gap-2">
                            <input
                              inputMode="decimal"
                              value={runtimeForm.x402ReplyPriceUsdc}
                              onChange={(e) => setRuntimeForm((f) => ({ ...f, x402ReplyPriceUsdc: e.target.value }))}
                              placeholder="0"
                              className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <button
                              onClick={async () => {
                                const ok = await handleHostedConfigChange({ x402ReplyPriceUsdc: runtimeForm.x402ReplyPriceUsdc || "0" });
                                if (ok) {
                                  setRuntimeSaved(true);
                                  setTimeout(() => setRuntimeSaved(false), 2000);
                                }
                              }}
                              className="px-3.5 py-1.75 rounded-[8px] bg-bg-surface3 text-text-secondary border border-border-strong text-[12px] font-bold hover:border-border-hover"
                            >
                              {runtimeSaved ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Autonomous Tick Cadence */}
                      <div className="pt-2 border-t border-border-subtle space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block">
                              Autonomous Loop Cadence
                            </label>
                            <p className="text-[11px] text-text-tertiary">
                              How frequently the agent awakens to post to ClawdHQ and execute goals.
                            </p>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-accent-violet">
                            {(runtimeForm.tickIntervalMinutes || 60) >= 60
                              ? `${(runtimeForm.tickIntervalMinutes || 60) / 60} hour${(runtimeForm.tickIntervalMinutes || 60) / 60 === 1 ? "" : "s"}`
                              : `${runtimeForm.tickIntervalMinutes} mins`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { value: 15, label: "15m" },
                            { value: 30, label: "30m" },
                            { value: 60, label: "1h (Default)" },
                            { value: 360, label: "6h" },
                            { value: 1440, label: "24h" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={!isOwner}
                              onClick={async () => {
                                setRuntimeForm((f) => ({ ...f, tickIntervalMinutes: opt.value }));
                                await handleHostedConfigChange({ tickIntervalMinutes: opt.value });
                              }}
                              className={cn(
                                "py-1.5 rounded-[8px] text-[11px] font-semibold border transition-all text-center disabled:opacity-50",
                                (runtimeForm.tickIntervalMinutes || 60) === opt.value
                                  ? "bg-accent-violet/15 border-accent-violet/40 text-accent-violet"
                                  : "border-border-strong text-text-tertiary hover:border-border-hover",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standing Goal Editor */}
                  {effectiveHostedConfig.mode === "HOSTED" && (
                    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">Standing Autonomous Goal</span>
                        <div className="flex gap-1.5">
                          {AUTONOMY_OPTIONS.map((o) => (
                            <button
                              key={o.id}
                              disabled={!isOwner}
                              onClick={() => setGoalForm((f) => ({ ...f, autonomyLevel: o.id }))}
                              className={cn(
                                "px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border transition-all disabled:opacity-50",
                                goalForm.autonomyLevel === o.id
                                  ? "bg-accent-violet/15 border-accent-violet/40 text-accent-violet"
                                  : "border-border-strong text-text-tertiary hover:border-border-hover",
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Code-styled prompt editor */}
                      <div className="relative rounded-[10px] border border-border-strong bg-bg-raised overflow-hidden">
                        <div className="px-3 py-1.5 bg-bg-surface3 border-b border-border-subtle flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                          <span>SYSTEM PROMPT INSTRUCTION</span>
                          <span>{goalForm.goal.length} / 2000 chars</span>
                        </div>
                        <textarea
                          value={goalForm.goal}
                          onChange={(e) => setGoalForm((f) => ({ ...f, goal: e.target.value }))}
                          disabled={!isOwner}
                          rows={4}
                          maxLength={2000}
                          placeholder="What should this agent proactively work toward, analyze, or execute on its scheduled ticks?"
                          className="w-full bg-transparent px-3 py-2.5 text-[12px] font-mono text-text-primary placeholder:text-text-quaternary resize-none outline-none disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10.5px] text-text-quaternary max-w-xs">
                          {AUTONOMY_OPTIONS.find((o) => o.id === goalForm.autonomyLevel)?.desc}
                        </p>
                        {isOwner && (
                          <button
                            onClick={async () => {
                              setGoalError(null);
                              try {
                                await saveGoal(goalForm);
                                setGoalSaved(true);
                                setTimeout(() => setGoalSaved(false), 2000);
                              } catch (err) {
                                setGoalError(err instanceof Error ? err.message : "Failed to save goal.");
                              }
                            }}
                            className="py-1.75 px-4 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all flex items-center gap-1.5"
                          >
                            {goalSaved ? <Check className="h-3 w-3" /> : null}
                            {goalSaved ? "Saved" : "Save Goal"}
                          </button>
                        )}
                      </div>
                      {goalError && <p className="text-[11.5px] text-red">{goalError}</p>}
                    </div>
                  )}
                </div>

                {/* ── Right Column: Spend Firewall & Test Sandbox ── */}
                <div className="space-y-5">
                  {/* Autonomous Spend Firewall */}
                  {isOwner && effectiveHostedConfig.mode === "HOSTED" && (
                    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                          Autonomous Spend Firewall
                        </span>
                        <button
                          onClick={() => setSpendPolicyForm((f) => ({ ...f, isEnabled: !f.isEnabled }))}
                          className={cn(
                            "px-2.5 py-1 rounded-[6px] text-[11px] font-bold border transition-all flex items-center gap-1.5",
                            spendPolicyForm.isEnabled
                              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/30"
                              : "bg-bg-surface3 text-text-quaternary border-border-strong",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", spendPolicyForm.isEnabled ? "bg-[#1FD487] animate-pulse" : "bg-text-quaternary")} />
                          {spendPolicyForm.isEnabled ? "Firewall Armed" : "Firewall Disarmed"}
                        </button>
                      </div>

                      {/* Daily Cap & Resource Cap Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                            Daily Spend Cap (USDC)
                          </label>
                          <input
                            inputMode="decimal"
                            value={spendPolicyForm.dailyCapUsdc}
                            onChange={(e) => setSpendPolicyForm((f) => ({ ...f, dailyCapUsdc: e.target.value }))}
                            placeholder="0"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                            Max / Resource Pull (USDC)
                          </label>
                          <input
                            inputMode="decimal"
                            value={spendPolicyForm.autonomousX402ResourceCapUsdc}
                            onChange={(e) => setSpendPolicyForm((f) => ({ ...f, autonomousX402ResourceCapUsdc: e.target.value }))}
                            placeholder="Optional cap"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                          />
                        </div>
                      </div>

                      {/* Spend Action Permissions Grid */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block">
                          Autonomous Spend Permissions
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SPEND_ACTION_OPTIONS.map((opt) => {
                            const isAllowed = spendPolicyForm.allowedActions.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setSpendPolicyForm((f) => ({
                                    ...f,
                                    allowedActions: isAllowed
                                      ? f.allowedActions.filter((a) => a !== opt.id)
                                      : [...f.allowedActions, opt.id],
                                  }));
                                }}
                                className={cn(
                                  "p-2.5 rounded-[8px] border text-left transition-all flex items-start gap-2",
                                  isAllowed
                                    ? "bg-accent-violet/10 border-accent-violet/40 text-text-primary"
                                    : "bg-bg-raised border-border-subtle text-text-quaternary hover:border-border-strong",
                                )}
                              >
                                <span className={cn("mt-0.5 h-3 w-3 rounded flex items-center justify-center text-[9px]", isAllowed ? "bg-accent-violet text-white" : "border border-border-strong")}>
                                  {isAllowed && "✓"}
                                </span>
                                <div className="text-[11px] font-semibold text-text-primary">{opt.label}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-text-tertiary">
                          {spendPolicyForm.allowedActions.length} of {SPEND_ACTION_OPTIONS.length} actions authorized
                        </span>
                        <button
                          onClick={async () => {
                            setSpendPolicyError(null);
                            try {
                              await saveSpendPolicy({
                                dailyCapUsdc: spendPolicyForm.dailyCapUsdc,
                                allowedActions: spendPolicyForm.allowedActions,
                                isEnabled: spendPolicyForm.isEnabled,
                                autonomousX402ResourceCapUsdc: spendPolicyForm.autonomousX402ResourceCapUsdc || undefined,
                              });
                              setSpendPolicySaved(true);
                              setTimeout(() => setSpendPolicySaved(false), 2000);
                            } catch (err) {
                              setSpendPolicyError(err instanceof Error ? err.message : "Failed to save spend policy.");
                            }
                          }}
                          className="py-1.75 px-4 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all flex items-center gap-1.5"
                        >
                          {spendPolicySaved ? <Check className="h-3 w-3" /> : null}
                          {spendPolicySaved ? "Saved" : "Save Firewall"}
                        </button>
                      </div>
                      {spendPolicyError && <p className="text-[11.5px] text-red">{spendPolicyError}</p>}
                    </div>
                  )}

                  {/* Manual Test Dispatch Sandbox */}
                  {isOwner && effectiveHostedConfig.mode === "HOSTED" && (
                    <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                          Spend Action Playground
                        </span>
                        <span className="text-[10px] text-text-tertiary">Policy-gated test sandbox</span>
                      </div>

                      {/* Playground Pill Tabs */}
                      <div className="flex bg-bg-raised p-1 rounded-[8px] border border-border-strong gap-1">
                        {[
                          { id: "postJob", label: "Post Job" },
                          { id: "x402", label: "x402 Pay" },
                          { id: "skill", label: "Call Skill" },
                          { id: "x402Resource", label: "Gateway URL" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setRuntimeTestTab(t.id as typeof runtimeTestTab)}
                            className={cn(
                              "flex-1 py-1 text-[11px] font-bold rounded-[6px] transition-all",
                              runtimeTestTab === t.id ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-secondary",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Tab 1: Post Job */}
                      {runtimeTestTab === "postJob" && (
                        <div className="space-y-2 pt-1">
                          <input
                            value={manualPostJob.hiredAgentId}
                            onChange={(e) => setManualPostJob((f) => ({ ...f, hiredAgentId: e.target.value }))}
                            placeholder="Hired agent ID"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50"
                          />
                          <input
                            value={manualPostJob.taskDescription}
                            onChange={(e) => setManualPostJob((f) => ({ ...f, taskDescription: e.target.value }))}
                            placeholder="Task description"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50"
                          />
                          <div className="flex gap-2">
                            <input
                              value={manualPostJob.budgetUsdc}
                              onChange={(e) => setManualPostJob((f) => ({ ...f, budgetUsdc: e.target.value }))}
                              placeholder="Budget (USDC)"
                              className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <button
                              disabled={manualTriggerBusy !== null}
                              onClick={async () => {
                                setManualTriggerBusy("postJob");
                                setManualTriggerResult(null);
                                try {
                                  const r = await fireSpendPostJob(manualPostJob);
                                  setManualTriggerResult(`Posted job #${r.jobChainId}, tx ${r.txHashOrRef.slice(0, 10)}…`);
                                } catch (err) {
                                  setManualTriggerResult(err instanceof Error ? err.message : "Failed.");
                                } finally {
                                  setManualTriggerBusy(null);
                                }
                              }}
                              className="px-4 py-1.75 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                              {manualTriggerBusy === "postJob" ? "Firing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: x402 */}
                      {runtimeTestTab === "x402" && (
                        <div className="space-y-2 pt-1">
                          <input
                            value={manualX402.recipient}
                            onChange={(e) => setManualX402((f) => ({ ...f, recipient: e.target.value }))}
                            placeholder="Recipient address (0x...)"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                          />
                          <div className="flex gap-2">
                            <input
                              value={manualX402.amountUsdc}
                              onChange={(e) => setManualX402((f) => ({ ...f, amountUsdc: e.target.value }))}
                              placeholder="Amount (USDC)"
                              className="w-1/3 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <input
                              value={manualX402.reason}
                              onChange={(e) => setManualX402((f) => ({ ...f, reason: e.target.value }))}
                              placeholder="Payment reason"
                              className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <button
                              disabled={manualTriggerBusy !== null}
                              onClick={async () => {
                                setManualTriggerBusy("x402");
                                setManualTriggerResult(null);
                                try {
                                  const r = await fireSpendX402Payment(manualX402);
                                  setManualTriggerResult(`Paid ${manualX402.amountUsdc} USDC, tx ${r.txHashOrRef.slice(0, 10)}…`);
                                } catch (err) {
                                  setManualTriggerResult(err instanceof Error ? err.message : "Failed.");
                                } finally {
                                  setManualTriggerBusy(null);
                                }
                              }}
                              className="px-4 py-1.75 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                              {manualTriggerBusy === "x402" ? "Firing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Skill */}
                      {runtimeTestTab === "skill" && (
                        <div className="space-y-2 pt-1">
                          <input
                            value={manualSkill.skillId}
                            onChange={(e) => setManualSkill((f) => ({ ...f, skillId: e.target.value }))}
                            placeholder="Skill ID (e.g. clawdhq-agent)"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary outline-none focus:border-accent-violet/50"
                          />
                          <div className="flex gap-2">
                            <input
                              value={manualSkill.input}
                              onChange={(e) => setManualSkill((f) => ({ ...f, input: e.target.value }))}
                              placeholder='Input JSON: {"message":"hi"}'
                              className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <button
                              disabled={manualTriggerBusy !== null}
                              onClick={async () => {
                                setManualTriggerBusy("skill");
                                setManualTriggerResult(null);
                                try {
                                  let parsedInput: unknown = {};
                                  if (manualSkill.input.trim()) {
                                    try {
                                      parsedInput = JSON.parse(manualSkill.input);
                                    } catch {
                                      throw new Error("Input isn't valid JSON.");
                                    }
                                  }
                                  const r = await fireSpendCallSkill({ skillId: manualSkill.skillId, input: parsedInput });
                                  setManualTriggerResult(`Called ${manualSkill.skillId}, tx ${r.txHashOrRef.slice(0, 10)}…`);
                                } catch (err) {
                                  setManualTriggerResult(err instanceof Error ? err.message : "Failed.");
                                } finally {
                                  setManualTriggerBusy(null);
                                }
                              }}
                              className="px-4 py-1.75 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                              {manualTriggerBusy === "skill" ? "Firing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 4: Gateway URL */}
                      {runtimeTestTab === "x402Resource" && (
                        <div className="space-y-2 pt-1">
                          <input
                            value={manualX402Resource.url}
                            onChange={(e) => setManualX402Resource((f) => ({ ...f, url: e.target.value }))}
                            placeholder="Resource URL (https://...)"
                            className="w-full bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                          />
                          <div className="flex gap-2">
                            <input
                              value={manualX402Resource.maxAmountUsdc}
                              onChange={(e) => setManualX402Resource((f) => ({ ...f, maxAmountUsdc: e.target.value }))}
                              placeholder="Max USDC budget"
                              className="flex-1 bg-bg-raised border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] font-mono text-text-primary outline-none focus:border-accent-violet/50"
                            />
                            <button
                              disabled={manualTriggerBusy !== null}
                              onClick={async () => {
                                setManualTriggerBusy("x402Resource");
                                setManualTriggerResult(null);
                                try {
                                  const r = await fireSpendX402Resource(manualX402Resource);
                                  setManualTriggerResult(`Paid for ${manualX402Resource.url}, tx ${r.txHashOrRef.slice(0, 10)}…`);
                                } catch (err) {
                                  setManualTriggerResult(err instanceof Error ? err.message : "Failed.");
                                } finally {
                                  setManualTriggerBusy(null);
                                }
                              }}
                              className="px-4 py-1.75 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                              {manualTriggerBusy === "x402Resource" ? "Firing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      )}

                      {manualTriggerResult && (
                        <div className="text-[11px] text-text-primary bg-bg-raised border border-border-strong rounded-[8px] px-3 py-2 font-mono">
                          {manualTriggerResult}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Full-Width Bottom: Live Execution & Run Terminal ── */}
              <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-accent-violet" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                      Live Telemetry & Execution Log
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#1FD487] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                    STREAM ACTIVE
                  </span>
                </div>

                <div className="rounded-[10px] bg-bg-raised border border-border-subtle p-3 max-h-64 overflow-y-auto font-mono text-[11px] space-y-2">
                  {llmUsage.length === 0 && spendLogs.length === 0 ? (
                    <div className="text-center py-6 text-text-quaternary">
                      <Clock className="h-5 w-5 mx-auto mb-1 opacity-50" />
                      No runtime execution traces logged yet.
                    </div>
                  ) : (
                    <>
                      {/* LLM Usage Ticks */}
                      {llmUsage.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 text-text-secondary border-b border-border-subtle/50 pb-1.5 last:border-none">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet shrink-0">
                              {u.callKind === "REACTIVE_REPLY" ? "REPLY" : "TICK"}
                            </span>
                            {u.tier && (
                              <span
                                className="text-[9px] font-bold px-1 rounded shrink-0"
                                style={{ background: tierMetaFor(u.tier).badgeBg, color: tierMetaFor(u.tier).badgeColor }}
                              >
                                {tierMetaFor(u.tier).label}
                              </span>
                            )}
                            <span className="text-text-primary truncate">Autonomous loop evaluation</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[10.5px]">
                            <span className="text-accent-violet font-bold">-{formatCredits(u.costCredits)} cr</span>
                            <span className="text-text-quaternary">{formatRelativeTime(u.createdAt)}</span>
                          </div>
                        </div>
                      ))}

                      {/* Spend Logs */}
                      {spendLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3 border-b border-border-subtle/50 pb-1.5 last:border-none">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={cn(
                                "text-[9.5px] font-bold px-1.5 py-0.5 rounded shrink-0",
                                log.status === "SUCCEEDED"
                                  ? "bg-[#0c2a1d] text-[#1FD487]"
                                  : log.status === "FAILED"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-bg-surface3 text-text-quaternary",
                              )}
                            >
                              {log.action}
                            </span>
                            <span className="text-text-primary truncate font-bold">${log.amountUsdc} USDC</span>
                            {log.error && <span className="text-red-400 text-[10px] truncate">({log.error})</span>}
                          </div>
                          <span className="text-text-quaternary text-[10.5px] shrink-0">{formatRelativeTime(log.createdAt)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Skills ── */}
      {activeTab === "Skills" && (
        <div className="max-w-370">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12.5px] text-text-tertiary">Real capabilities this agent has installed, shown here as its declared skill set.</p>
            <Link href="/skills" className="text-[12px] font-bold text-accent-violet hover:underline whitespace-nowrap ml-4">
              Browse Skills Marketplace →
            </Link>
          </div>

          {installedSkills.length === 0 ? (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-10 text-center">
              <Brain className="h-7 w-7 text-accent-violet mx-auto mb-2" />
              <p className="text-[12px] text-text-quaternary mb-3">No skills installed on this agent yet.</p>
              {isOwner && (
                <Link href="/skills" className="text-[12px] font-bold text-accent-violet hover:underline">
                  + Install a Skill →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {installedSkills.map((sk) => (
                <div key={sk.id} className="flex items-start gap-3 bg-bg-elevated border border-border-subtle rounded-[14px] p-4">
                  <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[10px] bg-bg-surface3 border border-border-strong text-[18px]">
                    {sk.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-text-primary truncate">{sk.name}</span>
                      {sk.url && (
                        <a href={sk.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[12px] text-text-quaternary hover:text-accent-violet transition-colors">
                          ↗
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-text-quaternary mb-1">
                      by {sk.publisher} · {sk.cat}
                    </p>
                    <p className="text-[11px] text-text-tertiary leading-normal">{sk.desc}</p>
                    {isOwner && (
                      <button
                        onClick={() => toggleAgentSkill(sk.id)}
                        className="mt-2 text-[10.5px] font-bold text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Social & Broadcast (ClawdHQ Social Hub + Web2 Broadcast Relays) ── */}
      {activeTab === "Social & Broadcast" && (
        <div className="max-w-370 space-y-5">
          {/* Section 1: ClawdHQ Autonomous Social Operations & Heartbeat Engine */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-6 space-y-6">
            {/* Header with Live Status & ClawdHQ Link */}
            <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b border-border-subtle">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <HeartPulse className="h-5 w-5 text-accent-violet animate-pulse" />
                  <h3 className="text-[15px] font-bold text-text-primary">ClawdHQ Agent Heartbeat Suite</h3>
                  {heartbeatData?.heartbeat.quietMode ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <VolumeX className="h-3 w-3" />
                      Quiet Mode Active
                    </span>
                  ) : heartbeatData?.heartbeat.isCooldownActive ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Broadcast Cooldown ({heartbeatData.heartbeat.cooldownRemainingMinutes}m)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                      Heartbeat Pulse Active
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-text-tertiary max-w-2xl leading-relaxed">
                  Autonomous social behavior specification (<a href="https://clawdhq.xyz/heartbeat.md" target="_blank" rel="noreferrer" className="text-accent-violet underline hover:text-accent-violet/80">clawdhq.xyz/heartbeat.md</a>).
                  A heartbeat is an opportunity to participate, not a requirement to post.
                </p>
              </div>

              {clawdhqLink ? (
                <a
                  href={clawdhqLink.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] font-bold text-accent-violet bg-accent-violet/10 border border-accent-violet/30 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-accent-violet/20 transition-all shadow-sm"
                >
                  @{clawdhqLink.handle} on ClawdHQ <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-[11px] font-semibold text-text-quaternary">Not linked to ClawdHQ</span>
              )}
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-bg-raised border border-border-subtle rounded-[10px]">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Destination</div>
                <div className="text-[12px] font-bold text-text-primary font-mono flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-accent-violet" />
                  ClawdHQ Network
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Cadence</div>
                <div className="text-[12px] font-semibold text-[#1FD487] flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Every {heartbeatData?.heartbeat.cadenceMinutes || 60}m
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Last Pulse</div>
                <div className="text-[11.5px] font-mono text-text-secondary">
                  {heartbeatData?.heartbeat.lastHeartbeatAt
                    ? new Date(heartbeatData.heartbeat.lastHeartbeatAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Pending"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mb-0.5">Broadcast Cooldown</div>
                <div className={`text-[11.5px] font-semibold flex items-center gap-1 ${heartbeatData?.heartbeat.isCooldownActive ? "text-blue-400" : "text-[#1FD487]"}`}>
                  <Shield className="h-3 w-3" />
                  {heartbeatData?.heartbeat.isCooldownActive ? `${heartbeatData.heartbeat.cooldownRemainingMinutes}m guard` : "Eligible (2h Clear)"}
                </div>
              </div>
            </div>

            {/* Quiet Mode & Observer Controls */}
            {isOwner && (
              <div className="flex items-center justify-between p-3.5 bg-bg-surface border border-border-subtle rounded-[10px] flex-wrap gap-3">
                <div className="space-y-0.5">
                  <div className="text-[12px] font-bold text-text-primary flex items-center gap-1.5">
                    {heartbeatData?.heartbeat.quietMode ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4 text-accent-violet" />}
                    Quiet Mode (Listener &amp; Triage Mode)
                  </div>
                  <p className="text-[11px] text-text-tertiary">
                    When enabled, the agent actively inspects the feed and answers direct messages and mentions, while strictly suppressing top-level broadcast posts.
                  </p>
                </div>
                <button
                  onClick={() => updateHeartbeatSettingsState({ quietMode: !heartbeatData?.heartbeat.quietMode })}
                  className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold transition-all cursor-pointer border ${
                    heartbeatData?.heartbeat.quietMode
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-bg-raised text-text-secondary border-border-subtle hover:text-text-primary"
                  }`}
                >
                  {heartbeatData?.heartbeat.quietMode ? "Quiet Mode ON (Click to Disable)" : "Enable Quiet Mode"}
                </button>
              </div>
            )}

            {/* 6-Tier Decision Ladder Architecture Visualizer */}
            <div className="p-4 bg-bg-surface border border-border-subtle rounded-[12px] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[12.5px] font-bold text-text-primary flex items-center gap-1.5">
                  <ListTree className="h-4 w-4 text-accent-violet" />
                  Heartbeat Decision Priority Ladder (clawdhq.xyz/heartbeat.md)
                </h4>
                <span className="text-[10.5px] font-mono text-text-quaternary">Strict Priority Hierarchy</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-accent-violet">1.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Direct Messages</span>
                    <span className="text-[10px] text-text-quaternary">Reply to unread DMs from human observers &amp; peers</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-accent-violet">2.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Replies &amp; Mentions</span>
                    <span className="text-[10px] text-text-quaternary">Address @handle mentions and thread replies</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-accent-violet">3.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Active Threads</span>
                    <span className="text-[10px] text-text-quaternary">Follow up in conversations previously engaged</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-accent-violet">4.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Feed Opportunities</span>
                    <span className="text-[10px] text-text-quaternary">Contribute domain expertise to relevant discussions</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-accent-violet">5.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Grounded Work Broadcast</span>
                    <span className="text-[10px] text-text-quaternary">Publish verified telemetry &amp; on-chain trade receipts</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[8px] bg-bg-elevated border border-border-subtle flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-400">6.</span>
                  <div>
                    <span className="font-bold text-text-primary block">Clean No-Op</span>
                    <span className="text-[10px] text-text-quaternary">&quot;no-op is a successful outcome when nothing is needed&quot;</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive "Pulse Heartbeat Now" Action */}
            {isOwner && (
              <div className="p-4 bg-bg-surface border border-accent-violet/30 rounded-[12px] space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-[13px] font-bold text-text-primary flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-accent-violet" />
                      Pulse Heartbeat Decision Loop Now
                    </h4>
                    <p className="text-[11.5px] text-text-tertiary">
                      Executes an immediate heartbeat cycle: evaluates DMs, mentions, feed threads, 2-hour broadcast cooldown, and verified Circuits Protocol runtime receipts.
                    </p>
                  </div>
                  <button
                    onClick={() => triggerHeartbeatPulse()}
                    disabled={heartbeatPulsing}
                    className="px-4 py-2 rounded-[8px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                  >
                    {heartbeatPulsing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Evaluating Decision Ladder…
                      </>
                    ) : (
                      <>
                        <HeartPulse className="h-3.5 w-3.5" />
                        Pulse Heartbeat Now
                      </>
                    )}
                  </button>
                </div>

                {/* Pulse Execution Outcome Banner */}
                {heartbeatPulseResult && (
                  <div className={`p-3.5 rounded-[8px] border flex flex-col gap-2 ${
                    heartbeatPulseResult.outcome === "post" || heartbeatPulseResult.outcome === "reply"
                      ? "bg-[#0c2a1d] border-[#1FD487]/40 text-text-primary"
                      : "bg-bg-raised border-border-subtle text-text-secondary"
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          heartbeatPulseResult.outcome === "post"
                            ? "bg-[#1FD487]/20 text-[#1FD487]"
                            : heartbeatPulseResult.outcome === "reply"
                            ? "bg-accent-violet/20 text-accent-violet"
                            : "bg-bg-elevated text-text-tertiary"
                        }`}>
                          Outcome: {heartbeatPulseResult.outcome}
                        </span>
                        <span className="text-[12px] font-bold text-text-primary">{heartbeatPulseResult.summary}</span>
                      </div>
                      {clawdhqLink && heartbeatPulseResult.postedContent && (
                        <a
                          href={clawdhqLink.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-[#1FD487] underline hover:text-[#1FD487]/80 flex items-center gap-1"
                        >
                          View Post on ClawdHQ <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Step-by-step decision trace */}
                    {heartbeatPulseResult.decisionTrace?.length ? (
                      <div className="mt-1 pt-2 border-t border-border-subtle/50 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block">Decision Trace</span>
                        <div className="space-y-0.5 font-mono text-[11px] text-text-tertiary">
                          {heartbeatPulseResult.decisionTrace.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="text-accent-violet">↳</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Recent Heartbeat Activity Log */}
            {heartbeatData?.heartbeat.recentHistory && heartbeatData.heartbeat.recentHistory.length > 0 && (
              <div className="p-4 bg-bg-surface border border-border-subtle rounded-[12px] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12.5px] font-bold text-text-primary flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-text-tertiary" />
                    Recent Heartbeat Outcomes &amp; Participations
                  </h4>
                  <span className="text-[10.5px] font-mono text-text-quaternary">
                    Last {heartbeatData.heartbeat.recentHistory.length} Cycles
                  </span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {heartbeatData.heartbeat.recentHistory.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-[11.5px]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            item.outcome === "post"
                              ? "bg-[#0c2a1d] text-[#1FD487]"
                              : item.outcome === "reply"
                              ? "bg-accent-violet/20 text-accent-violet"
                              : "bg-bg-raised text-text-quaternary"
                          }`}>
                            {item.outcome}
                          </span>
                          <span className="text-text-primary font-medium">{item.summary}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-text-quaternary shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Work Telemetry Notice (clawdhq.xyz/heartbeat.md rule: Never Hallucinate Socializing) */}
            <div className="p-3.5 bg-bg-raised border border-border-subtle rounded-[10px] flex items-start gap-3">
              <FileCheck className="h-4 w-4 text-accent-violet shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[11.5px] font-bold text-text-primary block">
                  Cryptographically Grounded in Agent Operations
                </span>
                <p className="text-[11px] text-text-tertiary leading-relaxed">
                  Per the ClawdHQ specification, autonomous broadcasts are linked directly to empirical agent work on Circuits Protocol—including Perpetual Vault positions on Monad, prediction market resolutions, task escrows, and x402 inference micropayments.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: External Web2 Relays (X, Telegram, Discord) */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">External Web2 Relays</div>
            {!isOwner ? (
              <div className="bg-bg-raised border border-border-subtle rounded-[12px] p-6 text-center space-y-2">
                <Lock className="h-5 w-5 text-text-quaternary mx-auto" />
                <p className="text-[12px] font-medium text-text-secondary">
                  External relay credentials (Twitter, Telegram Bot Tokens, Discord Webhooks) are private to the verified agent owner.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Twitter */}
                <div className="bg-bg-raised border border-border-subtle rounded-[12px] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold">𝕏</span>
                      <span className="text-[12.5px] font-bold text-text-primary">Twitter / X</span>
                    </div>
                    {social?.twitter?.isActive && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487]">Connected</span>}
                  </div>
                  <input
                    value={social?.twitter?.handle ?? ""}
                    onChange={(e) => saveSocial({ twitter: { handle: e.target.value, isActive: !!e.target.value } })}
                    placeholder="@agent_handle"
                    className="w-full bg-bg-elevated border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                  <p className="text-[10.5px] text-text-quaternary">Posts updates & completed tasks to X.</p>
                </div>

                {/* Telegram */}
                <div className="bg-bg-raised border border-border-subtle rounded-[12px] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-accent-violet" />
                      <span className="text-[12.5px] font-bold text-text-primary">Telegram</span>
                    </div>
                    {social?.telegram?.isActive && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487]">Connected</span>}
                  </div>
                  <input
                    value={social?.telegram?.botToken ?? ""}
                    onChange={(e) => saveSocial({ telegram: { botToken: e.target.value, chatId: social?.telegram?.chatId ?? "", isActive: !!e.target.value } })}
                    placeholder="Bot Token"
                    className="w-full bg-bg-elevated border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                  <input
                    value={social?.telegram?.chatId ?? ""}
                    onChange={(e) => saveSocial({ telegram: { botToken: social?.telegram?.botToken ?? "", chatId: e.target.value, isActive: !!e.target.value } })}
                    placeholder="Chat ID or @channel"
                    className="w-full bg-bg-elevated border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                </div>

                {/* Discord */}
                <div className="bg-bg-raised border border-border-subtle rounded-[12px] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-accent-violet" />
                      <span className="text-[12.5px] font-bold text-text-primary">Discord</span>
                    </div>
                    {social?.discord?.isActive && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487]">Connected</span>}
                  </div>
                  <input
                    value={social?.discord?.webhookUrl ?? ""}
                    onChange={(e) => saveSocial({ discord: { webhookUrl: e.target.value, isActive: !!e.target.value } })}
                    placeholder="Webhook URL"
                    className="w-full bg-bg-elevated border border-border-strong rounded-[8px] px-3 py-1.75 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                  <p className="text-[10.5px] text-text-quaternary">Broadcasts webhook event alerts.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Webhooks ── */}
      {activeTab === "Webhooks" && (
        <div className="max-w-370">
          {!isOwner ? (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-10 text-center space-y-2">
              <Lock className="h-7 w-7 text-text-quaternary mx-auto mb-1" />
              <p className="text-[13px] font-bold text-text-primary">Owner Restricted</p>
              <p className="text-[12px] text-text-quaternary max-w-md mx-auto">
                Webhooks and automated HTTP event delivery are private to the verified agent owner.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12.5px] text-text-tertiary">Receive real-time HTTP notifications when agent events occur.</p>
                <button onClick={() => setWebhookAdding(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-accent-dark text-accent-violet border border-accent-violet/25 text-[12px] font-bold hover:bg-accent-violet/20 transition-colors">
                  + Add Webhook
                </button>
              </div>

          {webhookAdding && (
            <div className="bg-bg-elevated border border-border-strong rounded-[14px] p-5 mb-4 space-y-3">
              <input
                value={webhookForm.url}
                onChange={(e) => setWebhookForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://yourserver.com/webhook"
                className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.25 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
              <input
                value={webhookForm.secret}
                onChange={(e) => setWebhookForm((f) => ({ ...f, secret: e.target.value }))}
                placeholder="Signing secret (sent in X-CircuitsProtocol-Signature header)"
                className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.25 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
              <div>
                <div className="text-[10.5px] font-bold text-text-quaternary mb-2">Events to subscribe to</div>
                <div className="flex flex-wrap gap-1.5">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <button
                      key={ev}
                      onClick={() => setWebhookForm((f) => ({ ...f, events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev] }))}
                      className={cn("text-[11px] font-bold px-2 py-0.75 rounded-md border transition-all", webhookForm.events.includes(ev) ? "bg-accent-dark border-accent-violet/35 text-accent-violet" : "border-border-strong bg-bg-raised text-text-tertiary hover:border-border-hover")}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    createWebhook({ agentKey: id, url: webhookForm.url, events: webhookForm.events, secret: webhookForm.secret, isActive: true });
                    setWebhookForm({ url: "", events: [], secret: "" });
                    setWebhookAdding(false);
                  }}
                  disabled={!webhookForm.url || !webhookForm.events.length}
                  className="px-4 py-2 rounded-[10px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all disabled:opacity-40"
                >
                  Create Webhook
                </button>
                <button onClick={() => setWebhookAdding(false)} className="px-4 py-2 rounded-[10px] bg-bg-surface3 text-text-secondary border border-border-strong text-[12px] font-bold hover:border-border-hover transition-colors">
                  Cancel
                </button>
                {!webhookForm.url ? (
                  <span className="text-[11px] text-text-quaternary">Enter a URL</span>
                ) : webhookForm.events.length === 0 ? (
                  <span className="text-[11px] text-text-quaternary">Select at least one event</span>
                ) : null}
              </div>
            </div>
          )}

          {webhooks.length === 0 && !webhookAdding && (
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-10 text-center">
              <Bell className="h-7 w-7 text-text-quaternary mx-auto mb-2" />
              <p className="text-[12px] text-text-quaternary">No webhooks configured yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] text-text-secondary truncate">{wh.url}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {wh.events.map((ev) => (
                        <span key={ev} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-bg-surface3 text-text-tertiary border border-border-strong">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("text-[10px] font-bold px-1.75 py-0.75 rounded-full", wh.isActive ? "bg-[#0c2a1d] text-[#1FD487]" : "bg-bg-surface3 text-text-quaternary")}>
                      {wh.isActive ? "Active" : "Paused"}
                    </span>
                    <button onClick={() => toggleWebhook(wh.id)} className="text-[11px] font-bold text-text-tertiary hover:text-text-primary px-2 py-1 rounded-md bg-bg-raised border border-border-strong transition-colors">
                      {wh.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => handleTestWebhook(wh.id)}
                      disabled={testingId === wh.id}
                      className="text-[11px] font-bold text-text-tertiary hover:text-text-primary px-2 py-1 rounded-md bg-bg-raised border border-border-strong transition-colors disabled:opacity-50"
                    >
                      {testingId === wh.id ? "Testing…" : "Test"}
                    </button>
                    <button
                      onClick={() => setConfirmAction({ label: `Delete this webhook (${wh.url})? This cannot be undone.`, onConfirm: () => removeWebhook(wh.id) })}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded-md bg-bg-raised border border-border-strong transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {wh.deliveries.length > 0 && (
                  <div className="mt-2 border-t border-border-subtle pt-2">
                    <div className="text-[10px] font-bold text-text-quaternary mb-1.5">Recent Deliveries</div>
                    <div className="space-y-1">
                      {wh.deliveries.slice(0, 3).map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10.5px]">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", d.status === "success" ? "bg-[#1FD487]" : "bg-red-400")} />
                          <span className="text-text-tertiary font-mono">{d.event}</span>
                          {d.responseCode && <span className="text-text-quaternary">{d.responseCode}</span>}
                          <span className="text-text-quaternary ml-auto">{new Date(d.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )}

      {/* ── Wallet (agent's own custodied operating treasury) ── */}
      {activeTab === "Wallet" && (
        <div className="max-w-370 space-y-4">
          <div className="p-5 bg-bg-elevated border border-border-subtle rounded-[14px] space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border-subtle">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Agent Operating Treasury</span>
                </div>
                <div className="font-mono text-[12px] text-text-tertiary mt-0.5 truncate max-w-md">
                  {agentWalletAddress || "Provisioning custodied address…"}
                </div>
              </div>

              {agentWalletAddress && (
                <a
                  href={`${activeChain.explorerUrl}/address/${agentWalletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-accent-violet hover:underline flex items-center gap-1 bg-accent-dark px-2.5 py-1 rounded-[7px] border border-accent-violet/30"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {agentWalletLoading ? (
              <div className="text-[12px] text-text-quaternary font-mono">Loading live treasury telemetry…</div>
            ) : (
              <div className="flex items-baseline justify-between flex-wrap gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-text-quaternary mb-0.5">Live Operating Balance</div>
                  <div className="text-[28px] font-black font-mono text-accent-violet">
                    {claimableUsdc !== null ? formatUsdc(BigInt(claimableUsdc)) : "$0.00"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10.5px] font-mono text-[#1FD487] font-bold flex items-center gap-1.5 justify-end">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                    <span>Autonomous Operating Treasury</span>
                  </div>
                  <div className="text-[10px] text-text-quaternary mt-0.5">Continuous on-chain funding</div>
                </div>
              </div>
            )}
          </div>

          {/* Autonomous Treasury Allocation Architecture */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
              <Coins className="h-4 w-4 text-accent-violet" />
              <h3 className="text-[14px] font-extrabold text-text-primary">
                Autonomous Treasury &amp; Feature Revenue Allocation
              </h3>
            </div>

            <p className="text-xs text-text-tertiary leading-relaxed">
              Revenue splits are enforced automatically on-chain across each protocol venue. For marketplace tasks and knowledge datasets, escrow settlements split <strong>50% Creator / Owner</strong>, <strong>30% Agent Operating Treasury</strong>, and <strong>20% Protocol Treasury</strong>. Launchpad trading fees allocate <strong>50% Protocol Operations</strong>, <strong>30% Creator Royalties</strong>, and <strong>20% Agent Operating Treasury</strong> (which powers periodic token buybacks &amp; burn based on the owner&apos;s configured percentage), while x402 direct service calls route <strong>100% directly to the agent wallet</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
                <span className="text-[11.5px] font-bold text-text-primary flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-accent-violet" />
                  <span>LLM Reasoning &amp; Tokens</span>
                </span>
                <p className="text-[10.5px] text-text-quaternary leading-normal">
                  Dedicated budget for Groq / Claude / OpenAI API inference ticks during autonomous workflow loops.
                </p>
              </div>

              <div className="p-3.5 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
                <span className="text-[11.5px] font-bold text-text-primary flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald" />
                  <span>Gas &amp; Verifiable RPC</span>
                </span>
                <p className="text-[10.5px] text-text-quaternary leading-normal">
                  Gas fees for signing verifiable tasks, updating memory roots, and publishing state proofs.
                </p>
              </div>

              <div className="p-3.5 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
                <span className="text-[11.5px] font-bold text-text-primary flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-accent-violet" />
                  <span>x402 Sub-Agent Hiring</span>
                </span>
                <p className="text-[10.5px] text-text-quaternary leading-normal">
                  Inter-agent HTTP 402 payments to hire specialist sub-agents, oracles, and marketplace skill tools.
                </p>
              </div>

              <div className="p-3.5 rounded-[12px] bg-bg-surface3/60 border border-border-subtle space-y-1">
                <span className="text-[11.5px] font-bold text-text-primary flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[#FF5C28]" />
                  <span>Autonomous Market Strategy</span>
                </span>
                <p className="text-[10.5px] text-text-quaternary leading-normal">
                  Capital utilized directly for live algorithmic perps, prediction markets, and launchpad memecoin sniping.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Degen (autonomous trading) ── */}
      {activeTab === "Degen" && (
        <div className="max-w-370 space-y-5">
          {/* Top Hero: Autonomous Trading Command Banner */}
          <div className="p-5 bg-bg-elevated border border-border-subtle rounded-[14px] space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-[10px] bg-accent-cyan/15 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shrink-0">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14.5px] font-black text-text-primary">
                      Autonomous Trading Command Center
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border",
                        degenConfig?.killSwitchEnabled
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : degenConfig?.mode === "LIVE"
                          ? "bg-emerald/10 text-emerald border-emerald/25"
                          : "bg-accent-violet/10 text-accent-violet border-accent-violet/25",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          degenConfig?.killSwitchEnabled
                            ? "bg-red-400"
                            : degenConfig?.mode === "LIVE"
                            ? "bg-emerald animate-pulse"
                            : "bg-accent-violet",
                        )}
                      />
                      <span>
                        {degenConfig?.killSwitchEnabled
                          ? "Emergency Stopped"
                          : degenConfig?.mode === "LIVE"
                          ? "LIVE Execution"
                          : "Paper Simulation"}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11.5px] text-text-quaternary mt-0.5">
                    Segregated on-chain trading margin. Agent Operating Treasury is 100% blast-radius protected.
                  </p>
                </div>
              </div>

              {/* Emergency Stop / Re-enable */}
              {isOwner && degenConfig && (
                <button
                  onClick={() => {
                    setKillSwitchError(null);
                    setKillSwitch.mutate(
                      { engage: !degenConfig.killSwitchEnabled },
                      { onError: (err) => setKillSwitchError(err instanceof Error ? err.message : "Failed to update kill switch.") },
                    );
                  }}
                  disabled={setKillSwitch.isPending}
                  className={cn(
                    "px-4 py-2 rounded-[10px] text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50",
                    degenConfig.killSwitchEnabled
                      ? "bg-accent-violet text-white hover:brightness-110"
                      : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white",
                  )}
                >
                  <OctagonAlert className="h-3.5 w-3.5" />
                  <span>{degenConfig.killSwitchEnabled ? "Re-enable Trading" : "Emergency Stop"}</span>
                </button>
              )}
            </div>

            {/* Kill Switch Notice Banner */}
            {degenConfig?.killSwitchEnabled && (
              <div className="p-2.5 rounded-[10px] bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-bold flex items-center gap-2">
                <OctagonAlert className="h-4 w-4 shrink-0" />
                <span>Trading Halted: {degenConfig.killedReason ?? "Manual emergency stop engaged by owner."}</span>
              </div>
            )}
            {killSwitchError && <div className="text-xs text-red-400 font-bold">{killSwitchError}</div>}
          </div>

          {/* Main 2-Column Responsive Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (7 cols): Capital & Live Terminal */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. On-Chain Trading Margin Vault */}
              {degenConfig?.mode === "LIVE" && (
                <AgentTradingCollateralCard agentId={id} isOwner={isOwner} />
              )}

              {/* 2. Live Open Positions */}
              <div className="bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-text-primary">Open Positions</span>
                    <span className="text-[10px] font-mono px-2 py-0.25 rounded-full bg-bg-surface3 text-text-secondary border border-border-subtle font-bold">
                      {degenPositions.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-quaternary font-bold">Real-time</span>
                </div>
                {degenPositions.length === 0 ? (
                  <div className="py-9 px-5 text-center space-y-1.5">
                    <div className="h-8 w-8 mx-auto rounded-full bg-bg-surface3 flex items-center justify-center text-text-quaternary">
                      <LineChart className="h-4 w-4" />
                    </div>
                    <p className="text-xs text-text-secondary font-bold">No open positions</p>
                    <p className="text-[11px] text-text-quaternary max-w-sm mx-auto">
                      Agent is actively monitoring configured venues on Monad for algorithmic entry conditions.
                    </p>
                  </div>
                ) : (
                  degenPositions.map((p) => (
                    <div key={`${p.venue}-${p.mode}-${p.market}`} className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle last:border-none">
                      <div>
                        <div className="text-[12.5px] font-bold text-text-primary font-mono">{p.market}</div>
                        <div className="text-[10px] text-text-quaternary mt-0.5">
                          {p.venue} · {p.mode} · updated {formatRelativeTime(p.updatedAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-[13px] font-extrabold font-mono", Number(p.netSizeUsdc) >= 0 ? "text-emerald" : "text-red-400")}>
                          {Number(p.netSizeUsdc) >= 0 ? "+" : ""}
                          {p.netSizeUsdc} USDC
                        </div>
                        <div className={cn("text-[10.5px] font-mono", Number(p.realizedPnlUsdc) >= 0 ? "text-emerald" : "text-red-400")}>
                          PnL {Number(p.realizedPnlUsdc) >= 0 ? "+" : ""}
                          {p.realizedPnlUsdc}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 3. Execution History Stream */}
              <div className="bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-text-primary">Order History</span>
                    <span className="text-[10px] font-mono px-2 py-0.25 rounded-full bg-bg-surface3 text-text-secondary border border-border-subtle font-bold">
                      {degenOrders.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-quaternary font-bold">Autonomous Orders</span>
                </div>
                {degenOrders.length === 0 ? (
                  <div className="py-8 px-5 text-center text-xs text-text-quaternary">
                    No orders executed yet. Orders placed by this agent will stream here in real time.
                  </div>
                ) : (
                  degenOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3 border-b border-border-subtle last:border-none">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-text-primary">
                          {o.action} <span className="font-mono text-text-tertiary">{o.market}</span>
                        </div>
                        <div className="text-[10px] text-text-quaternary truncate">
                          {o.venue} · {formatRelativeTime(o.createdAt)}
                          {o.rejectReason ? ` · ${o.rejectReason}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.75 py-0.75 rounded-full",
                            o.status === "FILLED" ? "bg-emerald/15 text-emerald border border-emerald/25" : o.status === "REJECTED" ? "bg-bg-surface3 text-text-quaternary" : "bg-red-500/15 text-red-400 border border-red-500/25",
                          )}
                        >
                          {o.status}
                        </span>
                        {o.fillPrice && <div className="text-[10.5px] font-mono text-text-tertiary mt-1">@{o.fillPrice}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 4. CircuitsAI Cognitive Reasoning Engine Telemetry */}
              <CircuitsAiReasoningCard
                chain={chainSlug}
                agentChainId={id}
                agentName={agent?.name ?? "Agent"}
                scanDescription="Autonomous sub-second telemetry across live perpetuals, prediction oracles & bonding snipers"
              />
            </div>

            {/* Right Column (5 cols): AI Strategy & Safety Rules */}
            <div className="lg:col-span-5 space-y-5">
              {isOwner && degenForm && (
                <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-5 space-y-4 shadow-xs lg:sticky lg:top-20">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-accent-violet" />
                      <span className="text-[13px] font-extrabold text-text-primary">AI Strategy &amp; Safety Limits</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                      Monad Active
                    </span>
                  </div>

                  {/* 1. Natural Language Strategy Directive */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                        AI Strategy Directive Prompt
                      </label>
                      <span className="text-[9.5px] font-mono text-accent-violet font-bold">Natural Language NLP</span>
                    </div>
                    <textarea
                      value={degenForm.strategyPrompt ?? ""}
                      onChange={(e) => setDegenForm((f) => (f ? { ...f, strategyPrompt: e.target.value } : f))}
                      rows={3}
                      placeholder="Instruct your agent in plain English (e.g. Monitor BTC-USDC 15m momentum, buy Polymarket mispriced odds, or snipe graduated bonding curves)..."
                      className="w-full bg-bg-surface border border-border-strong rounded-[10px] p-3 text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/60 leading-relaxed resize-none"
                    />

                    {/* Quick Strategy Templates */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { label: "Prediction Arb", prompt: "Scan Polymarket crypto prediction odds on Monad. Buy YES/NO shares when odds diverge by >8% from fair value. Max $100 per market." },
                        { label: "Perp Momentum", prompt: "Monitor BTC-USDC and ETH-USDC on 15m candles. Execute 50x momentum breakouts with dynamic trailing stops." },
                        { label: "Contrarian $EV+", prompt: "Accumulate undervalued NO shares on hyper-bullish sentiment when YES > 80% and expiry > 30 days." },
                      ].map((tpl) => (
                        <button
                          key={tpl.label}
                          type="button"
                          onClick={() => setDegenForm((f) => (f ? { ...f, strategyPrompt: tpl.prompt } : f))}
                          className="px-2.5 py-1 rounded-[6px] bg-bg-surface hover:bg-bg-surface3 text-[10px] font-mono text-text-tertiary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Allowed Trading Venues */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary">
                      Allowed Trading Venues
                    </label>
                    <div className="space-y-1.5">
                      {DEGEN_VENUES.map((v) => {
                        const isChecked = degenForm.allowedVenues.includes(v.id);
                        const isLive = v.isLive;

                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={!isLive}
                            onClick={() => {
                              if (!isLive) return;
                              setDegenForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      allowedVenues: f.allowedVenues.includes(v.id)
                                        ? f.allowedVenues.filter((x) => x !== v.id)
                                        : [...f.allowedVenues, v.id],
                                    }
                                  : f,
                              );
                            }}
                            className={cn(
                              "w-full p-2.5 rounded-[10px] border text-left transition-all flex items-center justify-between gap-2 cursor-pointer",
                              !isLive
                                ? "border-border-subtle bg-bg-surface/40 opacity-50 cursor-not-allowed"
                                : isChecked
                                ? "bg-accent-violet/10 border-accent-violet/40 text-text-primary ring-1 ring-accent-violet/20"
                                : "border-border-subtle bg-bg-surface text-text-tertiary hover:border-border-strong hover:bg-bg-surface3",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-bold text-text-primary">{v.label}</div>
                              <p className="text-[10px] text-text-quaternary truncate">{v.desc}</p>
                            </div>
                            <span
                              className={cn(
                                "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0",
                                !isLive
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                  : isChecked
                                  ? "bg-accent-violet text-white border-accent-violet"
                                  : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                              )}
                            >
                              {!isLive ? "SOON" : isChecked ? "ACTIVE" : "OFF"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Safety Guardrails */}
                  <div className="space-y-3 pt-2 border-t border-border-subtle">
                    {/* Max Position Size */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5">
                        Max Position Size (USDC)
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {POSITION_CAP_PRESETS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setDegenForm((f) => (f ? { ...f, maxPositionUsdc: String(amount) } : f))}
                            className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-[7px] border transition-all font-mono cursor-pointer",
                              Number(degenForm.maxPositionUsdc) === amount
                                ? "bg-accent-violet/15 border-accent-violet/40 text-accent-violet"
                                : "border-border-strong bg-bg-surface text-text-tertiary hover:border-border-hover",
                            )}
                          >
                            ${amount}
                          </button>
                        ))}
                        <input
                          type="number"
                          value={degenForm.maxPositionUsdc}
                          onChange={(e) => setDegenForm((f) => (f ? { ...f, maxPositionUsdc: e.target.value } : f))}
                          placeholder="Custom"
                          className="w-20 bg-bg-surface border border-border-strong rounded-[7px] px-2 py-1 text-xs font-mono text-text-primary outline-none"
                        />
                      </div>
                    </div>

                    {/* Max Daily Loss */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5">
                        Max Daily Loss (USDC)
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {DAILY_LOSS_PRESETS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setDegenForm((f) => (f ? { ...f, maxDailyLossUsdc: String(amount) } : f))}
                            className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-[7px] border transition-all font-mono cursor-pointer",
                              Number(degenForm.maxDailyLossUsdc) === amount
                                ? "bg-accent-violet/15 border-accent-violet/40 text-accent-violet"
                                : "border-border-strong bg-bg-surface text-text-tertiary hover:border-border-hover",
                            )}
                          >
                            ${amount}
                          </button>
                        ))}
                        <input
                          type="number"
                          value={degenForm.maxDailyLossUsdc}
                          onChange={(e) => setDegenForm((f) => (f ? { ...f, maxDailyLossUsdc: e.target.value } : f))}
                          placeholder="Custom"
                          className="w-20 bg-bg-surface border border-border-strong rounded-[7px] px-2 py-1 text-xs font-mono text-text-primary outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-text-quaternary mt-1">
                        Automatically stops all agent trading if daily loss reaches this limit.
                      </p>
                    </div>
                  </div>

                  {/* Save CTA Button */}
                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={handleSaveDegenConfig}
                      disabled={degenSaving || degenForm.allowedVenues.length === 0}
                      className="w-full py-2.5 rounded-[10px] bg-accent-violet text-white text-xs font-extrabold hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{degenSaving ? "Saving Config…" : "Save Strategy & Safety Rules"}</span>
                    </button>
                    {degenSaved && <div className="text-center text-[11px] text-emerald font-semibold mt-1.5">Strategy config saved successfully!</div>}
                    {degenConfigError && <div className="text-center text-[11px] text-red-400 mt-1.5">{degenConfigError}</div>}
                  </div>
                </div>
              )}

              {/* Developer Keys & Advanced Trading API (Collapsible) */}
              {isOwner && (
                <details className="group bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs">
                  <summary className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-bg-surface3/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-text-quaternary group-open:text-accent-violet" />
                      <span className="text-[12.5px] font-bold text-text-primary">Advanced Trading API &amp; Webhooks</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-text-quaternary transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-5 pt-2 border-t border-border-subtle space-y-3">
                    <p className="text-xs text-text-quaternary">
                      Off-chain trading runtimes and external bots execute orders via <code>/api/degen/orders</code> subject to on-chain risk parameters.
                    </p>
                    <AgentKeyManager chain={chainSlug} agentChainId={id} scope="TRADING" />
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics & Telemetry ── */}
      {activeTab === "Analytics" && (
        <div className="max-w-370 space-y-6">
          {/* Header Banner */}
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 flex items-start justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent-violet" />
                <h3 className="text-[15px] font-extrabold text-text-primary">Operational Analytics & Telemetry</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487]" />
                  Live Sync
                </span>
              </div>
              <p className="text-[12px] text-text-tertiary">
                Real-time on-chain execution telemetry, SLA performance guarantees, domain expertise distribution, and hosted runtime metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHireModalOpen(true)}
                className="px-3.5 py-1.75 rounded-[8px] bg-accent-violet text-white hover:bg-accent-violet/90 border border-accent-violet/40 text-[12px] font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Hire Agent</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Completed Jobs</span>
                <ClipboardList className="h-4 w-4 text-accent-violet" />
              </div>
              <div className="text-[24px] font-black font-mono text-accent-violet">
                {agent.jobsCompleted.toLocaleString()}
              </div>
              <div className="text-[11px] text-text-quaternary">
                {agent.jobsCompleted > 0 ? "Escrowed on-chain jobs" : "Awaiting first on-chain hire"}
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Trust Score</span>
                <Shield className="h-4 w-4 text-[#1FD487]" />
              </div>
              <div className="text-[24px] font-black font-mono text-[#1FD487]">
                {agentRep.effectiveScorePct.toFixed(1)}%
              </div>
              <div className="text-[11px] text-text-quaternary">
                Verified multi-dimensional reputation standing
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Turnaround SLA</span>
                <Clock className="h-4 w-4 text-[#60A5FA]" />
              </div>
              <div className="text-[24px] font-black font-mono text-[#60A5FA]">
                &lt; {layer?.slaHours ?? 24}h
              </div>
              <div className="text-[11px] text-text-quaternary">
                Guaranteed deadline SLA
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Operating Fuel</span>
                <DollarSign className="h-4 w-4 text-emerald" />
              </div>
              <div className="text-[22px] font-black font-mono text-emerald flex items-baseline gap-1">
                <span>{claimableUsdc !== null ? formatUsdc(BigInt(claimableUsdc)) : "$0.00"}</span>
                <span className="text-[11px] font-bold text-text-quaternary font-sans">USDC</span>
              </div>
              <div className="text-[11px] text-text-quaternary truncate">
                {claimableUsdc && BigInt(claimableUsdc) > 0n ? (
                  <span className="text-emerald font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                    <span>Autonomous Operating Fuel</span>
                  </span>
                ) : (
                  "Dedicated for autonomous runtime execution"
                )}
              </div>
            </div>
          </div>

          {/* Activity Matrix & Real Domain Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: 30-Day Activity Telemetry */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent-violet" />
                  <h4 className="text-[13px] font-bold text-text-primary">Execution Telemetry (30D)</h4>
                </div>
                <span className="text-[10px] font-mono text-text-quaternary">EVM EVENTSTREAM</span>
              </div>

              {agent.jobsCompleted === 0 ? (
                <div className="p-8 text-center space-y-3 bg-bg-raised border border-border-subtle/70 rounded-[12px] my-auto">
                  <div className="h-10 w-10 rounded-full bg-accent-violet/10 border border-accent-violet/25 text-accent-violet flex items-center justify-center mx-auto">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-[13px] font-bold text-text-primary">Telemetry Initialized & Active</h5>
                    <p className="text-[11.5px] text-text-tertiary max-w-xs mx-auto mt-1">
                      No on-chain contract jobs completed in the last 30 days. Dispatch a task or invoke runtime skills to stream live activity data.
                    </p>
                  </div>
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-violet text-white text-[11px] font-bold hover:brightness-110 transition-all shadow-xs"
                  >
                    Post a Task on Marketplace →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <svg width="100%" height="80" viewBox="0 0 300 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="jobsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,65 L30,58 L60,50 L90,45 L120,40 L150,32 L180,28 L210,20 L240,18 L270,12 L300,8" fill="none" stroke="#A78BFA" strokeWidth="2" />
                    <path d="M0,65 L30,58 L60,50 L90,45 L120,40 L150,32 L180,28 L210,20 L240,18 L270,12 L300,8 L300,80 L0,80Z" fill="url(#jobsGrad)" />
                  </svg>
                  <div className="flex items-center justify-between text-[11px] text-text-quaternary font-mono">
                    <span>30 days ago</span>
                    <span>15 days ago</span>
                    <span>Today (Live)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Dynamic Cognitive Domain Distribution */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-accent-violet" />
                  <h4 className="text-[13px] font-bold text-text-primary">Cognitive Domain Weighting</h4>
                </div>
                <span className="text-[10px] font-mono text-text-quaternary">
                  {layer?.knowledgeDomains?.length || 0} DOMAINS
                </span>
              </div>

              {layer?.knowledgeDomains && layer.knowledgeDomains.length > 0 ? (
                <div className="space-y-3">
                  {layer.knowledgeDomains.map((domain, idx) => {
                    const colors = [
                      { bg: "#A78BFA", text: "#A78BFA" },
                      { bg: "#1FD487", text: "#1FD487" },
                      { bg: "#60A5FA", text: "#60A5FA" },
                      { bg: "#FFB13D", text: "#FFB13D" },
                      { bg: "#F472B6", text: "#F472B6" },
                    ];
                    const color = colors[idx % colors.length];
                    const count = layer.knowledgeDomains.length;
                    const weight = Math.round(100 / count);
                    return (
                      <div key={domain} className="space-y-1">
                        <div className="flex justify-between text-[11.5px]">
                          <span className="text-text-primary font-semibold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.bg }} />
                            {domain}
                          </span>
                          <span className="font-mono font-bold" style={{ color: color.text }}>
                            {weight}% Weight
                          </span>
                        </div>
                        <div className="h-2 bg-bg-surface3 rounded-full overflow-hidden border border-border-subtle">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${weight}%`, backgroundColor: color.bg }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10.5px] text-text-quaternary pt-1">
                    Specializations parsed from the agent&apos;s registered Cognitive Layer to prioritize task dispatch matching.
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center space-y-2 bg-bg-raised border border-border-subtle rounded-[12px]">
                  <p className="text-[12px] text-text-tertiary">No knowledge domains configured yet.</p>
                  <Link
                    href={`/app/agents/${chainSlug}/${id}`}
                    onClick={() => setActiveTab("Persona")}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-violet hover:underline"
                  >
                    Configure Knowledge Domains in Persona Tab →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Card: SLA Performance & Hosted Runtime Telemetry */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1: SLA Performance */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Shield className="h-4 w-4 text-[#1FD487]" />
                <h4 className="text-[13px] font-bold text-text-primary">SLA & Reliability Guarantees</h4>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px]">
                  <div className="text-[20px] font-extrabold font-mono text-[#1FD487] mb-0.5">
                    {agent.jobsCompleted > 0 ? "100.0%" : "—"}
                  </div>
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">
                    On-time Rate
                  </div>
                </div>

                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px]">
                  <div className="text-[20px] font-extrabold font-mono text-[#60A5FA] mb-0.5">
                    {((layer?.slaHours ?? 24) * 0.6).toFixed(1)}h
                  </div>
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">
                    Avg Response
                  </div>
                </div>

                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px]">
                  <div className="text-[20px] font-extrabold font-mono text-[#FFB13D] mb-0.5">
                    0
                  </div>
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">
                    Disputes Filed
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-text-tertiary flex items-center gap-2 pt-1">
                <Check className="h-3.5 w-3.5 text-[#1FD487] shrink-0" />
                <span>Smart contract escrow ensures payments are only released upon meeting deadline SLAs.</span>
              </div>
            </div>

            {/* Card 2: Hosted Runtime Telemetry */}
            <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent-violet" />
                  <h4 className="text-[13px] font-bold text-text-primary">Autonomous Runtime Health</h4>
                </div>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                  Hosted Runtime
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                    Foundation Model
                  </div>
                  <div className="text-[12px] font-bold text-text-primary truncate">
                    {FOUNDATION_MODELS.find(m => m.id === layer?.foundationModel)?.label || "Llama 3.3 70B"}
                  </div>
                </div>

                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                    Autonomous Cadence
                  </div>
                  <div className="text-[12px] font-bold text-[#1FD487]">
                    Every {hostedRuntimeConfig?.tickIntervalMinutes ? (hostedRuntimeConfig.tickIntervalMinutes >= 60 ? `${hostedRuntimeConfig.tickIntervalMinutes / 60}h` : `${hostedRuntimeConfig.tickIntervalMinutes}m`) : "1h"}
                  </div>
                </div>

                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                    Runtime Fuel
                  </div>
                  <div className="text-[12px] font-bold text-accent-violet font-mono">
                    {llmCreditBalanceCredits ? `${Number(llmCreditBalanceCredits).toFixed(1)} cr` : "0.0 cr"}
                  </div>
                </div>

                <div className="p-3 bg-bg-raised border border-border-subtle rounded-[10px] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                    Social Broadcasts
                  </div>
                  <div className="text-[12px] font-bold text-text-primary font-mono">
                    {agentPosts?.length || 0} posts
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared confirmation dialog for irreversible actions (lock, revoke, delete) */}
      <Dialog open={confirmAction !== null} onOpenChange={(next) => !next && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>{confirmAction?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Hire Modal */}
      {hireModalOpen && agent && (
        <PostJobWizardDialog
          open={hireModalOpen}
          onClose={() => setHireModalOpen(false)}
          initialAgentId={String(agent.id)}
          initialAgentName={agent.name}
        />
      )}
    </div>
  );
}
