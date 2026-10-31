import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { getServerEvmAdapter, isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";

export interface ListingAgentDetail {
  name: string;
  endpoint: string;
  agentUri: string;
  owner: string;
  active: boolean;
  tier: number;
  jobsCompleted: number;
  reputationBps: number;
  usdcRevenue: string;
  tokenRoyalties?: string;
  taskRevenue?: string;
  lastJobAtSeconds: number;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
}

/** Reads the listed agent's full profile live from its own chain and enriches it with Launchpad
 * token trading revenues (30% creator + 20% agent operating treasury royalties). */
async function fetchAgentDetail(chain: Chain, agentChainId: string): Promise<ListingAgentDetail | null> {
  try {
    if (isEvmPrismaChain(chain)) {
      const [agent, launch] = await Promise.all([
        getServerEvmAdapter(chain).getAgent(BigInt(agentChainId)),
        prisma.launch.findFirst({ where: { chain, agentChainId } }),
      ]);

      let tokenRoyalties = 0n;
      if (launch) {
        const tradesSum = await prisma.launchTrade.aggregate({
          where: { chain, launchChainId: launch.launchChainId },
          _sum: { usdcAmount: true },
        }).catch(() => ({ _sum: { usdcAmount: null } }));
        const totalVolume = tradesSum._sum.usdcAmount ?? launch.usdcRaised;
        // 50% of the 2% trade fee = 1% (100 bps) to creator + agent operating treasury
        tokenRoyalties = (totalVolume * 100n) / 10_000n;
      }

      const totalRevenue = agent.usdcRevenue + tokenRoyalties;

      return {
        name: agent.name,
        endpoint: agent.endpoint,
        agentUri: agent.agentUri,
        owner: agent.owner,
        active: agent.active,
        tier: agent.tier,
        jobsCompleted: agent.jobsCompleted,
        reputationBps: agent.reputationBps,
        usdcRevenue: totalRevenue.toString(),
        tokenRoyalties: tokenRoyalties.toString(),
        taskRevenue: agent.usdcRevenue.toString(),
        lastJobAtSeconds: Number(agent.lastJobAt),
        supportsX402: agent.supportsX402,
        supportsA2A: agent.supportsA2A,
        supportsMcp: agent.supportsMcp,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { bids: { orderBy: { createdAtChain: "desc" } } },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const [agent, cachedValuation] = await Promise.all([
    fetchAgentDetail(listing.chain, listing.agentChainId),
    prisma.agentValuationCache.findUnique({
      where: { chain_agentChainId: { chain: listing.chain, agentChainId: listing.agentChainId } },
      select: { fairValueUsdc: true },
    }),
  ]);

  const fairValueSnapshotUsdc = (
    cachedValuation && cachedValuation.fairValueUsdc > 0n
      ? cachedValuation.fairValueUsdc
      : listing.fairValueSnapshotUsdc
  ).toString();

  return NextResponse.json({
    id: listing.id,
    chain: listing.chain,
    chainListingId: listing.chainListingId,
    agentChainId: listing.agentChainId,
    seller: listing.seller,
    mode: listing.mode,
    status: listing.status,
    fairValueSnapshotUsdc,
    reservePriceUsdc: listing.reservePriceUsdc.toString(),
    endTime: listing.endTime?.toISOString() ?? null,
    highestBidChainId: listing.highestBidChainId,
    createdAtChain: listing.createdAtChain.toISOString(),
    updatedAtChain: listing.updatedAtChain.toISOString(),
    agent,
    bids: listing.bids.map((bid) => ({
      id: bid.id,
      chainBidId: bid.chainBidId,
      bidder: bid.bidder,
      amountUsdc: bid.amountUsdc.toString(),
      active: bid.active,
      createdAtChain: bid.createdAtChain.toISOString(),
    })),
  });
}
