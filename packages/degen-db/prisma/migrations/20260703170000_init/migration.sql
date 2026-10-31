-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('BSC_TESTNET', 'BASE_SEPOLIA', 'ETH_SEPOLIA', 'SOLANA_DEVNET', 'SUI_TESTNET');

-- CreateEnum
CREATE TYPE "Venue" AS ENUM ('HYPERLIQUID', 'PUMPFUN', 'CLAWDHQ_LAUNCH', 'POLYMARKET');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('PAPER', 'LIVE');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('FILLED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "RiskEventKind" AS ENUM ('POSITION_CAP', 'DAILY_LOSS', 'KILL_SWITCH', 'GRADUATION_GUARD', 'VENUE_NOT_ALLOWED');

-- CreateTable
CREATE TABLE "TradingAgentConfig" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'PAPER',
    "killSwitchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "killedAt" TIMESTAMP(3),
    "killedReason" TEXT,
    "allowedVenues" "Venue"[],
    "maxPositionUsdc" DECIMAL(30,10) NOT NULL,
    "maxDailyLossUsdc" DECIMAL(30,10) NOT NULL,
    "paperBankrollUsdc" DECIMAL(30,10) NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingWallet" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradingWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingOrder" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "mode" "Mode" NOT NULL,
    "clientOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "requestedUsdc" DECIMAL(30,10) NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "fillPrice" DECIMAL(30,10),
    "txHashOrRef" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "venue" "Venue" NOT NULL,
    "mode" "Mode" NOT NULL,
    "market" TEXT NOT NULL,
    "netSizeUsdc" DECIMAL(30,10) NOT NULL DEFAULT 0,
    "avgEntryPrice" DECIMAL(30,10),
    "realizedPnlUsdc" DECIMAL(30,10) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "kind" "RiskEventKind" NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingAgentConfig_chain_agentChainId_key" ON "TradingAgentConfig"("chain", "agentChainId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingWallet_chain_agentChainId_venue_key" ON "TradingWallet"("chain", "agentChainId", "venue");

-- CreateIndex
CREATE INDEX "TradingOrder_chain_agentChainId_createdAt_idx" ON "TradingOrder"("chain", "agentChainId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TradingOrder_chain_agentChainId_venue_mode_clientOrderId_key" ON "TradingOrder"("chain", "agentChainId", "venue", "mode", "clientOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_chain_agentChainId_venue_mode_market_key" ON "Position"("chain", "agentChainId", "venue", "mode", "market");

-- CreateIndex
CREATE INDEX "RiskEvent_chain_agentChainId_createdAt_idx" ON "RiskEvent"("chain", "agentChainId", "createdAt");
