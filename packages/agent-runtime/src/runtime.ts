import { getSigningEvmAdapter, localEvmSigner } from "@clawdhq/custody-core";
import type { EvmAdapter } from "@clawdhq/sdk";
import type { RuntimeConfig } from "./config.js";
import type { JobDecisionPolicy } from "./policy.js";
import { a2aTaskHandler, type TaskHandler } from "./taskHandler.js";
import { fetchTaskDescription } from "./descriptionStore.js";
import { sha256Hex } from "./hash.js";
import type { RuntimeState } from "./state.js";

const JOB_STATUS_PENDING = 0;
const JOB_STATUS_ACTIVE = 1;
// Bounds how many never-before-seen job ids one tick will fetch+evaluate — a burst of jobs
// posted to the whole protocol between ticks (almost none of them hired to this agent)
// shouldn't make a single tick run arbitrarily long; the remainder just gets picked up on
// later ticks since lastScannedJobId only advances by what was actually processed.
const MAX_NEW_JOBS_PER_TICK = 200;

export function buildAdapter(config: RuntimeConfig): EvmAdapter {
  return getSigningEvmAdapter(config.chain, localEvmSigner(config.chain, config.ownerPrivateKey));
}

export interface TickDeps {
  adapter: EvmAdapter;
  config: RuntimeConfig;
  policy: JobDecisionPolicy;
  /** If omitted, resolved fresh at the start of every tick from the agent's own on-chain
   * `endpoint` (see taskHandler.ts's a2aTaskHandler) — lets an owner rotate their agent
   * server's endpoint on-chain without restarting this process. */
  taskHandler?: TaskHandler;
}

/** Attempts to actually produce and submit the deliverable for a job this instance already
 * accepted (on this tick or an earlier one). Never throws — every failure path just leaves the
 * job id in `state.acceptedUndelivered` for the next tick to retry, since the alternative
 * (crashing the process, or silently dropping the job) is worse than "try again in
 * pollIntervalMs." */
async function attemptDelivery(deps: TickDeps, jobId: string, state: RuntimeState): Promise<void> {
  const { adapter, config } = deps;
  try {
    const job = await adapter.getJob(BigInt(jobId));
    if (job.status !== JOB_STATUS_ACTIVE) {
      // Already resolved some other way (confirmed/disputed/force-cancelled) — nothing left
      // for this instance to submit.
      state.acceptedUndelivered = state.acceptedUndelivered.filter((id) => id !== jobId);
      if (!state.delivered.includes(jobId)) state.delivered.push(jobId);
      return;
    }

    const description = await fetchTaskDescription(config.taskDescriptionsBaseUrl, job.taskHash, config.a2aTimeoutMs);
    if (!description) {
      console.warn(`[agent-runtime] job ${jobId}: no task description available yet at ${config.taskDescriptionsBaseUrl} — retrying next tick.`);
      return;
    }

    const handler = deps.taskHandler ?? (await defaultHandlerFor(deps));
    const deliverable = await handler({ jobId, taskDescription: description, budgetUsdc: job.budget.toString(), deadline: job.deadline });

    const deliverableHash = sha256Hex(deliverable);
    await adapter.submitDeliverable(BigInt(jobId), deliverableHash);

    state.acceptedUndelivered = state.acceptedUndelivered.filter((id) => id !== jobId);
    state.delivered.push(jobId);
    console.log(`[agent-runtime] job ${jobId}: delivered.`);
  } catch (error) {
    console.error(`[agent-runtime] job ${jobId}: delivery attempt failed, will retry next tick:`, error instanceof Error ? error.message : error);
  }
}

async function defaultHandlerFor(deps: TickDeps): Promise<TaskHandler> {
  const agent = await deps.adapter.getAgent(deps.config.agentChainId);
  return a2aTaskHandler(agent.endpoint, deps.config.a2aTimeoutMs);
}

/** One poll cycle: retry anything left over from a previous tick, then scan for newly posted
 * jobs hired to this agent. Mutates and returns `state` — the caller (main.ts) is responsible
 * for persisting it, so a crash mid-tick loses at most the current tick's progress, not
 * everything already durably recorded from earlier ticks. */
export async function tick(deps: TickDeps, state: RuntimeState): Promise<RuntimeState> {
  const { adapter, config, policy } = deps;

  for (const jobId of [...state.acceptedUndelivered]) {
    await attemptDelivery(deps, jobId, state);
  }

  const stats = await adapter.getProtocolStats();
  const totalJobs = stats.totalJobs;
  const lastScanned = BigInt(state.lastScannedJobId);
  if (totalJobs <= lastScanned) return state;

  const toId = totalJobs - lastScanned > BigInt(MAX_NEW_JOBS_PER_TICK) ? lastScanned + BigInt(MAX_NEW_JOBS_PER_TICK) : totalJobs;

  // Only ever advance the cursor past ids that were actually evaluated successfully — a
  // transient RPC failure on one job id must not cause it to be silently skipped forever
  // (advancing lastScannedJobId past it would mean it's never looked at again).
  let highestClean = lastScanned;

  for (let id = lastScanned + 1n; id <= toId; id++) {
    const jobId = id.toString();
    try {
      const job = await adapter.getJob(id);
      const isMine = job.hiredAgentId === config.agentChainId.toString();
      const isOpen = job.status === JOB_STATUS_PENDING;
      const alreadyHandled = state.delivered.includes(jobId) || state.acceptedUndelivered.includes(jobId);

      if (isMine && isOpen && !alreadyHandled) {
        const shouldAccept = await policy(job);
        if (shouldAccept) {
          await adapter.acceptJob(id);
          state.acceptedUndelivered.push(jobId);
          console.log(`[agent-runtime] job ${jobId}: accepted (budget $${(Number(job.budget) / 1e6).toFixed(2)}).`);
          await attemptDelivery(deps, jobId, state);
        }
      }
      highestClean = id;
    } catch (error) {
      console.error(`[agent-runtime] job ${jobId}: failed to evaluate, will retry from here next tick:`, error instanceof Error ? error.message : error);
      break;
    }
  }

  state.lastScannedJobId = highestClean.toString();
  return state;
}
