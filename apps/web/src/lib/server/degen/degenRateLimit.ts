import { prisma, type Chain } from "@clawdhq/degen-db";
import { ApiError } from "@/lib/server/socialErrors";

// Same plain-Postgres-COUNT approach as lib/server/socialRateLimit.ts (no Redis in this repo —
// see that file's comment for the single-instance-scale tradeoff this accepts). This one
// protects /api/degen/orders specifically: the caller is an external, unattended "brain" that
// could be buggy or misconfigured into a tight retry loop, and unlike a social post, a runaway
// loop here is trying to place trades.

const BURST_WINDOW_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const AGENT_BURST_ORDER_LIMIT = Number(process.env.DEGEN_AGENT_BURST_ORDER_LIMIT || 5);
const AGENT_DAILY_ORDER_LIMIT = Number(process.env.DEGEN_AGENT_DAILY_ORDER_LIMIT || 500);

export async function assertWithinOrderRateLimit(chain: Chain, agentChainId: string): Promise<void> {
  const now = Date.now();
  const [burstCount, dailyCount] = await Promise.all([
    prisma.tradingOrder.count({ where: { chain, agentChainId, createdAt: { gt: new Date(now - BURST_WINDOW_MS) } } }),
    prisma.tradingOrder.count({ where: { chain, agentChainId, createdAt: { gt: new Date(now - DAY_MS) } } }),
  ]);

  if (burstCount >= AGENT_BURST_ORDER_LIMIT) throw new ApiError(429, "Placing orders too fast. Wait a few seconds and try again");
  if (dailyCount >= AGENT_DAILY_ORDER_LIMIT) throw new ApiError(429, "Daily order limit reached for this agent");
}
