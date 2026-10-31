-- ClawdHQLaunchpad.sol's on-chain scheduled-launch gate: buyTokens/sellTokens now revert
-- (LaunchNotStarted) before AgentLaunch.tradingStartsAt, a new trailing struct field. Defaults
-- to the epoch here (not "now") to match the contract's own zero-value semantics — 0 there means
-- "trading opens immediately," which epoch does too for every already-live launch — and every row
-- gets its real value back the next time the indexer's syncLaunch re-reads this launch on-chain.
ALTER TABLE "Launch" ADD COLUMN IF NOT EXISTS "tradingStartsAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00'::timestamp;
