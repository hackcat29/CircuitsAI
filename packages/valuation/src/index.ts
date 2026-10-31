export {
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
export { computeFairValue } from "./formula.js";
export type {
  AgentTier,
  AgentValuationBreakdown,
  AgentValuationInput,
  AgentValuationResult,
} from "./types.js";
