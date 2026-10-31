use crate::errors::ClawError;
use anchor_lang::prelude::*;

/// SPL agent tokens use 9 decimals (vs. 18 on EVM) so that
/// `TOTAL_SUPPLY_WHOLE * 10^TOKEN_DECIMALS` comfortably fits in a u64.
pub const TOKEN_DECIMALS: u32 = 9;
pub const TOKEN_DECIMALS_FACTOR: u64 = 1_000_000_000; // 10^9
pub const TOTAL_AGENT_TOKEN_SUPPLY_WHOLE: u64 = 1_000_000_000; // 1B whole tokens
pub const SELL_FEE_BPS: u64 = 200; // 2%
pub const ANTI_SNIPE_MAX_BPS: u64 = 500; // 5%
pub const MAX_CREATOR_ALLOC_BPS: u16 = 2_000; // 20%

/// Integer square root via Newton's method, matching the precision semantics of
/// Solidity's `Math.sqrt` (OpenZeppelin) used in the EVM contract's identical curve.
pub fn isqrt(value: u128) -> u128 {
    if value == 0 {
        return 0;
    }
    let mut x = value;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + value / x) / 2;
    }
    x
}

/// Solves the same quadratic integral as `ClawdHQCore._tokensOutForBuy` for the number
/// of whole tokens purchasable with `usdc_amount`, given a linear curve
/// `price(x) = base_price + slope * x` (x = whole tokens already sold).
pub fn tokens_out_for_buy(sold_whole: u64, base_price: u64, slope: u64, usdc_amount: u64) -> Result<u64> {
    if slope == 0 {
        let delta_whole = usdc_amount
            .checked_div(base_price)
            .ok_or(ClawError::Overflow)?;
        return delta_whole
            .checked_mul(TOKEN_DECIMALS_FACTOR)
            .ok_or_else(|| error!(ClawError::Overflow));
    }

    let sold_whole = sold_whole as u128;
    let base_price = base_price as u128;
    let slope = slope as u128;
    let usdc_amount = usdc_amount as u128;

    let b = base_price + slope * sold_whole;
    let discriminant = b
        .checked_mul(b)
        .and_then(|sq| sq.checked_add(2u128.checked_mul(slope)?.checked_mul(usdc_amount)?))
        .ok_or(ClawError::Overflow)?;
    let sqrt_discriminant = isqrt(discriminant);
    let delta_whole = (sqrt_discriminant - b) / slope;

    u64::try_from(delta_whole.checked_mul(TOKEN_DECIMALS_FACTOR as u128).ok_or(ClawError::Overflow)?)
        .map_err(|_| error!(ClawError::Overflow))
}

/// Direct evaluation of the integral for a known token amount being sold, returning
/// `(gross_usdc_out, net_usdc_out)` after the protocol's sell fee.
pub fn usdc_out_for_sell(sold_whole: u64, base_price: u64, slope: u64, token_amount: u64) -> Result<(u64, u64)> {
    let delta_whole = (token_amount / TOKEN_DECIMALS_FACTOR) as u128;
    let sold_whole = sold_whole as u128;
    let base_price = base_price as u128;
    let slope = slope as u128;

    let gross = base_price
        .checked_mul(delta_whole)
        .and_then(|base_component| {
            let two_sold_delta = 2u128.checked_mul(sold_whole)?.checked_mul(delta_whole)?;
            let delta_sq = delta_whole.checked_mul(delta_whole)?;
            let slope_component = slope.checked_mul(two_sold_delta.checked_sub(delta_sq)?)? / 2;
            base_component.checked_add(slope_component)
        })
        .ok_or(ClawError::Overflow)?;

    let fee = gross.checked_mul(SELL_FEE_BPS as u128).ok_or(ClawError::Overflow)? / 10_000;
    let net = gross.checked_sub(fee).ok_or(ClawError::Overflow)?;

    let gross_u64 = u64::try_from(gross).map_err(|_| error!(ClawError::Overflow))?;
    let net_u64 = u64::try_from(net).map_err(|_| error!(ClawError::Overflow))?;
    Ok((gross_u64, net_u64))
}
