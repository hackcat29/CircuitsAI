import { loadRuntimeConfig } from "./config.js";
import { defaultPolicy } from "./policy.js";
import { buildAdapter, tick, type TickDeps } from "./runtime.js";
import { loadState, saveState } from "./state.js";

// Same "plain setInterval tick loop, one process, graceful SIGTERM/SIGINT" shape as
// apps/indexer/src/scheduler.ts — this is that same pattern applied to the hired-agent side of
// a job instead of the employer side (subscriptions only ever auto-*post* jobs; nothing
// previously auto-accepted or auto-delivered one). Unlike the scheduler, there's no shared
// Postgres row to lock against concurrent instances — an owner is expected to run exactly one
// of these per agent, coordinated by STATE_FILE_PATH being process-local.

let shuttingDown = false;
let tickInFlight = false;

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const adapter = buildAdapter(config);
  const policy = defaultPolicy(config);
  const deps: TickDeps = { adapter, config, policy };

  console.log(`[agent-runtime] starting — agent #${config.agentChainId} on ${config.chain}, tick every ${config.pollIntervalMs}ms`);

  async function runTick(): Promise<void> {
    if (tickInFlight || shuttingDown) return;
    tickInFlight = true;
    try {
      const state = loadState(config.stateFilePath);
      const next = await tick(deps, state);
      saveState(config.stateFilePath, next);
    } catch (error) {
      // A systemic failure (RPC down, task-description API unreachable) — log and let the next
      // interval retry, rather than crashing. Anything scoped to a single job is already
      // caught inside tick()/attemptDelivery, so reaching here means something broader.
      console.error("[agent-runtime] tick failed:", error);
    } finally {
      tickInFlight = false;
    }
  }

  await runTick();
  const interval = setInterval(runTick, config.pollIntervalMs);

  const shutdown = (signal: string) => {
    console.log(`[agent-runtime] ${signal} received, stopping new ticks (in-flight work is left to finish)`);
    shuttingDown = true;
    clearInterval(interval);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[agent-runtime] fatal error", error);
  process.exitCode = 1;
});
