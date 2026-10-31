/// Job posting, acceptance and USDC escrow release. Mirrors the job lifecycle in the
/// EVM `ClawdHQCore` contract and the Solana Anchor program, adapted to Sui's
/// shared-object model: a `Job` is itself a shared object holding the escrowed `Balance<USDC>`.
module clawdhq_agent::marketplace;

use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use clawdhq_agent::registry::{Self, ProtocolState, Agent};
use clawdhq_agent::usdc::USDC;

const EAgentNotActive: u64 = 0;
const ENotHiredAgent: u64 = 1;
const ENotEmployer: u64 = 2;
const ENotPending: u64 = 3;
const ENotActive: u64 = 4;
const EUnauthorized: u64 = 5;
const ENoDeliverable: u64 = 6;
const EDeadlineNotPassed: u64 = 7;
const EInvalidRating: u64 = 8;
const ENotDisputed: u64 = 9;

const STATUS_PENDING: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_COMPLETED: u8 = 2;
const STATUS_DISPUTED: u8 = 3;
const STATUS_CANCELLED: u8 = 4;
const STATUS_RESOLVED: u8 = 5;

public struct Job has key, store {
    id: UID,
    job_id: u64,
    employer: address,
    employer_agent_id: u64,
    hired_agent_id: u64,
    task_hash: vector<u8>,
    escrow: Balance<USDC>,
    status: u8,
    created_at: u64,
    deadline: u64,
    started_at: u64,
    completed_at: u64,
    deliverable_hash: vector<u8>,
    has_deliverable: bool,
    rating: u8,
}

public struct JobPostedEvent has copy, drop { job_id: u64, employer: address, hired_agent_id: u64, budget: u64 }
public struct JobCompletedEvent has copy, drop { job_id: u64, hired_agent_id: u64, payout: u64 }

fun release_escrow(
    job: &mut Job,
    agent: &mut Agent,
    state: &mut ProtocolState,
    rating: u8,
    clock: &Clock,
    ctx: &mut TxContext,
): u64 {
    let gross = job.escrow.value();
    let fee = ((gross as u128) * (registry::protocol_fee_bps(state) as u128) / 10_000) as u64;
    let net = gross - fee;

    if (fee > 0) {
        state.treasury_mut().join(job.escrow.split(fee));
    };
    let payout_balance = job.escrow.withdraw_all();
    let payout_value = payout_balance.value();
    transfer::public_transfer(coin::from_balance(payout_balance, ctx), registry::payout_authority(agent));

    registry::record_job_completed(agent, net, rating, clock);
    registry::record_volume(state, gross);
    payout_value
}

public fun post_job(
    state: &mut ProtocolState,
    hired_agent: &Agent,
    employer_agent_id: u64,
    task_hash: vector<u8>,
    budget: Coin<USDC>,
    deadline: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Job {
    assert!(registry::agent_active(hired_agent), EAgentNotActive);

    let job_id = state.next_job_id();
    state.record_job_posted();
    let now = clock.timestamp_ms();
    let budget_value = budget.value();

    let job = Job {
        id: object::new(ctx),
        job_id,
        employer: ctx.sender(),
        employer_agent_id,
        hired_agent_id: registry::agent_id(hired_agent),
        task_hash,
        escrow: budget.into_balance(),
        status: STATUS_PENDING,
        created_at: now,
        deadline,
        started_at: 0,
        completed_at: 0,
        deliverable_hash: vector[],
        has_deliverable: false,
        rating: 0,
    };

    event::emit(JobPostedEvent {
        job_id,
        employer: job.employer,
        hired_agent_id: job.hired_agent_id,
        budget: budget_value,
    });
    job
}

public fun accept_job(job: &mut Job, agent: &mut Agent, clock: &Clock, ctx: &TxContext) {
    assert!(registry::agent_owner(agent) == ctx.sender(), ENotHiredAgent);
    assert!(registry::agent_id(agent) == job.hired_agent_id, ENotHiredAgent);
    assert!(job.status == STATUS_PENDING, ENotPending);

    job.status = STATUS_ACTIVE;
    job.started_at = clock.timestamp_ms();
    registry::mark_job_started(agent, clock);
}

public fun submit_deliverable(job: &mut Job, agent: &Agent, deliverable_hash: vector<u8>, ctx: &TxContext) {
    assert!(registry::agent_owner(agent) == ctx.sender(), ENotHiredAgent);
    assert!(registry::agent_id(agent) == job.hired_agent_id, ENotHiredAgent);
    assert!(job.status == STATUS_ACTIVE, ENotActive);

    job.deliverable_hash = deliverable_hash;
    job.has_deliverable = true;
}

public fun confirm_delivery(
    job: &mut Job,
    agent: &mut Agent,
    state: &mut ProtocolState,
    rating: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(job.employer == ctx.sender(), ENotEmployer);
    assert!(job.status == STATUS_ACTIVE, ENotActive);
    assert!(rating <= 5, EInvalidRating);

    let payout = release_escrow(job, agent, state, rating, clock, ctx);
    job.status = STATUS_COMPLETED;
    job.completed_at = clock.timestamp_ms();
    job.rating = rating;

    event::emit(JobCompletedEvent { job_id: job.job_id, hired_agent_id: job.hired_agent_id, payout });
}

public fun cancel_job(job: &mut Job, ctx: &mut TxContext) {
    assert!(job.employer == ctx.sender(), ENotEmployer);
    assert!(job.status == STATUS_PENDING, ENotPending);

    let refund = job.escrow.withdraw_all();
    transfer::public_transfer(coin::from_balance(refund, ctx), job.employer);
    job.status = STATUS_CANCELLED;
}

public fun dispute_job(job: &mut Job, agent: &Agent, ctx: &TxContext) {
    let is_employer = job.employer == ctx.sender();
    let is_agent_owner = registry::agent_owner(agent) == ctx.sender() && registry::agent_id(agent) == job.hired_agent_id;
    assert!(is_employer || is_agent_owner, EUnauthorized);
    assert!(job.status == STATUS_ACTIVE, ENotActive);

    job.status = STATUS_DISPUTED;
}

public fun resolve_dispute(
    job: &mut Job,
    agent: &mut Agent,
    state: &mut ProtocolState,
    favor_agent: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(registry::authority(state) == ctx.sender(), EUnauthorized);
    assert!(job.status == STATUS_DISPUTED, ENotDisputed);

    if (favor_agent) {
        let payout = release_escrow(job, agent, state, 0, clock, ctx);
        event::emit(JobCompletedEvent { job_id: job.job_id, hired_agent_id: job.hired_agent_id, payout });
    } else {
        let refund = job.escrow.withdraw_all();
        transfer::public_transfer(coin::from_balance(refund, ctx), job.employer);
        registry::record_job_failed(agent, clock);
    };
    job.status = STATUS_RESOLVED;
}

public fun auto_release_expired(
    job: &mut Job,
    agent: &mut Agent,
    state: &mut ProtocolState,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(job.status == STATUS_ACTIVE, ENotActive);
    assert!(job.has_deliverable, ENoDeliverable);
    assert!(clock.timestamp_ms() >= job.deadline, EDeadlineNotPassed);

    let payout = release_escrow(job, agent, state, 0, clock, ctx);
    job.status = STATUS_COMPLETED;
    job.completed_at = clock.timestamp_ms();

    event::emit(JobCompletedEvent { job_id: job.job_id, hired_agent_id: job.hired_agent_id, payout });
}

public fun status(job: &Job): u8 { job.status }
public fun job_id(job: &Job): u64 { job.job_id }
