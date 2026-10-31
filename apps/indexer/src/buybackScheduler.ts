import "./loadEnv.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EvmLaunchpadAdapter, httpWithRateLimitRetry } from "@clawdhq/sdk";
import { prisma, type Chain as PrismaChain } from "@clawdhq/marketplace-db";
import { getOrCreateRegistrarWallet, getDecryptedRegistrarWallet, viemChainFor, rpcTransportFor, type EvmPrismaChain } from "@clawdhq/custody-core";
import { loadAllEvmChainConfigs, type EvmChainIndexerConfig } from "./config.js";

// ClawdHQLaunchpad.executeBuyback is permissionless by design (see its own NatSpec) — this
// process is simply the protocol's own operator for it, not a required caller. A creator's role
// in the buyback mechanism is limited to choosing its cadence once, at createLaunch time
// (BuybackInterval); nothing about actually triggering execution depends on the creator's own
// wallet staying active or online.
//
// No off-chain claim/lock is needed the way scheduler.ts's Subscription table has one: the
// contract's own on-chain state (`nextBuybackAt`/`buybackPoolUsdc`) is the real source of truth,
// and executeBuyback already reverts (BuybackNotDue/NoBuybackPool) if called when not actually
// due — a race between two callers (this scheduler and, say, a third party manually calling it)
// just wastes one of the two transactions' gas, never double-executes.

const TICK_INTERVAL_MS = Number(process.env.BUYBACK_SCHEDULER_TICK_INTERVAL_MS ?? 60_000);
const MAX_LAUNCHES_PER_TICK = 25;

let shuttingDown = false;
let tickInFlight = false;

function toCustodyChain(chain: PrismaChain): EvmPrismaChain {
  return chain as unknown as EvmPrismaChain;
}

async function runDueBuyback(config: EvmChainIndexerConfig, launchChainId: string): Promise<void> {
  const custodyChain = toCustodyChain(config.prismaChain);
  await getOrCreateRegistrarWallet(custodyChain);
  const registrar = await getDecryptedRegistrarWallet(custodyChain);
  if (!registrar) {
    console.error(`[buyback-scheduler:${config.chain}] no RegistrarWallet available — cannot run buyback for launch ${launchChainId}`);
    return;
  }

  const account = privateKeyToAccount(registrar.privateKey as `0x${string}`);
  const publicClient = createPublicClient({
    transport: config.chain === "arc" ? httpWithRateLimitRetry(config.rpcUrl) : http(config.rpcUrl),
  });
  const walletClient = createWalletClient({ account, chain: viemChainFor(custodyChain), transport: rpcTransportFor(custodyChain) });

  const launchpad = new EvmLaunchpadAdapter({ contractAddress: config.launchpadAddress, publicClient, walletClient });
  const hash = await launchpad.executeBuyback(BigInt(launchChainId));
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[buyback-scheduler:${config.chain}] executed buyback for launch ${launchChainId}: ${hash}`);
}

async function tick(): Promise<void> {
  const configs = loadAllEvmChainConfigs();
  const now = new Date();

  for (const config of configs) {
    const due = await prisma.launch.findMany({
      where: { chain: config.prismaChain, active: true, graduated: false, nextBuybackAt: { lte: now }, buybackBps: { gt: 0 } },
      take: MAX_LAUNCHES_PER_TICK,
      select: { launchChainId: true },
    });
    if (due.length === 0) continue;
    console.log(`[buyback-scheduler:${config.chain}] ${due.length} launch(es) due`);

    for (const launch of due) {
      try {
        await runDueBuyback(config, launch.launchChainId);
      } catch (error) {
        // One launch's failure (e.g. a since-graduated launch the cache hasn't caught up on
        // yet, so the on-chain call reverts LaunchNotActive) shouldn't stop the rest of this
        // chain's due launches, or the other chains, from being tried this tick.
        console.error(`[buyback-scheduler:${config.chain}] launch ${launch.launchChainId} failed:`, error instanceof Error ? error.message : error);
      }
    }
  }
}

async function runTick(): Promise<void> {
  if (tickInFlight || shuttingDown) return;
  tickInFlight = true;
  try {
    await tick();
  } catch (error) {
    console.error("[buyback-scheduler] tick failed:", error);
  } finally {
    tickInFlight = false;
  }
}

async function main(): Promise<void> {
  console.log(`[buyback-scheduler] starting — tick every ${TICK_INTERVAL_MS}ms`);

  await runTick();
  const interval = setInterval(runTick, TICK_INTERVAL_MS);

  const shutdown = (signal: string) => {
    console.log(`[buyback-scheduler] ${signal} received, stopping new ticks (in-flight work is left to finish)`);
    shuttingDown = true;
    clearInterval(interval);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[buyback-scheduler] fatal error", error);
  process.exitCode = 1;
});
