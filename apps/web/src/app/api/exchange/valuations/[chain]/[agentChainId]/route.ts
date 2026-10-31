import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { computeFairValue, CURRENT_FORMULA_VERSION, type AgentTier } from "@clawdhq/valuation";
import { getServerEvmAdapter, isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";

// Cache-miss-safe by design: if the indexer hasn't processed this agent's events yet (or
// isn't running at all), this route computes the valuation live from chain state instead of
// 404ing — nothing depends on the indexer having run. See AgentValuationCache in
// packages/marketplace-db/prisma/schema.prisma.

export async function GET(_request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  const { chain: chainParam, agentChainId } = await context.params;

  if (!(chainParam in Chain)) {
    return NextResponse.json({ error: `Unknown chain "${chainParam}"` }, { status: 400 });
  }
  const chain = chainParam as Chain;

  const cached = await prisma.agentValuationCache.findUnique({
    where: { chain_agentChainId: { chain, agentChainId } },
  });
  // Only serve cache if it matches the current formula version (v2)
  if (cached && cached.formulaVersion === CURRENT_FORMULA_VERSION) {
    return NextResponse.json({
      chain,
      agentChainId,
      fairValueUsdc: cached.fairValueUsdc.toString(),
      formulaVersion: cached.formulaVersion,
      source: "cache" as const,
      computedAt: cached.computedAt.toISOString(),
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  let result: ReturnType<typeof computeFairValue> | undefined;

  if (isEvmPrismaChain(chain)) {
    const adapter = getServerEvmAdapter(chain);
    const [agent, launch, dbAgent] = await Promise.all([
      adapter.getAgent(BigInt(agentChainId)),
      prisma.launch.findFirst({ where: { chain, agentChainId } }),
      prisma.agent.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } }),
    ]);

    let tokenVolumeUsdc = 0n;
    let tokenUsdcRaised = 0n;
    if (launch) {
      tokenUsdcRaised = launch.usdcRaised;
      const tradesSum = await prisma.launchTrade.aggregate({
        where: { chain, launchChainId: launch.launchChainId },
        _sum: { usdcAmount: true },
      }).catch(() => ({ _sum: { usdcAmount: null } }));
      tokenVolumeUsdc = tradesSum._sum.usdcAmount ?? launch.usdcRaised;
    }

    const createdAtSeconds = dbAgent?.createdAtChain
      ? Math.floor(dbAgent.createdAtChain.getTime() / 1000)
      : undefined;

    result = computeFairValue({
      usdcRevenue: agent.usdcRevenue,
      tier: agent.tier as AgentTier,
      reputationBps: agent.reputationBps,
      lastJobAtSeconds: Number(agent.lastJobAt),
      supportsX402: agent.supportsX402,
      supportsA2A: agent.supportsA2A,
      supportsMcp: agent.supportsMcp,
      nowSeconds,
      createdAtSeconds,
      tokenUsdcRaised,
      tokenVolumeUsdc,
    });

    // Update the cache with the new v2 valuation
    await prisma.agentValuationCache.upsert({
      where: { chain_agentChainId: { chain, agentChainId } },
      create: {
        chain,
        agentChainId,
        fairValueUsdc: result.fairValueUsdc,
        formulaVersion: result.formulaVersion,
      },
      update: {
        fairValueUsdc: result.fairValueUsdc,
        formulaVersion: result.formulaVersion,
      },
    }).catch(() => {});
  }

  if (!result) {
    return NextResponse.json(
      { error: `No cached valuation yet for agent ${agentChainId} on ${chain}, and the live fallback couldn't reach it (chain not configured or agent not found).` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    chain,
    agentChainId,
    fairValueUsdc: result.fairValueUsdc.toString(),
    breakdown: {
      revenueComponentUsdc: result.breakdown.revenueComponentUsdc.toString(),
      capabilityComponentUsdc: result.breakdown.capabilityComponentUsdc.toString(),
      tokenRoyaltyComponentUsdc: result.breakdown.tokenRoyaltyComponentUsdc.toString(),
      treasuryFloorUsdc: result.breakdown.treasuryFloorUsdc.toString(),
      reputationFactor: result.breakdown.reputationFactor,
      recencyFactor: result.breakdown.recencyFactor,
    },
    formulaVersion: result.formulaVersion,
    source: "live" as const,
    computedAt: new Date().toISOString(),
  });
}
