import { Prisma, SubscriptionFrequency, type Subscription } from "@clawdhq/custody-db";
import { ApiError } from "@/lib/server/socialErrors";

// Chain-family predicates (isEvmPrismaChain, etc.) live in @clawdhq/custody-core now — reused
// from there rather than duplicated here, since that package is the actual execution engine
// and needs to be the single source of truth for "which chains does this feature support."
const ALL_SUBSCRIPTION_CHAINS = new Set<string>(["BASE_SEPOLIA", "ETH_SEPOLIA"]);

export function parseSubscriptionChain(value: unknown): Subscription["chain"] {
  if (typeof value !== "string" || !ALL_SUBSCRIPTION_CHAINS.has(value)) {
    throw new ApiError(400, `Unknown chain "${String(value)}"`);
  }
  return value as Subscription["chain"];
}

export function parseFrequency(value: unknown): Subscription["frequency"] {
  if (typeof value !== "string" || !(value in SubscriptionFrequency)) {
    throw new ApiError(400, `Unknown frequency "${String(value)}"`);
  }
  return value as Subscription["frequency"];
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

export function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${field} is required`);
  return value.trim();
}

/** Empty/missing defaults to "0" — same open-hire sentinel ClawdHQCore.sol's postJob uses
 * (see its doc comment): the subscription posts an open job each run, and any active agent's
 * owner can claim it via acceptOpenJob, same as a one-off Task. */
export function parseAgentId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "0";
  return value.trim();
}

export function parsePositiveInt(value: unknown, field: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, `${field} must be a positive whole number`);
  }
  return n;
}

export function serializeSubscription(subscription: Subscription) {
  return {
    id: subscription.id,
    chain: subscription.chain,
    ownerAddress: subscription.ownerAddress,
    hiredAgentId: subscription.hiredAgentId,
    taskDescription: subscription.taskDescription,
    budgetUsdc: subscription.budgetUsdc.toString(),
    deadlineDays: subscription.deadlineDays,
    frequency: subscription.frequency,
    isActive: subscription.isActive,
    maxConcurrentOpenJobs: subscription.maxConcurrentOpenJobs,
    nextRunAt: subscription.nextRunAt.toISOString(),
    executionCount: subscription.executionCount,
    totalPaidUsdc: subscription.totalPaidUsdc.toString(),
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}
