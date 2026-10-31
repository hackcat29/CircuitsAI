-- CreateEnum
CREATE TYPE "LaunchBuybackInterval" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "launchChainId" TEXT NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "totalSupply" BIGINT NOT NULL,
    "usdcRaised" BIGINT NOT NULL,
    "tokensSold" BIGINT NOT NULL,
    "graduationThreshold" BIGINT NOT NULL,
    "bondingBasePrice" BIGINT NOT NULL,
    "bondingSlope" BIGINT NOT NULL,
    "buybackPoolUsdc" BIGINT NOT NULL,
    "buybackInterval" "LaunchBuybackInterval" NOT NULL,
    "nextBuybackAt" TIMESTAMP(3) NOT NULL,
    "graduated" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAtChain" TIMESTAMP(3) NOT NULL,
    "graduatedAtChain" TIMESTAMP(3),
    "updatedAtChain" TIMESTAMP(3) NOT NULL,
    "lastIndexedAt" BIGINT,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchMetadata" (
    "chain" "Chain" NOT NULL,
    "launchChainId" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "twitterUrl" TEXT,
    "telegramUrl" TEXT,
    "description" TEXT,
    "team" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchMetadata_pkey" PRIMARY KEY ("chain","launchChainId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Launch_chain_launchChainId_key" ON "Launch"("chain", "launchChainId");

-- CreateIndex
CREATE INDEX "Launch_chain_graduated_graduatedAtChain_idx" ON "Launch"("chain", "graduated", "graduatedAtChain");

-- CreateIndex
CREATE INDEX "Launch_chain_active_idx" ON "Launch"("chain", "active");

-- CreateIndex
CREATE INDEX "Launch_agentChainId_idx" ON "Launch"("agentChainId");

-- CreateIndex
CREATE INDEX "LaunchTrade_chain_launchChainId_createdAtChain_idx" ON "LaunchTrade"("chain", "launchChainId", "createdAtChain");
