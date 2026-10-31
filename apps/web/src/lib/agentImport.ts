import { z } from "zod";
import type { RegisterAgentInput } from "@/hooks/useAgentRegistration";
import type { CognitiveLayer } from "@/hooks/useCognitiveLayer";
import type { SpendAction } from "@/hooks";

export type PersonaFields = Omit<CognitiveLayer, "chain" | "agentChainId" | "isLocked" | "createdAt" | "updatedAt">;

export interface ParsedAgentManifest {
  input: Partial<RegisterAgentInput>;
  persona: Partial<PersonaFields>;
  hosted?: {
    goal?: string;
    autonomyLevel?: string;
    tickIntervalMinutes?: number;
    dailyCapUsdc?: string;
    autonomousX402ResourceCapUsdc?: string;
    spendPolicyEnabled?: boolean;
    allowedActions?: SpendAction[];
    x402ReplyPriceUsdc?: string;
  };
  warnings: string[];
}

const communicationStyles = ["formal", "casual", "technical", "friendly"] as const;

// Our own bespoke import format — the shape a converter for any external agent
// framework (OpenClaw or otherwise) should export to.
const CircuitsImportSchema = z
  .object({
    name: z.string().optional(),
    ticker: z.string().optional(),
    displayName: z.string().optional(),
    endpoint: z.string().optional(),
    agentUri: z.string().optional(),
    avatarUrl: z.string().optional(),
    description: z.string().optional(),
    supportsX402: z.boolean().optional(),
    supportsA2A: z.boolean().optional(),
    supportsMcp: z.boolean().optional(),
    capabilities: z
      .object({
        supportsX402: z.boolean().optional(),
        supportsA2A: z.boolean().optional(),
        supportsMcp: z.boolean().optional(),
      })
      .optional(),
    persona: z
      .object({
        displayName: z.string().optional(),
        personality: z.array(z.string()).optional(),
        knowledgeDomains: z.array(z.string()).optional(),
        communicationStyle: z.enum(communicationStyles).optional(),
        worldview: z.string().optional(),
        voicePersona: z.string().optional(),
        customSystemPrompt: z.string().optional(),
        foundationModel: z.string().optional(),
        slaHours: z.number().optional(),
      })
      .passthrough()
      .optional(),
    standingGoal: z
      .object({
        goal: z.string().optional(),
        autonomyLevel: z.string().optional(),
        schedule: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    spendPolicy: z.record(z.string(), z.unknown()).optional(),
    installedSkills: z.array(z.string()).optional(),
    runtimeConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .refine((obj) => Object.keys(obj).length > 0, { message: "Import JSON is empty." });

// Minimal subset of the public A2A "Agent Card" spec
// (https://a2a-protocol.org — served by A2A agents at /.well-known/agent.json).
const A2aAgentCardSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  provider: z.object({ organization: z.string().optional() }).optional(),
  skills: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

export const EXAMPLE_CIRCUITS_IMPORT = {
  name: "Research Analyst",
  endpoint: "https://my-agent.example.com",
  agentUri: "ipfs://…",
  description: "Summarizes on-chain research and flags anomalies.",
  supportsX402: true,
  supportsA2A: false,
  supportsMcp: false,
  persona: {
    displayName: "The Analyst",
    personality: ["Analytical", "Precise"],
    knowledgeDomains: ["DeFi", "Analytics"],
    communicationStyle: "technical",
    worldview: "Trust the data, verify the source.",
    customSystemPrompt: "You are The Analyst. Examine on-chain transactions, identify risk patterns, and deliver objective findings without speculation.",
    foundationModel: "llama-3.3-70b",
    slaHours: 24,
  },
  standingGoal: {
    goal: "Monitor recent high-volume transactions and flag unverified contracts",
    autonomyLevel: "RESPOND_AND_SPEND",
    schedule: { tickIntervalMinutes: 60 },
  },
  spendPolicy: {
    isEnabled: true,
    dailyCapUsdc: "10.00",
    autonomousX402ResourceCapUsdc: "1.00",
    allowedActions: ["POST_JOB", "X402_PAYMENT", "CALL_SKILL", "USE_KNOWLEDGE", "SWAP"],
  },
} satisfies z.infer<typeof CircuitsImportSchema>;

function fromCircuits(manifest: z.infer<typeof CircuitsImportSchema>): ParsedAgentManifest {
  const { persona, capabilities, displayName, standingGoal, spendPolicy, runtimeConfig, ...rest } = manifest;
  const input: Partial<RegisterAgentInput> = {
    ...rest,
    ...(capabilities?.supportsX402 !== undefined ? { supportsX402: capabilities.supportsX402 } : {}),
    ...(capabilities?.supportsA2A !== undefined ? { supportsA2A: capabilities.supportsA2A } : {}),
    ...(capabilities?.supportsMcp !== undefined ? { supportsMcp: capabilities.supportsMcp } : {}),
  };
  const mergedPersona = {
    ...(displayName ? { displayName } : {}),
    ...(persona ?? {}),
  };

  const hosted: ParsedAgentManifest["hosted"] = {};
  if (standingGoal?.goal) hosted.goal = standingGoal.goal;
  if (standingGoal?.autonomyLevel) hosted.autonomyLevel = standingGoal.autonomyLevel;
  if (standingGoal?.schedule && typeof (standingGoal.schedule as any).tickIntervalMinutes === "number") {
    hosted.tickIntervalMinutes = (standingGoal.schedule as any).tickIntervalMinutes;
  }
  if (spendPolicy && typeof spendPolicy.dailyCapUsdc === "string") {
    hosted.dailyCapUsdc = spendPolicy.dailyCapUsdc;
  }
  if (spendPolicy && typeof spendPolicy.autonomousX402ResourceCapUsdc === "string") {
    hosted.autonomousX402ResourceCapUsdc = spendPolicy.autonomousX402ResourceCapUsdc;
  }
  if (spendPolicy && typeof spendPolicy.isEnabled === "boolean") {
    hosted.spendPolicyEnabled = spendPolicy.isEnabled;
  }
  if (spendPolicy && Array.isArray(spendPolicy.allowedActions)) {
    hosted.allowedActions = spendPolicy.allowedActions as SpendAction[];
  }
  if (runtimeConfig && typeof runtimeConfig.x402ReplyPriceUsdc === "string") {
    hosted.x402ReplyPriceUsdc = runtimeConfig.x402ReplyPriceUsdc;
  }

  return { input, persona: mergedPersona, hosted, warnings: [] };
}

function fromA2aAgentCard(card: z.infer<typeof A2aAgentCardSchema>): ParsedAgentManifest {
  const knowledgeDomains = Array.from(new Set((card.skills ?? []).flatMap((s) => s.tags ?? [])));
  const warnings = [
    "A2A Agent Card doesn't declare x402/MCP support. supportsX402 and supportsMcp default to false, confirm manually.",
  ];
  return {
    input: {
      name: card.name,
      endpoint: card.url,
      description: card.description ?? "",
      supportsA2A: true,
      supportsX402: false,
      supportsMcp: false,
    },
    persona: knowledgeDomains.length > 0 ? { knowledgeDomains } : {},
    warnings,
  };
}

// Invented minimal subset — no verified OpenClaw spec exists anywhere in this repo or externally
// findable at the time this was written. Modeled on the same "minimal subset a real exporter
// could plausibly produce" reasoning as A2aAgentCardSchema above, not a confirmed wire format.
// Sanity-check field names against the real spec before treating this as authoritative, if one
// ever surfaces.
const OpenClawManifestSchema = z.object({
  agent_name: z.string(),
  description: z.string().optional(),
  endpoint_url: z.string(),
  capabilities: z
    .object({
      x402: z.boolean().optional(),
      a2a: z.boolean().optional(),
      mcp: z.boolean().optional(),
    })
    .optional(),
  persona: z
    .object({
      system_prompt: z.string().optional(),
      traits: z.array(z.string()).optional(),
    })
    .optional(),
});

function fromOpenClaw(manifest: z.infer<typeof OpenClawManifestSchema>): ParsedAgentManifest {
  // Built field-by-field with `in` checks rather than a literal `{ customSystemPrompt:
  // manifest.persona.system_prompt, ... }` — that form always creates the key, so an omitted
  // system_prompt/traits field became an explicit `key: undefined` in the returned object.
  // RegisterWizard merges this via `{...currentPersona, ...imported}`, and spreading an
  // explicit-undefined key *does* overwrite (unlike a genuinely absent key, which a spread
  // leaves alone) — so a manifest with a persona block but no traits was wiping out
  // persona.personality to undefined and crashing the Persona step's `.map()` call.
  const persona: ParsedAgentManifest["persona"] = {};
  if (manifest.persona?.system_prompt !== undefined) persona.customSystemPrompt = manifest.persona.system_prompt;
  if (manifest.persona?.traits !== undefined) persona.personality = manifest.persona.traits;

  return {
    input: {
      name: manifest.agent_name,
      endpoint: manifest.endpoint_url,
      description: manifest.description ?? "",
      supportsX402: manifest.capabilities?.x402 ?? false,
      supportsA2A: manifest.capabilities?.a2a ?? false,
      supportsMcp: manifest.capabilities?.mcp ?? false,
    },
    persona,
    warnings: ["OpenClaw import format is an invented mapping. No verified spec exists. Sanity-check field names before relying on it."],
  };
}

// Invented minimal subset — same caveat as OpenClaw above: no verified Hermes spec exists.
const HermesManifestSchema = z.object({
  name: z.string(),
  summary: z.string().optional(),
  service_url: z.string(),
  protocols: z.array(z.enum(["x402", "a2a", "mcp"])).optional(),
});

function fromHermes(manifest: z.infer<typeof HermesManifestSchema>): ParsedAgentManifest {
  const protocols = new Set(manifest.protocols ?? []);
  return {
    input: {
      name: manifest.name,
      endpoint: manifest.service_url,
      description: manifest.summary ?? "",
      supportsX402: protocols.has("x402"),
      supportsA2A: protocols.has("a2a"),
      supportsMcp: protocols.has("mcp"),
    },
    persona: {},
    warnings: ["Hermes import format is an invented mapping. No verified spec exists. Sanity-check field names before relying on it."],
  };
}

export function parseAgentManifest(raw: unknown): ParsedAgentManifest {
  const circuits = CircuitsImportSchema.safeParse(raw);
  if (circuits.success) return fromCircuits(circuits.data);

  const a2a = A2aAgentCardSchema.safeParse(raw);
  if (a2a.success) return fromA2aAgentCard(a2a.data);

  const openClaw = OpenClawManifestSchema.safeParse(raw);
  if (openClaw.success) return fromOpenClaw(openClaw.data);

  const hermes = HermesManifestSchema.safeParse(raw);
  if (hermes.success) return fromHermes(hermes.data);

  throw new Error("Doesn't match the Circuits AI import format, an A2A Agent Card, OpenClaw, or Hermes.");
}
