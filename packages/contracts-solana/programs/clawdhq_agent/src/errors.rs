use anchor_lang::prelude::*;

#[error_code]
pub enum ClawError {
    #[msg("Agent name is already taken")]
    NameTaken,
    #[msg("Agent name must be 1-64 bytes")]
    NameTooLong,
    #[msg("Caller is not the agent owner")]
    NotAgentOwner,
    #[msg("Agent is not active")]
    AgentNotActive,
    #[msg("Tier value is invalid")]
    TierInvalid,
    #[msg("Job is not in the required status for this action")]
    InvalidJobStatus,
    #[msg("Caller is not the job's employer")]
    NotEmployer,
    #[msg("Caller is neither the employer nor the agent owner")]
    NotEmployerOrAgentOwner,
    #[msg("Job deadline has not yet passed")]
    DeadlineNotPassed,
    #[msg("Job deadline has already passed")]
    DeadlinePassed,
    #[msg("Rating must be between 1 and 5")]
    InvalidRating,
    #[msg("No deliverable has been submitted for this job")]
    NoDeliverableSubmitted,
    #[msg("Creator allocation exceeds the maximum allowed")]
    ExcessiveCreatorAlloc,
    #[msg("This agent already has an active launch")]
    AlreadyLaunched,
    #[msg("Launch is not active")]
    LaunchNotActive,
    #[msg("Purchase would exceed the anti-snipe per-wallet cap")]
    AntiSnipeActive,
    #[msg("Graduation threshold has not been met")]
    ThresholdNotMet,
    #[msg("Launch has already graduated")]
    AlreadyGraduated,
    #[msg("Resulting amount violates the caller's slippage tolerance")]
    SlippageExceeded,
    #[msg("Insufficient funds for this operation")]
    InsufficientFunds,
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
    #[msg("Protocol is paused")]
    Paused,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Amount must be a non-zero, whole number of tokens")]
    InvalidTokenAmount,
    #[msg("Sell amount exceeds tokens currently sold")]
    InsufficientTokensSold,
    #[msg("This agent already has an active listing")]
    AlreadyListed,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("This action is not valid for the listing's mode")]
    WrongListingMode,
    #[msg("Invalid listing parameters for this mode")]
    InvalidListingParams,
    #[msg("Bid amount must be non-zero and, for auctions, strictly higher than the current highest bid")]
    BidTooLow,
    #[msg("Bid is not active (already accepted, settled, or withdrawn)")]
    BidNotActive,
    #[msg("This bid cannot be withdrawn right now")]
    BidNotWithdrawable,
    #[msg("Auction end time has already passed")]
    AuctionEnded,
    #[msg("Auction end time has not passed yet")]
    AuctionNotEnded,
    #[msg("Cannot cancel an auction that already has a bid")]
    CannotCancelAuctionWithBids,
    #[msg("This agent's wallet has already been set")]
    WalletAlreadySet,
    #[msg("Wallet address cannot be the default (all-zero) pubkey")]
    ZeroPubkey,
}
