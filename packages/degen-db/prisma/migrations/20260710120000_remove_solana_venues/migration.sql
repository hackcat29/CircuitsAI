-- Pump.fun and Jupiter Predict (both Solana-native) are removed as trading venues alongside the
-- rest of the app's Solana/Sui/BSC removal. Postgres has no direct DROP VALUE for enums, so this
-- recreates the type without the two removed members and repoints every column that used it.
-- Safe here because no existing TradingWallet/TradingOrder/Position/TradingAgentConfig row
-- references either value (verified before writing this migration).
CREATE TYPE "Venue_new" AS ENUM ('HYPERLIQUID', 'CLAWDHQ_LAUNCH');

ALTER TABLE "TradingWallet" ALTER COLUMN "venue" TYPE "Venue_new" USING ("venue"::text::"Venue_new");
ALTER TABLE "TradingOrder" ALTER COLUMN "venue" TYPE "Venue_new" USING ("venue"::text::"Venue_new");
ALTER TABLE "Position" ALTER COLUMN "venue" TYPE "Venue_new" USING ("venue"::text::"Venue_new");
ALTER TABLE "TradingAgentConfig" ALTER COLUMN "allowedVenues" TYPE "Venue_new"[] USING ("allowedVenues"::text[]::"Venue_new"[]);

DROP TYPE "Venue";
ALTER TYPE "Venue_new" RENAME TO "Venue";
