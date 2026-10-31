import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { computeLaunchStats, decimalToBigInt, getLaunchHolders } from "@/lib/server/launchStats";
import { getGraduatedPairReserves, isEvmPrismaChain, isXeroDeployed } from "@/lib/server/evmExchangeReaders";
import { currentPrice, EVM_TOKEN_DECIMALS_FACTOR, PRICE_PRECISION, TOTAL_WHOLE_SUPPLY } from "@/lib/bondingCurve";
import { fromIndexerChainSlug } from "@/lib/chains";

function parseChain(value: string | null): Chain | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  if (clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ launchChainId: string }> }) {
  const { launchChainId } = await context.params;
  const url = new URL(request.url);
  const rawChain = parseChain(url.searchParams.get("chain"));
  const candidateChains = rawChain ? [rawChain] : [Chain.MONAD_MAINNET, Chain.BSC_TESTNET];

  let launch = rawChain
    ? await prisma.launch.findUnique({ where: { chain_launchChainId: { chain: rawChain, launchChainId } } })
    : null;

  if (!launch) {
    launch = await prisma.launch.findFirst({
      where: {
        launchChainId,
        chain: { in: candidateChains },
      },
    });
  }
  if (!launch) return NextResponse.json({ error: "Launch not found" }, { status: 404 });

  const [statsByLaunchChainId, metadata, agent, holders] = await Promise.all([
    computeLaunchStats(launch.chain, [launch]),
    prisma.launchMetadata.findUnique({ where: { chain_launchChainId: { chain: launch.chain, launchChainId } } }),
    prisma.agent.findUnique({ where: { chain_agentChainId: { chain: launch.chain, agentChainId: launch.agentChainId } } }),
    getLaunchHolders(launch.chain, launchChainId),
  ]);
  const stats = statsByLaunchChainId.get(launchChainId) || {
    priceUsdc: 0n,
    fdvUsdc: 0n,
    marketCapUsdc: 0n,
    volume24hUsdc: 0n,
    priceChangeBps24h: null,
    priceChangeBps7d: null,
    holdersCount: 0,
  };

  // Post-graduation, part of the supply sits in the Xero pair itself (whatever migrated in at
  // graduation) rather than any individual trader — surfaced as a labeled "LP" row, matching
  // how Virtuals' own reference UI labels its top holder. A live read (reserves only, not
  // trades) scoped to this one detail-page load — see getGraduatedPairReserves's doc comment.
  let liquidityUsdc: string | null = null;
  let holdersWithLp = holders;
  const evmChainConfig = fromIndexerChainSlug(launch.chain);
  if (launch.graduated && isEvmPrismaChain(launch.chain) && isXeroDeployed(launch.chain) && evmChainConfig?.usdcAddress) {
    const reserves = await getGraduatedPairReserves(launch.chain, launch.token as `0x${string}`, evmChainConfig.usdcAddress as `0x${string}`);
    if (reserves && reserves.tokenReserve > 0n) {
      liquidityUsdc = reserves.usdcReserve.toString();
      holdersWithLp = [{ address: reserves.pairAddress, balance: reserves.tokenReserve.toString(), isLiquidityPool: true }, ...holders];

      const livePriceUsdc = (reserves.usdcReserve * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / reserves.tokenReserve;
      const liveFdvUsdc = (livePriceUsdc * TOTAL_WHOLE_SUPPLY) / PRICE_PRECISION;

      const tokensSold = decimalToBigInt(launch.tokensSold);
      const initialTokensInPair = TOTAL_WHOLE_SUPPLY * EVM_TOKEN_DECIMALS_FACTOR - tokensSold;
      const graduationPrice = initialTokensInPair > 0n
        ? (launch.usdcRaised * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / initialTokensInPair
        : 0n;
      if (graduationPrice > 0n) {
        stats.priceChangeBps24h = Number(((livePriceUsdc - graduationPrice) * 10_000n) / graduationPrice);
        stats.priceChangeBps7d = stats.priceChangeBps24h;
      }

      stats.priceUsdc = livePriceUsdc;
      stats.fdvUsdc = liveFdvUsdc;
      stats.marketCapUsdc = liveFdvUsdc;
    }
  } else if (!launch.graduated) {
    // Pre-graduation, "liquidity" isn't a real DEX concept yet — the curve's own USDC reserve
    // is the closest analogue, already available as usdcRaised (returned below).
    liquidityUsdc = launch.usdcRaised.toString();
  }

  return NextResponse.json({
    id: launch.launchChainId,
    chain: launch.chain,
    launchChainId: launch.launchChainId,
    agentChainId: launch.agentChainId,
    agentName: agent?.name ?? null,
    token: launch.token,
    name: launch.name,
    symbol: launch.symbol,
    creator: launch.creator,
    // .toFixed(0), not .toString(): Decimal's own toString() switches to exponential
    // notation ("3e+26") past ~21 digits, which the client's BigInt(...) can't parse — see
    // decimalToBigInt's doc comment in lib/server/launchStats.ts.
    totalSupply: launch.totalSupply.toFixed(0),
    usdcRaised: launch.usdcRaised.toString(),
    tokensSold: launch.tokensSold.toFixed(0),
    graduationThreshold: launch.graduationThreshold.toString(),
    initialVirtualUsdcReserve: launch.initialVirtualUsdcReserve.toString(),
    buybackPoolUsdc: launch.buybackPoolUsdc.toString(),
    buybackBps: launch.buybackBps ?? 2000,
    buybackInterval: launch.buybackInterval,
    nextBuybackAt: launch.nextBuybackAt.toISOString(),
    tradingStartsAt: launch.tradingStartsAt.toISOString(),
    graduated: launch.graduated,
    active: launch.active,
    createdAtChain: launch.createdAtChain.toISOString(),
    graduatedAtChain: launch.graduatedAtChain?.toISOString() ?? null,
    priceUsdc: stats.priceUsdc.toString(),
    fdvUsdc: stats.fdvUsdc.toString(),
    marketCapUsdc: stats.marketCapUsdc.toString(),
    volume24hUsdc: stats.volume24hUsdc.toString(),
    priceChangeBps24h: stats.priceChangeBps24h,
    priceChangeBps7d: stats.priceChangeBps7d,
    liquidityUsdc,
    holdersCount: stats.holdersCount,
    holders: holdersWithLp,
    metadata: metadata
      ? {
          websiteUrl: metadata.websiteUrl,
          twitterUrl: metadata.twitterUrl,
          telegramUrl: metadata.telegramUrl,
          description: metadata.description,
          team: metadata.team,
        }
      : null,
  });
}
