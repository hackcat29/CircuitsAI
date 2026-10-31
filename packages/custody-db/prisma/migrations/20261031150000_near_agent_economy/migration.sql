ALTER TYPE "AgentWalletCustodyType" ADD VALUE 'NEAR_CHAIN_SIGNATURES';
ALTER TYPE "LlmProvider" ADD VALUE 'NEAR_AI';
ALTER TABLE "AgentWallet" ADD COLUMN "nearAccountId" TEXT, ADD COLUMN "nearNetwork" TEXT;
CREATE TABLE "NearPaymentIntent" (
  "id" TEXT NOT NULL PRIMARY KEY, "listingId" TEXT NOT NULL, "callerAddress" TEXT NOT NULL,
  "recipient" TEXT NOT NULL, "destinationAsset" TEXT NOT NULL, "amountMicros" TEXT NOT NULL,
  "depositAddress" TEXT NOT NULL, "depositMemo" TEXT, "quoteJson" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "redeemedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NearPaymentIntent_depositAddress_key" ON "NearPaymentIntent"("depositAddress");
CREATE INDEX "NearPaymentIntent_listingId_callerAddress_idx" ON "NearPaymentIntent"("listingId", "callerAddress");
CREATE TABLE "NearInferenceEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY, "chain" "Chain" NOT NULL, "agentChainId" TEXT NOT NULL,
  "completionId" TEXT NOT NULL, "model" TEXT NOT NULL, "signatureKind" TEXT NOT NULL, "evidenceJson" TEXT,
  "verified" BOOLEAN NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "NearInferenceEvidence_completionId_key" ON "NearInferenceEvidence"("completionId");
CREATE INDEX "NearInferenceEvidence_chain_agentChainId_verifiedAt_idx" ON "NearInferenceEvidence"("chain", "agentChainId", "verifiedAt");
