/// A 6-decimal test stablecoin, mirroring `MockUSDC` (EVM) and the Devnet USDC mint
/// (Solana) used elsewhere in ClawdHQ. Testnet-only — never deploy this on mainnet.
module clawdhq_agent::usdc;

use sui::coin::{Self, TreasuryCap};
use sui::url;

public struct USDC has drop {}

fun init(witness: USDC, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        6,
        b"USDC",
        b"Test USD Coin",
        b"Testnet-only USDC for the ClawdHQ protocol",
        option::none<url::Url>(),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender());
}

public fun mint(treasury: &mut TreasuryCap<USDC>, amount: u64, recipient: address, ctx: &mut TxContext) {
    let coin = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(coin, recipient);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(USDC {}, ctx)
}
