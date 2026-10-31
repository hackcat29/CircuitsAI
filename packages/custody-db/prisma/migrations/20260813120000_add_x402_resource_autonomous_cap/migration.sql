-- Per-call ceiling for the hosted-runtime tick loop's own PAY_X402_RESOURCE decision — see
-- AgentSpendPolicy.autonomousX402ResourceCapUsdc's own doc comment in schema.prisma. Nullable,
-- no default: null means the owner hasn't opted the autonomous loop into this action at all,
-- which is the correct behavior for every existing policy row (this action didn't exist before
-- this migration, so nothing should retroactively start using it).
ALTER TABLE "AgentSpendPolicy" ADD COLUMN "autonomousX402ResourceCapUsdc" DECIMAL(30,10);
