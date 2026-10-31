/// Bonding-curve math shared by `launchpad`. Mirrors the linear curve
/// `price(x) = base_price + slope * x` used identically by the EVM and Solana
/// implementations of ClawdHQ, so buy/sell quotes are consistent across chains.
module clawdhq_agent::math;

/// Agent tokens use 9 decimals (matching the Solana SPL implementation) so that
/// `TOTAL_SUPPLY_WHOLE * 10^TOKEN_DECIMALS` comfortably fits in a u64.
const TOKEN_DECIMALS_FACTOR: u64 = 1_000_000_000;
const TOTAL_AGENT_TOKEN_SUPPLY_WHOLE: u64 = 1_000_000_000;
const SELL_FEE_BPS: u64 = 200;
const ANTI_SNIPE_MAX_BPS: u64 = 500;
const MAX_CREATOR_ALLOC_BPS: u16 = 2_000;

public fun token_decimals_factor(): u64 { TOKEN_DECIMALS_FACTOR }
public fun total_agent_token_supply_whole(): u64 { TOTAL_AGENT_TOKEN_SUPPLY_WHOLE }
public fun sell_fee_bps(): u64 { SELL_FEE_BPS }
public fun anti_snipe_max_bps(): u64 { ANTI_SNIPE_MAX_BPS }
public fun max_creator_alloc_bps(): u16 { MAX_CREATOR_ALLOC_BPS }

/// Integer square root via Newton's method, matching the precision semantics of
/// the `isqrt` helpers used in the EVM (OpenZeppelin `Math.sqrt`) and Solana programs.
public fun isqrt(value: u128): u128 {
    if (value == 0) return 0;
    let mut x = value;
    let mut y = (x + 1) / 2;
    while (y < x) {
        x = y;
        y = (x + value / x) / 2;
    };
    x
}

/// Solves the buy-side quadratic for the number of whole tokens purchasable with
/// `usdc_amount`, given `sold_whole` whole tokens already sold on the curve.
public fun tokens_out_for_buy(sold_whole: u64, base_price: u64, slope: u64, usdc_amount: u64): u64 {
    if (slope == 0) {
        let delta_whole = usdc_amount / base_price;
        return delta_whole * TOKEN_DECIMALS_FACTOR
    };

    let sold_whole = sold_whole as u128;
    let base_price = base_price as u128;
    let slope = slope as u128;
    let usdc_amount = usdc_amount as u128;

    let b = base_price + slope * sold_whole;
    let discriminant = b * b + 2 * slope * usdc_amount;
    let sqrt_discriminant = isqrt(discriminant);
    let delta_whole = (sqrt_discriminant - b) / slope;

    (delta_whole * (TOKEN_DECIMALS_FACTOR as u128)) as u64
}

/// Direct closed-form evaluation of the integral for a known token amount being sold,
/// returning `(gross_usdc_out, net_usdc_out)` after the protocol's sell fee.
public fun usdc_out_for_sell(sold_whole: u64, base_price: u64, slope: u64, token_amount: u64): (u64, u64) {
    let delta_whole = (token_amount / TOKEN_DECIMALS_FACTOR) as u128;
    let sold_whole = sold_whole as u128;
    let base_price = base_price as u128;
    let slope = slope as u128;

    let base_component = base_price * delta_whole;
    let two_sold_delta = 2 * sold_whole * delta_whole;
    let delta_sq = delta_whole * delta_whole;
    let slope_component = (slope * (two_sold_delta - delta_sq)) / 2;
    let gross = base_component + slope_component;

    let fee = (gross * (SELL_FEE_BPS as u128)) / 10_000;
    let net = gross - fee;

    (gross as u64, net as u64)
}
