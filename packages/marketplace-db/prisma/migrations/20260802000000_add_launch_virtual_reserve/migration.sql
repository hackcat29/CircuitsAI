-- ClawdHQLaunchpad's v3 constant-product curve adds initialVirtualUsdcReserve as a new trailing
-- struct field (see the contract's own doc comment). Additive, default 0 — a launch created
-- before this upgrade shows 0 here until backfilled via a fresh syncLaunch (which re-reads the
-- live on-chain value, itself 0 until an admin runs migrateLaunchVirtualLiquidity for it).
ALTER TABLE "Launch" ADD COLUMN IF NOT EXISTS "initialVirtualUsdcReserve" BIGINT NOT NULL DEFAULT 0;
