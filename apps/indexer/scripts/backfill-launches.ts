import "../src/loadEnv.js";
import { createPublicClient, http } from "viem";
import { clawdHQLaunchpadAbi } from "@clawdhq/sdk";
import { loadAllEvmChainConfigs, type EvmChainIndexerConfig } from "../src/config.js";
import { syncLaunch } from "../src/listeners/evm.js";

// One-off backfill for the Launch table added in marketplace-db's
// 20260729000000_add_launch_and_metadata migration — same shape as backfill-agents.ts, for the
// same reason: the indexer's event-log cursor is already past every existing launch's
// LaunchCreated block, so processBatch will never see those events again. This script seeds
// every launch that already existed before the Launch table did, by walking totalLaunches()
// directly rather than replaying history. Idempotent (syncLaunch upserts), safe to re-run.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry<T>(fn: () => Promise<T>, label: string, isArc: boolean): Promise<T> {
  const attempts = isArc ? 10 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      console.log(`[backfill-launches] ${label} failed (attempt ${attempt}/${attempts}), retrying in 2s: ${err instanceof Error ? err.message : err}`);
      await sleep(2_000);
    }
  }
  throw new Error("unreachable");
}

async function backfillChain(config: EvmChainIndexerConfig): Promise<void> {
  const isArc = config.chain === "arc";
  const publicClient = createPublicClient({
    transport: isArc ? http(config.rpcUrl, { retryCount: 5, retryDelay: 1_000 }) : http(config.rpcUrl),
  });

  const totalLaunches = await withRateLimitRetry(
    () => publicClient.readContract({ address: config.launchpadAddress, abi: clawdHQLaunchpadAbi, functionName: "totalLaunches" }) as Promise<bigint>,
    `${config.chain}:totalLaunches`,
    isArc,
  );

  console.log(`[backfill-launches:${config.chain}] totalLaunches=${totalLaunches}`);

  for (let id = 1n; id <= totalLaunches; id++) {
    if (isArc) await sleep(1_200);
    await withRateLimitRetry(() => syncLaunch(publicClient, config, id), `${config.chain}:launch(${id})`, isArc);
    console.log(`[backfill-launches:${config.chain}] synced launch ${id}/${totalLaunches}`);
  }
}

async function main(): Promise<void> {
  const configs = loadAllEvmChainConfigs();
  for (const config of configs) {
    await backfillChain(config);
  }
  console.log("[backfill-launches] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-launches] failed:", err);
    process.exit(1);
  });
