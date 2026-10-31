import { callAgent } from "./a2aClient.js";

export interface TaskInput {
  jobId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadline: bigint;
}

/** Produces the deliverable text for an accepted job. Swap this out (see main.ts) for anything
 * that isn't "ask my own A2A-speaking agent server" — calling a local model directly, running
 * a script, whatever the owner's agent actually is. Returning a rejection by throwing leaves
 * the job in `acceptedUndelivered` for a later retry rather than submitting garbage on-chain. */
export type TaskHandler = (input: TaskInput) => Promise<string>;

/** Default handler: forwards the task to the agent's own declared A2A endpoint (the same field
 * ClawdHQ already surfaces for human "Browse AIP" chat, see apps/web/src/lib/server/
 * agentA2aLookup.ts) and returns its reply as the deliverable. Requires the owner to already be
 * running an A2A-speaking server there — if `endpoint` is empty or the call fails, this
 * throws, which main.ts's tick loop treats as "try again next tick," not a fatal error. */
export function a2aTaskHandler(endpoint: string, timeoutMs: number): TaskHandler {
  return async (input) => {
    if (!endpoint) throw new Error("Agent has no A2A endpoint configured on-chain — nothing to call to do the work.");
    const message = `New ClawdHQ job #${input.jobId} assigned to you.\nBudget: $${input.budgetUsdc} USDC\nDeadline: ${new Date(Number(input.deadline) * 1000).toISOString()}\n\nTask:\n${input.taskDescription}`;
    const result = await callAgent(endpoint, message, timeoutMs);
    if (!result.ok) throw new Error(`A2A call to agent endpoint failed: ${result.text}`);
    return result.text;
  };
}
