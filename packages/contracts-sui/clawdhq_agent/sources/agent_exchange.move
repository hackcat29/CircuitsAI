/// NFT-style ownership marketplace for agents — a separate system from `marketplace`'s
/// job-hiring escrow, which this module never touches.
///
/// `Agent` is a normal shared object (see `registry::Agent.active_listing_id`'s doc comment):
/// this module never takes custody of one, it only ever operates on it by reference, exactly
/// like `marketplace`/`launchpad` already do. That's a deliberate departure from an earlier
/// version of this design that *wrapped* the `Agent` inside the `Listing` object — confirmed
/// empirically, against a live local network, to be unworkable: Sui only lets a transaction
/// reference an *owned* object if its sender is that object's current owner, for reads and
/// writes alike, so an owned `Agent` could never be referenced by an arbitrary employer's
/// `marketplace::post_job` call, an arbitrary bidder's `place_bid` call, or (once wrapped)
/// even by its own listed agent's owner without unwrapping it first. Making `Agent` shared
/// and tracking "is this agent currently listed, and by which listing" via the
/// `active_listing_id` field instead sidesteps all of that: a listed agent stays exactly as
/// directly usable — by `marketplace`, `launchpad`, anything — as an unlisted one, the whole
/// time it's listed, no unwrap step, no special "for a listed agent" variant of any other
/// module's functions needed.
///
/// Bids live as `Table` entries inside the Listing itself rather than as separate top-level
/// objects: Sui only lets a transaction reference an *owned* object if its sender is that
/// object's owner, so a separate per-bidder `Bid` object would make it impossible for a *new*
/// bidder's transaction to refund the *previous* highest bidder — keeping bids inside the
/// already-shared Listing sidesteps that entirely.
module clawdhq_agent::agent_exchange;

use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};
use clawdhq_agent::registry::{Self, ProtocolState, Agent};
use clawdhq_agent::usdc::USDC;

const ENotAgentOwner: u64 = 0;
const ENotBidder: u64 = 1;
const EInvalidListingParams: u64 = 2;
const EListingNotActive: u64 = 3;
const EWrongListingMode: u64 = 4;
const EZeroAmount: u64 = 5;
const EBidTooLow: u64 = 6;
const EBidNotActive: u64 = 7;
const EBidNotWithdrawable: u64 = 8;
const EAuctionEnded: u64 = 9;
const EAuctionNotEnded: u64 = 10;
const ECannotCancelAuctionWithBids: u64 = 11;
const EAgentAlreadyListed: u64 = 12;
const EAgentMismatch: u64 = 13;

const MODE_OPEN: u8 = 0;
const MODE_AUCTION: u8 = 1;

const STATUS_ACTIVE: u8 = 0;
const STATUS_SOLD: u8 = 1;
const STATUS_CANCELLED: u8 = 2;
const STATUS_EXPIRED: u8 = 3;

/// 5 minutes, matching ANTI_SNIPE_EXTENSION_WINDOW (EVM) / ANTI_SNIPE_EXTENSION_SECONDS (Solana).
const ANTI_SNIPE_EXTENSION_MS: u64 = 300_000;

public struct Listing has key, store {
    id: UID,
    listing_id: u64,
    agent_id: u64,
    seller: address,
    mode: u8,
    status: u8,
    fair_value_snapshot: u64, // off-chain valuation at listing time, display-only, never enforced
    reserve_price: u64, // Auction-only; 0 = no reserve
    end_time: u64, // ms; 0 for Open (no expiry); required for Auction
    highest_bid_id: u64, // Auction-only; 0 = none yet
    created_at: u64,
    updated_at: u64,
    bids: Table<u64, Bid>,
    next_bid_id: u64,
}

public struct Bid has store {
    bid_id: u64,
    bidder: address,
    escrow: Balance<USDC>,
    created_at: u64,
}

public struct ListingCreatedEvent has copy, drop {
    listing_id: u64,
    agent_id: u64,
    seller: address,
    mode: u8,
    fair_value_snapshot: u64,
    reserve_price: u64,
    end_time: u64,
}
public struct ListingCancelledEvent has copy, drop { listing_id: u64 }
public struct BidPlacedEvent has copy, drop { listing_id: u64, bid_id: u64, bidder: address, amount: u64 }
public struct BidWithdrawnEvent has copy, drop { listing_id: u64, bid_id: u64, bidder: address, amount: u64 }
public struct BidOutbidRefundedEvent has copy, drop { listing_id: u64, bid_id: u64, bidder: address, amount: u64 }
public struct ListingSoldEvent has copy, drop {
    listing_id: u64,
    agent_id: u64,
    bid_id: u64,
    seller: address,
    buyer: address,
    price: u64,
    mode: u8,
}
public struct ListingExpiredUnsoldEvent has copy, drop { listing_id: u64 }

fun check_agent(listing: &Listing, agent: &Agent) {
    assert!(registry::agent_id(agent) == listing.agent_id, EAgentMismatch);
}

/// Marks `agent` as listed (via `active_listing_id` — see its doc comment on `Agent`, this
/// module's only guard against double-listing now that holding the object isn't what makes a
/// listing exclusive anymore) and creates a new shared `Listing` referencing it by id.
public fun create_listing(
    state: &mut ProtocolState,
    agent: &mut Agent,
    mode: u8,
    fair_value_snapshot: u64,
    reserve_price: u64,
    end_time: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(registry::agent_owner(agent) == ctx.sender(), ENotAgentOwner);
    assert!(registry::agent_active_listing_id(agent).is_none(), EAgentAlreadyListed);
    let now = clock.timestamp_ms();
    if (mode == MODE_AUCTION) {
        assert!(end_time > now, EInvalidListingParams);
    } else if (mode == MODE_OPEN) {
        // Open mode has no expiry and no reserve — the seller's unconditional
        // accept-anytime discretion already makes a reserve redundant.
        assert!(end_time == 0 && reserve_price == 0, EInvalidListingParams);
    } else {
        abort EInvalidListingParams
    };

    let listing_id = state.next_listing_id();
    let agent_id = registry::agent_id(agent);
    let seller = ctx.sender();
    registry::set_active_listing(agent, option::some(listing_id));

    let listing = Listing {
        id: object::new(ctx),
        listing_id,
        agent_id,
        seller,
        mode,
        status: STATUS_ACTIVE,
        fair_value_snapshot,
        reserve_price,
        end_time,
        highest_bid_id: 0,
        created_at: now,
        updated_at: now,
        bids: table::new(ctx),
        next_bid_id: 1,
    };

    event::emit(ListingCreatedEvent { listing_id, agent_id, seller, mode, fair_value_snapshot, reserve_price, end_time });
    transfer::share_object(listing);
}

/// Only a listing with no bids yet can be cancelled; an Auction with a bid must run to
/// expiry (see `settle_auction`). Any bids already sitting in `bids` (Open mode only, by
/// the guard above) stay individually withdrawable afterward — this never loops over them.
public fun cancel_listing(listing: &mut Listing, agent: &mut Agent, clock: &Clock, ctx: &TxContext) {
    check_agent(listing, agent);
    assert!(listing.seller == ctx.sender(), ENotAgentOwner);
    assert!(listing.status == STATUS_ACTIVE, EListingNotActive);
    assert!(listing.mode == MODE_OPEN || listing.highest_bid_id == 0, ECannotCancelAuctionWithBids);

    registry::set_active_listing(agent, option::none());
    listing.status = STATUS_CANCELLED;
    listing.updated_at = clock.timestamp_ms();

    event::emit(ListingCancelledEvent { listing_id: listing.listing_id });
}

public fun place_bid(listing: &mut Listing, amount: Coin<USDC>, clock: &Clock, ctx: &mut TxContext) {
    assert!(listing.status == STATUS_ACTIVE, EListingNotActive);
    let value = amount.value();
    assert!(value > 0, EZeroAmount);
    let now = clock.timestamp_ms();

    if (listing.mode == MODE_AUCTION) {
        assert!(now <= listing.end_time, EAuctionEnded);

        if (listing.highest_bid_id != 0) {
            assert!(value > listing.bids.borrow(listing.highest_bid_id).escrow.value(), EBidTooLow);
            let Bid { bid_id, bidder, escrow, created_at: _ } = listing.bids.remove(listing.highest_bid_id);
            let refund_amount = escrow.value();
            transfer::public_transfer(coin::from_balance(escrow, ctx), bidder);
            event::emit(BidOutbidRefundedEvent { listing_id: listing.listing_id, bid_id, bidder, amount: refund_amount });
        };

        if (listing.end_time - now < ANTI_SNIPE_EXTENSION_MS) {
            listing.end_time = now + ANTI_SNIPE_EXTENSION_MS;
        };
    };

    let bid_id = listing.next_bid_id;
    listing.next_bid_id = bid_id + 1;
    let bidder = ctx.sender();
    listing.bids.add(bid_id, Bid { bid_id, bidder, escrow: amount.into_balance(), created_at: now });

    if (listing.mode == MODE_AUCTION) {
        listing.highest_bid_id = bid_id;
    };
    listing.updated_at = now;

    event::emit(BidPlacedEvent { listing_id: listing.listing_id, bid_id, bidder, amount: value });
}

/// Always allowed for Open-listing bids and non-highest Auction bids. The current-highest
/// Auction bid is locked until the auction's `end_time` passes or it settles — mirroring the
/// EVM/Solana exchanges' identical withdrawal rule, so funds can never be stuck behind a slow
/// keeper.
public fun withdraw_bid(listing: &mut Listing, bid_id: u64, clock: &Clock, ctx: &mut TxContext) {
    assert!(listing.bids.contains(bid_id), EBidNotActive);
    assert!(listing.bids.borrow(bid_id).bidder == ctx.sender(), ENotBidder);

    let now = clock.timestamp_ms();
    let is_locked_highest = listing.mode == MODE_AUCTION &&
        listing.highest_bid_id == bid_id &&
        listing.status == STATUS_ACTIVE &&
        now <= listing.end_time;
    assert!(!is_locked_highest, EBidNotWithdrawable);

    let Bid { bid_id: withdrawn_bid_id, bidder, escrow, created_at: _ } = listing.bids.remove(bid_id);
    let amount = escrow.value();
    transfer::public_transfer(coin::from_balance(escrow, ctx), bidder);

    event::emit(BidWithdrawnEvent { listing_id: listing.listing_id, bid_id: withdrawn_bid_id, bidder, amount });
}

/// Seller accepts any open bid on an Open-mode listing, at any time — bids may be above or
/// below the listing's fair-value snapshot. Auction-mode listings only ever settle via
/// `settle_auction`, never early.
public fun accept_bid(listing: &mut Listing, agent: &mut Agent, bid_id: u64, state: &mut ProtocolState, clock: &Clock, ctx: &mut TxContext) {
    check_agent(listing, agent);
    assert!(listing.status == STATUS_ACTIVE, EListingNotActive);
    assert!(listing.mode == MODE_OPEN, EWrongListingMode);
    assert!(listing.seller == ctx.sender(), ENotAgentOwner);
    assert!(listing.bids.contains(bid_id), EBidNotActive);

    let Bid { bid_id: _, bidder, escrow, created_at: _ } = listing.bids.remove(bid_id);
    let price = escrow.value();
    settle_sale(listing, agent, state, escrow, bidder, clock, ctx);

    listing.status = STATUS_SOLD;
    listing.updated_at = clock.timestamp_ms();

    event::emit(ListingSoldEvent {
        listing_id: listing.listing_id,
        agent_id: listing.agent_id,
        bid_id,
        seller: listing.seller,
        buyer: bidder,
        price,
        mode: MODE_OPEN,
    });
}

/// Permissionless — callable by anyone once the auction's `end_time` has passed, mirroring
/// `marketplace::auto_release_expired`'s precedent since no chain can self-execute at a
/// future timestamp. If the highest bid never met the reserve price, the listing simply
/// expires unsold and stays withdrawable.
public fun settle_auction(listing: &mut Listing, agent: &mut Agent, state: &mut ProtocolState, clock: &Clock, ctx: &mut TxContext) {
    check_agent(listing, agent);
    assert!(listing.status == STATUS_ACTIVE, EListingNotActive);
    assert!(listing.mode == MODE_AUCTION, EWrongListingMode);
    let now = clock.timestamp_ms();
    assert!(now > listing.end_time, EAuctionNotEnded);

    let has_winning_bid = listing.highest_bid_id != 0 &&
        listing.bids.borrow(listing.highest_bid_id).escrow.value() >= listing.reserve_price;

    if (!has_winning_bid) {
        // Clear the listing marker exactly like `cancel_listing` — any surviving below-reserve
        // bid stays independently withdrawable via `withdraw_bid`, since `is_locked_highest`
        // there requires STATUS_ACTIVE, which this listing no longer has.
        registry::set_active_listing(agent, option::none());
        listing.status = STATUS_EXPIRED;
        listing.updated_at = now;
        event::emit(ListingExpiredUnsoldEvent { listing_id: listing.listing_id });
        return
    };

    let winning_bid_id = listing.highest_bid_id;
    let Bid { bid_id: _, bidder, escrow, created_at: _ } = listing.bids.remove(winning_bid_id);
    let price = escrow.value();
    settle_sale(listing, agent, state, escrow, bidder, clock, ctx);

    listing.status = STATUS_SOLD;
    listing.updated_at = now;

    event::emit(ListingSoldEvent {
        listing_id: listing.listing_id,
        agent_id: listing.agent_id,
        bid_id: winning_bid_id,
        seller: listing.seller,
        buyer: bidder,
        price,
        mode: MODE_AUCTION,
    });
}

fun settle_sale(listing: &Listing, agent: &mut Agent, state: &mut ProtocolState, mut escrow: Balance<USDC>, buyer: address, clock: &Clock, ctx: &mut TxContext) {
    let fee = ((escrow.value() as u128) * (registry::exchange_fee_bps(state) as u128) / 10_000) as u64;
    if (fee > 0) {
        state.treasury_mut().join(escrow.split(fee));
    };
    transfer::public_transfer(coin::from_balance(escrow, ctx), listing.seller);

    registry::set_agent_owner(agent, buyer, clock);
    registry::set_active_listing(agent, option::none());
}

public fun listing_id(listing: &Listing): u64 { listing.listing_id }
public fun agent_id(listing: &Listing): u64 { listing.agent_id }
public fun seller(listing: &Listing): address { listing.seller }
public fun mode(listing: &Listing): u8 { listing.mode }
public fun status(listing: &Listing): u8 { listing.status }
public fun highest_bid_id(listing: &Listing): u64 { listing.highest_bid_id }
public fun end_time(listing: &Listing): u64 { listing.end_time }
public fun has_bid(listing: &Listing, bid_id: u64): bool { listing.bids.contains(bid_id) }
public fun bid_amount(listing: &Listing, bid_id: u64): u64 { listing.bids.borrow(bid_id).escrow.value() }
public fun bid_bidder(listing: &Listing, bid_id: u64): address { listing.bids.borrow(bid_id).bidder }

public fun mode_open(): u8 { MODE_OPEN }
public fun mode_auction(): u8 { MODE_AUCTION }
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_sold(): u8 { STATUS_SOLD }
public fun status_cancelled(): u8 { STATUS_CANCELLED }
public fun status_expired(): u8 { STATUS_EXPIRED }
