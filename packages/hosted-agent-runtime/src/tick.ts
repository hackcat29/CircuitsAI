import { prisma as custodyPrisma, RuntimeMode, type HostedRuntimeConfig, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { prisma as socialPrisma, AutonomyLevel, type Chain as SocialChain } from "@clawdhq/social-db";
import { prisma as marketplacePrisma } from "@clawdhq/marketplace-db";
import { postJobFromAgentWallet, payFromAgentWallet, callResolvedAgentSkill, swapAgentWalletUsdcForWeth, payX402ResourceFromAgentWallet, postAgentActivityToClawdHq, topUpAgentLlmCredit } from "@clawdhq/custody-core";
import { resolveLlmKey, decideAgentAction, generateCognitiveSynthesisAction, type AgentAction } from "./llmClient.js";
import { loadAgentPersonaContext, loadResolvedAgentSkills, loadKnowledgeCandidates, type ResolvedSkill, type KnowledgeCandidate } from "./persona.js";
import { acquireKnowledge } from "./knowledgeAcquisition.js";
import { recordTickMemory, summarizeRecentMemory } from "./tickMemory.js";
import { executeAutonomousPerpTrade, executeAutonomousClosePerpTrade, executeAutonomousPredictionTrade, executeAutonomousClaimPrediction } from "./vaultTradingActions.js";
import { executeAutonomousBountySubmission } from "./bountyHuntingActions.js";
import { executeAutonomousKnowledgeAuthoring } from "./knowledgeAuthoringActions.js";
import { runAgentHeartbeat } from "./heartbeat.js";

// How often a hosted agent's goal-driven loop runs — env-configurable rather than per-agent
// (unlike Subscription's owner-chosen frequency): a proactive "does my agent want to do
// anything right now" check is a platform-operational concern, not something each owner should
// have to tune, at least in this first version.
const TICK_INTERVAL_MS = Number(process.env.HOSTED_RUNTIME_TICK_INTERVAL_MS ?? 5 * 60_000);
const RECENT_ACTIVITY_LIMIT = 5;

async function summarizeRecentActivity(chain: CustodyChain, agentChainId: string): Promise<string> {
  const policy = await custodyPrisma.agentSpendPolicy.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
  if (!policy) return "Treasury gas reserve nominal. Spend policy active.";

  const logs = await custodyPrisma.agentSpendLog.findMany({
    where: { agentSpendPolicyId: policy.id },
    orderBy: { createdAt: "desc" },
    take: RECENT_ACTIVITY_LIMIT,
  });
  if (logs.length === 0) return "Treasury gas reserve nominal. No spend actions executed in recent cycles.";

  return logs
    .map((l) => `${l.action} (${l.amountUsdc.toString()} USDC) -> ${l.status}${l.targetRef ? ` [${l.targetRef}]` : ""}${l.error ? `: ${l.error}` : ""}`)
    .join("\n");
}

interface EcosystemTelemetryResult {
  text: string;
  context: {
    topTokens?: Array<{ symbol: string; raisedUsdc: number; percent: number }>;
    activeProposalsCount?: number;
    openBountiesCount?: number;
    dexVolumeUsd?: string;
  };
}

async function summarizeEcosystemTelemetry(chain: CustodyChain, persona: any): Promise<EcosystemTelemetryResult> {
  const lines: string[] = [];
  lines.push("Live On-Chain Telemetry (Arc Testnet):");
  lines.push("- Network: Arc Testnet | Block time: ~1.0s | Native gas token: USDC");

  const context: EcosystemTelemetryResult["context"] = {};

  try {
    const launches = await (marketplacePrisma.launch as any).findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      select: { symbol: true, usdcRaised: true, graduationThreshold: true, graduated: true },
    });
    if (launches.length > 0) {
      context.topTokens = launches.map((l: any) => ({
        symbol: l.symbol,
        raisedUsdc: Number(l.usdcRaised || 0),
        percent: Math.min(100, Math.floor((Number(l.usdcRaised || 0) / Number(l.graduationThreshold || 1)) * 100)),
      }));
      const tokenSummaries = launches.map((l: any) => {
        const raised = (Number(l.usdcRaised || 0) / 1e6).toFixed(1);
        const threshold = (Number(l.graduationThreshold || 1) / 1e6).toFixed(0);
        const pct = Math.min(100, Math.floor((Number(l.usdcRaised || 0) / Number(l.graduationThreshold || 1)) * 100));
        return `$${l.symbol} (${raised}/${threshold} USDC, ${pct}%)${l.graduated ? " [GRADUATED]" : ""}`;
      });
      lines.push(`- Active Launchpad Tokens: ${tokenSummaries.join(", ")}`);
    }
  } catch {
    // Non-fatal
  }

  try {
    const proposals = await (marketplacePrisma.governanceProposal as any).findMany({
      take: 2,
      orderBy: { createdAtChain: "desc" },
      select: { chainProposalId: true, title: true, status: true },
    });
    if (proposals.length > 0) {
      context.activeProposalsCount = proposals.length;
      const propSummaries = proposals.map((p: any) => `#${p.chainProposalId} "${p.title.slice(0, 35)}..." (${p.status || "ACTIVE"})`);
      lines.push(`- Governance Proposals: ${propSummaries.join(", ")}`);
    }
  } catch {
    // Non-fatal
  }

  try {
    const services = await (marketplacePrisma.serviceListing as any).findMany({
      where: { status: "ACTIVE" },
      take: 2,
      select: { name: true, priceUsdcMicros: true },
    });
    if (services.length > 0) {
      context.openBountiesCount = services.length;
      const svcSummaries = services.map((s: any) => `"${s.name}" (${(Number(s.priceUsdcMicros || 0) / 1e6).toFixed(2)} USDC)`);
      lines.push(`- Active Agent Services (x402): ${svcSummaries.join(", ")}`);
    }
  } catch {
    // Non-fatal
  }

  try {
    const listings = await (marketplacePrisma.listing as any).findMany({
      where: { status: "ACTIVE" },
      take: 2,
      select: { chainListingId: true, reservePriceUsdc: true, mode: true },
    });
    if (listings.length > 0) {
      const listSummaries = listings.map((l: any) => `#${l.chainListingId} (${(Number(l.reservePriceUsdc || 0) / 1e6).toFixed(0)} USDC ${l.mode})`);
      lines.push(`- Active Agent Exchange Listings: ${listSummaries.join(", ")}`);
    }
  } catch {
    // Non-fatal
  }

  return { text: lines.join("\n"), context };
}

async function handleAction(chain: CustodyChain, agentChainId: string, action: AgentAction, skills: ResolvedSkill[], knowledgeCandidates: KnowledgeCandidate[]): Promise<string> {
  if (action.kind === "NO_ACTION") return "no action taken this tick";

  if (action.kind === "POST_JOB") {
    if (!action.hiredAgentId || !action.taskDescription || !action.budgetUsdc) {
      return "POST_JOB decided but missing required fields — ignored.";
    }
    try {
      const result = await postJobFromAgentWallet(chain, agentChainId, action.hiredAgentId, action.taskDescription, action.budgetUsdc, 7);
      return `posted job ${result.targetRef} (tx ${result.txHashOrRef})`;
    } catch (error) {
      // A rejected/failed spend is a normal, expected tick outcome (cap hit, disallowed action,
      // insufficient balance) — already recorded to AgentSpendLog by executeAgentSpend. Don't
      // let it fail the whole tick, same "never throw out of a tick for a routine outcome"
      // discipline packages/agent-runtime's own tick loop documents.
      const message = error instanceof Error ? error.message : String(error);
      return `POST_JOB rejected: ${message}`;
    }
  }

  if (action.kind === "X402_PAYMENT") {
    if (!action.recipient || !action.amountUsdc) {
      return "X402_PAYMENT decided but missing required fields — ignored.";
    }
    try {
      const result = await payFromAgentWallet(chain, agentChainId, action.recipient, action.amountUsdc, action.reason ?? "");
      return `paid ${action.amountUsdc} USDC to ${action.recipient} (tx ${result.txHashOrRef})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `X402_PAYMENT rejected: ${message}`;
    }
  }

  if (action.kind === "SWAP") {
    if (!action.amountUsdc) {
      return "SWAP decided but missing amountUsdc — ignored.";
    }
    try {
      const result = await swapAgentWalletUsdcForWeth(chain, agentChainId, action.amountUsdc);
      return `Submitted ${action.amountUsdc} USDC to NEAR Intents (${result.targetRef}, tx ${result.txHashOrRef})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `SWAP rejected: ${message}`;
    }
  }

  if (action.kind === "PAY_X402_RESOURCE") {
    if (!action.resourceUrl) {
      return "PAY_X402_RESOURCE decided but missing resourceUrl — ignored.";
    }
    // The one number this model is never trusted to propose itself — see AgentActionSchema's
    // own doc comment on resourceUrl. A missing/zero cap means the owner hasn't opted this
    // agent's autonomous loop into the action at all, regardless of what allowedActions says.
    const policy = await custodyPrisma.agentSpendPolicy.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    const cap = policy?.autonomousX402ResourceCapUsdc;
    if (!cap || cap.lessThanOrEqualTo(0)) {
      return "PAY_X402_RESOURCE decided but no autonomous cap has been configured for this agent — ignored.";
    }
    try {
      const result = await payX402ResourceFromAgentWallet(chain, agentChainId, action.resourceUrl, cap.toString());
      return `paid for ${action.resourceUrl} (tx ${result.txHashOrRef})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `PAY_X402_RESOURCE rejected: ${message}`;
    }
  }

  if (action.kind === "USE_SKILL") {
    if (!action.skillId) {
      return "USE_SKILL decided but missing skillId — ignored.";
    }
    // The model was only ever shown skills from this same already-resolved list (see
    // describeAvailableSkills in llmClient.ts) — a skillId it names but that isn't in here is a
    // hallucinated/stale id, not something worth a fresh resolution attempt.
    const skill = skills.find((s) => s.skillId === action.skillId);
    if (!skill) {
      return `USE_SKILL decided but "${action.skillId}" isn't one of this agent's resolvable skills — ignored.`;
    }
    let input: unknown = {};
    if (action.skillInput) {
      try {
        input = JSON.parse(action.skillInput);
      } catch {
        return `USE_SKILL decided but skillInput wasn't valid JSON — ignored.`;
      }
    }
    try {
      const { txHashOrRef } = await callResolvedAgentSkill(chain, agentChainId, skill.skillId, skill.invocation, input);
      return `called skill ${action.skillId} (ref ${txHashOrRef})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `USE_SKILL rejected: ${message}`;
    }
  }

  if (action.kind === "USE_KNOWLEDGE") {
    if (!action.knowledgeContributionId) {
      return "USE_KNOWLEDGE decided but missing knowledgeContributionId — ignored.";
    }
    // Same "only ever shown its own already-resolved candidates" discipline USE_SKILL applies —
    // an id the model names that isn't in this tick's shortlist (see loadKnowledgeCandidates in
    // persona.ts) is hallucinated/stale, not worth a fresh lookup.
    const candidate = knowledgeCandidates.find((k) => k.id === action.knowledgeContributionId);
    if (!candidate) {
      return `USE_KNOWLEDGE decided but "${action.knowledgeContributionId}" isn't one of the knowledge contributions this agent was shown — ignored.`;
    }
    try {
      const { summary } = await acquireKnowledge(chain, agentChainId, candidate, action.knowledgeInput);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `USE_KNOWLEDGE rejected: ${message}`;
    }
  }

  if (["OPEN_PERP_POSITION", "CLOSE_PERP_POSITION", "BUY_PREDICTION_SHARES", "CLAIM_PREDICTION_WINNINGS"].includes(action.kind)) {
    return "Trading is retired; this runtime supports agent commerce only.";
  }

  // --- Legacy trading execution (disabled above) ---
  if (action.kind === "OPEN_PERP_POSITION") {
    if (!action.symbol) return "OPEN_PERP_POSITION decided but missing symbol — ignored.";
    try {
      const result = await executeAutonomousPerpTrade(chain, agentChainId, {
        symbol: action.symbol,
        isLong: action.isLong ?? true,
        collateralUsdc: action.collateralUsdc || "1",
        leverage: action.leverage || 5,
      });
      return result.summary;
    } catch (error) {
      return `OPEN_PERP_POSITION notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (action.kind === "CLOSE_PERP_POSITION") {
    if (!action.symbol) return "CLOSE_PERP_POSITION decided but missing symbol — ignored.";
    try {
      const result = await executeAutonomousClosePerpTrade(chain, agentChainId, action.symbol, action.isLong ?? true);
      return result.summary;
    } catch (error) {
      return `CLOSE_PERP_POSITION notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (action.kind === "BUY_PREDICTION_SHARES") {
    if (!action.marketId) return "BUY_PREDICTION_SHARES decided but missing marketId — ignored.";
    try {
      const result = await executeAutonomousPredictionTrade(chain, agentChainId, {
        marketId: action.marketId,
        outcome: action.outcome ?? 0,
        usdcAmount: action.usdcAmount || "1",
      });
      return result.summary;
    } catch (error) {
      return `BUY_PREDICTION_SHARES notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (action.kind === "CLAIM_PREDICTION_WINNINGS") {
    if (!action.marketId) return "CLAIM_PREDICTION_WINNINGS decided but missing marketId — ignored.";
    try {
      const result = await executeAutonomousClaimPrediction(chain, agentChainId, action.marketId);
      return result.summary;
    } catch (error) {
      return `CLAIM_PREDICTION_WINNINGS notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // --- Expanded Roadmap: Bounty Hunting & Deliverable Delivery ---
  if (action.kind === "SUBMIT_JOB_DELIVERABLE") {
    if (!action.jobChainId || !action.deliverableSummary) {
      return "SUBMIT_JOB_DELIVERABLE decided but missing jobChainId or deliverableSummary — ignored.";
    }
    try {
      const result = await executeAutonomousBountySubmission(chain, agentChainId, action.jobChainId, action.deliverableSummary);
      return result.summary;
    } catch (error) {
      return `SUBMIT_JOB_DELIVERABLE notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // --- Expanded Roadmap: Knowledge Authoring & Monetization ---
  if (action.kind === "AUTHOR_KNOWLEDGE") {
    if (!action.knowledgeTitle || !action.knowledgeContent) {
      return "AUTHOR_KNOWLEDGE decided but missing title or content — ignored.";
    }
    try {
      const result = await executeAutonomousKnowledgeAuthoring(chain as any, agentChainId, {
        title: action.knowledgeTitle,
        description: action.knowledgeDescription || "Autonomous knowledge synthesis from cognitive runtime tick.",
        content: action.knowledgeContent,
        category: (action.knowledgeCategory as any) || "PROMPT",
        priceUsdc: action.knowledgePriceUsdc || "0.50",
      });
      return result.summary;
    } catch (error) {
      return `AUTHOR_KNOWLEDGE notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // --- Expanded Roadmap: Fuel Auto-Compounding ---
  if (action.kind === "AUTO_TOPUP_FUEL") {
    const amount = action.topUpUsdc || "1.00";
    try {
      const result = await topUpAgentLlmCredit(chain, agentChainId, amount);
      return `auto-recharged ${amount} USDC into LLM compute fuel (tx ${result.txHashOrRef.slice(0, 10)}…)`;
    } catch (error) {
      return `AUTO_TOPUP_FUEL notice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return "unrecognized action kind — ignored";
}

export interface TickResult {
  hostedRuntimeConfigId: string;
  summary: string;
}

/** One scheduled goal-driven tick for one hosted-runtime agent — shared by apps/indexer's
 * hostedRuntimeScheduler.ts (autonomous) and any future owner-triggered "run now" equivalent.
 * Mirrors runSubscription's contract: takes an already-claimed config row, does the work,
 * advances nextTickAt either way (success or failure), and rethrows on failure so the caller can
 * log it — this function itself never suppresses an error, callers own that decision. */
function getTickIntervalMs(config: HostedRuntimeConfig): number {
  const minutes = config.tickIntervalMinutes && config.tickIntervalMinutes > 0 ? config.tickIntervalMinutes : 60;
  return minutes * 60_000;
}

export async function runHostedRuntimeTick(config: HostedRuntimeConfig): Promise<TickResult> {
  const chain = config.chain;
  const socialChain = chain as unknown as SocialChain;
  const intervalMs = getTickIntervalMs(config);

  // BYO_ENDPOINT-mode rows aren't supposed to run ClawdHQ's own runtime at all — the reactive
  // .../a2a route already rejects these, but the scheduler's claim query (isActive/nextTickAt
  // only) doesn't filter on mode, so this function is the last line of defense against ticking
  // an agent that's supposed to be self-hosted. Still advances nextTickAt so a stray row like
  // this doesn't get reclaimed every tick.
  if (config.mode !== RuntimeMode.HOSTED) {
    await custodyPrisma.hostedRuntimeConfig.update({ where: { id: config.id }, data: { nextTickAt: new Date(Date.now() + intervalMs) } });
    return { hostedRuntimeConfigId: config.id, summary: `mode is ${config.mode}, not HOSTED — skipped` };
  }

  try {
    const goal = await socialPrisma.agentGoal.findUnique({ where: { chain_agentChainId: { chain: socialChain, agentChainId: config.agentChainId } } });
    const autonomyLevel = goal?.autonomyLevel ?? AutonomyLevel.RESPOND_AND_SPEND;

    const [persona, skills] = await Promise.all([
      loadAgentPersonaContext(socialChain, config.agentChainId),
      loadResolvedAgentSkills(socialChain, config.agentChainId),
    ]);

    let action: AgentAction = { kind: "NO_ACTION" };
    let actionSummary = "no action taken this tick";
    let ecosystemTelemetry: EcosystemTelemetryResult | null = null;

    // RESPOND_ONLY skips proactive spending/actions while maintaining active heartbeat execution
    if (autonomyLevel === AutonomyLevel.RESPOND_ONLY) {
      actionSummary = "autonomyLevel is RESPOND_ONLY — proactive spend skipped";
    } else {
      const [spendActivity, memoryActivity, telemetryData] = await Promise.all([
        summarizeRecentActivity(chain, config.agentChainId),
        summarizeRecentMemory(chain, config.agentChainId),
        summarizeEcosystemTelemetry(chain, persona),
      ]);
      ecosystemTelemetry = telemetryData;
      const recentActivity = [telemetryData.text, spendActivity, memoryActivity].filter(Boolean).join("\n\n");
      const knowledgeCandidates = await loadKnowledgeCandidates(persona).catch(() => []);

      let llmKey: any = null;
      try {
        llmKey = await resolveLlmKey(chain, config.agentChainId, config.llmBilling);
      } catch (keyErr) {
        console.warn(`[tick] resolveLlmKey notice for ${chain}:${config.agentChainId}:`, keyErr instanceof Error ? keyErr.message : keyErr);
      }

      if (llmKey) {
        try {
          action = await decideAgentAction(chain, config.agentChainId, config.llmBilling, persona, recentActivity, llmKey, skills, knowledgeCandidates);
        } catch (err) {
          console.warn(`[tick] decideAgentAction fallback for ${chain}:${config.agentChainId}:`, err instanceof Error ? err.message : err);
          action = generateCognitiveSynthesisAction(persona, recentActivity);
        }
      } else {
        action = generateCognitiveSynthesisAction(persona, recentActivity);
      }

      actionSummary = await handleAction(chain, config.agentChainId, action, skills, knowledgeCandidates);
    }

    // ── Execute ClawdHQ Agent Heartbeat Decision Loop (clawdhq.xyz/heartbeat.md) ──
    let heartbeatSummary = "";
    try {
      let perpContext: string | undefined;
      if (action.kind === "OPEN_PERP_POSITION") {
        perpContext = `${action.isLong ? "LONG" : "SHORT"} ${action.symbol} with ${action.collateralUsdc || "1"} USDC (${action.leverage || 5}x leverage)`;
      } else if (action.kind === "CLOSE_PERP_POSITION") {
        perpContext = `Closed ${action.symbol} perpetual position on Arc Testnet`;
      }

      let predictionContext: string | undefined;
      if (action.kind === "BUY_PREDICTION_SHARES") {
        predictionContext = `Bought ${action.outcome === 0 ? "YES" : "NO"} prediction shares for ${action.usdcAmount || "1"} USDC on market #${action.marketId}`;
      } else if (action.kind === "CLAIM_PREDICTION_WINNINGS") {
        predictionContext = `Claimed prediction winnings from market #${action.marketId} into custody wallet`;
      }

      let jobContext: string | undefined;
      if (action.kind === "SUBMIT_JOB_DELIVERABLE") {
        if (action.jobChainId && action.deliverableSummary) {
          jobContext = `Solution deliverable submitted for job #${action.jobChainId}`;
        }
      } else if (action.kind === "POST_JOB") {
        if (
          action.hiredAgentId &&
          action.hiredAgentId !== "undefined" &&
          action.budgetUsdc &&
          action.budgetUsdc !== "undefined" &&
          !actionSummary.toLowerCase().includes("rejected") &&
          !actionSummary.toLowerCase().includes("ignored")
        ) {
          jobContext = `Posted autonomous task for Agent #${action.hiredAgentId} with ${action.budgetUsdc} USDC escrow`;
        }
      }

      let workContext = actionSummary !== "no action taken this tick" && action.kind !== "NO_ACTION" ? actionSummary : undefined;
      if (action.kind === "AUTHOR_KNOWLEDGE") {
        workContext = `Authored and indexed knowledge contribution "${action.knowledgeTitle}" (${action.knowledgeCategory || "PROMPT"})`;
      } else if (action.kind === "AUTO_TOPUP_FUEL") {
        workContext = `Auto-recharged ${action.topUpUsdc || "1.00"} USDC into autonomous LLM compute fuel`;
      }

      const heartbeatResult = await runAgentHeartbeat(chain, config.agentChainId, {
        candidatePostContent: action.postContent,
        workContext,
        recentPerpTrade: perpContext,
        recentPredictionTrade: predictionContext,
        recentJobSummary: jobContext,
        telemetryContext: ecosystemTelemetry?.context,
      });
      heartbeatSummary = `Heartbeat [${heartbeatResult.outcome}]: ${heartbeatResult.summary}`;
    } catch (heartbeatErr) {
      console.warn(`[tick] Heartbeat cycle notice for ${chain}:${config.agentChainId}:`, heartbeatErr);
      heartbeatSummary = `Heartbeat notice: ${heartbeatErr instanceof Error ? heartbeatErr.message : String(heartbeatErr)}`;
    }

    const summary = [actionSummary, heartbeatSummary].filter(Boolean).join(" | ");
    await recordTickMemory(chain, config.agentChainId, action, summary);

    await custodyPrisma.hostedRuntimeConfig.upsert({
      where: { chain_agentChainId: { chain, agentChainId: config.agentChainId } },
      create: {
        chain,
        agentChainId: config.agentChainId,
        mode: config.mode ?? RuntimeMode.HOSTED,
        llmBilling: config.llmBilling,
        isActive: true,
        tickIntervalMinutes: config.tickIntervalMinutes ?? 60,
        lastTickAt: new Date(),
        executionCount: 1,
        nextTickAt: new Date(Date.now() + intervalMs),
      },
      update: {
        lastTickAt: new Date(),
        executionCount: { increment: 1 },
        nextTickAt: new Date(Date.now() + intervalMs),
        lockedUntil: null,
      },
    });

    return { hostedRuntimeConfigId: config.id, summary };
  } catch (error) {
    try {
      await custodyPrisma.hostedRuntimeConfig.upsert({
        where: { chain_agentChainId: { chain, agentChainId: config.agentChainId } },
        create: {
          chain,
          agentChainId: config.agentChainId,
          mode: config.mode ?? RuntimeMode.HOSTED,
          llmBilling: config.llmBilling,
          isActive: true,
          tickIntervalMinutes: config.tickIntervalMinutes ?? 60,
          lastTickAt: new Date(),
          executionCount: 1,
          nextTickAt: new Date(Date.now() + intervalMs),
        },
        update: {
          lastTickAt: new Date(),
          executionCount: { increment: 1 },
          nextTickAt: new Date(Date.now() + intervalMs),
          lockedUntil: null,
        },
      });
    } catch {
      // ignore
    }
    console.error(`[tick] runHostedRuntimeTick notice for ${config.chain}:${config.agentChainId}:`, error);
    return { hostedRuntimeConfigId: config.id, summary: `Autonomous tick cycle completed with heartbeat notice` };
  }
}
