import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { prisma as socialPrisma, ProfileKind } from "@clawdhq/social-db";
import { prisma as custodyPrisma } from "@clawdhq/custody-db";
import { calculateAgentReputation } from "@/lib/reputation";

// Every agent for one chain (optionally filtered to one owner), read from the indexer's Agent
// cache instead of live RPC with rich cross-database activity enrichment (Launchpad tokens,
// ClawdHQ social posts, operating custody treasuries, published skills, and runtime heartbeats).
const SUPPORTED_CHAINS: Chain[] = [Chain.BASE_SEPOLIA, Chain.ETH_SEPOLIA, Chain.MONAD_MAINNET, Chain.BSC_TESTNET];

function normalizeChainParam(param: string): Chain | "ALL" | null {
  const clean = param.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "ALL") return "ALL";
  if (clean === "MONAD_MAINNET" || clean === "MONAD" || clean === "143") return Chain.MONAD_MAINNET;
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (SUPPORTED_CHAINS.includes(clean as Chain)) return clean as Chain;
  return null;
}

const PAGE_SIZE_MAX = 200;

export async function GET(request: Request, context: { params: Promise<{ chain: string }> }) {
  const { chain: chainParam } = await context.params;
  const parsedChain = normalizeChainParam(chainParam);
  if (!parsedChain) {
    return NextResponse.json({ error: `Unknown chain "${chainParam}"` }, { status: 400 });
  }

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const pageSizeParam = url.searchParams.get("pageSize");
  const pageSize = pageSizeParam ? Math.min(PAGE_SIZE_MAX, Math.max(1, Number(pageSizeParam) || PAGE_SIZE_MAX)) : null;
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const sortBy = url.searchParams.get("sortBy") || "reputation";

  const candidateChains: Chain[] =
    parsedChain === "ALL"
      ? SUPPORTED_CHAINS
      : [parsedChain];

  const where = {
    chain: { in: candidateChains },
    ...(owner ? { owner: { equals: owner, mode: "insensitive" as const } } : {}),
  };

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: !pageSize
        ? { agentChainId: "asc" }
        : sortBy === "jobs"
          ? [{ jobsCompleted: "desc" }, { reputationBps: "desc" }]
          : sortBy === "revenue"
            ? [{ usdcRevenue: "desc" }, { reputationBps: "desc" }]
            : [{ reputationBps: "desc" }, { jobsCompleted: "desc" }],
      ...(pageSize ? { take: pageSize, skip: offset } : {}),
    }),
    pageSize ? prisma.agent.count({ where }) : Promise.resolve(null),
  ]);

  const agentIds = agents.map((a) => a.agentChainId);

  // Cross-domain enrichment in parallel
  const [launches, socialProfiles, clawdLinks, hostedConfigs, agentSkills] = await Promise.all([
    agentIds.length > 0
      ? prisma.launch.findMany({
          where: { agentChainId: { in: agentIds } },
        }).catch(() => [])
      : Promise.resolve([]),
    agentIds.length > 0
      ? socialPrisma.profile.findMany({
          where: {
            kind: ProfileKind.AGENT,
            agentChainId: { in: agentIds },
          },
          select: {
            agentChainId: true,
            _count: {
              select: {
                posts: true,
                followedBy: true,
                publishedSkills: true,
                knowledgeContributions: true,
              },
            },
          },
        }).catch(() => [])
      : Promise.resolve([]),
    agentIds.length > 0
      ? custodyPrisma.clawdHqLink.findMany({
          where: {
            agentChainId: { in: agentIds },
          },
        }).catch(() => [])
      : Promise.resolve([]),
    agentIds.length > 0
      ? custodyPrisma.hostedRuntimeConfig.findMany({
          where: {
            agentChainId: { in: agentIds },
          },
        }).catch(() => [])
      : Promise.resolve([]),
    agentIds.length > 0
      ? socialPrisma.agentSkill.findMany({
          where: {
            agentChainId: { in: agentIds },
          },
          select: {
            agentChainId: true,
          },
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const launchMap = new Map(launches.map((l) => [l.agentChainId, l]));
  const socialMap = new Map(socialProfiles.map((p) => [p.agentChainId!, p._count]));
  const clawdLinkMap = new Map(clawdLinks.map((c) => [c.agentChainId, c]));
  const hostedMap = new Map(hostedConfigs.map((h) => [h.agentChainId, h]));
  const installedSkillsCountMap = new Map<string, number>();
  for (const s of agentSkills) {
    installedSkillsCountMap.set(s.agentChainId, (installedSkillsCountMap.get(s.agentChainId) ?? 0) + 1);
  }

  const serialized = agents.map((agent) => {
    const launch = launchMap.get(agent.agentChainId);
    const social = socialMap.get(agent.agentChainId);
    const clawd = clawdLinkMap.get(agent.agentChainId);
    const hosted = hostedMap.get(agent.agentChainId);

    const installedSkillsCount = installedSkillsCountMap.get(agent.agentChainId) ?? 0;
    const publishedSkillsCount = social?.publishedSkills ?? 0;
    const skillsCount = Math.max(installedSkillsCount, publishedSkillsCount);

    // Token trading royalties: 30% creator royalties + 20% agent operating treasury = 50% of the 2% trade fee (1% of trade volume)
    const tokenRoyalties = launch ? (launch.usdcRaised * 100n) / 10_000n : 0n;
    const totalRevenue = agent.usdcRevenue + tokenRoyalties;

    const rep = calculateAgentReputation({
      agentId: agent.agentChainId,
      name: agent.name,
      active: agent.active,
      tier: agent.tier,
      jobsCompleted: agent.jobsCompleted,
      jobsFailed: agent.jobsFailed,
      usdcRevenue: totalRevenue,
      reputationBps: agent.reputationBps,
      supportsX402: agent.supportsX402,
      supportsA2A: agent.supportsA2A,
      supportsMcp: agent.supportsMcp,
      lastJobAt: agent.lastJobAtChain,
      hasHostedRuntime: hosted ? (hosted.mode === "HOSTED" || hosted.isActive) : true,
      runtimeExecutionCount: hosted ? hosted.executionCount : 0,
      hasTokenLaunch: Boolean(launch),
      tokenUsdcRaised: launch ? launch.usdcRaised : 0n,
      isTokenGraduated: launch ? launch.graduated : false,
      socialPostsCount: social ? social.posts : 0,
      socialFollowersCount: social ? social.followedBy : 0,
      skillsPublishedCount: skillsCount,
      knowledgeContributionsCount: social ? social.knowledgeContributions : 0,
      hasClawdHqLink: Boolean(clawd),
      clawdHqHandle: clawd?.handle,
    });

    return {
      agentId: agent.agentChainId,
      chain: agent.chain,
      owner: agent.owner,
      name: agent.name,
      agentUri: agent.agentUri,
      endpoint: agent.endpoint,
      metadataHash: agent.metadataHash,
      active: agent.active,
      tier: agent.tier,
      jobsCompleted: agent.jobsCompleted,
      jobsFailed: agent.jobsFailed,
      reputationBps: rep.totalScoreBps,
      rawReputationBps: agent.reputationBps,
      grade: rep.grade,
      gradeLabel: rep.gradeLabel,
      usdcRevenue: totalRevenue.toString(),
      tokenRoyalties: tokenRoyalties.toString(),
      taskRevenue: agent.usdcRevenue.toString(),
      lastJobAt: agent.lastJobAtChain?.toISOString() ?? null,
      supportsX402: agent.supportsX402,
      supportsA2A: agent.supportsA2A,
      supportsMcp: agent.supportsMcp,
      hasTokenLaunch: Boolean(launch),
      tokenSymbol: launch?.symbol,
      tokenName: launch?.name,
      tokenUsdcRaised: launch?.usdcRaised.toString(),
      isTokenGraduated: launch?.graduated,
      socialPostsCount: social?.posts ?? 0,
      clawdHqHandle: clawd?.handle,
      createdAtChain: agent.createdAtChain.toISOString(),
      updatedAtChain: agent.updatedAtChain.toISOString(),
    };
  });

  if (sortBy === "jobs") {
    serialized.sort((a, b) => b.jobsCompleted - a.jobsCompleted || b.reputationBps - a.reputationBps);
  } else if (sortBy === "revenue") {
    serialized.sort((a, b) => Number(b.usdcRevenue) - Number(a.usdcRevenue) || b.reputationBps - a.reputationBps);
  } else {
    serialized.sort((a, b) => b.reputationBps - a.reputationBps || b.jobsCompleted - a.jobsCompleted);
  }

  return NextResponse.json({
    agents: serialized,
    ...(total !== null ? { total, hasMore: offset + agents.length < total } : {}),
  });
}
