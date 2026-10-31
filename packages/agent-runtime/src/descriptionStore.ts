import { sha256Hex } from "./hash.js";

/** Reads a job's plaintext task description back from ClawdHQ's off-chain cache (see
 * apps/web/src/app/api/marketplace/task-descriptions/[taskHash]/route.ts) — the only place a
 * job's description exists anywhere, since ClawdHQCore.sol only ever stores its sha256 hash.
 * Re-verifies the hash locally before returning anything: that cache is a convenience relay,
 * not a trust anchor, and this is the code that decides what an autonomous agent acts on, so
 * it re-derives trust itself rather than assuming the server already did.
 *
 * Returns undefined (not a thrown error) if no description is cached yet, or if what's cached
 * doesn't actually hash to `taskHash` — both are "we can't safely act on this job", not a hard
 * failure of the runtime itself. */
export async function fetchTaskDescription(baseUrl: string, taskHash: string, timeoutMs: number): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/marketplace/task-descriptions/${taskHash}`, { signal: controller.signal });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { description?: unknown };
    const description = typeof body.description === "string" ? body.description : undefined;
    if (!description) return undefined;
    return sha256Hex(description) === taskHash.toLowerCase() ? description : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
