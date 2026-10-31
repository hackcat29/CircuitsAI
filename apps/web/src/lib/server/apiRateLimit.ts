import { ApiError } from "./socialErrors";

interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
  errorMessage?: string;
}

const MAX_TRACKED_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;

class MemoryRateLimiter {
  private buckets = new Map<string, number[]>();
  private lastCleanup = Date.now();

  check(config: RateLimitConfig): void {
    const now = Date.now();
    this.maybeCleanup(now);

    const recent = (this.buckets.get(config.key) ?? []).filter((ts) => ts > now - config.windowMs);

    if (recent.length >= config.limit) {
      this.buckets.set(config.key, recent);
      throw new ApiError(429, config.errorMessage ?? "Too many requests. Please slow down and try again.");
    }

    recent.push(now);
    this.buckets.set(config.key, recent);
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS && this.buckets.size < MAX_TRACKED_KEYS) {
      return;
    }

    this.lastCleanup = now;
    for (const [key, timestamps] of this.buckets.entries()) {
      const active = timestamps.filter((ts) => ts > now - 120_000);
      if (active.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, active);
      }
    }

    // Hard ceiling safety against unbounded map growth
    if (this.buckets.size > MAX_TRACKED_KEYS) {
      this.buckets.clear();
    }
  }
}

export const globalRateLimiter = new MemoryRateLimiter();

export function clientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || "127.0.0.1";
}

export function assertApiRateLimit(request: Request, scope: string, limit: number, windowMs: number): void {
  const ip = clientIpFromRequest(request);
  const key = `${scope}:${ip}`;
  globalRateLimiter.check({
    key,
    limit,
    windowMs,
    errorMessage: `Too many requests. Rate limit exceeded.`,
  });
}
