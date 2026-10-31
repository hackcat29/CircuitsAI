/// Bonding-curve agent token launchpad. Mirrors `ClawdHQCore`'s launch lifecycle on EVM
/// and the Solana program's, but Sui's static `Coin<T>` type system can't mint a brand
/// new fungible-token type per launch at runtime (unlike an SPL mint or a Solidity
/// `AgentToken` clone). Instead, each launch tracks balances internally on the shared
/// `Launch` object, and holders carry an owned `LaunchPosition` object recording their
/// balance for that specific `launch_id` — functionally equivalent (same bonding-curve
/// math, same fees, same graduation rules), but not a separately transferable `Coin`.
module clawdhq_agent::launchpad;

use std::string::String;
use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use clawdhq_agent::math;
use clawdhq_agent::registry::{Self, ProtocolState, Agent};
use clawdhq_agent::usdc::USDC;

const ENotAgentOwner: u64 = 0;
const EInvalidAlloc: u64 = 1;
const EInsufficientFee: u64 = 2;
const ELaunchNotActive: u64 = 3;
const EZeroAmount: u64 = 4;
const ESlippageExceeded: u64 = 5;
const EAntiSnipeLimitExceeded: u64 = 6;
const EInsufficientTokensSold: u64 = 7;
const EWrongLaunch: u64 = 8;
const EAlreadyGraduated: u64 = 9;
const EThresholdNotMet: u64 = 10;

/// 10 minutes, matching `ANTI_SNIPE_WINDOW` in the EVM contract.
const ANTI_SNIPE_WINDOW_MS: u64 = 600_000;

public struct Launch has key, store {
    id: UID,
    launch_id: u64,
    agent_id: u64,
    creator: address,
    name: String,
    symbol: String,
    total_supply: u64,
    usdc_raised: u64,
    tokens_sold: u64,
    graduation_threshold: u64,
    bonding_base_price: u64,
    bonding_slope: u64,
    creator_alloc_bps: u16,
    created_at: u64,
    graduated_at: u64,
    anti_snipe_until: u64,
    graduated: bool,
    active: bool,
    reserve: Balance<USDC>,
}

public struct LaunchPosition has key, store {
    id: UID,
    launch_id: u64,
    amount: u64,
    purchased: u64,
}

public struct LaunchCreatedEvent has copy, drop { launch_id: u64, agent_id: u64, name: String, symbol: String }
public struct TokensPurchasedEvent has copy, drop { launch_id: u64, buyer: address, usdc_in: u64, tokens_out: u64 }
public struct TokensSoldEvent has copy, drop { launch_id: u64, seller: address, tokens_in: u64, usdc_out: u64 }
public struct LaunchGraduatedEvent has copy, drop { launch_id: u64, agent_id: u64, usdc_raised: u64, tokens_sold: u64 }

/// Transfers the creator's `LaunchPosition` on-chain to `registry::payout_authority(agent)`
/// (its registered wallet if set, else its owner) rather than returning it for the caller's
/// PTB to relay — the same "the contract itself enforces the payout destination" trust model
/// `marketplace::release_escrow` already uses, so a buggy or malicious client can't misdirect
/// the creator allocation. Only `Launch` is returned, for the caller to share.
public fun create_launch(
    state: &mut ProtocolState,
    agent: &Agent,
    name: String,
    symbol: String,
    creator_alloc_bps: u16,
    fee: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
): Launch {
    assert!(registry::agent_owner(agent) == ctx.sender(), ENotAgentOwner);
    assert!(creator_alloc_bps <= math::max_creator_alloc_bps(), EInvalidAlloc);
    assert!(fee.value() >= registry::launch_fee(state), EInsufficientFee);
    state.treasury_mut().join(fee.into_balance());

    let launch_id = state.next_launch_id();
    state.record_launch_created();
    let now = clock.timestamp_ms();

    let total_supply = math::total_agent_token_supply_whole() * math::token_decimals_factor();
    let creator_amount = ((total_supply as u128) * (creator_alloc_bps as u128) / 10_000) as u64;

    let launch = Launch {
        id: object::new(ctx),
        launch_id,
        agent_id: registry::agent_id(agent),
        creator: ctx.sender(),
        name,
        symbol,
        total_supply,
        usdc_raised: 0,
        tokens_sold: 0,
        graduation_threshold: registry::default_graduation_threshold(state),
        bonding_base_price: registry::default_bonding_base_price(state),
        bonding_slope: registry::default_bonding_slope(state),
        creator_alloc_bps,
        created_at: now,
        graduated_at: 0,
        anti_snipe_until: now + ANTI_SNIPE_WINDOW_MS,
        graduated: false,
        active: true,
        reserve: sui::balance::zero(),
    };

    let position = LaunchPosition {
        id: object::new(ctx),
        launch_id,
        amount: creator_amount,
        purchased: 0,
    };
    transfer::public_transfer(position, registry::payout_authority(agent));

    event::emit(LaunchCreatedEvent { launch_id, agent_id: launch.agent_id, name: launch.name, symbol: launch.symbol });
    launch
}

/// Buys tokens into `position`. Pass a fresh zero `LaunchPosition` for `launch.launch_id`
/// (see `new_position`) on a buyer's first purchase, or an existing one to accumulate.
public fun buy_tokens(
    launch: &mut Launch,
    position: &mut LaunchPosition,
    usdc_in: Coin<USDC>,
    min_tokens_out: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(launch.launch_id == position.launch_id, EWrongLaunch);
    assert!(launch.active && !launch.graduated, ELaunchNotActive);
    let usdc_amount = usdc_in.value();
    assert!(usdc_amount > 0, EZeroAmount);

    let sold_whole = launch.tokens_sold / math::token_decimals_factor();
    let tokens_out = math::tokens_out_for_buy(sold_whole, launch.bonding_base_price, launch.bonding_slope, usdc_amount);
    assert!(tokens_out >= min_tokens_out, ESlippageExceeded);

    if (clock.timestamp_ms() < launch.anti_snipe_until) {
        let max_per_wallet = ((launch.total_supply as u128) * (math::anti_snipe_max_bps() as u128) / 10_000) as u64;
        let new_total = position.purchased + tokens_out;
        assert!(new_total <= max_per_wallet, EAntiSnipeLimitExceeded);
        position.purchased = new_total;
    };

    launch.reserve.join(usdc_in.into_balance());
    launch.tokens_sold = launch.tokens_sold + tokens_out;
    launch.usdc_raised = launch.usdc_raised + usdc_amount;
    position.amount = position.amount + tokens_out;

    event::emit(TokensPurchasedEvent { launch_id: launch.launch_id, buyer: ctx.sender(), usdc_in: usdc_amount, tokens_out });
}

public fun sell_tokens(
    launch: &mut Launch,
    position: &mut LaunchPosition,
    token_amount: u64,
    min_usdc_out: u64,
    treasury: &mut ProtocolState,
    ctx: &mut TxContext,
): Coin<USDC> {
    assert!(launch.launch_id == position.launch_id, EWrongLaunch);
    assert!(launch.active && !launch.graduated, ELaunchNotActive);
    assert!(token_amount > 0 && token_amount % math::token_decimals_factor() == 0, EZeroAmount);
    assert!(token_amount <= launch.tokens_sold, EInsufficientTokensSold);
    assert!(token_amount <= position.amount, EInsufficientTokensSold);

    let sold_whole = launch.tokens_sold / math::token_decimals_factor();
    let (gross, net) = math::usdc_out_for_sell(sold_whole, launch.bonding_base_price, launch.bonding_slope, token_amount);
    assert!(net >= min_usdc_out, ESlippageExceeded);

    position.amount = position.amount - token_amount;
    launch.tokens_sold = launch.tokens_sold - token_amount;
    launch.usdc_raised = launch.usdc_raised - gross;

    let fee = gross - net;
    if (fee > 0) {
        treasury.treasury_mut().join(launch.reserve.split(fee));
    };
    let payout = launch.reserve.split(net);

    event::emit(TokensSoldEvent { launch_id: launch.launch_id, seller: ctx.sender(), tokens_in: token_amount, usdc_out: net });
    coin::from_balance(payout, ctx)
}

public fun graduate_launch(launch: &mut Launch, state: &mut ProtocolState, clock: &Clock) {
    assert!(!launch.graduated, EAlreadyGraduated);
    assert!(launch.usdc_raised >= launch.graduation_threshold, EThresholdNotMet);

    launch.graduated = true;
    launch.active = false;
    launch.graduated_at = clock.timestamp_ms();
    state.record_launch_graduated();

    event::emit(LaunchGraduatedEvent {
        launch_id: launch.launch_id,
        agent_id: launch.agent_id,
        usdc_raised: launch.usdc_raised,
        tokens_sold: launch.tokens_sold,
    });
}

public fun new_position(launch_id: u64, ctx: &mut TxContext): LaunchPosition {
    LaunchPosition { id: object::new(ctx), launch_id, amount: 0, purchased: 0 }
}

/// Merges `other` into `position`. Both must belong to the same `launch_id`.
public fun merge_positions(position: &mut LaunchPosition, other: LaunchPosition) {
    let LaunchPosition { id, launch_id, amount, purchased } = other;
    assert!(launch_id == position.launch_id, EWrongLaunch);
    id.delete();
    position.amount = position.amount + amount;
    position.purchased = position.purchased + purchased;
}

public fun position_amount(position: &LaunchPosition): u64 { position.amount }
public fun position_launch_id(position: &LaunchPosition): u64 { position.launch_id }
public fun launch_id(launch: &Launch): u64 { launch.launch_id }
public fun launch_creator(launch: &Launch): address { launch.creator }
public fun launch_graduated(launch: &Launch): bool { launch.graduated }
public fun launch_tokens_sold(launch: &Launch): u64 { launch.tokens_sold }
public fun launch_usdc_raised(launch: &Launch): u64 { launch.usdc_raised }
public fun bonding_base_price(launch: &Launch): u64 { launch.bonding_base_price }
public fun bonding_slope(launch: &Launch): u64 { launch.bonding_slope }
