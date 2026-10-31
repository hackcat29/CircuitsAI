/** Mirrors ClawdHQLaunchpad's v3 constant-product bonding curve (see the contract's own
 * top-level doc comment) so the UI can quote prices without an on-chain view call. This is a
 * quote for display purposes only; the contracts are the source of truth and enforce
 * `minTokensOut`/`minUsdcOut` slippage bounds independently. */

/** The launch token uses 18 decimals on EVM (standard ERC20). */
export const EVM_TOKEN_DECIMALS_FACTOR = 10n ** 18n;

/** 1%, applied to both buys and sells — matches ClawdHQLaunchpad.TRADE_FEE_BPS exactly. Doesn't
 * account for the elevated ANTI_SNIPE_FEE_BPS the contract charges instead during a fresh
 * launch's first 10 minutes — this quote lib has no notion of "when did this launch start," so
 * treat a quote for a brand-new launch as an estimate during that window specifically. */
export const TRADE_FEE_BPS = 100n;

/** ClawdHQLaunchpad.TOTAL_AGENT_TOKEN_SUPPLY / 1e18 — fixed for every launch. */
export const TOTAL_WHOLE_SUPPLY = 1_000_000_000n;
const TOTAL_SUPPLY_RAW = TOTAL_WHOLE_SUPPLY * EVM_TOKEN_DECIMALS_FACTOR;

/** Extra decimal digits `currentPrice`/`priceAtTokensSold` carry beyond plain raw-USDC(6dec)-
 * per-whole-token. This launchpad's FDV can start well under $1,000 (the default is $4,000, and
 * an admin-configured launch can go lower still) — at that range a bare, unscaled integer price
 * floors to 0 long before a meaningful FDV is reached (see ClawdHQLaunchpad.sol's getCurrentPrice
 * NatSpec, which documents that exact limitation for the on-chain view function). Divide out
 * before display — format.ts's formatTokenPrice already expects this convention, and fdvUsdc
 * below does the corresponding division for FDV. */
export const PRICE_PRECISION = 10n ** 12n;

export interface BondingCurveLaunch {
  tokensSold: bigint;
  usdcRaised: bigint;
  initialVirtualUsdcReserve: bigint;
}

function kFor(initialVirtualUsdcReserve: bigint): bigint {
  return initialVirtualUsdcReserve * TOTAL_SUPPLY_RAW;
}

/** Scaled USDC(6dec)-per-whole-token, using the launch's real, authoritative current state
 * (initialVirtualUsdcReserve + usdcRaised) — exact up to the tiny, bounded rounding a single
 * on-chain integer division introduces per trade (see ClawdHQLaunchpad.sol's own
 * _tokensOutForBuy/_usdcOutForSell doc comments). Divide the result by PRICE_PRECISION (and by
 * 1e6 for USDC's own decimals) to get a human price — see format.ts's formatTokenPrice. */
export function currentPrice(launch: BondingCurveLaunch, tokenDecimalsFactor: bigint): bigint {
  const realTokens = TOTAL_SUPPLY_RAW - launch.tokensSold;
  if (realTokens <= 0n) return 0n; // fully depleted curve — should already be graduated
  const virtualUsdc = launch.initialVirtualUsdcReserve + launch.usdcRaised;
  return (virtualUsdc * tokenDecimalsFactor * PRICE_PRECISION) / realTokens;
}

/** Same scaled price convention as `currentPrice`, but reconstructed purely from the
 * constant-product invariant (k = initialVirtualUsdcReserve * totalSupply, fixed for the
 * launch's entire life) at a hypothetical `tokensSold` value, rather than a real historical
 * usdcRaised figure. Used only for a 24h-ago price reconstruction (see launchStats.ts) — this
 * app doesn't track historical usdcRaised snapshots, only the net token delta traded, so this is
 * the best available reconstruction rather than an approximation invented for convenience: the
 * invariant genuinely does pin down what usdcRaised *must* have been at any given tokensSold. */
export function priceAtTokensSold(initialVirtualUsdcReserve: bigint, tokensSold: bigint, tokenDecimalsFactor: bigint): bigint {
  const realTokens = TOTAL_SUPPLY_RAW - tokensSold;
  if (realTokens <= 0n) return 0n;
  const virtualUsdc = kFor(initialVirtualUsdcReserve) / realTokens;
  return (virtualUsdc * tokenDecimalsFactor * PRICE_PRECISION) / realTokens;
}

/** priceScaled * total whole supply / PRICE_PRECISION — a single final division keeps this
 * exact (or negligibly close) rather than compounding two separately-rounded values the way
 * naively multiplying an already-floored per-token price by the supply would. FDV at zero
 * tokens sold equals initialVirtualUsdcReserve exactly (the totalSupply factor cancels). */
export function fdvUsdc(launch: BondingCurveLaunch): bigint {
  return (currentPrice(launch, EVM_TOKEN_DECIMALS_FACTOR) * TOTAL_WHOLE_SUPPLY) / PRICE_PRECISION;
}

/** Constant-product (x*y=k) buy-side solve — mirrors ClawdHQLaunchpad._tokensOutForBuy exactly.
 * `k` is never stored on either side; it's reconstructible from launch-time constants alone
 * (initialVirtualUsdcReserve * totalSupply), since the invariant never changes once a launch is
 * created. `usdcAmount` has the 2% trade fee taken off the top first, exactly like `buyTokens`
 * does on-chain, since only the post-fee remainder ever reaches the curve. */
export function quoteBuy(launch: BondingCurveLaunch, usdcAmount: bigint): bigint {
  const fee = (usdcAmount * TRADE_FEE_BPS) / 10_000n;
  const netUsdcIn = usdcAmount - fee;
  const virtualUsdc = launch.initialVirtualUsdcReserve + launch.usdcRaised;
  const realTokens = TOTAL_SUPPLY_RAW - launch.tokensSold;
  const k = kFor(launch.initialVirtualUsdcReserve);
  const newRealTokens = k / (virtualUsdc + netUsdcIn);
  return realTokens - newRealTokens;
}

/** The sell-side mirror of `quoteBuy` — mirrors ClawdHQLaunchpad._usdcOutForSell exactly.
 * Returns both the gross curve value and the net amount after the protocol's 2% trade fee. */
export function quoteSell(launch: BondingCurveLaunch, tokenAmount: bigint): { gross: bigint; net: bigint } {
  const virtualUsdc = launch.initialVirtualUsdcReserve + launch.usdcRaised;
  const realTokens = TOTAL_SUPPLY_RAW - launch.tokensSold;
  const k = kFor(launch.initialVirtualUsdcReserve);
  const newVirtualUsdc = k / (realTokens + tokenAmount);
  let gross = virtualUsdc - newVirtualUsdc;
  if (gross > launch.usdcRaised) {
    gross = launch.usdcRaised;
  }
  const fee = (gross * TRADE_FEE_BPS) / 10_000n;
  return { gross, net: gross - fee };
}

export function applySlippage(amount: bigint, toleranceBps: bigint): bigint {
  return (amount * (10_000n - toleranceBps)) / 10_000n;
}
