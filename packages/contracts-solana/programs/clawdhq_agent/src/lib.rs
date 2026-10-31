use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

mod errors;
mod events;
mod math;
mod state;

use errors::ClawError;
use events::*;
use math::*;
use state::*;

declare_id!("5QdAJFcNheK3mmjQsaatqafHGmJC3BHGUeoupCRk5g66");

const PROTOCOL_SEED: &[u8] = b"protocol";
const AGENT_SEED: &[u8] = b"agent";
const JOB_SEED: &[u8] = b"job";
const LAUNCH_SEED: &[u8] = b"launch";
const BUYER_POSITION_SEED: &[u8] = b"buyer_position";
const NAME_SEED: &[u8] = b"name";
const LISTING_SEED: &[u8] = b"listing";
const BID_SEED: &[u8] = b"bid";
const ACTIVE_LISTING_SEED: &[u8] = b"active_listing";
const ANTI_SNIPE_WINDOW_SECONDS: i64 = 600; // 10 minutes
const ANTI_SNIPE_EXTENSION_SECONDS: i64 = 300; // 5 minutes

#[program]
pub mod clawdhq_agent {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee_recipient: Pubkey) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.authority = ctx.accounts.authority.key();
        protocol.fee_recipient = fee_recipient;
        protocol.usdc_mint = ctx.accounts.usdc_mint.key();
        // Placeholder — rotated to the indexer's real custody-provisioned wallet via
        // set_registrar once that wallet exists (see registrarCustody.ts and
        // apps/indexer/scripts/rotate-local-registrar-solana.ts).
        protocol.registrar = ctx.accounts.authority.key();

        protocol.total_agents = 0;
        protocol.active_agents = 0;
        protocol.total_jobs = 0;
        protocol.total_volume = 0;
        protocol.total_launches = 0;
        protocol.graduated_launches = 0;

        protocol.protocol_fee_bps = 0;
        protocol.registration_fee = 0;
        protocol.launch_fee = 0;
        protocol.exchange_fee_bps = 0;

        protocol.default_bonding_base_price = 1_000; // 0.001 USDC per whole token
        protocol.default_bonding_slope = 1; // +0.000001 USDC per whole token sold
        protocol.default_graduation_threshold = 69_000_000_000; // 69,000 USDC (6dp)

        protocol.next_agent_id = 1;
        protocol.next_job_id = 1;
        protocol.next_launch_id = 1;
        protocol.next_listing_id = 1;
        protocol.next_bid_id = 1;

        protocol.bump = ctx.bumps.protocol_state;
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        agent_uri: String,
        endpoint: String,
        metadata_hash: [u8; 32],
        supports_x402: bool,
        supports_a2a: bool,
        supports_mcp: bool,
    ) -> Result<()> {
        require!(!name.is_empty() && name.len() <= 64, ClawError::NameTooLong);

        let protocol = &mut ctx.accounts.protocol_state;
        let agent_id = protocol.next_agent_id;

        if protocol.registration_fee > 0 {
            transfer_to_vault(
                &ctx.accounts.token_program,
                &ctx.accounts.owner_usdc_ata,
                &ctx.accounts.vault,
                &ctx.accounts.owner,
                protocol.registration_fee,
            )?;
        }

        let now = Clock::get()?.unix_timestamp;
        let agent = &mut ctx.accounts.agent_state;
        agent.agent_id = agent_id;
        agent.owner = ctx.accounts.owner.key();
        agent.name = name.clone();
        agent.agent_uri = agent_uri;
        agent.endpoint = endpoint;
        agent.metadata_hash = metadata_hash;
        agent.supports_x402 = supports_x402;
        agent.supports_a2a = supports_a2a;
        agent.supports_mcp = supports_mcp;
        agent.active = true;
        agent.tier = AgentTier::Basic;
        agent.created_at = now;
        agent.updated_at = now;
        agent.last_job_at = 0;
        agent.jobs_completed = 0;
        agent.jobs_failed = 0;
        agent.usdc_revenue = 0;
        agent.reputation_bps = 0;
        agent.bump = ctx.bumps.agent_state;

        ctx.accounts.name_record.agent_id = agent_id;
        ctx.accounts.name_record.bump = ctx.bumps.name_record;

        protocol.next_agent_id += 1;
        protocol.total_agents += 1;
        protocol.active_agents += 1;

        emit!(AgentRegisteredEvent { agent_id, owner: agent.owner, name });
        Ok(())
    }

    pub fn update_agent_metadata(
        ctx: Context<UpdateAgent>,
        agent_uri: String,
        endpoint: String,
        metadata_hash: [u8; 32],
        supports_x402: bool,
        supports_a2a: bool,
        supports_mcp: bool,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_state;
        agent.agent_uri = agent_uri;
        agent.endpoint = endpoint;
        agent.metadata_hash = metadata_hash;
        agent.supports_x402 = supports_x402;
        agent.supports_a2a = supports_a2a;
        agent.supports_mcp = supports_mcp;
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn set_agent_active(ctx: Context<UpdateAgent>, active: bool) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        let agent = &mut ctx.accounts.agent_state;
        if agent.active != active {
            agent.active = active;
            if active {
                protocol.active_agents += 1;
            } else {
                protocol.active_agents -= 1;
            }
        }
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn transfer_agent_ownership(ctx: Context<UpdateAgent>, new_owner: Pubkey) -> Result<()> {
        let agent = &mut ctx.accounts.agent_state;
        agent.owner = new_owner;
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// One-time-settable: binds `agent_id` to its off-chain-provisioned custodied wallet.
    /// Called by the indexer's registrar signer shortly after the agent registers (see
    /// agentWalletCustody.ts's provisionAgentWallet). Reverts if already set — the wallet is
    /// meant to be a stable, permanent identity for the agent, not reassignable after the fact.
    pub fn set_agent_wallet(ctx: Context<SetAgentWallet>, agent_id: u64, wallet: Pubkey) -> Result<()> {
        require!(wallet != Pubkey::default(), ClawError::ZeroPubkey);
        require!(ctx.accounts.agent_state.agent_wallet == Pubkey::default(), ClawError::WalletAlreadySet);

        ctx.accounts.agent_state.agent_wallet = wallet;
        emit!(AgentWalletSetEvent { agent_id, wallet });
        Ok(())
    }

    /// Rotates the authorized registrar signer — e.g. after a key-custody migration.
    pub fn set_registrar(ctx: Context<UpdateProtocolParams>, new_registrar: Pubkey) -> Result<()> {
        require!(new_registrar != Pubkey::default(), ClawError::ZeroPubkey);
        ctx.accounts.protocol_state.registrar = new_registrar;
        Ok(())
    }

    pub fn set_agent_tier(ctx: Context<SetAgentTier>, tier: AgentTier) -> Result<()> {
        let agent = &mut ctx.accounts.agent_state;
        agent.tier = tier;
        agent.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn post_job(
        ctx: Context<PostJob>,
        employer_agent_id: u64,
        hired_agent_id: u64,
        task_hash: [u8; 32],
        budget: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(ctx.accounts.hired_agent.active, ClawError::AgentNotActive);
        require!(budget > 0, ClawError::InsufficientFunds);
        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, ClawError::DeadlinePassed);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.employer_usdc_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.employer.to_account_info(),
                },
            ),
            budget,
        )?;

        let protocol = &mut ctx.accounts.protocol_state;
        let job_id = protocol.next_job_id;

        let job = &mut ctx.accounts.job_state;
        job.job_id = job_id;
        job.employer = ctx.accounts.employer.key();
        job.employer_agent_id = employer_agent_id;
        job.hired_agent_id = hired_agent_id;
        job.task_hash = task_hash;
        job.budget = budget;
        job.status = JobStatus::Pending;
        job.created_at = now;
        job.deadline = deadline;
        job.started_at = 0;
        job.completed_at = 0;
        job.deliverable_hash = [0u8; 32];
        job.rating = 0;
        job.bump = ctx.bumps.job_state;

        protocol.next_job_id += 1;
        protocol.total_jobs += 1;

        emit!(JobPostedEvent { job_id, employer: job.employer, hired_agent_id, budget });
        Ok(())
    }

    pub fn accept_job(ctx: Context<AcceptJob>) -> Result<()> {
        let job = &mut ctx.accounts.job_state;
        require!(job.status == JobStatus::Pending, ClawError::InvalidJobStatus);
        require_keys_eq!(ctx.accounts.agent_state.owner, ctx.accounts.agent_owner.key(), ClawError::NotAgentOwner);

        job.status = JobStatus::Active;
        job.started_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn submit_deliverable(ctx: Context<SubmitDeliverable>, deliverable_hash: [u8; 32]) -> Result<()> {
        let job = &mut ctx.accounts.job_state;
        require!(job.status == JobStatus::Active, ClawError::InvalidJobStatus);
        require_keys_eq!(ctx.accounts.agent_state.owner, ctx.accounts.agent_owner.key(), ClawError::NotAgentOwner);
        job.deliverable_hash = deliverable_hash;
        Ok(())
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>, rating: u8) -> Result<()> {
        {
            let job = &ctx.accounts.job_state;
            require!(job.status == JobStatus::Active, ClawError::InvalidJobStatus);
            require_keys_eq!(job.employer, ctx.accounts.employer.key(), ClawError::NotEmployer);
            require!((1..=5).contains(&rating), ClawError::InvalidRating);
            require!(job.deliverable_hash != [0u8; 32], ClawError::NoDeliverableSubmitted);
        }

        let now = Clock::get()?.unix_timestamp;
        let budget = ctx.accounts.job_state.budget;
        release_job_escrow(
            &ctx.accounts.protocol_state,
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.agent_payout_usdc_ata,
            &ctx.accounts.treasury_usdc_ata,
            budget,
        )?;

        let job = &mut ctx.accounts.job_state;
        job.status = JobStatus::Completed;
        job.completed_at = now;
        job.rating = rating;

        apply_job_completion_stats(&mut ctx.accounts.agent_state, &mut ctx.accounts.protocol_state, budget, rating, now)?;

        emit!(JobCompletedEvent { job_id: job.job_id, agent_id: job.hired_agent_id, payout: budget, rating });
        Ok(())
    }

    pub fn dispute_job(ctx: Context<DisputeJob>) -> Result<()> {
        let job = &mut ctx.accounts.job_state;
        require!(job.status == JobStatus::Active, ClawError::InvalidJobStatus);
        let signer = ctx.accounts.signer.key();
        require!(
            signer == job.employer || signer == ctx.accounts.agent_state.owner,
            ClawError::NotEmployerOrAgentOwner
        );
        job.status = JobStatus::Disputed;
        Ok(())
    }

    pub fn cancel_job(ctx: Context<CancelJob>) -> Result<()> {
        let job = &mut ctx.accounts.job_state;
        require!(job.status == JobStatus::Pending, ClawError::InvalidJobStatus);
        require_keys_eq!(job.employer, ctx.accounts.employer.key(), ClawError::NotEmployer);

        let budget = job.budget;
        job.status = JobStatus::Cancelled;

        transfer_from_vault(
            &ctx.accounts.protocol_state,
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.employer_usdc_ata,
            budget,
        )
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, release_to_agent: bool) -> Result<()> {
        {
            let job = &ctx.accounts.job_state;
            require!(job.status == JobStatus::Disputed, ClawError::InvalidJobStatus);
        }

        let now = Clock::get()?.unix_timestamp;
        let budget = ctx.accounts.job_state.budget;

        if release_to_agent {
            release_job_escrow(
                &ctx.accounts.protocol_state,
                &ctx.accounts.token_program,
                &ctx.accounts.vault,
                &ctx.accounts.recipient_usdc_ata,
                &ctx.accounts.treasury_usdc_ata,
                budget,
            )?;
            apply_job_completion_stats(&mut ctx.accounts.agent_state, &mut ctx.accounts.protocol_state, budget, 0, now)?;
        } else {
            transfer_from_vault(
                &ctx.accounts.protocol_state,
                &ctx.accounts.token_program,
                &ctx.accounts.vault,
                &ctx.accounts.recipient_usdc_ata,
                budget,
            )?;
            ctx.accounts.agent_state.jobs_failed += 1;
        }

        let job = &mut ctx.accounts.job_state;
        job.status = JobStatus::Resolved;
        job.completed_at = now;
        Ok(())
    }

    pub fn auto_release_expired(ctx: Context<AutoReleaseExpired>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let job = &ctx.accounts.job_state;
            require!(job.status == JobStatus::Active, ClawError::InvalidJobStatus);
            require!(now > job.deadline, ClawError::DeadlineNotPassed);
            require!(job.deliverable_hash != [0u8; 32], ClawError::NoDeliverableSubmitted);
        }

        let budget = ctx.accounts.job_state.budget;
        release_job_escrow(
            &ctx.accounts.protocol_state,
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.agent_payout_usdc_ata,
            &ctx.accounts.treasury_usdc_ata,
            budget,
        )?;

        let job = &mut ctx.accounts.job_state;
        job.status = JobStatus::Completed;
        job.completed_at = now;

        apply_job_completion_stats(&mut ctx.accounts.agent_state, &mut ctx.accounts.protocol_state, budget, 0, now)?;
        Ok(())
    }

    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        symbol: String,
        creator_alloc_bps: u16,
    ) -> Result<()> {
        require!(creator_alloc_bps <= MAX_CREATOR_ALLOC_BPS, ClawError::ExcessiveCreatorAlloc);

        let protocol = &mut ctx.accounts.protocol_state;
        if protocol.launch_fee > 0 {
            transfer_to_vault(
                &ctx.accounts.token_program,
                &ctx.accounts.creator_usdc_ata,
                &ctx.accounts.vault,
                &ctx.accounts.creator,
                protocol.launch_fee,
            )?;
        }

        let total_supply = TOTAL_AGENT_TOKEN_SUPPLY_WHOLE
            .checked_mul(TOKEN_DECIMALS_FACTOR)
            .ok_or(ClawError::Overflow)?;

        let launch_id = protocol.next_launch_id;
        let launch_bump = ctx.bumps.launch_state;
        let launch_seeds: &[&[u8]] = &[LAUNCH_SEED, &launch_id.to_le_bytes(), &[launch_bump]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.launch_reserve.to_account_info(),
                    authority: ctx.accounts.launch_state.to_account_info(),
                },
                &[launch_seeds],
            ),
            total_supply,
        )?;

        if creator_alloc_bps > 0 {
            let creator_amount = (total_supply as u128 * creator_alloc_bps as u128 / 10_000) as u64;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.launch_reserve.to_account_info(),
                        to: ctx.accounts.creator_token_ata.to_account_info(),
                        authority: ctx.accounts.launch_state.to_account_info(),
                    },
                    &[launch_seeds],
                ),
                creator_amount,
            )?;
        }

        let now = Clock::get()?.unix_timestamp;
        let launch = &mut ctx.accounts.launch_state;
        launch.launch_id = launch_id;
        launch.agent_id = ctx.accounts.agent_state.agent_id;
        launch.token_mint = ctx.accounts.token_mint.key();
        launch.name = name;
        launch.symbol = symbol;
        launch.creator = ctx.accounts.creator.key();
        launch.total_supply = total_supply;
        launch.usdc_raised = 0;
        launch.tokens_sold = 0;
        launch.graduation_threshold = protocol.default_graduation_threshold;
        launch.bonding_base_price = protocol.default_bonding_base_price;
        launch.bonding_slope = protocol.default_bonding_slope;
        launch.created_at = now;
        launch.graduated_at = 0;
        launch.anti_snipe_until = now + ANTI_SNIPE_WINDOW_SECONDS;
        launch.graduated = false;
        launch.active = true;
        launch.creator_alloc_bps = creator_alloc_bps;
        launch.bump = launch_bump;

        protocol.next_launch_id += 1;
        protocol.total_launches += 1;

        emit!(LaunchCreatedEvent { launch_id, agent_id: launch.agent_id, token_mint: launch.token_mint });
        Ok(())
    }

    pub fn buy_tokens(ctx: Context<BuyTokens>, usdc_amount: u64, min_tokens_out: u64) -> Result<()> {
        require!(usdc_amount > 0, ClawError::InsufficientFunds);
        let now = Clock::get()?.unix_timestamp;

        let launch = &ctx.accounts.launch_state;
        require!(launch.active && !launch.graduated, ClawError::LaunchNotActive);

        let sold_whole = launch.tokens_sold / TOKEN_DECIMALS_FACTOR;
        let tokens_out = tokens_out_for_buy(sold_whole, launch.bonding_base_price, launch.bonding_slope, usdc_amount)?;
        require!(tokens_out >= min_tokens_out, ClawError::SlippageExceeded);

        if now < launch.anti_snipe_until {
            let max_per_wallet = (launch.total_supply as u128 * ANTI_SNIPE_MAX_BPS as u128 / 10_000) as u64;
            let position = &mut ctx.accounts.buyer_position;
            let new_total = position.purchased.checked_add(tokens_out).ok_or(ClawError::Overflow)?;
            require!(new_total <= max_per_wallet, ClawError::AntiSnipeActive);
            position.launch_id = launch.launch_id;
            position.buyer = ctx.accounts.buyer.key();
            position.purchased = new_total;
            position.bump = ctx.bumps.buyer_position;
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_usdc_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        let launch_bump = ctx.accounts.launch_state.bump;
        let launch_id = ctx.accounts.launch_state.launch_id;
        let launch_seeds: &[&[u8]] = &[LAUNCH_SEED, &launch_id.to_le_bytes(), &[launch_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_reserve.to_account_info(),
                    to: ctx.accounts.buyer_token_ata.to_account_info(),
                    authority: ctx.accounts.launch_state.to_account_info(),
                },
                &[launch_seeds],
            ),
            tokens_out,
        )?;

        let launch = &mut ctx.accounts.launch_state;
        launch.tokens_sold += tokens_out;
        launch.usdc_raised += usdc_amount;

        emit!(TokensPurchasedEvent { launch_id, buyer: ctx.accounts.buyer.key(), usdc_in: usdc_amount, tokens_out });
        Ok(())
    }

    pub fn sell_tokens(ctx: Context<SellTokens>, token_amount: u64, min_usdc_out: u64) -> Result<()> {
        require!(
            token_amount > 0 && token_amount % TOKEN_DECIMALS_FACTOR == 0,
            ClawError::InvalidTokenAmount
        );

        let launch = &ctx.accounts.launch_state;
        require!(launch.active && !launch.graduated, ClawError::LaunchNotActive);
        require!(token_amount <= launch.tokens_sold, ClawError::InsufficientTokensSold);

        let sold_whole = launch.tokens_sold / TOKEN_DECIMALS_FACTOR;
        let (gross, net) = usdc_out_for_sell(sold_whole, launch.bonding_base_price, launch.bonding_slope, token_amount)?;
        require!(net >= min_usdc_out, ClawError::SlippageExceeded);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_ata.to_account_info(),
                    to: ctx.accounts.launch_reserve.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        let fee = gross - net;
        transfer_from_vault(
            &ctx.accounts.protocol_state,
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.seller_usdc_ata,
            net,
        )?;
        if fee > 0 {
            transfer_from_vault(
                &ctx.accounts.protocol_state,
                &ctx.accounts.token_program,
                &ctx.accounts.vault,
                &ctx.accounts.treasury_usdc_ata,
                fee,
            )?;
        }

        let launch = &mut ctx.accounts.launch_state;
        launch.tokens_sold -= token_amount;
        launch.usdc_raised -= gross;

        emit!(TokensPurchasedEvent {
            launch_id: launch.launch_id,
            buyer: ctx.accounts.seller.key(),
            usdc_in: 0,
            tokens_out: 0
        });
        Ok(())
    }

    pub fn graduate_launch(ctx: Context<GraduateLaunch>) -> Result<()> {
        let launch = &mut ctx.accounts.launch_state;
        require!(!launch.graduated, ClawError::AlreadyGraduated);
        require!(launch.usdc_raised >= launch.graduation_threshold, ClawError::ThresholdNotMet);

        launch.graduated = true;
        launch.active = false;
        launch.graduated_at = Clock::get()?.unix_timestamp;

        let protocol = &mut ctx.accounts.protocol_state;
        protocol.graduated_launches += 1;

        emit!(LaunchGraduatedEvent {
            launch_id: launch.launch_id,
            agent_id: launch.agent_id,
            token_mint: launch.token_mint,
            usdc_raised: launch.usdc_raised,
            tokens_sold: launch.tokens_sold,
        });
        Ok(())
    }

    pub fn update_protocol_params(
        ctx: Context<UpdateProtocolParams>,
        protocol_fee_bps: Option<u16>,
        registration_fee: Option<u64>,
        launch_fee: Option<u64>,
        bonding_base_price: Option<u64>,
        bonding_slope: Option<u64>,
        graduation_threshold: Option<u64>,
        exchange_fee_bps: Option<u16>,
    ) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        if let Some(v) = protocol_fee_bps {
            require!(v <= 10_000, ClawError::Overflow);
            protocol.protocol_fee_bps = v;
        }
        if let Some(v) = registration_fee {
            protocol.registration_fee = v;
        }
        if let Some(v) = launch_fee {
            protocol.launch_fee = v;
        }
        if let Some(v) = exchange_fee_bps {
            require!(v <= 10_000, ClawError::Overflow);
            protocol.exchange_fee_bps = v;
        }
        if let Some(v) = bonding_base_price {
            protocol.default_bonding_base_price = v;
        }
        if let Some(v) = bonding_slope {
            protocol.default_bonding_slope = v;
        }
        if let Some(v) = graduation_threshold {
            protocol.default_graduation_threshold = v;
        }
        Ok(())
    }

    // ==================================================== Agent exchange =====
    // NFT-style ownership marketplace, separate from the job-hiring escrow above (which
    // this never touches). Unlike the EVM `ClawdHQAgentExchange` design, there is no
    // separate "approval" step: `create_listing` verifies `agent_state.owner == seller`
    // directly (the same `has_one`/`constraint` pattern `CreateLaunch` already uses), and
    // `accept_bid`/`settle_auction` re-verify it against `listing.seller` before ever
    // writing a new owner — preserving the same "never trust stale state" guarantee with no
    // cross-program trust boundary to bridge.

    pub fn create_listing(
        ctx: Context<CreateListing>,
        mode: ListingMode,
        fair_value_snapshot: u64,
        reserve_price: u64,
        end_time: i64,
    ) -> Result<()> {
        require!(ctx.accounts.active_listing_marker.listing_id == 0, ClawError::AlreadyListed);

        let now = Clock::get()?.unix_timestamp;
        match mode {
            ListingMode::Auction => require!(end_time > now, ClawError::InvalidListingParams),
            ListingMode::Open => require!(end_time == 0 && reserve_price == 0, ClawError::InvalidListingParams),
        }

        let protocol = &mut ctx.accounts.protocol_state;
        let listing_id = protocol.next_listing_id;
        protocol.next_listing_id += 1;

        let seller = ctx.accounts.seller.key();
        let agent_id = ctx.accounts.agent_state.agent_id;

        let listing = &mut ctx.accounts.listing_state;
        listing.listing_id = listing_id;
        listing.agent_id = agent_id;
        listing.seller = seller;
        listing.mode = mode;
        listing.status = ListingStatus::Active;
        listing.fair_value_snapshot = fair_value_snapshot;
        listing.reserve_price = reserve_price;
        listing.end_time = end_time;
        listing.highest_bid_id = 0;
        listing.created_at = now;
        listing.updated_at = now;
        listing.bump = ctx.bumps.listing_state;

        ctx.accounts.active_listing_marker.listing_id = listing_id;
        ctx.accounts.active_listing_marker.bump = ctx.bumps.active_listing_marker;

        emit!(ListingCreatedEvent { listing_id, agent_id, seller, mode, fair_value_snapshot, reserve_price, end_time });
        Ok(())
    }

    /// Only a listing with no bids yet can be cancelled — an auction with a bid must run to
    /// expiry (see `settle_auction`).
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing_state;
        require!(listing.status == ListingStatus::Active, ClawError::ListingNotActive);
        require!(
            listing.mode == ListingMode::Open || listing.highest_bid_id == 0,
            ClawError::CannotCancelAuctionWithBids
        );

        listing.status = ListingStatus::Cancelled;
        listing.updated_at = Clock::get()?.unix_timestamp;
        ctx.accounts.active_listing_marker.listing_id = 0;

        emit!(ListingCancelledEvent { listing_id: listing.listing_id });
        Ok(())
    }

    pub fn place_bid(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
        require!(amount > 0, ClawError::InsufficientFunds);

        let listing_status = ctx.accounts.listing_state.status;
        let listing_mode = ctx.accounts.listing_state.mode;
        let listing_end_time = ctx.accounts.listing_state.end_time;
        let listing_highest_bid_id = ctx.accounts.listing_state.highest_bid_id;
        let listing_id = ctx.accounts.listing_state.listing_id;
        require!(listing_status == ListingStatus::Active, ClawError::ListingNotActive);

        let now = Clock::get()?.unix_timestamp;
        let mut new_end_time = listing_end_time;

        if listing_mode == ListingMode::Auction {
            require!(now <= listing_end_time, ClawError::AuctionEnded);

            if listing_highest_bid_id != 0 {
                let previous_highest = ctx
                    .accounts
                    .previous_highest_bid
                    .as_mut()
                    .ok_or(ClawError::InvalidListingParams)?;
                require!(previous_highest.bid_id == listing_highest_bid_id, ClawError::InvalidListingParams);
                require!(amount > previous_highest.amount, ClawError::BidTooLow);

                // Normally always true here (the highest bid can only become inactive
                // before endTime through this very refund path), checked defensively.
                if previous_highest.active {
                    previous_highest.active = false;
                    let previous_amount = previous_highest.amount;
                    let previous_bid_id = previous_highest.bid_id;
                    let previous_bidder = previous_highest.bidder;

                    let previous_ata = ctx
                        .accounts
                        .previous_highest_bidder_usdc_ata
                        .as_ref()
                        .ok_or(ClawError::InvalidListingParams)?;
                    require_keys_eq!(previous_ata.owner, previous_bidder, ClawError::InvalidListingParams);

                    transfer_from_vault(&ctx.accounts.protocol_state, &ctx.accounts.token_program, &ctx.accounts.vault, previous_ata, previous_amount)?;
                    emit!(BidOutbidRefundedEvent { bid_id: previous_bid_id, bidder: previous_bidder, amount: previous_amount });
                }
            } else {
                require!(amount > 0, ClawError::BidTooLow);
            }

            if listing_end_time - now < ANTI_SNIPE_EXTENSION_SECONDS {
                new_end_time = now + ANTI_SNIPE_EXTENSION_SECONDS;
            }
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bidder_usdc_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.bidder.to_account_info(),
                },
            ),
            amount,
        )?;

        let protocol = &mut ctx.accounts.protocol_state;
        let bid_id = protocol.next_bid_id;
        protocol.next_bid_id += 1;

        let bidder_key = ctx.accounts.bidder.key();
        let bid = &mut ctx.accounts.bid_state;
        bid.bid_id = bid_id;
        bid.listing_id = listing_id;
        bid.bidder = bidder_key;
        bid.amount = amount;
        bid.active = true;
        bid.created_at = now;
        bid.bump = ctx.bumps.bid_state;

        let listing = &mut ctx.accounts.listing_state;
        if listing_mode == ListingMode::Auction {
            listing.highest_bid_id = bid_id;
            listing.end_time = new_end_time;
        }
        listing.updated_at = now;

        emit!(BidPlacedEvent { bid_id, listing_id, bidder: bidder_key, amount });
        Ok(())
    }

    /// Always allowed for Open-listing bids and non-highest Auction bids. The
    /// current-highest Auction bid is locked only while the auction is still Active and
    /// before its `end_time` — once that passes, even the highest bidder can reclaim their
    /// funds if nobody has called `settle_auction` yet, so funds can never be stuck behind a
    /// slow keeper (mirrors the EVM exchange's identical withdrawal rule).
    pub fn withdraw_bid(ctx: Context<WithdrawBid>) -> Result<()> {
        require!(ctx.accounts.bid_state.active, ClawError::BidNotActive);
        let now = Clock::get()?.unix_timestamp;

        let listing = &ctx.accounts.listing_state;
        let is_locked_highest_auction_bid = listing.mode == ListingMode::Auction
            && listing.highest_bid_id == ctx.accounts.bid_state.bid_id
            && listing.status == ListingStatus::Active
            && now <= listing.end_time;
        require!(!is_locked_highest_auction_bid, ClawError::BidNotWithdrawable);

        let bid = &mut ctx.accounts.bid_state;
        bid.active = false;
        let amount = bid.amount;
        let bidder = bid.bidder;
        let bid_id = bid.bid_id;

        transfer_from_vault(&ctx.accounts.protocol_state, &ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.bidder_usdc_ata, amount)?;

        emit!(BidWithdrawnEvent { bid_id, bidder, amount });
        Ok(())
    }

    /// Seller accepts any open bid on an Open-mode listing, at any time — bids may be above
    /// or below the listing's fair-value snapshot. Auction-mode listings only ever settle
    /// via `settle_auction`, never early.
    pub fn accept_bid(ctx: Context<AcceptBid>) -> Result<()> {
        {
            let listing = &ctx.accounts.listing_state;
            require!(listing.status == ListingStatus::Active, ClawError::ListingNotActive);
            require!(listing.mode == ListingMode::Open, ClawError::WrongListingMode);
            require_keys_eq!(listing.seller, ctx.accounts.seller.key(), ClawError::NotAgentOwner);
            require_keys_eq!(ctx.accounts.agent_state.owner, listing.seller, ClawError::NotAgentOwner);

            let bid = &ctx.accounts.bid_state;
            require!(bid.listing_id == listing.listing_id, ClawError::BidNotActive);
            require!(bid.active, ClawError::BidNotActive);
        }

        let now = Clock::get()?.unix_timestamp;
        let amount = ctx.accounts.bid_state.amount;
        let buyer = ctx.accounts.bid_state.bidder;
        let agent_id = ctx.accounts.listing_state.agent_id;
        let listing_id = ctx.accounts.listing_state.listing_id;
        let seller = ctx.accounts.listing_state.seller;

        ctx.accounts.bid_state.active = false;

        settle_sale(
            &ctx.accounts.protocol_state,
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.seller_usdc_ata,
            &ctx.accounts.treasury_usdc_ata,
            amount,
        )?;

        ctx.accounts.agent_state.owner = buyer;
        ctx.accounts.agent_state.updated_at = now;

        let listing = &mut ctx.accounts.listing_state;
        listing.status = ListingStatus::Sold;
        listing.updated_at = now;
        ctx.accounts.active_listing_marker.listing_id = 0;

        emit!(ListingSoldEvent { listing_id, agent_id, seller, buyer, price: amount, mode: ListingMode::Open });
        Ok(())
    }

    /// Permissionless — callable by anyone once the auction's `end_time` has passed, mirroring
    /// `auto_release_expired`'s precedent since no chain can self-execute at a future
    /// timestamp. If the highest bid was withdrawn in the post-end_time race window (see
    /// `withdraw_bid`) or never met the reserve price, the listing simply expires unsold.
    pub fn settle_auction(ctx: Context<SettleAuction>) -> Result<()> {
        let listing_status = ctx.accounts.listing_state.status;
        let listing_mode = ctx.accounts.listing_state.mode;
        let listing_end_time = ctx.accounts.listing_state.end_time;
        let listing_reserve = ctx.accounts.listing_state.reserve_price;
        let listing_highest_bid_id = ctx.accounts.listing_state.highest_bid_id;
        let listing_id = ctx.accounts.listing_state.listing_id;
        let agent_id = ctx.accounts.listing_state.agent_id;
        let seller = ctx.accounts.listing_state.seller;

        require!(listing_status == ListingStatus::Active, ClawError::ListingNotActive);
        require!(listing_mode == ListingMode::Auction, ClawError::WrongListingMode);
        let now = Clock::get()?.unix_timestamp;
        require!(now > listing_end_time, ClawError::AuctionNotEnded);

        ctx.accounts.active_listing_marker.listing_id = 0;

        let has_winning_bid = listing_highest_bid_id != 0
            && ctx
                .accounts
                .highest_bid
                .as_ref()
                .map(|b| b.active && b.amount >= listing_reserve)
                .unwrap_or(false);

        if !has_winning_bid {
            let listing = &mut ctx.accounts.listing_state;
            listing.status = ListingStatus::Expired;
            listing.updated_at = now;
            emit!(ListingExpiredUnsoldEvent { listing_id });
            return Ok(());
        }

        let (amount, buyer) = {
            let highest_bid = ctx.accounts.highest_bid.as_mut().ok_or(ClawError::InvalidListingParams)?;
            require!(highest_bid.bid_id == listing_highest_bid_id, ClawError::InvalidListingParams);
            highest_bid.active = false;
            (highest_bid.amount, highest_bid.bidder)
        };

        let seller_usdc_ata = ctx.accounts.seller_usdc_ata.as_ref().ok_or(ClawError::InvalidListingParams)?;
        require_keys_eq!(seller_usdc_ata.owner, seller, ClawError::InvalidListingParams);
        settle_sale(&ctx.accounts.protocol_state, &ctx.accounts.token_program, &ctx.accounts.vault, seller_usdc_ata, &ctx.accounts.treasury_usdc_ata, amount)?;

        ctx.accounts.agent_state.owner = buyer;
        ctx.accounts.agent_state.updated_at = now;

        let listing = &mut ctx.accounts.listing_state;
        listing.status = ListingStatus::Sold;
        listing.updated_at = now;

        emit!(ListingSoldEvent { listing_id, agent_id, seller, buyer, price: amount, mode: ListingMode::Auction });
        Ok(())
    }
}

// ============================================================== Helpers =====

fn transfer_to_vault<'info>(
    token_program: &Program<'info, Token>,
    from: &Box<Account<'info, TokenAccount>>,
    vault: &Box<Account<'info, TokenAccount>>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: vault.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
    )
}

fn transfer_from_vault<'info>(
    protocol_state: &Account<'info, ProtocolState>,
    token_program: &Program<'info, Token>,
    vault: &Box<Account<'info, TokenAccount>>,
    to: &Box<Account<'info, TokenAccount>>,
    amount: u64,
) -> Result<()> {
    let bump = protocol_state.bump;
    let seeds: &[&[u8]] = &[PROTOCOL_SEED, &[bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault.to_account_info(),
                to: to.to_account_info(),
                authority: protocol_state.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )
}

/// Payout destination for an agent's own earnings (job completion, launchpad creator
/// allocation): its registered `agent_wallet` if set, otherwise `owner`. Mirrors
/// `ClawdHQCore._payoutAddress` exactly. Callers use this to compute the expected
/// `associated_token::authority` for a payout ATA — see `ConfirmDelivery`/`AutoReleaseExpired`/
/// `ResolveDispute`/`CreateLaunch`'s account constraints.
fn payout_authority(agent: &AgentState) -> Pubkey {
    if agent.agent_wallet != Pubkey::default() {
        agent.agent_wallet
    } else {
        agent.owner
    }
}

/// Pays out `budget` from the vault to the agent owner (minus `protocol_fee_bps`, sent
/// to the treasury), mirroring `ClawdHQCore._releaseEscrow`.
fn release_job_escrow<'info>(
    protocol_state: &Account<'info, ProtocolState>,
    token_program: &Program<'info, Token>,
    vault: &Box<Account<'info, TokenAccount>>,
    agent_owner_usdc_ata: &Box<Account<'info, TokenAccount>>,
    treasury_usdc_ata: &Box<Account<'info, TokenAccount>>,
    budget: u64,
) -> Result<()> {
    let fee = (budget as u128 * protocol_state.protocol_fee_bps as u128 / 10_000) as u64;
    let payout = budget - fee;

    transfer_from_vault(protocol_state, token_program, vault, agent_owner_usdc_ata, payout)?;
    if fee > 0 {
        transfer_from_vault(protocol_state, token_program, vault, treasury_usdc_ata, fee)?;
    }
    Ok(())
}

/// Pays out a winning bid's escrowed `amount` from the vault to the seller (minus
/// `exchange_fee_bps`, sent to the treasury) — the agent-exchange analog of
/// `release_job_escrow`, using its own independent fee rate.
fn settle_sale<'info>(
    protocol_state: &Account<'info, ProtocolState>,
    token_program: &Program<'info, Token>,
    vault: &Box<Account<'info, TokenAccount>>,
    seller_usdc_ata: &Box<Account<'info, TokenAccount>>,
    treasury_usdc_ata: &Box<Account<'info, TokenAccount>>,
    amount: u64,
) -> Result<()> {
    let fee = (amount as u128 * protocol_state.exchange_fee_bps as u128 / 10_000) as u64;
    let payout = amount - fee;

    transfer_from_vault(protocol_state, token_program, vault, seller_usdc_ata, payout)?;
    if fee > 0 {
        transfer_from_vault(protocol_state, token_program, vault, treasury_usdc_ata, fee)?;
    }
    Ok(())
}

fn apply_job_completion_stats(
    agent: &mut Account<AgentState>,
    protocol: &mut Account<ProtocolState>,
    budget: u64,
    rating: u8,
    now: i64,
) -> Result<()> {
    let fee = (budget as u128 * protocol.protocol_fee_bps as u128 / 10_000) as u64;
    let payout = budget - fee;

    agent.jobs_completed += 1;
    agent.usdc_revenue += payout;
    agent.last_job_at = now;

    if rating > 0 {
        let prior_completed = (agent.jobs_completed - 1) as u128;
        let rating_bps = rating as u128 * 2_000;
        agent.reputation_bps = ((agent.reputation_bps as u128 * prior_completed + rating_bps) / agent.jobs_completed as u128) as u16;
    }

    protocol.total_volume += budget;
    Ok(())
}

fn name_hash(name: &str) -> [u8; 32] {
    hash(name.as_bytes()).to_bytes()
}

// ============================================================ Accounts =====

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer = authority, space = 8 + ProtocolState::INIT_SPACE, seeds = [PROTOCOL_SEED], bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = protocol_state
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        init,
        payer = owner,
        space = 8 + AgentState::INIT_SPACE,
        seeds = [AGENT_SEED, &protocol_state.next_agent_id.to_le_bytes()],
        bump
    )]
    pub agent_state: Account<'info, AgentState>,

    #[account(
        init,
        payer = owner,
        space = 8 + NameRecord::INIT_SPACE,
        seeds = [NAME_SEED, &name_hash(&name)],
        bump
    )]
    pub name_record: Account<'info, NameRecord>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = agent_state.bump,
        has_one = owner @ ClawError::NotAgentOwner
    )]
    pub agent_state: Account<'info, AgentState>,
}

#[derive(Accounts)]
pub struct SetAgentTier<'info> {
    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump, has_one = authority @ ClawError::Unauthorized)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,

    #[account(mut, seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,
}

#[derive(Accounts)]
pub struct SetAgentWallet<'info> {
    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump, has_one = registrar @ ClawError::Unauthorized)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub registrar: Signer<'info>,

    #[account(mut, seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,
}

#[derive(Accounts)]
pub struct PostJob<'info> {
    #[account(mut)]
    pub employer: Signer<'info>,

    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(seeds = [AGENT_SEED, &hired_agent.agent_id.to_le_bytes()], bump = hired_agent.bump)]
    pub hired_agent: Account<'info, AgentState>,

    #[account(
        init,
        payer = employer,
        space = 8 + JobState::INIT_SPACE,
        seeds = [JOB_SEED, &protocol_state.next_job_id.to_le_bytes()],
        bump
    )]
    pub job_state: Account<'info, JobState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = employer)]
    pub employer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptJob<'info> {
    pub agent_owner: Signer<'info>,

    #[account(seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,
}

#[derive(Accounts)]
pub struct SubmitDeliverable<'info> {
    pub agent_owner: Signer<'info>,

    #[account(seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,
}

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    pub employer: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// A bare account reference to `payout_authority(&agent_state)` — see `CreateLaunch`'s
    /// `agent_payout_authority` doc comment for why this indirection exists at all: Anchor's
    /// `associated_token::authority` position only tolerates a bare `<account>.<field>` path
    /// under its separate `idl-build` cfg, not a function call or even a plain ternary (both
    /// compile fine in the real program build, but not there) — routing the computation
    /// through a `constraint = ...` clause instead sidesteps that entirely.
    /// CHECK: only used as an authority reference for ATA derivation; never read or written.
    #[account(constraint = agent_payout_authority.key() == payout_authority(&agent_state) @ ClawError::Unauthorized)]
    pub agent_payout_authority: UncheckedAccount<'info>,

    /// The agent's earnings destination — its registered `agent_wallet` if set, otherwise
    /// `owner` (see `payout_authority`). Must already exist: the indexer's registrar creates
    /// this ATA once, right after `set_agent_wallet`, the same "system wallet sponsors the
    /// bootstrapping cost" shape the EVM port's gas top-up uses (see agentWalletClaim.ts's
    /// `ensureEvmGasForClaim`) — kept as a plain `mut` rather than `init_if_needed` here
    /// deliberately, since `auto_release_expired` below is permissionless (no Signer to charge
    /// rent to).
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = agent_payout_authority)]
    pub agent_payout_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DisputeJob<'info> {
    pub signer: Signer<'info>,

    #[account(seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,
}

#[derive(Accounts)]
pub struct CancelJob<'info> {
    pub employer: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = employer)]
    pub employer_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(release_to_agent: bool)]
pub struct ResolveDispute<'info> {
    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump, has_one = authority @ ClawError::Unauthorized)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,

    #[account(mut, seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// A bare account reference to the expected recipient authority — routed through a
    /// `constraint = ...` clause (see `CreateLaunch`'s `agent_payout_authority` doc comment for
    /// why `associated_token::authority` itself can't hold this expression directly).
    /// CHECK: only used as an authority reference for ATA derivation; never read or written.
    #[account(
        constraint = recipient_authority.key() == if release_to_agent { payout_authority(&agent_state) } else { job_state.employer } @ ClawError::Unauthorized
    )]
    pub recipient_authority: UncheckedAccount<'info>,

    /// Recipient of the escrow: the agent's payout destination (`payout_authority` — its
    /// registered wallet if set, else `owner`) if releasing to the agent, or the employer's
    /// ATA if refunding. Enforced via `recipient_authority` above rather than trusted from the
    /// caller directly.
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = recipient_authority)]
    pub recipient_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AutoReleaseExpired<'info> {
    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [AGENT_SEED, &job_state.hired_agent_id.to_le_bytes()], bump = agent_state.bump)]
    pub agent_state: Account<'info, AgentState>,

    #[account(mut, seeds = [JOB_SEED, &job_state.job_id.to_le_bytes()], bump = job_state.bump)]
    pub job_state: Account<'info, JobState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// A bare account reference to `payout_authority(&agent_state)` — see `CreateLaunch`'s
    /// `agent_payout_authority` doc comment for why this indirection exists at all.
    /// CHECK: only used as an authority reference for ATA derivation; never read or written.
    #[account(constraint = agent_payout_authority.key() == payout_authority(&agent_state) @ ClawError::Unauthorized)]
    pub agent_payout_authority: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = agent_payout_authority)]
    pub agent_payout_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    // Boxed (unlike this same field on smaller Accounts structs elsewhere in this file) —
    // CreateLaunch's account list is large enough (mint + 3 token accounts + an extra
    // agent_payout_authority reference on top of the usual protocol/agent/launch state) that
    // leaving ProtocolState/AgentState/LaunchState on the stack overflows the BPF VM's 4KB
    // frame limit at build time ("A function call... overwrites values in the frame"). Boxing
    // moves them to the heap; Box<Account<_>> derefs transparently so no call-site changes.
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Box<Account<'info, ProtocolState>>,

    #[account(
        seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = agent_state.bump,
        constraint = agent_state.owner == creator.key() @ ClawError::NotAgentOwner
    )]
    pub agent_state: Box<Account<'info, AgentState>>,

    #[account(
        init,
        payer = creator,
        space = 8 + LaunchState::INIT_SPACE,
        seeds = [LAUNCH_SEED, &protocol_state.next_launch_id.to_le_bytes()],
        bump
    )]
    pub launch_state: Box<Account<'info, LaunchState>>,

    #[account(init, payer = creator, mint::decimals = TOKEN_DECIMALS as u8, mint::authority = launch_state)]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = launch_state
    )]
    pub launch_reserve: Box<Account<'info, TokenAccount>>,

    /// A bare account reference to `payout_authority(&agent_state)` — Anchor's `init_if_needed`
    /// associated-token-account codegen needs an actual account it can call `.to_account_info()`
    /// on for the create-ATA CPI, not just a computed `Pubkey` (a plain `mut`-only ATA
    /// constraint, as `ConfirmDelivery`/`AutoReleaseExpired` use, doesn't have this restriction
    /// since it never creates anything — only `init`/`init_if_needed` does). The constraint
    /// below is what actually keeps this trustworthy: the client can pass any account here, but
    /// it must be the agent's real payout authority or the transaction reverts.
    /// CHECK: only used as an authority reference for ATA derivation; never read or written.
    #[account(constraint = agent_payout_authority.key() == payout_authority(&agent_state) @ ClawError::Unauthorized)]
    pub agent_payout_authority: UncheckedAccount<'info>,

    /// The creator allocation's destination — the agent's registered wallet if set, otherwise
    /// `creator` itself (== `agent_state.owner`, enforced above) — see `payout_authority`.
    /// `init_if_needed` here doubles as how the agent wallet's own token ATA for this launch's
    /// mint gets created on first use, paid for by `creator` (who's already paying to create
    /// this launch) rather than needing a separate provisioning step.
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = agent_payout_authority
    )]
    pub creator_token_ata: Box<Account<'info, TokenAccount>>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = creator)]
    pub creator_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [LAUNCH_SEED, &launch_state.launch_id.to_le_bytes()], bump = launch_state.bump)]
    pub launch_state: Account<'info, LaunchState>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + BuyerPosition::INIT_SPACE,
        seeds = [BUYER_POSITION_SEED, &launch_state.launch_id.to_le_bytes(), buyer.key().as_ref()],
        bump
    )]
    pub buyer_position: Account<'info, BuyerPosition>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = buyer)]
    pub buyer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(address = launch_state.token_mint)]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = token_mint, associated_token::authority = launch_state)]
    pub launch_reserve: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [LAUNCH_SEED, &launch_state.launch_id.to_le_bytes()], bump = launch_state.bump)]
    pub launch_state: Account<'info, LaunchState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = seller)]
    pub seller_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = launch_state.token_mint, associated_token::authority = seller)]
    pub seller_token_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = launch_state.token_mint, associated_token::authority = launch_state)]
    pub launch_reserve: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GraduateLaunch<'info> {
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [LAUNCH_SEED, &launch_state.launch_id.to_le_bytes()], bump = launch_state.bump)]
    pub launch_state: Account<'info, LaunchState>,
}

#[derive(Accounts)]
pub struct UpdateProtocolParams<'info> {
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump, has_one = authority @ ClawError::Unauthorized)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = agent_state.bump,
        constraint = agent_state.owner == seller.key() @ ClawError::NotAgentOwner
    )]
    pub agent_state: Account<'info, AgentState>,

    #[account(
        init,
        payer = seller,
        space = 8 + ListingState::INIT_SPACE,
        seeds = [LISTING_SEED, &protocol_state.next_listing_id.to_le_bytes()],
        bump
    )]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + ActiveListingMarker::INIT_SPACE,
        seeds = [ACTIVE_LISTING_SEED, &agent_state.agent_id.to_le_bytes()],
        bump
    )]
    pub active_listing_marker: Account<'info, ActiveListingMarker>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, &listing_state.listing_id.to_le_bytes()],
        bump = listing_state.bump,
        has_one = seller @ ClawError::NotAgentOwner
    )]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        mut,
        seeds = [ACTIVE_LISTING_SEED, &listing_state.agent_id.to_le_bytes()],
        bump = active_listing_marker.bump
    )]
    pub active_listing_marker: Account<'info, ActiveListingMarker>,
}

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(mut, seeds = [LISTING_SEED, &listing_state.listing_id.to_le_bytes()], bump = listing_state.bump)]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        init,
        payer = bidder,
        space = 8 + BidState::INIT_SPACE,
        seeds = [BID_SEED, &protocol_state.next_bid_id.to_le_bytes()],
        bump
    )]
    pub bid_state: Account<'info, BidState>,

    /// Present only when this is an Auction listing that already has a highest bid —
    /// that previous-highest bid, refunded here as it's outbid. Omitted by the client for
    /// Open-mode bids or a listing's first Auction bid.
    #[account(
        mut,
        seeds = [BID_SEED, &listing_state.highest_bid_id.to_le_bytes()],
        bump = previous_highest_bid.bump
    )]
    pub previous_highest_bid: Option<Account<'info, BidState>>,

    /// Present exactly when `previous_highest_bid` is — the previous bidder's USDC ATA to
    /// refund. Ownership of this account is re-checked in the handler against
    /// `previous_highest_bid.bidder` before any transfer, since the two Optionals can't be
    /// declaratively correlated by Anchor's account-constraint macro.
    #[account(mut)]
    pub previous_highest_bidder_usdc_ata: Option<Box<Account<'info, TokenAccount>>>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = bidder)]
    pub bidder_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawBid<'info> {
    pub bidder: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(seeds = [LISTING_SEED, &listing_state.listing_id.to_le_bytes()], bump = listing_state.bump)]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        mut,
        seeds = [BID_SEED, &bid_state.bid_id.to_le_bytes()],
        bump = bid_state.bump,
        has_one = bidder @ ClawError::NotAgentOwner,
        constraint = bid_state.listing_id == listing_state.listing_id @ ClawError::BidNotActive
    )]
    pub bid_state: Account<'info, BidState>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = bidder)]
    pub bidder_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AcceptBid<'info> {
    pub seller: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = agent_state.bump
    )]
    pub agent_state: Account<'info, AgentState>,

    #[account(
        mut,
        seeds = [LISTING_SEED, &listing_state.listing_id.to_le_bytes()],
        bump = listing_state.bump,
        has_one = seller @ ClawError::NotAgentOwner,
        constraint = listing_state.agent_id == agent_state.agent_id @ ClawError::InvalidListingParams
    )]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        mut,
        seeds = [BID_SEED, &bid_state.bid_id.to_le_bytes()],
        bump = bid_state.bump,
        constraint = bid_state.listing_id == listing_state.listing_id @ ClawError::BidNotActive
    )]
    pub bid_state: Account<'info, BidState>,

    #[account(
        mut,
        seeds = [ACTIVE_LISTING_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = active_listing_marker.bump
    )]
    pub active_listing_marker: Account<'info, ActiveListingMarker>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = seller)]
    pub seller_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettleAuction<'info> {
    #[account(seeds = [PROTOCOL_SEED], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [AGENT_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = agent_state.bump
    )]
    pub agent_state: Account<'info, AgentState>,

    #[account(
        mut,
        seeds = [LISTING_SEED, &listing_state.listing_id.to_le_bytes()],
        bump = listing_state.bump,
        constraint = listing_state.agent_id == agent_state.agent_id @ ClawError::InvalidListingParams
    )]
    pub listing_state: Account<'info, ListingState>,

    #[account(
        mut,
        seeds = [ACTIVE_LISTING_SEED, &agent_state.agent_id.to_le_bytes()],
        bump = active_listing_marker.bump
    )]
    pub active_listing_marker: Account<'info, ActiveListingMarker>,

    /// Present only if the listing actually received a bid (`highest_bid_id != 0`) — the
    /// winning bid, if the auction is to be settled as a sale.
    #[account(
        mut,
        seeds = [BID_SEED, &listing_state.highest_bid_id.to_le_bytes()],
        bump = highest_bid.bump
    )]
    pub highest_bid: Option<Account<'info, BidState>>,

    #[account(address = protocol_state.usdc_mint)]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// Present exactly when `highest_bid` is and its amount met the reserve — the seller's
    /// USDC ATA to pay out. Omitted by the client when settling an unsold/no-bid auction.
    /// Ownership is re-checked in the handler against `listing_state.seller`, same reasoning
    /// as `previous_highest_bidder_usdc_ata` in `PlaceBid`.
    #[account(mut)]
    pub seller_usdc_ata: Option<Box<Account<'info, TokenAccount>>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = protocol_state.fee_recipient)]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}
