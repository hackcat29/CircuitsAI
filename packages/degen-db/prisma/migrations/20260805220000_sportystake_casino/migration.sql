-- New venue: covers both sportystake CasinoHouse (instant-resolve Dice/Slots/Blackjack/
-- Roulette/Baccarat) and CrashGame (multiplayer rounds), dispatched by the `market` string's
-- prefix — see venues/sportystakeCasino.ts.
ALTER TYPE "Venue" ADD VALUE 'SPORTYSTAKE_CASINO';

-- AlterTable
ALTER TABLE "PendingBetSettlement" ADD COLUMN "metadata" JSONB;
