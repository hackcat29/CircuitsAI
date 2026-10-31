-- Fixes a real overflow: these columns store 18-decimal-raw AgentToken amounts
-- (TOTAL_AGENT_TOKEN_SUPPLY = 1e9 whole tokens = 1e27 raw units), but BIGINT is a signed
-- 8-byte integer (max ~9.22e18) — any trade beyond ~9.22 whole tokens, or any launch's
-- totalSupply/tokensSold, silently exceeds that range. Discovered while smoke-testing the
-- Launchpad rebuild (an insert of a realistic-scale test row failed with a numeric-overflow
-- error). NUMERIC(78,0) comfortably covers any uint256 value.
-- No data migration needed in this local dev database (both tables are empty here) — any
-- existing row elsewhere would already have tokenAmount/totalSupply/tokensSold below the old
-- BIGINT ceiling (~9.22 whole tokens' worth of raw units), since a write past that would have
-- failed rather than silently truncated; a plain ALTER COLUMN TYPE is safe either way.

-- AlterTable
ALTER TABLE "Launch" ALTER COLUMN "totalSupply" TYPE DECIMAL(78,0);
ALTER TABLE "Launch" ALTER COLUMN "tokensSold" TYPE DECIMAL(78,0);

-- AlterTable
ALTER TABLE "LaunchTrade" ALTER COLUMN "tokenAmount" TYPE DECIMAL(78,0);
