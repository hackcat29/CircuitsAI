// The catalog itself lives in @clawdhq/custody-core's separate "llm-model-catalog" subpath
// export (llmModelCatalog.ts) — custody-core's agentLlmCredit.ts needs the same tier data
// server-side (to price a call by the selected model's tier), so it lives there once rather than
// duplicated per app, same reasoning as lib/skills.ts's identical precedent. A *separate*
// subpath, not the package's main barrel: this catalog is pure data, safe for a browser bundle
// (RegisterWizard.tsx / agents/[id]/page.tsx render it client-side), unlike custody-core's main
// export surface, which pulls in Node-only built-ins.
export {
  type FoundationModelTier,
  type FoundationModelCatalogEntry,
  type FoundationModelTierMeta,
  FOUNDATION_MODEL_TIERS,
  FOUNDATION_MODELS,
  tierForFoundationModel,
  tierMetaFor,
} from "@clawdhq/custody-core/llm-model-catalog";

// Indicative-only credit-cost hints shown during model selection, before any call happens —
// mirrors agentLlmCredit.ts's PLATFORM_LLM_COST_*_USDC env-var *defaults*. Duplicated here on
// purpose, same "can't share a runtime import across this boundary" convention already used for
// the Chain enum across this repo's Prisma schemas: the real charge is always computed
// server-side at call time regardless of what this hint says, so drift here is cosmetic, not a
// correctness bug. If an operator overrides those env vars, update this table to match.
import { FOUNDATION_MODELS, type FoundationModelTier as Tier } from "@clawdhq/custody-core/llm-model-catalog";
export const TIER_CREDIT_HINT: Record<Tier, { reactive: number; tick: number }> = {
  STANDARD: { reactive: 1, tick: 0.5 },
  PLUS: { reactive: 3, tick: 1.5 },
  PRO: { reactive: 10, tick: 5 },
};

// A "bring your own key" owner calls their chosen model's vendor directly (see
// packages/hosted-agent-runtime/src/llmClient.ts's BYO_KEY path) — only Anthropic/OpenAI/Google
// have a direct-call integration and a matching entry in custody-core's AgentLlmKey provider
// allow-list (the llm-key route's BYO_PROVIDERS). Every other vendor in FOUNDATION_MODELS (Meta,
// Alibaba, Mistral AI, DeepSeek, Zhipu AI, xAI) is only ever reachable through platform billing
// today, so BYOK isn't offered for those models — this is what callers use to decide that.
const VENDOR_TO_BYOK_PROVIDER: Record<string, "ANTHROPIC" | "OPENAI" | "GEMINI"> = {
  Anthropic: "ANTHROPIC",
  OpenAI: "OPENAI",
  Google: "GEMINI",
};

export function byokProviderForModel(foundationModelId: string): "ANTHROPIC" | "OPENAI" | "GEMINI" | null {
  const vendor = FOUNDATION_MODELS.find((m) => m.id === foundationModelId)?.vendor;
  return vendor ? (VENDOR_TO_BYOK_PROVIDER[vendor] ?? null) : null;
}
