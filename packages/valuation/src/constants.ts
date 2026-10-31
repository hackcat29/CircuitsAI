export const CURRENT_FORMULA_VERSION = "v2";

/** Indexed by AgentTier (Basic/Verified/Elite). Higher tiers imply more durable, trustworthy
 * revenue, so lifetime earnings are weighted more heavily for them. */
export const TIER_REVENUE_MULTIPLIER: readonly [number, number, number] = [1.0, 1.5, 2.5];

/** Flat USDC credit (6-decimal), per supported protocol capability (x402, ACP/A2A, MCP).
 * Elevated in v2 from $0.50 to $10.00 USDC to represent the real engineering,
 * hosted runtime, and protocol integration baseline of an autonomous agent. */
export const CAPABILITY_BASE_VALUE_USDC = 10_000_000n; // $10.00 USDC per capability

export const REPUTATION_FACTOR_MIN = 0.5;
export const REPUTATION_FACTOR_MAX = 1.5;

/** Recency decay: value halves every RECENCY_HALF_LIFE_SECONDS of inactivity since the agent's
 * last completed job, floored at RECENCY_FLOOR_FACTOR so a dormant agent's history never decays to zero. */
export const RECENCY_HALF_LIFE_SECONDS = 30 * 24 * 60 * 60;
export const RECENCY_FLOOR_FACTOR = 0.25;

/** Fresh mint grace period (30 days): A newly minted/registered agent with no completed jobs
 * is granted an initial 1.0 recency factor during its grace period, decaying smoothly toward
 * the floor only if it remains inactive thereafter. Eliminates the 75% dormancy penalty on day 1. */
export const NEW_AGENT_GRACE_PERIOD_SECONDS = 30 * 24 * 60 * 60;

/** Token creator royalty stream rate: 30% creator + 20% agent treasury = 50% of the 2% trade fee (1% of volume = 100 bps). */
export const TOKEN_ROYALTY_BPS = 100n;

/** Capitalization multiplier on bonding curve equity: 5% (500 bps) of usdcRaised capital backing. */
export const TOKEN_BONDING_CAPITALIZATION_BPS = 500n;
