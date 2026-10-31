import { Prisma, PipelineExecutionMode, PipelineStepRole, type Pipeline, type PipelineStep } from "@clawdhq/custody-db";
import { ApiError } from "@/lib/server/socialErrors";

// Orchestration only supports EVM chains — same restricted subset (and same "chain-family
// predicates live in @clawdhq/custody-core" reasoning) as subscriptions/validate.ts.
const ALL_ORCHESTRATION_CHAINS = new Set<string>(["BASE_SEPOLIA", "ETH_SEPOLIA"]);

export function parseOrchestrationChain(value: unknown): Pipeline["chain"] {
  if (typeof value !== "string" || !ALL_ORCHESTRATION_CHAINS.has(value)) {
    throw new ApiError(400, `Unknown chain "${String(value)}". Orchestration only supports EVM chains.`);
  }
  return value as Pipeline["chain"];
}

export function parseExecutionMode(value: unknown): Pipeline["executionMode"] {
  if (typeof value !== "string" || !(value in PipelineExecutionMode)) {
    throw new ApiError(400, `Unknown execution mode "${String(value)}"`);
  }
  return value as Pipeline["executionMode"];
}

export function parseStepRole(value: unknown): PipelineStep["role"] {
  if (typeof value !== "string" || !(value in PipelineStepRole)) {
    throw new ApiError(400, `Unknown step role "${String(value)}"`);
  }
  return value as PipelineStep["role"];
}

export function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${field} is required`);
  return value.trim();
}

export function parsePositiveDecimal(value: unknown, field: string): Prisma.Decimal {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError(400, `${field} must be a number or numeric string`);
  }
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new ApiError(400, `${field} is not a valid number`);
  }
  if (!decimal.isFinite() || decimal.isNegative() || decimal.isZero()) {
    throw new ApiError(400, `${field} must be a positive number`);
  }
  return decimal;
}

export function parsePositiveInt(value: unknown, field: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, `${field} must be a positive whole number`);
  }
  return n;
}

/** Empty/missing/"0" is never valid here, unlike Subscription's open-hire sentinel — a pipeline
 * step always names a specific agent to hire (there's no "any active agent may claim this"
 * concept for a chained workflow: the next step's predecessor-completion trigger has nothing
 * to key off of for an open job that any agent could claim). */
export function parseHiredAgentId(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed === "0") throw new ApiError(400, "agentId is required. Pick a specific agent for this step.");
  return trimmed;
}

export function serializePipelineStep(step: PipelineStep) {
  return {
    id: step.id,
    position: step.position,
    agentChainId: step.agentChainId,
    agentName: step.agentName,
    role: step.role,
    taskDescription: step.taskDescription,
    budgetUsdc: step.budgetUsdc.toString(),
    deadlineDays: step.deadlineDays,
    status: step.status,
    jobChainId: step.jobChainId,
    txHashOrRef: step.txHashOrRef,
    error: step.error,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  };
}

export function serializePipeline(pipeline: Pipeline & { steps: PipelineStep[] }) {
  return {
    id: pipeline.id,
    chain: pipeline.chain,
    ownerAddress: pipeline.ownerAddress,
    name: pipeline.name,
    description: pipeline.description,
    executionMode: pipeline.executionMode,
    status: pipeline.status,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString(),
    steps: pipeline.steps.map(serializePipelineStep),
  };
}
