import { Chain, Venue, Prisma } from "@clawdhq/degen-db";
import { ApiError } from "@/lib/server/socialErrors";

export function parseChain(value: unknown): Chain {
  if (typeof value !== "string" || !(value in Chain)) {
    throw new ApiError(400, `Unknown chain "${String(value)}"`);
  }
  return value as Chain;
}

export function parseVenue(value: unknown): Venue {
  if (typeof value !== "string" || !(value in Venue)) {
    throw new ApiError(400, `Unknown venue "${String(value)}"`);
  }
  return value as Venue;
}

export function parseVenueList(value: unknown): Venue[] {
  if (!Array.isArray(value)) throw new ApiError(400, "allowedVenues must be an array");
  return value.map(parseVenue);
}

/** Positive-decimal request fields (order sizes, risk caps) — rejects non-numeric input,
 * negatives, and zero rather than letting an invalid string reach Prisma's Decimal parser and
 * throw an opaque 500. */
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

export function serializeTradingAgentConfig(config: {
  chain: Chain;
  agentChainId: string;
  mode: string;
  killSwitchEnabled: boolean;
  killedAt: Date | null;
  killedReason: string | null;
  allowedVenues: Venue[];
  maxPositionUsdc: Prisma.Decimal;
  maxDailyLossUsdc: Prisma.Decimal;
  paperBankrollUsdc: Prisma.Decimal;
  updatedAt: Date;
}) {
  return {
    chain: config.chain,
    agentChainId: config.agentChainId,
    mode: config.mode,
    killSwitchEnabled: config.killSwitchEnabled,
    killedAt: config.killedAt?.toISOString() ?? null,
    killedReason: config.killedReason,
    allowedVenues: config.allowedVenues,
    maxPositionUsdc: config.maxPositionUsdc.toString(),
    maxDailyLossUsdc: config.maxDailyLossUsdc.toString(),
    paperBankrollUsdc: config.paperBankrollUsdc.toString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}
