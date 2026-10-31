import type { JobSummary } from "@clawdhq/sdk";
import type { RuntimeConfig } from "./config.js";

/** Decides whether to accept a job this instance was hired for. Returning false just skips the
 * job forever (no on-chain action taken, no retry) — there's no "decline" call on the
 * contract, so not accepting is the only way to pass on a job. Swap this out (see main.ts) for
 * anything more sophisticated: matching the task description against the agent's declared
 * capabilities, checking employer reputation, rate-limiting concurrent open jobs, etc. */
export type JobDecisionPolicy = (job: JobSummary) => boolean | Promise<boolean>;

/** Ships as the default so the runtime does something reasonable with zero configuration
 * beyond a budget floor: accept anything at or above MIN_BUDGET_USDC_MICROS, reject everything
 * else. Deliberately doesn't look at the task description at all — by the time the policy
 * runs, the description hasn't been fetched yet (that only happens after acceptance, since
 * fetching it is one more network round trip this policy shouldn't have to pay for on every
 * job it's going to reject anyway). */
export function defaultPolicy(config: RuntimeConfig): JobDecisionPolicy {
  return (job) => job.budget >= config.minBudgetUsdc;
}
