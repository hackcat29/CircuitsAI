use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub usdc_mint: Pubkey,
    /// The indexer's privileged signer for `set_agent_wallet` — bootstrapped to `authority` as
    /// a placeholder at `initialize()` (the real custody-provisioned wallet doesn't exist yet
    /// at deploy time) and rotated in via `set_registrar` once it does. Mirrors
    /// AgentWalletRegistry.sol's `registrar` on EVM, except Solana has no bytecode-size
    /// pressure forcing it into a separate program — this field lives directly on
    /// `ProtocolState` alongside every other protocol-level authority.
    pub registrar: Pubkey,

    pub total_agents: u64,
    pub active_agents: u64,
    pub total_jobs: u64,
    pub total_volume: u64,
    pub total_launches: u64,
    pub graduated_launches: u64,

    pub protocol_fee_bps: u16,
    pub registration_fee: u64,
    pub launch_fee: u64,
    /// Fee taken from agent-exchange sale proceeds on settlement — independent of
    /// `protocol_fee_bps` (the job-hiring fee), matching the EVM exchange's own separate
    /// `protocolFeeBps` rather than conflating two different fee policies.
    pub exchange_fee_bps: u16,

    pub default_bonding_base_price: u64,
    pub default_bonding_slope: u64,
    pub default_graduation_threshold: u64,

    pub next_agent_id: u64,
    pub next_job_id: u64,
    pub next_launch_id: u64,
    pub next_listing_id: u64,
    pub next_bid_id: u64,

    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum AgentTier {
    Basic,
    Verified,
    Elite,
}

#[account]
#[derive(InitSpace)]
pub struct AgentState {
    pub agent_id: u64,
    pub owner: Pubkey,
    /// The agent's own custodied wallet (see packages/custody-core/src/agentWalletCustody.ts),
    /// set once via `set_agent_wallet`. `Pubkey::default()` (all-zero) means "not provisioned
    /// yet" — job payouts and launchpad creator allocations fall back to `owner` until then;
    /// see `payout_authority`.
    pub agent_wallet: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(128)]
    pub agent_uri: String,
    #[max_len(256)]
    pub endpoint: String,
    pub metadata_hash: [u8; 32],
    pub supports_x402: bool,
    pub supports_a2a: bool,
    pub supports_mcp: bool,
    pub active: bool,
    pub tier: AgentTier,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_job_at: i64,
    pub jobs_completed: u32,
    pub jobs_failed: u32,
    pub usdc_revenue: u64,
    pub reputation_bps: u16,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Pending,
    Active,
    Completed,
    Disputed,
    Cancelled,
    Resolved,
}

#[account]
#[derive(InitSpace)]
pub struct JobState {
    pub job_id: u64,
    pub employer: Pubkey,
    pub employer_agent_id: u64, // 0 if none
    pub hired_agent_id: u64,
    pub task_hash: [u8; 32],
    pub budget: u64, // USDC base units
    pub status: JobStatus,
    pub created_at: i64,
    pub deadline: i64,
    pub started_at: i64,
    pub completed_at: i64,
    pub deliverable_hash: [u8; 32],
    pub rating: u8, // 1-5, 0 if unrated
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LaunchState {
    pub launch_id: u64,
    pub agent_id: u64,
    pub token_mint: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    pub creator: Pubkey,
    pub total_supply: u64, // 9-decimal base units
    pub usdc_raised: u64,
    pub tokens_sold: u64, // 9-decimal base units
    pub graduation_threshold: u64,
    pub bonding_base_price: u64,
    pub bonding_slope: u64,
    pub created_at: i64,
    pub graduated_at: i64,
    pub anti_snipe_until: i64,
    pub graduated: bool,
    pub active: bool,
    pub creator_alloc_bps: u16,
    pub bump: u8,
}

/// Tracks how many tokens a wallet has bought from a given launch during the
/// anti-snipe window. A small standalone PDA per (launch, buyer) so we don't need an
/// unbounded map inside `LaunchState`.
#[account]
#[derive(InitSpace)]
pub struct BuyerPosition {
    pub launch_id: u64,
    pub buyer: Pubkey,
    pub purchased: u64,
    pub bump: u8,
}

/// A marker PDA keyed by `hash(name)` that exists purely to make agent names globally
/// unique on-chain: `register_agent` uses `init` on this account, which fails if a
/// record for the same name hash already exists.
#[account]
#[derive(InitSpace)]
pub struct NameRecord {
    pub agent_id: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ListingMode {
    Open,
    Auction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
    Expired,
}

/// NFT-style ownership listing for an agent — separate system from `JobState`'s
/// job-hiring escrow, which this leaves untouched. Unlike the EVM/`ClawdHQAgentExchange`
/// design, there is no separate "approval" concept here: since the exchange instructions
/// live in this same program, `create_listing` verifies `agent_state.owner == seller` (and
/// `accept_bid`/`settle_auction` re-verify it against `listing.seller` before ever writing a
/// new owner) directly via the same `has_one`/`constraint` pattern `CreateLaunch` already
/// uses, with no cross-program trust boundary to bridge.
#[account]
#[derive(InitSpace)]
pub struct ListingState {
    pub listing_id: u64,
    pub agent_id: u64,
    pub seller: Pubkey,
    pub mode: ListingMode,
    pub status: ListingStatus,
    pub fair_value_snapshot: u64, // off-chain valuation at listing time, display-only, never enforced
    pub reserve_price: u64,       // Auction-only; 0 = no reserve
    pub end_time: i64,            // 0 for Open (no expiry); required for Auction
    pub highest_bid_id: u64,      // Auction-only; 0 = none yet
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BidState {
    pub bid_id: u64,
    pub listing_id: u64,
    pub bidder: Pubkey,
    pub amount: u64,
    pub active: bool, // false once accepted, settled, or withdrawn
    pub created_at: i64,
    pub bump: u8,
}

/// Tracks whether `agent_id` currently has an active listing, so `create_listing` can
/// reject a second simultaneous listing for the same agent — a UX/correctness guard, not a
/// fund-safety one (a stray second listing could never actually settle twice: the second
/// `accept_bid`/`settle_auction` would fail the `agent_state.owner == listing.seller` check
/// once the first sale completes). `listing_id == 0` means no active listing.
#[account]
#[derive(InitSpace)]
pub struct ActiveListingMarker {
    pub listing_id: u64,
    pub bump: u8,
}
