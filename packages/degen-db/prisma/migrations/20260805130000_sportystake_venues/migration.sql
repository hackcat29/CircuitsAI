-- ARC_TESTNET was missing from this schema's Chain enum entirely — a pre-existing drift bug
-- against marketplace-db's copy (see schema.prisma's own note on this enum). Adding it is a hard
-- prerequisite for the two new venues below, both Arc-only.
ALTER TYPE "Chain" ADD VALUE 'ARC_TESTNET';

-- New venues: both backed by sportystake's BettingCore contract on Arc.
ALTER TYPE "Venue" ADD VALUE 'SPORTYSTAKE_PREDICTIONS';
ALTER TYPE "Venue" ADD VALUE 'SPORTYSTAKE_SPORTSBOOK';

-- CreateEnum
CREATE TYPE "BetSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED');

-- CreateTable
CREATE TABLE "PendingBetSettlement" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "tradingOrderId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "stakeUsdc" DECIMAL(30,10) NOT NULL,
    "oddsAtEntry" DECIMAL(30,10) NOT NULL,
    "status" "BetSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "PendingBetSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingBetSettlement_status_chain_idx" ON "PendingBetSettlement"("status", "chain");

-- CreateIndex
CREATE INDEX "PendingBetSettlement_market_idx" ON "PendingBetSettlement"("market");
