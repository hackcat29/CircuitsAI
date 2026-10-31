import {
  CAPABILITY_BASE_VALUE_USDC,
  CURRENT_FORMULA_VERSION,
  NEW_AGENT_GRACE_PERIOD_SECONDS,
  RECENCY_FLOOR_FACTOR,
  RECENCY_HALF_LIFE_SECONDS,
  REPUTATION_FACTOR_MAX,
  REPUTATION_FACTOR_MIN,
  TIER_REVENUE_MULTIPLIER,
  TOKEN_BONDING_CAPITALIZATION_BPS,
  TOKEN_ROYALTY_BPS,
} from "./constants.js";
import type { AgentValuationInput, AgentValuationResult } from "./types.js";

function reputationFactor(reputationBps: number): number {
  const clamped = Math.min(10_000, Math.max(0, reputationBps));
  const span = REPUTATION_FACTOR_MAX - REPUTATION_FACTOR_MIN;
  return REPUTATION_FACTOR_MIN + (clamped / 10_000) * span;
}

function recencyFactor(lastJobAtSeconds: number, nowSeconds: number, createdAtSeconds?: number): number {
  if (lastJobAtSeconds > 0) {
    const elapsed = Math.max(0, nowSeconds - lastJobAtSeconds);
    const decayed = 2 ** (-elapsed / RECENCY_HALF_LIFE_SECONDS);
    return RECENCY_FLOOR_FACTOR + (1 - RECENCY_FLOOR_FACTOR) * decayed;
  }

  // In v2: If the agent has never completed a job, check if it is within its new-agent grace period.
  if (createdAtSeconds !== undefined && createdAtSeconds > 0) {
    const elapsedSinceCreation = Math.max(0, nowSeconds - createdAtSeconds);
    if (elapsedSinceCreation <= NEW_AGENT_GRACE_PERIOD_SECONDS) {
      // Graceful linear decay from 1.0 down to 0.5 across the 30-day window
      const fraction = elapsedSinceCreation / NEW_AGENT_GRACE_PERIOD_SECONDS;
      return 1.0 - fraction * 0.5;
    }
    // Beyond grace period without a job: decay smoothly from 0.5 down toward the floor (0.25)
    const postGraceElapsed = elapsedSinceCreation - NEW_AGENT_GRACE_PERIOD_SECONDS;
    const postDecay = 2 ** (-postGraceElapsed / RECENCY_HALF_LIFE_SECONDS);
    return RECENCY_FLOOR_FACTOR + (0.5 - RECENCY_FLOOR_FACTOR) * postDecay;
  }

  return RECENCY_FLOOR_FACTOR;
}

function capabilityComponentUsdc(input: AgentValuationInput): bigint {
  const count = (input.supportsX402 ? 1 : 0) + (input.supportsA2A ? 1 : 0) + (input.supportsMcp ? 1 : 0);
  return CAPABILITY_BASE_VALUE_USDC * BigInt(count);
}

function tokenRoyaltyComponentUsdc(input: AgentValuationInput): bigint {
  const tokenVolume = input.tokenVolumeUsdc ?? 0n;
  const tokenRaised = input.tokenUsdcRaised ?? 0n;

  // 1% of volume (trade royalties to creator + agent operating treasury)
  const volumeRoyalty = (tokenVolume * TOKEN_ROYALTY_BPS) / 10_000n;
  // 5% capitalization credit on USDC raised in bonding curve equity backing
  const bondingCapitalization = (tokenRaised * TOKEN_BONDING_CAPITALIZATION_BPS) / 10_000n;

  return volumeRoyalty > bondingCapitalization ? volumeRoyalty : bondingCapitalization;
}

/**
 * Computes an agent's off-chain, display-only "fair value" reference price from its on-chain
 * capabilities, revenue history, token trading royalties/capitalization, and treasury reserves.
 * Pure function of its inputs.
 */
export function computeFairValue(input: AgentValuationInput): AgentValuationResult {
  const revenueMultiplier = TIER_REVENUE_MULTIPLIER[input.tier];
  const revenueComponentUsdc = (input.usdcRevenue * BigInt(Math.round(revenueMultiplier * 1000))) / 1000n;
  const capabilityUsdc = capabilityComponentUsdc(input);
  const tokenRoyaltyUsdc = tokenRoyaltyComponentUsdc(input);
  const repFactor = reputationFactor(input.reputationBps);
  const recFactor = recencyFactor(input.lastJobAtSeconds, input.nowSeconds, input.createdAtSeconds);

  const base = revenueComponentUsdc + capabilityUsdc + tokenRoyaltyUsdc;
  const combinedFactorMicros = BigInt(Math.round(repFactor * recFactor * 1_000_000));
  let fairValueUsdc = (base * combinedFactorMicros) / 1_000_000n;

  // Net Asset Value Floor: An agent's valuation cannot drop below its physical liquid treasury balance
  const treasuryFloorUsdc = input.treasuryUsdcBalance ?? 0n;
  if (treasuryFloorUsdc > 0n && fairValueUsdc < treasuryFloorUsdc) {
    fairValueUsdc = treasuryFloorUsdc;
  }

  return {
    fairValueUsdc,
    breakdown: {
      revenueComponentUsdc,
      capabilityComponentUsdc: capabilityUsdc,
      tokenRoyaltyComponentUsdc: tokenRoyaltyUsdc,
      treasuryFloorUsdc,
      reputationFactor: repFactor,
      recencyFactor: recFactor,
    },
    formulaVersion: CURRENT_FORMULA_VERSION,
  };
}
