import { unstable_cache } from "next/cache";
import { prisma as custodyPrisma } from "@clawdhq/custody-db";
import { prisma as socialPrisma, ProfileKind } from "@clawdhq/social-db";
import { prisma as marketplacePrisma, TradeSide } from "@clawdhq/marketplace-db";
import { getServerEvmAdapter, getServerEvmLaunchpadAdapter, isChainDeployed, type EvmPrismaChain } from "@/lib/server/evmExchangeReaders";

// The Contribute page's single source of truth for "who has done what" — computed live from
// on-chain state (agents/launches have no off-chain owner index anywhere in this codebase) plus
// the DB-native features (Pipelines, PublishedSkills, LaunchTrades, ServiceCalls, Bids).
// Balanced between Builder actions (deploying agents, pipelines) and Revenue/Capital actions
// (Launchpad token volume, task escrow funding, x402 service calls).

const SCORE_CHAINS: EvmPrismaChain[] = ["BASE_SEPOLIA", "ETH_SEPOLIA", "MONAD_MAINNET"];

export interface ContributorEntry {
  address: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  // Builder supply metrics
  agentsRegistered: number;
  jobsCompleted: number;
  pipelinesBuilt: number;
  skillsPublished: number;
  projectsLaunched: number;
  // Revenue & capital metrics
  launchpadBuyVolumeUsdc: number;
  escrowJobsFunded: number;
  escrowFundedVolumeUsdc: number;
  serviceCallsCount: number;
  exchangeBidsVolumeUsdc: number;
  // Split & total scores
  builderScore: number;
  revenueScore: number;
  score: number;
}

export function scoreFor(entry: Omit<ContributorEntry, "address" | "score" | "builderScore" | "revenueScore">): {
  builderScore: number;
  revenueScore: number;
  totalScore: number;
} {
  // 1. Builder supply-side score
  const builderScore =
    entry.agentsRegistered * 10 +
    entry.pipelinesBuilt * 15 +
    entry.skillsPublished * 20 +
    entry.projectsLaunched * 25 +
    entry.jobsCompleted * 5;

  // 2. Revenue & Capital score (rewarding token buyers, liquidity, and task commissioners)
  // Token Backer quest: 1 pt per 2 USDC spent on Launchpad tokens (~50 pts per $100 USDC volume)
  const launchpadScore = Math.floor((entry.launchpadBuyVolumeUsdc || 0) * 0.5);
  // Escrow funding: 15 pts per posted/funded task escrow + 1 pt per 2 USDC deposited
  const escrowScore = (entry.escrowJobsFunded || 0) * 15 + Math.floor((entry.escrowFundedVolumeUsdc || 0) * 0.5);
  // Paid agent API services (x402 / micropayments): 2 pts per call
  const serviceScore = (entry.serviceCallsCount || 0) * 2;
  // Secondary agent exchange bids & purchases: 1 pt per 5 USDC
  const exchangeScore = Math.floor((entry.exchangeBidsVolumeUsdc || 0) * 0.2);

  const revenueScore = launchpadScore + escrowScore + serviceScore + exchangeScore;

  return {
    builderScore,
    revenueScore,
    totalScore: builderScore + revenueScore,
  };
}

interface Accumulator {
  agentsRegistered: number;
  jobsCompleted: number;
  pipelinesBuilt: number;
  skillsPublished: number;
  projectsLaunched: number;
  launchpadBuyVolumeUsdc: number;
  escrowJobsFunded: number;
  escrowFundedVolumeUsdc: number;
  serviceCallsCount: number;
  exchangeBidsVolumeUsdc: number;
}

function emptyAccumulator(): Accumulator {
  return {
    agentsRegistered: 0,
    jobsCompleted: 0,
    pipelinesBuilt: 0,
    skillsPublished: 0,
    projectsLaunched: 0,
    launchpadBuyVolumeUsdc: 0,
    escrowJobsFunded: 0,
    escrowFundedVolumeUsdc: 0,
    serviceCallsCount: 0,
    exchangeBidsVolumeUsdc: 0,
  };
}

async function computeContributorLeaderboardUncached(): Promise<ContributorEntry[]> {
  const byAddress = new Map<string, Accumulator>();
  // (chain, agentChainId) -> owner address — built during the agent pass, reused to attribute an
  // AGENT-kind Profile's published skills back to the human wallet that owns that agent.
  const agentOwnerByChainAndId = new Map<string, string>();

  function bump(address: string | undefined | null, field: keyof Accumulator, by = 1): void {
    if (!address) return;
    const key = address.toLowerCase();
    const acc = byAddress.get(key) ?? emptyAccumulator();
    acc[field] += by;
    byAddress.set(key, acc);
  }

  await Promise.all(
    SCORE_CHAINS.filter(isChainDeployed).map(async (chain) => {
      const adapter = getServerEvmAdapter(chain);
      const launchpadAdapter = getServerEvmLaunchpadAdapter(chain);
      // Own try/catch (unlike the per-agent/per-launch reads below, which already tolerate
      // individual failures) so one chain's RPC hiccup can't reject this chain's whole
      // Promise.all entry and, via the outer Promise.all, wipe out every other chain's
      // contributors too.
      const stats = await adapter.getProtocolStats().catch(() => null);
      if (!stats) return;

      const agentIds = bigintRange(1n, stats.totalAgents);
      const agents = await Promise.all(agentIds.map((id) => adapter.getAgent(id).catch(() => null)));
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (!agent) continue;
        agentOwnerByChainAndId.set(`${chain}:${agentIds[i].toString()}`, agent.owner);
        bump(agent.owner, "agentsRegistered");
        bump(agent.owner, "jobsCompleted", agent.jobsCompleted);
      }

      const launchIds = bigintRange(1n, stats.totalLaunches);
      const launches = await Promise.all(launchIds.map((id) => launchpadAdapter.getLaunch(id).catch(() => null)));
      for (const launch of launches) {
        if (!launch || !launch.graduated) continue;
        bump(launch.creator, "projectsLaunched");
      }

      if (stats.totalJobs > 0n) {
        const jobIds = bigintRange(1n, stats.totalJobs);
        const jobs = await Promise.all(jobIds.map((id) => adapter.getJob(id).catch(() => null)));
        for (const job of jobs) {
          if (!job || !job.employer) continue;
          bump(job.employer, "escrowJobsFunded");
          bump(job.employer, "escrowFundedVolumeUsdc", Number(job.budget) / 1_000_000);
        }
      }
    }),
  );

  const pipelineCounts = await custodyPrisma.pipeline.groupBy({ by: ["ownerAddress"], _count: { _all: true } }).catch(() => []);
  for (const row of pipelineCounts) {
    bump(row.ownerAddress, "pipelinesBuilt", row._count._all);
  }

  const publishedSkills = await socialPrisma.publishedSkill.findMany({ include: { creator: true } }).catch(() => []);
  for (const skill of publishedSkills) {
    const creator = skill.creator;
    if (creator.kind === ProfileKind.HUMAN) {
      bump(creator.walletAddress, "skillsPublished");
    } else if (creator.kind === ProfileKind.AGENT && creator.chain && creator.agentChainId) {
      const owner = agentOwnerByChainAndId.get(`${creator.chain}:${creator.agentChainId}`);
      bump(owner, "skillsPublished");
    }
  }

  // 1. Launchpad Token Purchases (traders & liquidity backers)
  const buyTrades = await marketplacePrisma.launchTrade
    .findMany({
      where: { side: TradeSide.BUY },
      select: { traderAddress: true, usdcAmount: true },
    })
    .catch(() => []);
  for (const trade of buyTrades) {
    bump(trade.traderAddress, "launchpadBuyVolumeUsdc", Number(trade.usdcAmount) / 1_000_000);
  }

  // 2. Paid Agent API Service Calls (x402 micropayments)
  const serviceCalls = await marketplacePrisma.serviceCall
    .findMany({
      select: { callerAddress: true },
    })
    .catch(() => []);
  for (const call of serviceCalls) {
    bump(call.callerAddress, "serviceCallsCount");
  }

  // 3. Agent Exchange Bids & Purchases
  const exchangeBids = await marketplacePrisma.bid
    .findMany({
      select: { bidder: true, amountUsdc: true },
    })
    .catch(() => []);
  for (const bid of exchangeBids) {
    bump(bid.bidder, "exchangeBidsVolumeUsdc", Number(bid.amountUsdc) / 1_000_000);
  }

  const addresses = Array.from(byAddress.keys());
  const profiles = await socialPrisma.profile
    .findMany({
      where: {
        walletAddress: { in: addresses },
        kind: ProfileKind.HUMAN,
      },
      select: {
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    })
    .catch(() => []);

  const profileByAddress = new Map<string, { username?: string | null; displayName?: string | null; avatarUrl?: string | null }>();
  for (const p of profiles) {
    if (p.walletAddress) {
      profileByAddress.set(p.walletAddress.toLowerCase(), p);
    }
  }

  const entries: ContributorEntry[] = Array.from(byAddress.entries()).map(([address, acc]) => {
    const profile = profileByAddress.get(address.toLowerCase());
    const { builderScore, revenueScore, totalScore } = scoreFor(acc);
    return {
      address,
      username: profile?.username ?? null,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      ...acc,
      builderScore,
      revenueScore,
      score: totalScore,
    };
  });

  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function bigintRange(from: bigint, to: bigint): bigint[] {
  const result: bigint[] = [];
  for (let i = from; i <= to; i++) result.push(i);
  return result;
}

export const computeContributorLeaderboard = unstable_cache(computeContributorLeaderboardUncached, ["contributor-leaderboard"], {
  revalidate: 300,
});
