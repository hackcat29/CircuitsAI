-- CreateTable
CREATE TABLE IF NOT EXISTS "SquadBundle" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL DEFAULT 'ARC_TESTNET',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priceUsdc" DECIMAL(12,2) NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "tags" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "totalVolumeUsdc" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SquadMember" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "agentChainId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "splitBps" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SquadHire" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
    "jobChainIds" TEXT[],
    "deliverable" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadHire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SquadBundle_chain_category_isPublished_idx" ON "SquadBundle"("chain", "category", "isPublished");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SquadBundle_creatorAddress_idx" ON "SquadBundle"("creatorAddress");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SquadMember_agentChainId_idx" ON "SquadMember"("agentChainId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SquadMember_bundleId_agentChainId_key" ON "SquadMember"("bundleId", "agentChainId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SquadHire_bundleId_idx" ON "SquadHire"("bundleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SquadHire_buyerAddress_idx" ON "SquadHire"("buyerAddress");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'SquadMember_bundleId_fkey'
    ) THEN
        ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SquadBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'SquadHire_bundleId_fkey'
    ) THEN
        ALTER TABLE "SquadHire" ADD CONSTRAINT "SquadHire_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SquadBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
