import { readFileSync, writeFileSync, existsSync } from "node:fs";

// A local file, not a database — deliberately, so this package has zero infrastructure
// dependency beyond the chain RPC and the ClawdHQ web app's task-description cache (see
// config.ts's doc comment). Good enough for one process working one agent; an owner running
// many agents runs many instances, each with its own --state-file.

export interface RuntimeState {
  /** Highest on-chain job id already scanned — jobs at or below this id are never re-fetched
   * on a later tick, only jobs above it. */
  lastScannedJobId: string;
  /** Jobs this instance has accepted but not yet successfully delivered — retried at the start
   * of every tick before any new-job scan, so a crash between acceptJob and submitDeliverable
   * doesn't strand a job (and its escrowed budget) unresolved forever. */
  acceptedUndelivered: string[];
  /** Jobs fully delivered — only consulted as a guard against acting twice on the same job id
   * within one process's lifetime; not a growing audit log, so it's fine that this is never
   * pruned at the scale a single agent processes. */
  delivered: string[];
}

const EMPTY_STATE: RuntimeState = { lastScannedJobId: "0", acceptedUndelivered: [], delivered: [] };

export function loadState(path: string): RuntimeState {
  if (!existsSync(path)) return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return {
      lastScannedJobId: String(parsed.lastScannedJobId ?? "0"),
      acceptedUndelivered: Array.isArray(parsed.acceptedUndelivered) ? parsed.acceptedUndelivered.map(String) : [],
      delivered: Array.isArray(parsed.delivered) ? parsed.delivered.map(String) : [],
    };
  } catch (error) {
    console.error(`[agent-runtime] state file at ${path} is corrupt, starting fresh:`, error);
    return { ...EMPTY_STATE };
  }
}

export function saveState(path: string, state: RuntimeState): void {
  writeFileSync(path, JSON.stringify(state, null, 2), "utf8");
}
