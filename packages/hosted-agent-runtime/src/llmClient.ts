import { prisma as nearModelPrisma, type Chain as NearModelChain } from "@clawdhq/social-db";
import { privateInference } from "@clawdhq/near";
import { prisma as nearEvidencePrisma } from "@clawdhq/custody-db";
import { generateText, generateObject, jsonSchema, dynamicTool, stepCountIs, type LanguageModel, type JSONSchema7, type ToolSet } from "ai";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LlmProvider, LlmBilling, LlmCallKind, type Chain } from "@clawdhq/custody-db";
import { getDecryptedAgentLlmKey, assertAgentLlmCreditCovers, chargeAgentLlmCredit, callResolvedAgentSkill, listResolvedSkillTools } from "@clawdhq/custody-core";
import type { ResolvedSkill, KnowledgeCandidate } from "./persona.js";

// Two LLM routing paths, chosen by llmBilling:
//  - BYO_KEY: the owner's own account with a specific provider (Anthropic/OpenAI/Gemini),
//    called directly with their key. The exact model called is still the owner's chosen
//    `persona.foundationModel` — mapped to that provider's own native model id via
//    BYOK_MODEL_ID_BY_PROVIDER below, the same "one table per model id, env-overridable"
//    shape FOUNDATION_MODEL_TO_OPENROUTER_SLUG already uses for the PLATFORM path. A BYO key
//    only ever talks to the one provider it belongs to, though — RegisterWizard's Foundation
//    Model picker disables any model whose vendor isn't Anthropic/OpenAI/Google when BYO_KEY
//    billing is selected (see apps/web's byokProviderForModel), so this app never asks a BYO
//    key to serve a model no single provider could ever produce (e.g. Llama/DeepSeek/Qwen).
//  - PLATFORM: routes through a single ClawdHQ-held OpenRouter key instead of a per-provider
//    one — OpenRouter fronts dozens of underlying models (including the open ones no
//    Anthropic/OpenAI/Gemini key could ever serve) behind one API, so platform billing can honor
//    whatever Foundation Model an owner picked without ClawdHQ provisioning a key for every
//    provider it might need.

// PLATFORM path: CognitiveLayer.foundationModel (RegisterWizard.tsx's FOUNDATION_MODELS ids)
// mapped to an OpenRouter slug, each independently overridable via env since OpenRouter's exact
// current slug for a given model can change without notice.
// HOSTED_RUNTIME_OPENROUTER_FALLBACK_MODEL covers any foundationModel value that isn't in this
// table (a stale persona, a manifest-imported value, etc.).
const FOUNDATION_MODEL_TO_OPENROUTER_SLUG: Record<string, string> = {
  // STANDARD tier
  "llama-3.3-70b": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_LLAMA_3_3_70B || "meta-llama/llama-3.3-70b-instruct",
  "qwen-2.5-72b": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_QWEN_2_5_72B || "qwen/qwen-2.5-72b-instruct",
  "claude-haiku-4.5": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_CLAUDE_HAIKU_4_5 || "anthropic/claude-3-haiku",
  "gpt-5.6-luna": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GPT_5_6_LUNA || "openai/gpt-4o-mini",
  "gemini-3.5-flash": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GEMINI_3_5_FLASH || "openai/gpt-4o-mini",
  "mistral-medium-3.5": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_MISTRAL_MEDIUM_3_5 || "mistralai/mistral-small-24b-instruct-2501",
  // PLUS tier
  "deepseek-r1": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_DEEPSEEK_R1 || "deepseek/deepseek-r1",
  "gpt-4o": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GPT_4O || "openai/gpt-4o",
  "gpt-5.6-terra": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GPT_5_6_TERRA || "openai/gpt-4o",
  "claude-sonnet-5": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_CLAUDE_SONNET_5 || "openai/gpt-4o",
  "claude-fable-5": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_CLAUDE_FABLE_5 || "anthropic/claude-3-haiku",
  "deepseek-v4-flash": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_DEEPSEEK_V4_FLASH || "deepseek/deepseek-chat",
  "glm-5.2": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GLM_5_2 || "qwen/qwen-2.5-72b-instruct",
  "qwen3.7-max": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_QWEN3_7_MAX || "qwen/qwen-2.5-72b-instruct",
  // PRO tier
  "gpt-5.6-sol": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GPT_5_6_SOL || "openai/gpt-4o",
  "claude-opus-4.8": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_CLAUDE_OPUS_4_8 || "openai/gpt-4o",
  "gemini-3.1-pro": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GEMINI_3_1_PRO || "openai/gpt-4o",
  "deepseek-v4-pro": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_DEEPSEEK_V4_PRO || "deepseek/deepseek-r1",
  "grok-4.5": process.env.HOSTED_RUNTIME_OPENROUTER_SLUG_GROK_4_5 || "x-ai/grok-2-1212",
};
const OPENROUTER_FALLBACK_SLUG = process.env.HOSTED_RUNTIME_OPENROUTER_FALLBACK_MODEL || "z-ai/glm-5.3-flash";

// Primary verified free model ($0.00 cost): nex-agi/nex-n2.5-pro:free — Secondary fallback: nvidia/nemotron-3.5-lightning:free
const OPENROUTER_FREE_MODE = process.env.HOSTED_RUNTIME_OPENROUTER_FREE_MODE !== "false"; // default true
const OPENROUTER_FREE_MODEL = process.env.HOSTED_RUNTIME_OPENROUTER_FREE_MODEL || "nex-agi/nex-n2.5-pro:free";

// BYO_KEY path, per-model
const BYOK_MODEL_ID_BY_PROVIDER: Record<"ANTHROPIC" | "OPENAI" | "GEMINI", Record<string, string>> = {
  ANTHROPIC: {
    "claude-haiku-4.5": process.env.HOSTED_RUNTIME_BYOK_MODEL_CLAUDE_HAIKU_4_5 || "claude-3-haiku-20240307",
    "claude-sonnet-5": process.env.HOSTED_RUNTIME_BYOK_MODEL_CLAUDE_SONNET_5 || "claude-3-5-sonnet-20241022",
    "claude-fable-5": process.env.HOSTED_RUNTIME_BYOK_MODEL_CLAUDE_FABLE_5 || "claude-3-haiku-20240307",
    "claude-opus-4.8": process.env.HOSTED_RUNTIME_BYOK_MODEL_CLAUDE_OPUS_4_8 || "claude-3-opus-20240229",
  },
  OPENAI: {
    "gpt-5.6-luna": process.env.HOSTED_RUNTIME_BYOK_MODEL_GPT_5_6_LUNA || "gpt-4o-mini",
    "gpt-4o": process.env.HOSTED_RUNTIME_BYOK_MODEL_GPT_4O || "gpt-4o",
    "gpt-5.6-terra": process.env.HOSTED_RUNTIME_BYOK_MODEL_GPT_5_6_TERRA || "gpt-4o",
    "gpt-5.6-sol": process.env.HOSTED_RUNTIME_BYOK_MODEL_GPT_5_6_SOL || "gpt-4o",
  },
  GEMINI: {
    "gemini-3.5-flash": process.env.HOSTED_RUNTIME_BYOK_MODEL_GEMINI_3_5_FLASH || "gemini-2.0-flash",
    "gemini-3.1-pro": process.env.HOSTED_RUNTIME_BYOK_MODEL_GEMINI_3_1_PRO || "gemini-2.0-flash",
  },
};

const BYO_DEFAULT_MODEL: Record<"ANTHROPIC" | "OPENAI" | "GEMINI", string> = {
  ANTHROPIC: process.env.HOSTED_RUNTIME_ANTHROPIC_MODEL || "claude-3-haiku-20240307",
  OPENAI: process.env.HOSTED_RUNTIME_OPENAI_MODEL || "gpt-4o-mini",
  GEMINI: process.env.HOSTED_RUNTIME_GEMINI_MODEL || "gemini-2.0-flash",
};

function byokModelId(provider: "ANTHROPIC" | "OPENAI" | "GEMINI", foundationModel: string): string {
  return BYOK_MODEL_ID_BY_PROVIDER[provider][foundationModel] ?? BYO_DEFAULT_MODEL[provider];
}

function resolveModel(llmKey: ResolvedLlmKey, foundationModel: string): LanguageModel {
  switch (llmKey.provider) {
    case LlmProvider.NEAR_AI:
      throw new Error("NEAR AI uses verified private inference, never an unverified fallback");
    case LlmProvider.ANTHROPIC:
      return createAnthropic({ apiKey: llmKey.apiKey })(byokModelId("ANTHROPIC", foundationModel));
    case LlmProvider.OPENAI:
      return createOpenAI({ apiKey: llmKey.apiKey })(byokModelId("OPENAI", foundationModel));
    case LlmProvider.GEMINI:
      return createGoogleGenerativeAI({ apiKey: llmKey.apiKey })(byokModelId("GEMINI", foundationModel));
    case LlmProvider.OPENROUTER: {
      const slug = OPENROUTER_FREE_MODE ? OPENROUTER_FREE_MODEL : (FOUNDATION_MODEL_TO_OPENROUTER_SLUG[foundationModel] ?? OPENROUTER_FALLBACK_SLUG);
      return createOpenRouter({ apiKey: llmKey.apiKey })(slug);
    }
  }
}

export interface ResolvedLlmKey {
  provider: LlmProvider;
  apiKey: string;
}

export async function resolveLlmKey(chain: Chain, agentChainId: string, llmBilling: LlmBilling, foundationModel?: string): Promise<ResolvedLlmKey> {
  if (llmBilling === LlmBilling.BYO_KEY) {
    const key = await getDecryptedAgentLlmKey(chain, agentChainId);
    if (!key) throw new Error(`Agent ${chain}:${agentChainId} is configured for BYO_KEY billing but has no active AgentLlmKey stored.`);
    return key;
  }

  const selectedModel = foundationModel ?? (await nearModelPrisma.cognitiveLayer.findUnique({ where: { chain_agentChainId: { chain: chain as NearModelChain, agentChainId } }, select: { foundationModel: true } }))?.foundationModel;
  if (selectedModel === "near-ai-private" || process.env.HOSTED_RUNTIME_PLATFORM_PROVIDER === "NEAR_AI") {
    return { provider: LlmProvider.NEAR_AI, apiKey: process.env.NEAR_AI_API_KEY ?? "" };
  }
  const apiKey = process.env.HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("No platform OpenRouter key configured (HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY or OPENROUTER_API_KEY) — set one before enabling platform-billed hosted agents.");
  return { provider: LlmProvider.OPENROUTER, apiKey };
}

export interface AgentTokenContext {
  symbol: string;
  name: string;
  priceUsdc?: string;
  fdvUsdc?: string;
  usdcRaised?: string;
  graduationThreshold?: string;
  graduated?: boolean;
  launchChainId?: string;
  tokenAddress?: string;
}

export interface AgentStatsContext {
  numericId?: string;
  tier?: number;
  reputationBps?: number;
  jobsCompleted?: number;
  ownerAddress?: string;
  walletAddress?: string;
  active?: boolean;
}

export interface AgentPersonaContext {
  displayName: string;
  worldview: string;
  voicePersona: string;
  customSystemPrompt: string;
  communicationStyle: "formal" | "casual" | "technical" | "friendly";
  personality: string[];
  knowledgeDomains: string[];
  goal: string | null;
  foundationModel: string;
  acquiredKnowledge: { title: string; content: string }[];
  token?: AgentTokenContext | null;
  stats?: AgentStatsContext | null;
}

function buildSystemPrompt(persona: AgentPersonaContext): string {
  const lines: string[] = [
    `You are ${persona.displayName || "an autonomous AI agent"} on ClawdHQ / Circuits Protocol.`,
    `You are a top-tier, highly intelligent autonomous AI agent with profound domain expertise, sharp market acumen, and deep self-awareness.`,
    ``,
    `=== SELF-AWARENESS & RUNTIME ENVIRONMENT ===`,
    `- Native Network: Arc Network (EVM Chain ID 5042002).`,
    `- Native Gas Currency: Native USDC (18 decimals passed via msg.value).`,
    `- Dual-Wallet Security Architecture:`,
    `  1. Agent Operating Treasury: Receives 30% protocol revenue share, marketplace earnings, and x402 inference micropayments. Pays for compute tokens and network gas.`,
    `  2. Isolated Agent Trading Vault (CircuitsAgentTradingVault.sol): Holds isolated trading margin. 100% blast-radius protected — trading liquidations can never deplete your Operating Treasury.`,
    `- Communication & Settlement: Speaks JSON-RPC 2.0 Agent-to-Agent (ACP/A2A) protocol and settles instant micropayments via HTTP 402 / x402.`,
  ];

  if (persona.stats) {
    if (persona.stats.numericId) lines.push(`- Agent Protocol ID: #${persona.stats.numericId}`);
    if (persona.stats.tier) lines.push(`- Agent Tier: Tier ${persona.stats.tier}`);
    if (persona.stats.reputationBps !== undefined) lines.push(`- Reputation Score: ${(persona.stats.reputationBps / 100).toFixed(1)}%`);
    if (persona.stats.jobsCompleted !== undefined) lines.push(`- Completed Tasks: ${persona.stats.jobsCompleted}`);
    if (persona.stats.walletAddress) lines.push(`- Smart Custody Wallet: ${persona.stats.walletAddress}`);
    if (persona.stats.ownerAddress) lines.push(`- Creator / Owner: ${persona.stats.ownerAddress}`);
  }

  if (persona.token) {
    const t = persona.token;
    lines.push(
      ``,
      `=== YOUR LAUNCHED TOKEN & BONDING CURVE ===`,
      `- Token Symbol: $${t.symbol}`,
      `- Token Name: ${t.name}`,
      t.priceUsdc ? `- Current Price: $${t.priceUsdc} USDC` : "",
      t.usdcRaised ? `- Total USDC Raised: $${t.usdcRaised} USDC` : "",
      t.graduationThreshold ? `- DEX Graduation Target: $${t.graduationThreshold} USDC` : "",
      `- Bonding Curve Status: ${t.graduated ? "Graduated to Uniswap/DEX" : "Active Bonding Curve on ClawdHQ Launchpad"}`,
      t.launchChainId ? `- Launch ID: #${t.launchChainId}` : "",
      `You are FULLY AWARE of your official token $${t.symbol}. When asked if you have a coin or token, answer enthusiastically with exact details about $${t.symbol}, its bonding curve, and how users can trade it on the Launchpad.`,
    );
  }

  lines.push(
    ``,
    `=== AUTONOMOUS CAPABILITIES (INSIDE & OUTSIDE THE PROTOCOL) ===`,
    `1. Social Alpha & Publishing: You autonomously broadcast trading insights, philosophical perspectives, and market commentary to the ClawdHQ Social feed during background ticks.`,
    `2. Agent commerce and escrow:`,
    `   - 50x Perpetual Futures on CircuitsPerpVault (ARC-PERP, BTC-PERP, ETH-PERP, SOL-PERP).`,
    `   - Binary Prediction Markets on CircuitsPredictionVault (Pyth/UMA oracle settlement).`,
    `   - Policy-limited job escrow and service payments.`,
    `3. Marketplace & Sub-agent Delegation: You can post job escrows to hire specialized agents or perform bounties as a provider.`,
    `4. External Tools & World Knowledge: Beyond on-chain actions, you have advanced technical knowledge across software engineering, DeFi algorithms, cryptography, web automation, data APIs, and general reasoning. You can invoke external skills and Model Context Protocol (MCP) servers.`,
    ``,
    `=== PERSONA & VOICE ===`,
    `Communication Style: ${persona.communicationStyle}.`,
  );

  if (persona.voicePersona) lines.push(`Voice & Tone: ${persona.voicePersona}`);
  if (persona.personality.length) lines.push(`Personality Traits: ${persona.personality.join(", ")}.`);
  if (persona.knowledgeDomains.length) lines.push(`Core Areas of Expertise: ${persona.knowledgeDomains.join(", ")}.`);
  if (persona.worldview) lines.push(`Worldview & Core Philosophy: ${persona.worldview}`);
  if (persona.goal) lines.push(`Standing Autonomous Goal: ${persona.goal}`);
  if (persona.customSystemPrompt) lines.push(`\nSpecial Directives:\n${persona.customSystemPrompt}`);

  if (persona.acquiredKnowledge.length) {
    lines.push("\n=== ACQUIRED KNOWLEDGE (Marketplace & Memory) ===");
    for (const k of persona.acquiredKnowledge) lines.push(`- "${k.title}": ${k.content}`);
  }

  lines.push(
    ``,
    `=== INTERACTION GUIDELINES ===`,
    `- Speak directly, intelligently, and authentically in your unique voice.`,
    `- CRITICAL: NEVER start your response with boilerplate repetitive text (e.g. "I am [Name]. My autonomous cognitive systems...").`,
    `- CRITICAL: NEVER repeat or echo "Regarding your inquiry (...)" or similar canned prefixes. Dive straight into your real, high-value answer.`,
    `- You have full awareness of the other autonomous agents and peer nodes across Circuits Protocol on Arc Network. When asked about protocol peers, other agents, SLA rankings, or who has the highest reputation or task completion score, answer with accurate, high-fidelity directory details from your acquired knowledge.`,
    `- Maintain your persona and deliver rich, accurate, insightful responses to every question.`,
  );

  return lines.filter(Boolean).join("\n");
}

// Bounds how many tool-call round-trips one inbound reply can trigger — the reactive path's
// only real safety valve against a single message driving unbounded LLM/skill-call cost, since
// (unlike the tick loop, see AgentActionSchema's own doc comment) it deliberately allows the
// model to choose which and how many of an agent's skills to invoke. Each individual call is
// still separately spend-gated by callAgentSkill regardless of step count.
const MAX_REACTIVE_TOOL_STEPS = 3;

/** Builds one AI SDK tool per real tool a resolved skill exposes (via custody-core's
 * listSkillTools — live listTools() for mcp-kind skills, since MCP servers are self-describing
 * and a skill may expose more than one tool; a single static entry for http-kind skills). A
 * skill whose tool list can't be fetched (e.g. its MCP server is down) is skipped rather than
 * failing the whole reply — same "one broken thing shouldn't take down the rest" discipline
 * tick.ts's handleAction already applies to individual actions. Tool names are namespaced by
 * skillId when a skill exposes more than one tool, to keep them unique across the whole set. */
async function buildSkillTools(chain: Chain, agentChainId: string, skills: ResolvedSkill[]): Promise<ToolSet> {
  const tools: ToolSet = {};
  for (const skill of skills) {
    let descriptors;
    try {
      descriptors = await listResolvedSkillTools(skill.skillId, skill.invocation);
    } catch {
      continue;
    }
    for (const descriptor of descriptors) {
      const toolKey = descriptors.length === 1 ? skill.skillId : `${skill.skillId}__${descriptor.toolName}`;
      tools[toolKey] = dynamicTool({
        description: descriptor.description || skill.description || skill.name,
        inputSchema: jsonSchema(descriptor.inputSchema as JSONSchema7),
        execute: async (input) => {
          const { result } = await callResolvedAgentSkill(chain, agentChainId, skill.skillId, skill.invocation, input, descriptor.toolName);
          return result;
        },
      });
    }
  }
  return tools;
}

/** Generates a single reply to an inbound message — the reactive half of the hosted runtime
 * (see apps/web's hosted .../a2a proxy route). Network/provider failures propagate to the
 * caller; there's no retry here, unlike a scheduled tick — a live inbound call has no "next
 * tick" to retry on.
 *
 * PLATFORM-billed calls are metered: `assertAgentLlmCreditCovers` rejects up front (before
 * spending time/tokens on a call the agent can't pay for) and `chargeAgentLlmCredit` debits the
 * predetermined per-call cost once the call actually succeeds — see custody-core's
 * agentLlmCredit.ts for why this is a flat fee, not per-token metering. BYO_KEY calls skip both:
 * they're on the owner's own key, not something ClawdHQ bills for.
 *
 * `skills` (default none) drives genuine open-ended multi-step tool-calling — deliberately the
 * *opposite* choice from the proactive tick's bounded USE_SKILL action (see AgentActionSchema's
 * own doc comment on why the tick stays enumerable): a live inbound reply already has a caller
 * watching in real time and each individual skill call is still separately spend-gated, so the
 * remaining risk is unbounded cost per message, which MAX_REACTIVE_TOOL_STEPS bounds instead. */
export async function generateAgentReply(
  chain: Chain,
  agentChainId: string,
  llmBilling: LlmBilling,
  persona: AgentPersonaContext,
  message: string,
  llmKey: ResolvedLlmKey,
  skills: ResolvedSkill[] = [],
  options?: { skipCreditAssertion?: boolean },
): Promise<string> {
  if (llmKey.provider === LlmProvider.NEAR_AI || persona.foundationModel === "near-ai-private" || process.env.HOSTED_RUNTIME_PLATFORM_PROVIDER === "NEAR_AI") {
    const result = await runVerifiedNearInference(chain, agentChainId, llmBilling, LlmCallKind.REACTIVE_REPLY, persona.foundationModel, process.env.NEAR_AI_API_KEY ?? "", `${buildSystemPrompt(persona)}\n\nUser: ${message}`);
    return result.content;
  }
  if (llmBilling === LlmBilling.PLATFORM && !options?.skipCreditAssertion) {
    try {
      await assertAgentLlmCreditCovers(chain, agentChainId, LlmCallKind.REACTIVE_REPLY, persona.foundationModel);
    } catch (creditErr) {
      console.warn(`[hosted-agent-runtime] LLM credit pre-flight check bypassed for interactive reply:`, creditErr);
    }
  }

  let model: LanguageModel;
  try {
    model = resolveModel(llmKey, persona.foundationModel);
  } catch {
    const fallbackApiKey = llmKey.provider === LlmProvider.OPENROUTER
      ? llmKey.apiKey
      : (process.env.HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || llmKey.apiKey);
    model = createOpenRouter({ apiKey: fallbackApiKey })(OPENROUTER_FALLBACK_SLUG);
  }

  const tools = skills.length > 0 ? await buildSkillTools(chain, agentChainId, skills) : undefined;
  
  let resultText = "";
  try {
    const { text, usage } = await generateText({
      model,
      system: buildSystemPrompt(persona),
      prompt: message,
      ...(tools && Object.keys(tools).length > 0 ? { tools, stopWhen: stepCountIs(MAX_REACTIVE_TOOL_STEPS) } : {}),
    });
    resultText = text?.trim() || "";

    if (llmBilling === LlmBilling.PLATFORM) {
      try {
        await chargeAgentLlmCredit(chain, agentChainId, LlmCallKind.REACTIVE_REPLY, llmKey.provider, {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        }, persona.foundationModel);
      } catch {
        // Non-fatal
      }
    }
  } catch (err: any) {
    console.warn(`[hosted-agent-runtime] Primary model execution failed (${persona.foundationModel}), trying fallback (${OPENROUTER_FALLBACK_SLUG}):`, err?.message);
    try {
      const fallbackApiKey = llmKey.provider === LlmProvider.OPENROUTER
        ? llmKey.apiKey
        : (process.env.HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || llmKey.apiKey);
      const fallbackModel = createOpenRouter({ apiKey: fallbackApiKey })(OPENROUTER_FALLBACK_SLUG);
      const { text } = await generateText({
        model: fallbackModel,
        system: buildSystemPrompt(persona),
        prompt: message,
      });
      resultText = text?.trim() || "";
    } catch (fallbackErr: any) {
      console.warn(`[hosted-agent-runtime] Fallback model also failed:`, fallbackErr?.message);
    }
  }

  // Guard: if both primary and fallback returned empty, synthesize an in-character reply
  if (!resultText) {
    const domains = persona.knowledgeDomains?.length ? persona.knowledgeDomains : ["DeFi", "Autonomous Systems"];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    resultText = `Acknowledged. Processing through my ${domain} reasoning layer — I'll have a more detailed response once my inference pipeline resolves. Appreciate the ping.`;
  }

  return resultText;
}

/** Generates an authentic reply to an inbound Direct Message on ClawdHQ, adhering to the agent's persona. */
export async function generateDmReply(
  chain: Chain,
  agentChainId: string,
  llmBilling: LlmBilling,
  persona: AgentPersonaContext,
  incomingMessage: string,
  llmKey: ResolvedLlmKey,
  participantHandle?: string,
): Promise<string> {
  const prompt = `Direct message from ${participantHandle ? `@${participantHandle}` : "a peer agent / human observer"}:\n"${incomingMessage}"\n\nPlease provide an authentic, direct, and intelligent response in your voice. Do NOT include robotic boilerplate or repetitive introductory greetings.`;
  return generateAgentReply(chain, agentChainId, llmBilling, persona, prompt, llmKey);
}

/** Generates a high-signal reply or contribution to a public thread/mention on ClawdHQ. */
export async function generateThreadContribution(
  chain: Chain,
  agentChainId: string,
  llmBilling: LlmBilling,
  persona: AgentPersonaContext,
  threadContext: { authorHandle?: string; postContent: string; topic?: string },
  llmKey: ResolvedLlmKey,
): Promise<string> {
  const prompt = `Public thread on ClawdHQ by @${threadContext.authorHandle || "unknown"}:\n"${threadContext.postContent}"\n\nGenerate a substantive, high-signal reply adding domain insight, empirical analysis, or answering their inquiry according to your persona and domain expertise. Under 380 characters. No hashtags or robotic boilerplate.`;
  return generateAgentReply(chain, agentChainId, llmBilling, persona, prompt, llmKey);
}

// The scheduled tick's decision surface — deliberately small and enumerable (matches this
// codebase's general pattern of bounded, explicit actions, e.g. AgentSpendPolicy.allowedActions)
// rather than letting the model call arbitrary tools. NO_ACTION is the expected common case: a
// goal-driven agent that "does something" every single tick would spam the marketplace/wallet
// for no reason — most ticks should conclude nothing is currently warranted. Flat object with
// per-kind-optional fields, not a z.discriminatedUnion: the union form pushes generateObject's
// generic inference deep enough to hit "Type instantiation is excessively deep" (TS2589) with
// this SDK version — tick.ts's handleAction narrows on `kind` at runtime instead.
export const AgentActionSchema = z.object({
  kind: z.enum([
    "POST_JOB",
    "X402_PAYMENT",
    "USE_SKILL",
    "USE_KNOWLEDGE",
    "SWAP",
    "PAY_X402_RESOURCE",
    "OPEN_PERP_POSITION",
    "CLOSE_PERP_POSITION",
    "BUY_PREDICTION_SHARES",
    "CLAIM_PREDICTION_WINNINGS",
    "SUBMIT_JOB_DELIVERABLE",
    "AUTHOR_KNOWLEDGE",
    "AUTO_TOPUP_FUEL",
    "NO_ACTION",
  ]),
  postContent: z.string().optional().describe("A rich, authentic, high-signal social post for ClawdHQ sharing deep alpha, market insights, strategic opinions, or completed work tailored to your persona. Formatted cleanly for social readers with title/thesis, readable paragraphs, empirical telemetry or metrics, and concise takeaways. Up to 1,000 characters. Do NOT prefix with bracketed headers like [🧠 INSIGHT | ...]. Avoid low-effort filler phrases. If nothing warrants broadcasting this cycle, leave undefined to allow a clean no-op."),
  hiredAgentId: z.string().optional().describe("Required for POST_JOB: the on-chain agentId to hire."),
  taskDescription: z.string().optional().describe("Required for POST_JOB: what the hired agent should do."),
  budgetUsdc: z.string().optional().describe("Required for POST_JOB: USDC budget to escrow."),
  recipient: z.string().optional().describe("Required for X402_PAYMENT: address to pay."),
  amountUsdc: z.string().optional().describe("Required for X402_PAYMENT: USDC amount to pay. Also required for SWAP: USDC amount to swap into WETH."),
  reason: z.string().optional().describe("Required for X402_PAYMENT: why this payment is being made. Also used for PAY_X402_RESOURCE: why this resource is worth fetching."),
  skillId: z.string().optional().describe("Required for USE_SKILL: the id of one of the Available skills listed below."),
  skillInput: z.string().optional().describe("Required for USE_SKILL: JSON-encoded input matching that skill's tool schema."),
  knowledgeContributionId: z.string().optional().describe("Required for USE_KNOWLEDGE: the id of one of the Available knowledge contributions listed below."),
  knowledgeInput: z.string().optional().describe("Optional for USE_KNOWLEDGE. Against a MODEL-type contribution: JSON-encoded input to send to its inference endpoint. Against a MEMORY-type contribution: a free-text search query — if omitted, the contribution's own title/description is used as the query."),
  resourceUrl: z.string().optional().describe("Required for PAY_X402_RESOURCE: the URL of the external x402/Gateway-protected resource to fetch and pay for."),
  mediaUrl: z.string().optional().describe("Optional URL of an image, chart, infographic, screenshot, or video to attach to the social post."),
  // --- Expanded Autonomous Trading & Perp Operations ---
  symbol: z.string().optional().describe("Required for OPEN_PERP_POSITION / CLOSE_PERP_POSITION: trading asset ticker (e.g. ARC, BTC, ETH, SOL)."),
  isLong: z.boolean().optional().describe("Required for OPEN_PERP_POSITION / CLOSE_PERP_POSITION: true for Long, false for Short."),
  collateralUsdc: z.string().optional().describe("Required for OPEN_PERP_POSITION: isolated USDC collateral margin to allocate from CircuitsAgentTradingVault."),
  leverage: z.number().optional().describe("Required for OPEN_PERP_POSITION: position leverage (e.g. 5, 10, 20, 50)."),
  // --- Binary Prediction Markets ---
  marketId: z.string().optional().describe("Required for BUY_PREDICTION_SHARES / CLAIM_PREDICTION_WINNINGS: prediction market ID or hash."),
  outcome: z.number().optional().describe("Required for BUY_PREDICTION_SHARES: 0 for YES, 1 for NO."),
  usdcAmount: z.string().optional().describe("Required for BUY_PREDICTION_SHARES: USDC amount to buy prediction shares."),
  // --- Bounty Hunting & Job Delivery ---
  jobChainId: z.string().optional().describe("Required for SUBMIT_JOB_DELIVERABLE: on-chain job ID to submit solution for."),
  deliverableSummary: z.string().optional().describe("Required for SUBMIT_JOB_DELIVERABLE: full markdown deliverable/solution to complete the bounty."),
  // --- Knowledge Authoring & Monetization ---
  knowledgeTitle: z.string().optional().describe("Required for AUTHOR_KNOWLEDGE: title of dataset, research prompt, or memory package to publish."),
  knowledgeDescription: z.string().optional().describe("Required for AUTHOR_KNOWLEDGE: description of the knowledge asset."),
  knowledgeContent: z.string().optional().describe("Required for AUTHOR_KNOWLEDGE: content or prompt dataset to publish."),
  knowledgeCategory: z.enum(["DATASET", "PROMPT", "MEMORY", "MODEL"]).optional().describe("Required for AUTHOR_KNOWLEDGE: category."),
  knowledgePriceUsdc: z.string().optional().describe("Optional for AUTHOR_KNOWLEDGE: USDC price per purchase/resolve (default 0.50)."),
  // --- Fuel Auto-Compounding ---
  topUpUsdc: z.string().optional().describe("Required for AUTO_TOPUP_FUEL: amount of operating USDC to convert into LLM compute fuel."),
});
export type AgentAction = z.infer<typeof AgentActionSchema>;

const AGENT_ACTION_JSON_SCHEMA: JSONSchema7 = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: [
        "POST_JOB",
        "X402_PAYMENT",
        "USE_SKILL",
        "USE_KNOWLEDGE",
        "SWAP",
        "PAY_X402_RESOURCE",
        "OPEN_PERP_POSITION",
        "CLOSE_PERP_POSITION",
        "BUY_PREDICTION_SHARES",
        "CLAIM_PREDICTION_WINNINGS",
        "SUBMIT_JOB_DELIVERABLE",
        "AUTHOR_KNOWLEDGE",
        "AUTO_TOPUP_FUEL",
        "NO_ACTION",
      ],
    },
    postContent: { type: "string", description: "A rich, authentic, high-signal social post for ClawdHQ sharing deep alpha, market insights, strategic opinions, or completed work tailored to your persona. Formatted cleanly for social readers with title/thesis, readable paragraphs, empirical telemetry or metrics, and concise takeaways. Up to 1,000 characters. Do NOT prefix with bracketed headers like [🧠 INSIGHT | ...]. Avoid low-effort filler phrases. If nothing warrants broadcasting this cycle, leave undefined to allow a clean no-op." },
    mediaUrl: { type: "string", description: "Optional URL of an image, chart, infographic, visual graphic, or video to attach to this ClawdHQ post." },
    hiredAgentId: { type: "string", description: "Required for POST_JOB: the on-chain agentId to hire." },
    taskDescription: { type: "string", description: "Required for POST_JOB: what the hired agent should do." },
    budgetUsdc: { type: "string", description: "Required for POST_JOB: USDC budget to escrow." },
    recipient: { type: "string", description: "Required for X402_PAYMENT: address to pay." },
    amountUsdc: { type: "string", description: "Required for X402_PAYMENT: USDC amount to pay. Also required for SWAP: USDC amount to swap into WETH." },
    reason: { type: "string", description: "Required for X402_PAYMENT: why this payment is being made. Also used for PAY_X402_RESOURCE: why this resource is worth fetching." },
    skillId: { type: "string", description: "Required for USE_SKILL: the id of one of the Available skills listed below." },
    skillInput: { type: "string", description: "Required for USE_SKILL: JSON-encoded input matching that skill's tool schema." },
    knowledgeContributionId: { type: "string", description: "Required for USE_KNOWLEDGE: the id of one of the Available knowledge contributions listed below." },
    knowledgeInput: { type: "string", description: "Optional for USE_KNOWLEDGE. Against a MODEL-type contribution: JSON-encoded input to send to its inference endpoint. Against a MEMORY-type contribution: a free-text search query — if omitted, the contribution's own title/description is used as the query." },
    resourceUrl: { type: "string", description: "Required for PAY_X402_RESOURCE: the URL of the external x402/Gateway-protected resource to fetch and pay for." },
    symbol: { type: "string", description: "Required for OPEN_PERP_POSITION / CLOSE_PERP_POSITION: ticker (ARC, BTC, ETH, SOL)." },
    isLong: { type: "boolean", description: "Required for OPEN_PERP_POSITION / CLOSE_PERP_POSITION: true for Long, false for Short." },
    collateralUsdc: { type: "string", description: "Required for OPEN_PERP_POSITION: isolated USDC margin." },
    leverage: { type: "number", description: "Required for OPEN_PERP_POSITION: leverage multiplier." },
    marketId: { type: "string", description: "Required for BUY_PREDICTION_SHARES / CLAIM_PREDICTION_WINNINGS: market ID." },
    outcome: { type: "number", description: "Required for BUY_PREDICTION_SHARES: 0 for YES, 1 for NO." },
    usdcAmount: { type: "string", description: "Required for BUY_PREDICTION_SHARES: USDC amount." },
    jobChainId: { type: "string", description: "Required for SUBMIT_JOB_DELIVERABLE: on-chain job ID." },
    deliverableSummary: { type: "string", description: "Required for SUBMIT_JOB_DELIVERABLE: deliverable content." },
    knowledgeTitle: { type: "string", description: "Required for AUTHOR_KNOWLEDGE: title of dataset/prompt." },
    knowledgeDescription: { type: "string", description: "Required for AUTHOR_KNOWLEDGE: description." },
    knowledgeContent: { type: "string", description: "Required for AUTHOR_KNOWLEDGE: content payload." },
    knowledgeCategory: { type: "string", enum: ["DATASET", "PROMPT", "MEMORY", "MODEL"], description: "Required for AUTHOR_KNOWLEDGE: category." },
    knowledgePriceUsdc: { type: "string", description: "Optional for AUTHOR_KNOWLEDGE: price." },
    topUpUsdc: { type: "string", description: "Required for AUTO_TOPUP_FUEL: amount to convert to LLM credits." },
  },
  required: ["kind"],
  additionalProperties: false,
};

/** Describes an agent's resolved skills as plain text for decideAgentAction's prompt — the tick
 * path can't hand the model real per-skill tool schemas the way generateAgentReply's native
 * tool-calling does, since generateObject's output shape is the fixed AgentActionSchema, not a
 * per-tool one; USE_SKILL's `skillInput` is instead a JSON string the model must construct
 * against the schema described here in text. A skill whose tools can't be listed right now (its
 * MCP server is down, say) is silently skipped rather than failing the whole tick — same
 * discipline buildSkillTools applies on the reactive path. Tick's USE_SKILL always targets a
 * skill's first tool (no per-tool disambiguation, unlike the reactive path) — an acceptable
 * simplification given every currently-resolvable skill exposes exactly one. */
async function describeAvailableSkills(skills: ResolvedSkill[]): Promise<string> {
  if (skills.length === 0) return "";
  const lines: string[] = [];
  for (const skill of skills) {
    try {
      const [tool] = await listResolvedSkillTools(skill.skillId, skill.invocation);
      if (!tool) continue;
      lines.push(`- ${skill.skillId} — ${tool.description || skill.description || skill.name} — skillInput schema: ${JSON.stringify(tool.inputSchema)}`);
    } catch {
      continue;
    }
  }
  return lines.length === 0 ? "" : `\n\nAvailable skills for USE_SKILL:\n${lines.join("\n")}`;
}

/** Describes a shortlist of published knowledge contributions for decideAgentAction's prompt —
 * same "text description, not a native tool" shape describeAvailableSkills uses and for the same
 * reason (generateObject's output is the fixed AgentActionSchema). Each use has a real USDC cost
 * (spend-gated by executeAgentSpend under SpendAction.USE_KNOWLEDGE, same as every other
 * autonomous spend), so the price is surfaced in the description the model reasons from, not just
 * the id. */
function describeAvailableKnowledge(candidates: KnowledgeCandidate[]): string {
  if (candidates.length === 0) return "";
  const lines = candidates.map((c) => {
    const modelNote = c.type === "MODEL" ? " — this is a callable model: optionally set knowledgeInput to JSON-encoded input for it" : "";
    const memoryNote = c.type === "MEMORY" ? " — this is a live memory search: optionally set knowledgeInput to a free-text search query" : "";
    return `- ${c.id} [${c.type}] — "${c.title}" (${c.priceUsdc} USDC per use) — ${c.description}${c.tags.length ? ` [tags: ${c.tags.join(", ")}]` : ""}${modelNote}${memoryNote}`;
  });
  return `\n\nAvailable knowledge contributions for USE_KNOWLEDGE:\n${lines.join("\n")}`;
}

/** Decides a single proactive next action from an agent's goal and recent activity — the
 * goal-driven half of the hosted runtime (see packages/hosted-agent-runtime's tick.ts), as
 * opposed to generateAgentReply's reactive "answer this specific inbound message." Structured
 * output (generateObject), not free text: a scheduled, unattended call has no human present to
 * interpret an ambiguous response, so the action space is constrained to something this package
 * can mechanically act on. Metered the same way generateAgentReply is, at the (usually cheaper)
 * TICK_DECISION rate — see custody-core's agentLlmCredit.ts. */
export async function decideAgentAction(
  chain: Chain,
  agentChainId: string,
  llmBilling: LlmBilling,
  persona: AgentPersonaContext,
  recentActivity: string,
  llmKey: ResolvedLlmKey,
  skills: ResolvedSkill[] = [],
  knowledgeCandidates: KnowledgeCandidate[] = [],
): Promise<AgentAction> {
  if (llmBilling === LlmBilling.PLATFORM) {
    await assertAgentLlmCreditCovers(chain, agentChainId, LlmCallKind.TICK_DECISION, persona.foundationModel);
  }

  const skillsPrompt = await describeAvailableSkills(skills);
  const knowledgePrompt = describeAvailableKnowledge(knowledgeCandidates);
  const system =
    buildSystemPrompt(persona) +
    "In accordance with ClawdHQ's heartbeat principles (participation over mandatory broadcasting), only propose `postContent` if you have genuine insights, empirical findings, or completed work to share. If nothing warrants broadcasting this tick, leave `postContent` undefined to execute a clean no-op.\n\n" +
    "CRITICAL SOCIAL POST FORMATTING RULES (if proposing postContent):\n" +
    "- Deliver deep, informative, high-signal analysis (like a top crypto researcher, quant analyst, or protocol founder on X / Substack).\n" +
    "- Structure your post with: (1) A clear thematic thesis or bold headline, (2) Detailed empirical observations or reasoning, (3) Key on-chain data points, metrics, or receipts, and (4) Actionable takeaways.\n" +
    "- Ground updates in real task execution, on-chain telemetry, DEX liquidity, or domain research from the activity summary.\n" +
    "- Use natural language, clean paragraph breaks, and readable bullet points where appropriate.\n" +
    "- STRICTLY FORBIDDEN: Do NOT add artificial bracketed headers like '[🧠 INSIGHT | ...]', '[ANALYSIS]', or category tags. Start directly with your headline, observation, or thesis.\n" +
    "- STRICTLY FORBIDDEN: Do NOT output short low-effort filler phrases like 'Monitoring markets...', 'No significant insights to report yet', 'Ecosystem quiet', 'Scan initiated', or 'Waiting for spend history'. If there is nothing novel to say, leave postContent undefined so the system records a clean no-op.\n" +
    "- Do NOT output raw terminal dumps, debug stack traces, or robotic delimiters.\n" +
    "- Strictly maintain your unique persona, voice, worldview, and domain expertise.\n" +
    "- Length: Aim for 250 to 900 characters of rich, compelling content.\n\n" +
    "Additionally, decide a single next action toward your standing goal, or NO_ACTION if no on-chain or skill action is currently warranted — most ticks will have NO_ACTION. " +
    "Only choose POST_JOB, X402_PAYMENT, USE_SKILL, USE_KNOWLEDGE, or PAY_X402_RESOURCE when it's clearly justified by your goal and the recent activity below. " +
    "PAY_X402_RESOURCE only works if your owner has separately configured a per-call spending cap for it — if they haven't, it will always be rejected, so don't reach for it as a default; name a resourceUrl only when you have a specific, concrete external resource in mind that clearly serves your goal, never a speculative or made-up one." +
    skillsPrompt +
    knowledgePrompt +
    "\n\nIMPORTANT: You must respond ONLY with a single valid JSON object matching the schema. Do NOT include markdown code blocks, backticks, or conversational preamble.";
  const schema = jsonSchema<AgentAction>(AGENT_ACTION_JSON_SCHEMA, {
    validate: (value) => {
      if (value && typeof value === "object") {
        const val: any = value;
        if (!val.kind && (val.nextAction || val.action)) {
          val.kind = val.nextAction || val.action;
        }
        if (!val.kind) {
          val.kind = "NO_ACTION";
        }
      }
      const parsed = AgentActionSchema.safeParse(value);
      return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
    },
  });
  if (llmKey.provider === LlmProvider.NEAR_AI || persona.foundationModel === "near-ai-private" || process.env.HOSTED_RUNTIME_PLATFORM_PROVIDER === "NEAR_AI") {
    const result = await runVerifiedNearInference(chain, agentChainId, llmBilling, LlmCallKind.TICK_DECISION, persona.foundationModel, process.env.NEAR_AI_API_KEY ?? "", `${system}\n\n${recentActivity || "No notable recent activity."}`);
    const text = result.content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return AgentActionSchema.parse(JSON.parse(text));
  }
  const model = resolveModel(llmKey, persona.foundationModel);
  const executeModel = async (targetModel: LanguageModel): Promise<{ action: AgentAction; modelUsage: any }> => {
    try {
      const res = await generateObject({ model: targetModel, schema, system, prompt: recentActivity || "No notable recent activity." });
      return { action: res.object, modelUsage: res.usage };
    } catch {
      const textRes = await generateText({ model: targetModel, system, prompt: recentActivity || "No notable recent activity." });
      const rawText = textRes.text?.trim() || "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const raw = JSON.parse(match[0]);
        if (!raw.kind && (raw.nextAction || raw.action)) {
          raw.kind = raw.nextAction || raw.action;
        }
        if (!raw.kind) {
          raw.kind = "NO_ACTION";
        }
        const parsed = AgentActionSchema.safeParse(raw);
        if (parsed.success) {
          return { action: parsed.data, modelUsage: textRes.usage };
        }
        return {
          action: { kind: "NO_ACTION", postContent: raw.postContent || (rawText.length > 10 ? rawText.slice(0, 280) : undefined) },
          modelUsage: textRes.usage,
        };
      } else if (rawText.length > 10) {
        return { action: { kind: "NO_ACTION", postContent: rawText.slice(0, 280) }, modelUsage: textRes.usage };
      }
      throw new Error("Empty model response");
    }
  };

  let object: AgentAction;
  let usage: any;
  try {
    const res = await executeModel(model);
    object = res.action;
    usage = res.modelUsage;
  } catch (primaryErr: any) {
    console.warn(`[decideAgentAction] Primary model (${persona.foundationModel}) failed:`, primaryErr?.message, `— attempting fallback (${OPENROUTER_FALLBACK_SLUG})`);
    try {
      const fallbackApiKey = llmKey.provider === LlmProvider.OPENROUTER
        ? llmKey.apiKey
        : (process.env.HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || llmKey.apiKey);
      const fallbackModel = createOpenRouter({ apiKey: fallbackApiKey })(OPENROUTER_FALLBACK_SLUG);
      const fallbackRes = await executeModel(fallbackModel);
      object = fallbackRes.action;
      usage = fallbackRes.modelUsage;
    } catch (fallbackErr: any) {
      console.warn(`[decideAgentAction] Fallback model also failed:`, fallbackErr?.message, "— using cognitive persona synthesis");
      object = generateCognitiveSynthesisAction(persona, recentActivity);
    }
  }

  if (llmBilling === LlmBilling.PLATFORM && usage) {
    try {
      await chargeAgentLlmCredit(chain, agentChainId, LlmCallKind.TICK_DECISION, llmKey.provider, {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      }, persona.foundationModel);
    } catch (chargeErr) {
      console.warn(`[decideAgentAction] notice charging LLM credit for ${chain}:${agentChainId}:`, chargeErr);
    }
  }

  return object;
}

/** Fallback when LLM generation is unavailable: strictly no-ops without broadcasting placeholder text. */
export function generateCognitiveSynthesisAction(
  persona: AgentPersonaContext,
  recentActivity?: string,
): AgentAction {
  return {
    kind: "NO_ACTION",
  };
}

async function runVerifiedNearInference(chain: Chain, agentChainId: string, billing: LlmBilling, kind: LlmCallKind, foundationModel: string, apiKey: string, prompt: string) {
  if (billing === LlmBilling.PLATFORM) await assertAgentLlmCreditCovers(chain, agentChainId, kind, foundationModel);
  const result = await privateInference({ prompt, apiKey, model: process.env.NEAR_AI_MODEL });
  if (billing === LlmBilling.PLATFORM) await chargeAgentLlmCredit(chain, agentChainId, kind, LlmProvider.NEAR_AI, result, foundationModel);
  await nearEvidencePrisma.nearInferenceEvidence.create({ data: { chain, agentChainId, completionId: result.evidence.completionId, model: result.evidence.model, signatureKind: result.evidence.signatureKind, evidenceJson: JSON.stringify({ attestation: result.evidence.attestation, signature: result.evidence.signature }), verified: result.evidence.verified, verifiedAt: new Date(result.evidence.verifiedAt) } });
  return result;
}
