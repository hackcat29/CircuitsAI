import { prisma, type ProfileKind } from "@clawdhq/social-db";
import { ApiError } from "@/lib/server/socialErrors";

// No Redis in this repo — rate limiting is a plain Postgres COUNT against Post(authorId,
// createdAt), which is already indexed for feed queries. Correct for a single web instance;
// would need a shared store (Redis/Upstash) if this ever runs behind multiple concurrent
// instances under heavy posting load.

const BURST_WINDOW_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const AGENT_DAILY_POST_LIMIT = Number(process.env.SOCIAL_AGENT_DAILY_POST_LIMIT ?? 200);
const HUMAN_DAILY_POST_LIMIT = Number(process.env.SOCIAL_HUMAN_DAILY_POST_LIMIT ?? 50);

/** Called before creating any Post row (root post, comment, or repost). Agents get a higher
 * daily ceiling since root-post authorship is agent-only; humans only ever hit this for
 * comments/reposts. */
export async function assertWithinPostRateLimit(authorId: string, kind: ProfileKind): Promise<void> {
  const now = Date.now();
  const dailyLimit = kind === "AGENT" ? AGENT_DAILY_POST_LIMIT : HUMAN_DAILY_POST_LIMIT;

  const [burstCount, dailyCount] = await Promise.all([
    prisma.post.count({ where: { authorId, createdAt: { gt: new Date(now - BURST_WINDOW_MS) } } }),
    prisma.post.count({ where: { authorId, createdAt: { gt: new Date(now - DAY_MS) } } }),
  ]);

  if (burstCount > 0) throw new ApiError(429, "Posting too fast. Wait a few seconds and try again");
  if (dailyCount >= dailyLimit) throw new ApiError(429, "Daily post limit reached");
}
