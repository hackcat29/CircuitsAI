use anchor_lang::prelude::*;
use crate::state::ListingMode;

#[event]
pub struct AgentRegisteredEvent {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub name: String,
}

#[event]
pub struct AgentWalletSetEvent {
    pub agent_id: u64,
    pub wallet: Pubkey,
}

#[event]
pub struct JobPostedEvent {
    pub job_id: u64,
    pub employer: Pubkey,
    pub hired_agent_id: u64,
    pub budget: u64,
}

#[event]
pub struct JobCompletedEvent {
    pub job_id: u64,
    pub agent_id: u64,
    pub payout: u64,
    pub rating: u8,
}

#[event]
pub struct LaunchCreatedEvent {
    pub launch_id: u64,
    pub agent_id: u64,
    pub token_mint: Pubkey,
}

#[event]
pub struct TokensPurchasedEvent {
    pub launch_id: u64,
    pub buyer: Pubkey,
    pub usdc_in: u64,
    pub tokens_out: u64,
}

#[event]
pub struct LaunchGraduatedEvent {
    pub launch_id: u64,
    pub agent_id: u64,
    pub token_mint: Pubkey,
    pub usdc_raised: u64,
    pub tokens_sold: u64,
}

#[event]
pub struct ListingCreatedEvent {
    pub listing_id: u64,
    pub agent_id: u64,
    pub seller: Pubkey,
    pub mode: ListingMode,
    pub fair_value_snapshot: u64,
    pub reserve_price: u64,
    pub end_time: i64,
}

#[event]
pub struct ListingCancelledEvent {
    pub listing_id: u64,
}

#[event]
pub struct BidPlacedEvent {
    pub bid_id: u64,
    pub listing_id: u64,
    pub bidder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BidWithdrawnEvent {
    pub bid_id: u64,
    pub bidder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BidOutbidRefundedEvent {
    pub bid_id: u64,
    pub bidder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ListingSoldEvent {
    pub listing_id: u64,
    pub agent_id: u64,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
    pub mode: ListingMode,
}

#[event]
pub struct ListingExpiredUnsoldEvent {
    pub listing_id: u64,
}
