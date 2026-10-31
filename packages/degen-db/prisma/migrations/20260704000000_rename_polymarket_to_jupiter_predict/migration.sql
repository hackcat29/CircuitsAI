-- Polymarket integration replaced with Jupiter's Prediction Market API (Solana-native) after
-- discovering Polymarket's own CLOB V2 upgrade had deprecated the client library this app was
-- built against. RENAME VALUE preserves any existing rows (TradingWallet/TradingOrder/Position)
-- that reference the old label rather than requiring a data migration.
ALTER TYPE "Venue" RENAME VALUE 'POLYMARKET' TO 'JUPITER_PREDICT';
