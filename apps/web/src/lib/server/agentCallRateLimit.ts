import { ApiError } from "./socialErrors";

// No Redis in this repo — same tradeoff as socialRateLimit.ts's Postgres-COUNT approach, but
// there's no natural DB row to count against for "POSTs to an arbitrary agent endpoint," so
// this is a plain in-memory sliding window instead. Correct for a single web instance; would
// need a shared store (Redis/Upstash) if this ever runs behind multiple concurrent instances.
//
// IP is the real throttle here, not "must be a registered A2A agent" (see fetchPublicJson.ts's
// assertPublicHost doc comment) — registration on every chain in this app is permissionless and
// free (testnets), so without this, anyone could hammer arbitrary public endpoints through
// ClawdHQ's server merely by registering a throwaway agent.

import { globalRateLimiter } from "./apiRateLimit";

const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = Number(process.env.AGENT_CALL_RATE_LIMIT_PER_MIN ?? 10);

export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || "unknown";
}

export function assertWithinAgentCallRateLimit(key: string): void {
  globalRateLimiter.check({
    key: `agent-call:${key}`,
    limit: LIMIT_PER_WINDOW,
    windowMs: WINDOW_MS,
    errorMessage: "Too many agent calls. Wait a minute and try again.",
  });
}
