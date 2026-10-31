/// Global protocol configuration and the AI agent registry. `ProtocolState` is a single
/// shared object (mirroring the EVM contract's storage and the Solana program's PDA) that
/// `marketplace` and `launchpad` both read and mutate via `public(package)` functions.
module clawdhq_agent::registry;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::table::{Self, Table};
use clawdhq_agent::usdc::USDC;

const EUnauthorized: u64 = 0;
const ENotAgentOwner: u64 = 1;
const ENameTaken: u64 = 2;
const EInvalidTier: u64 = 3;
const EInsufficientFee: u64 = 4;
const EAgentIsListed: u64 = 5;
const EWalletAlreadySet: u64 = 6;
const EZeroAddress: u64 = 7;

const TIER_BASIC: u8 = 0;
const TIER_VERIFIED: u8 = 1;
const TIER_ELITE: u8 = 2;

public struct ProtocolState has key {
    id: UID,
    authority: address,
    fee_recipient: address,
    /// Privileged off-chain signer (the indexer's custody-provisioned wallet — see
    /// packages/custody-core/src/registrarCustody.ts) allowed to call `set_agent_wallet`.
    /// Placeholder `authority` at `init` time until rotated in via `set_registrar`, mirroring
    /// the same "authority is a bootstrap placeholder" pattern the Solana port's
    /// `ProtocolState.registrar` uses (see clawdhq_agent's Rust `initialize`).
    registrar: address,
    treasury: Balance<USDC>,

    total_agents: u64,
    active_agents: u64,
    total_jobs: u64,
    total_volume: u64,
    total_launches: u64,
    graduated_launches: u64,

    protocol_fee_bps: u16,
    registration_fee: u64,
    launch_fee: u64,
    /// Fee taken from agent-exchange sale proceeds on settlement — independent of
    /// `protocol_fee_bps` (the job-hiring fee), matching the EVM/Solana exchange's own
    /// separate fee rate rather than conflating two different fee policies.
    exchange_fee_bps: u16,

    default_bonding_base_price: u64,
    default_bonding_slope: u64,
    default_graduation_threshold: u64,

    next_agent_id: u64,
    next_job_id: u64,
    next_launch_id: u64,
    next_listing_id: u64,

    names: Table<String, ID>,
}

public struct Agent has key, store {
    id: UID,
    agent_id: u64,
    owner: address,
    /// The agent's own custodied wallet — job earnings and launchpad creator allocations pay
    /// out here instead of `owner` once set (see `payout_authority`), so an owner can claim
    /// them at any time while still owning the agent, and claim rights follow an Agent
    /// Exchange sale automatically. `@0x0` sentinel until the indexer's registrar sets it via
    /// `set_agent_wallet` (mirrors EVM's `address(0)` / Solana's `Pubkey::default()`).
    agent_wallet: address,
    name: String,
    agent_uri: String,
    endpoint: String,
    metadata_hash: vector<u8>,
    supports_x402: bool,
    supports_a2a: bool,
    supports_mcp: bool,
    active: bool,
    tier: u8,
    created_at: u64,
    updated_at: u64,
    last_job_at: u64,
    jobs_completed: u32,
    jobs_failed: u32,
    usdc_revenue: u64,
    reputation_bps: u16,
    /// Set by `agent_exchange::create_listing`, cleared on cancel/sale/expiry — the only
    /// guard against double-listing now that `Agent` is a normal shared object the exchange
    /// operates on by reference rather than taking custody of (see `agent_exchange`'s module
    /// doc comment for why: an owned object can only ever be referenced by transactions its
    /// owner signs, which would make it impossible for an arbitrary employer to hire someone
    /// else's agent, or for an arbitrary bidder to bid on someone else's listing).
    active_listing_id: Option<u64>,
}

public struct AgentRegisteredEvent has copy, drop {
    agent_id: u64,
    owner: address,
    name: String,
}

public struct AgentTierUpdatedEvent has copy, drop {
    agent_id: u64,
    tier: u8,
}

public struct AgentWalletSetEvent has copy, drop {
    agent_id: u64,
    wallet: address,
}

fun init(ctx: &mut TxContext) {
    let state = ProtocolState {
        id: object::new(ctx),
        authority: ctx.sender(),
        fee_recipient: ctx.sender(),
        registrar: ctx.sender(),
        treasury: balance::zero(),
        total_agents: 0,
        active_agents: 0,
        total_jobs: 0,
        total_volume: 0,
        total_launches: 0,
        graduated_launches: 0,
        protocol_fee_bps: 0,
        registration_fee: 0,
        launch_fee: 0,
        exchange_fee_bps: 0,
        default_bonding_base_price: 1_000,
        default_bonding_slope: 1,
        default_graduation_threshold: 69_000_000_000, // 69,000 USDC at 6 decimals
        next_agent_id: 1,
        next_job_id: 1,
        next_launch_id: 1,
        next_listing_id: 1,
        names: table::new(ctx),
    };
    transfer::share_object(state);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx)
}

public fun register_agent(
    state: &mut ProtocolState,
    name: String,
    agent_uri: String,
    endpoint: String,
    metadata_hash: vector<u8>,
    supports_x402: bool,
    supports_a2a: bool,
    supports_mcp: bool,
    fee: Coin<USDC>,
    clock: &Clock,
    ctx: &mut TxContext,
): Agent {
    assert!(!state.names.contains(name), ENameTaken);
    assert!(fee.value() >= state.registration_fee, EInsufficientFee);
    state.treasury.join(fee.into_balance());

    let agent_id = state.next_agent_id;
    state.next_agent_id = agent_id + 1;
    state.total_agents = state.total_agents + 1;
    state.active_agents = state.active_agents + 1;

    let now = clock.timestamp_ms();
    let agent = Agent {
        id: object::new(ctx),
        agent_id,
        owner: ctx.sender(),
        agent_wallet: @0x0,
        name,
        agent_uri,
        endpoint,
        metadata_hash,
        supports_x402,
        supports_a2a,
        supports_mcp,
        active: true,
        tier: TIER_BASIC,
        created_at: now,
        updated_at: now,
        last_job_at: 0,
        jobs_completed: 0,
        jobs_failed: 0,
        usdc_revenue: 0,
        reputation_bps: 10_000,
        active_listing_id: option::none(),
    };
    state.names.add(name, object::id(&agent));

    event::emit(AgentRegisteredEvent { agent_id, owner: agent.owner, name: agent.name });
    agent
}

public fun update_agent_metadata(
    agent: &mut Agent,
    agent_uri: String,
    endpoint: String,
    metadata_hash: vector<u8>,
    supports_x402: bool,
    supports_a2a: bool,
    supports_mcp: bool,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(agent.owner == ctx.sender(), ENotAgentOwner);
    agent.agent_uri = agent_uri;
    agent.endpoint = endpoint;
    agent.metadata_hash = metadata_hash;
    agent.supports_x402 = supports_x402;
    agent.supports_a2a = supports_a2a;
    agent.supports_mcp = supports_mcp;
    agent.updated_at = clock.timestamp_ms();
}

public fun set_active(agent: &mut Agent, active: bool, state: &mut ProtocolState, clock: &Clock, ctx: &TxContext) {
    assert!(agent.owner == ctx.sender(), ENotAgentOwner);
    if (agent.active != active) {
        if (active) {
            state.active_agents = state.active_agents + 1;
        } else {
            state.active_agents = state.active_agents - 1;
        };
    };
    agent.active = active;
    agent.updated_at = clock.timestamp_ms();
}

public fun set_agent_tier(state: &ProtocolState, agent: &mut Agent, tier: u8, ctx: &TxContext) {
    assert!(state.authority == ctx.sender(), EUnauthorized);
    assert!(tier == TIER_BASIC || tier == TIER_VERIFIED || tier == TIER_ELITE, EInvalidTier);
    agent.tier = tier;
    event::emit(AgentTierUpdatedEvent { agent_id: agent.agent_id, tier });
}

/// Transfers an agent directly, peer-to-peer, outside `agent_exchange`. `Agent` is a shared
/// object (see the module doc comment on `active_listing_id`), so there's no native custody
/// to move — this is purely a field update, exactly like every other function in this module.
/// Blocked while listed (mirrors "manual transfer implicitly delists" on EVM/Solana): the
/// owner must cancel the listing first, since `agent_exchange` has no way to know a transfer
/// happened out from under an active `Listing` otherwise.
public fun transfer_agent_ownership(agent: &mut Agent, new_owner: address, clock: &Clock, ctx: &TxContext) {
    assert!(agent.owner == ctx.sender(), ENotAgentOwner);
    assert!(agent.active_listing_id.is_none(), EAgentIsListed);
    agent.owner = new_owner;
    agent.updated_at = clock.timestamp_ms();
}

/// Package-internal counterpart to `transfer_agent_ownership`, for `agent_exchange` to call
/// when a listing sells — doesn't check `active_listing_id` (the caller is already mid-sale
/// and clears the marker itself once this returns).
public(package) fun set_agent_owner(agent: &mut Agent, new_owner: address, clock: &Clock) {
    agent.owner = new_owner;
    agent.updated_at = clock.timestamp_ms();
}

/// One-time-settable: binds an agent to its off-chain-provisioned custodied wallet. Called by
/// the indexer's registrar signer shortly after registration (see custody-core's
/// agentWalletCustody.ts::provisionAgentWallet). Reverts if already set — the wallet is meant
/// to be a stable, permanent identity for the agent, not reassignable after the fact (mirrors
/// the EVM/Solana ports exactly).
public fun set_agent_wallet(state: &ProtocolState, agent: &mut Agent, wallet: address, ctx: &TxContext) {
    assert!(state.registrar == ctx.sender(), EUnauthorized);
    assert!(wallet != @0x0, EZeroAddress);
    assert!(agent.agent_wallet == @0x0, EWalletAlreadySet);
    agent.agent_wallet = wallet;
    event::emit(AgentWalletSetEvent { agent_id: agent.agent_id, wallet });
}

/// Rotates the authorized registrar signer — e.g. after a key-custody migration.
public fun set_registrar(state: &mut ProtocolState, new_registrar: address, ctx: &TxContext) {
    assert!(state.authority == ctx.sender(), EUnauthorized);
    assert!(new_registrar != @0x0, EZeroAddress);
    state.registrar = new_registrar;
}

/// `agent_exchange`'s only guard against double-listing (see the field's doc comment on
/// `Agent`) — `Some(listing_id)` while listed, `None` once cancelled/sold/expired.
public(package) fun set_active_listing(agent: &mut Agent, listing_id: Option<u64>) {
    agent.active_listing_id = listing_id;
}

public fun update_protocol_params(
    state: &mut ProtocolState,
    protocol_fee_bps: Option<u16>,
    registration_fee: Option<u64>,
    launch_fee: Option<u64>,
    bonding_base_price: Option<u64>,
    bonding_slope: Option<u64>,
    graduation_threshold: Option<u64>,
    exchange_fee_bps: Option<u16>,
    ctx: &TxContext,
) {
    assert!(state.authority == ctx.sender(), EUnauthorized);
    if (protocol_fee_bps.is_some()) state.protocol_fee_bps = *protocol_fee_bps.borrow();
    if (registration_fee.is_some()) state.registration_fee = *registration_fee.borrow();
    if (launch_fee.is_some()) state.launch_fee = *launch_fee.borrow();
    if (bonding_base_price.is_some()) state.default_bonding_base_price = *bonding_base_price.borrow();
    if (bonding_slope.is_some()) state.default_bonding_slope = *bonding_slope.borrow();
    if (graduation_threshold.is_some()) state.default_graduation_threshold = *graduation_threshold.borrow();
    if (exchange_fee_bps.is_some()) state.exchange_fee_bps = *exchange_fee_bps.borrow();
}

// === package-internal accessors used by `marketplace` and `launchpad` ===

public(package) fun authority(state: &ProtocolState): address { state.authority }
public(package) fun fee_recipient(state: &ProtocolState): address { state.fee_recipient }
public(package) fun protocol_fee_bps(state: &ProtocolState): u16 { state.protocol_fee_bps }
public(package) fun launch_fee(state: &ProtocolState): u64 { state.launch_fee }
public(package) fun default_bonding_base_price(state: &ProtocolState): u64 { state.default_bonding_base_price }
public(package) fun default_bonding_slope(state: &ProtocolState): u64 { state.default_bonding_slope }
public(package) fun default_graduation_threshold(state: &ProtocolState): u64 { state.default_graduation_threshold }
public(package) fun treasury_mut(state: &mut ProtocolState): &mut Balance<USDC> { &mut state.treasury }
public(package) fun exchange_fee_bps(state: &ProtocolState): u16 { state.exchange_fee_bps }

public(package) fun next_listing_id(state: &mut ProtocolState): u64 {
    let id = state.next_listing_id;
    state.next_listing_id = id + 1;
    id
}

public(package) fun next_job_id(state: &mut ProtocolState): u64 {
    let id = state.next_job_id;
    state.next_job_id = id + 1;
    id
}

public(package) fun next_launch_id(state: &mut ProtocolState): u64 {
    let id = state.next_launch_id;
    state.next_launch_id = id + 1;
    id
}

public(package) fun record_job_posted(state: &mut ProtocolState) {
    state.total_jobs = state.total_jobs + 1;
}

public(package) fun record_volume(state: &mut ProtocolState, amount: u64) {
    state.total_volume = state.total_volume + amount;
}

public(package) fun record_launch_created(state: &mut ProtocolState) {
    state.total_launches = state.total_launches + 1;
}

public(package) fun record_launch_graduated(state: &mut ProtocolState) {
    state.graduated_launches = state.graduated_launches + 1;
}

public(package) fun mark_job_started(agent: &mut Agent, clock: &Clock) {
    agent.last_job_at = clock.timestamp_ms();
}

public(package) fun record_job_completed(agent: &mut Agent, revenue: u64, rating: u8, clock: &Clock) {
    agent.jobs_completed = agent.jobs_completed + 1;
    agent.usdc_revenue = agent.usdc_revenue + revenue;
    agent.updated_at = clock.timestamp_ms();
    if (rating > 0) {
        // Exponential moving average toward `rating` (out of 5), in bps, weight 1/5.
        let rating_bps = (rating as u64) * 2_000;
        let current = agent.reputation_bps as u64;
        agent.reputation_bps = ((current * 4 + rating_bps) / 5) as u16;
    };
}

public(package) fun record_job_failed(agent: &mut Agent, clock: &Clock) {
    agent.jobs_failed = agent.jobs_failed + 1;
    agent.updated_at = clock.timestamp_ms();
    let current = agent.reputation_bps as u64;
    agent.reputation_bps = (if (current > 1_000) { current - 1_000 } else { 0 }) as u16;
}

// === read-only accessors for off-chain indexing / cross-module checks ===

public fun agent_id(agent: &Agent): u64 { agent.agent_id }
public fun agent_owner(agent: &Agent): address { agent.owner }
public fun agent_wallet(agent: &Agent): address { agent.agent_wallet }

/// The agent's earnings destination: its registered custodied wallet if set, otherwise
/// `owner` — see `Agent.agent_wallet`'s doc comment. Used by `marketplace::release_escrow`
/// and `launchpad::create_launch` instead of `agent_owner` directly, so job payouts and
/// launch creator allocations redirect there automatically once a wallet is provisioned.
public fun payout_authority(agent: &Agent): address {
    if (agent.agent_wallet != @0x0) { agent.agent_wallet } else { agent.owner }
}
public fun agent_active(agent: &Agent): bool { agent.active }
public fun agent_tier(agent: &Agent): u8 { agent.tier }
public fun agent_jobs_completed(agent: &Agent): u32 { agent.jobs_completed }
public fun agent_reputation_bps(agent: &Agent): u16 { agent.reputation_bps }
public fun agent_active_listing_id(agent: &Agent): Option<u64> { agent.active_listing_id }

public fun tier_basic(): u8 { TIER_BASIC }
public fun tier_verified(): u8 { TIER_VERIFIED }
public fun tier_elite(): u8 { TIER_ELITE }
