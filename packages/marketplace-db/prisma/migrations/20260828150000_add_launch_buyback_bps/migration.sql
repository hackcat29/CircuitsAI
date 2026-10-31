-- Adds buybackBps (basis points of Agent Operating Treasury to spend per buyback, e.g. 2000 = 20%)
-- to Launch table. Default 2000 (20%) for backwards compatibility.
ALTER TABLE "Launch" ADD COLUMN IF NOT EXISTS "buybackBps" INTEGER NOT NULL DEFAULT 2000;
