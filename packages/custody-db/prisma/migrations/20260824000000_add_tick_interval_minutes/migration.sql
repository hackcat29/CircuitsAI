-- Add tickIntervalMinutes to HostedRuntimeConfig with default 60 (hourly)
ALTER TABLE "HostedRuntimeConfig" ADD COLUMN IF NOT EXISTS "tickIntervalMinutes" INTEGER NOT NULL DEFAULT 60;
