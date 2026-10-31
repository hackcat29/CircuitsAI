import { NextResponse } from "next/server";
import { Chain, TradeSide, prisma } from "@clawdhq/marketplace-db";
import { decimalToBigInt } from "@/lib/server/launchStats";
import { priceAtTokensSold, EVM_TOKEN_DECIMALS_FACTOR, PRICE_PRECISION } from "@/lib/bondingCurve";
import { getGraduatedPairReserves, isEvmPrismaChain, isXeroDeployed } from "@/lib/server/evmExchangeReaders";
import { fromIndexerChainSlug } from "@/lib/chains";

// Feeds PriceChart.tsx's lightweight-charts area series. Bucketed on read from the raw
// LaunchTrade ledger — no precomputed candle table (matches this app's testnet-scale "computed
// on read" convention elsewhere, e.g. launchStats.ts's 24h volume/gainers math). Revisit with a
// real rollup table only if trade volume ever grows enough for per-request bucketing to matter.
//
// Plots the curve's real, fee-*excluded* price after each trade (via priceAtTokensSold, the
// same constant-product-invariant reconstruction launchStats.ts already uses for its 24h-ago
// price), not each trade's own realized (fee-inclusive) rate. An earlier version of this route
// used the latter (usdcAmount / tokenAmount) — deliberately, per that version's own comment,
// "what actually happened" — but that makes the chart visibly track the anti-snipe fee instead
// of the curve: a trade taxed at the elevated 20% anti-snipe rate looks like it paid a much
// higher price per token than a later, normal-2%-fee trade even when the curve only ever moved
// up, producing a chart that appears to *drop* right after launch. priceAtTokensSold sidesteps
// this entirely — it's a pure function of cumulative tokensSold, so it always matches what
// `currentPrice`/the Trade card's "Current price" would have shown at that exact moment,
// regardless of what fee rate that particular trade happened to pay.
function parseChain(value: string | null): Chain | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  if (clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  return null;
}

interface Candle {
  time: number; // unix seconds, bucket start
  open: string;
  high: string;
  low: string;
  close: string;
}

export async function GET(request: Request, context: { params: Promise<{ launchChainId: string }> }) {
  const { launchChainId } = await context.params;
  const url = new URL(request.url);
  const rawChain = parseChain(url.searchParams.get("chain"));
  const candidateChains = rawChain ? [rawChain] : [Chain.MONAD_MAINNET, Chain.BSC_TESTNET];

  let launch = rawChain
    ? await prisma.launch.findUnique({
        where: { chain_launchChainId: { chain: rawChain, launchChainId } },
        select: {
          chain: true,
          initialVirtualUsdcReserve: true,
          createdAtChain: true,
          graduated: true,
          graduatedAtChain: true,
          token: true,
          totalSupply: true,
          tokensSold: true,
          usdcRaised: true,
        },
      })
    : null;

  if (!launch) {
    launch = await prisma.launch.findFirst({
      where: { launchChainId, chain: { in: candidateChains } },
      select: {
        chain: true,
        initialVirtualUsdcReserve: true,
        createdAtChain: true,
        graduated: true,
        graduatedAtChain: true,
        token: true,
        totalSupply: true,
        tokensSold: true,
        usdcRaised: true,
      },
    });
  }
  if (!launch) return NextResponse.json({ error: "Launch not found" }, { status: 404 });

  const intervalMinutes = Math.min(1440, Math.max(1, Number(url.searchParams.get("intervalMinutes")) || 15));
  const intervalSeconds = intervalMinutes * 60;
  const source = url.searchParams.get("source") || (launch.graduated ? "dex" : "curve");
  const isDexMode = Boolean(launch.graduated && launch.graduatedAtChain && source !== "curve");

  const trades = await prisma.launchTrade.findMany({
    where: { chain: launch.chain, launchChainId },
    orderBy: { createdAtChain: "asc" },
    select: { tokenAmount: true, usdcAmount: true, side: true, createdAtChain: true },
  });

  const candlesByBucket = new Map<number, Candle>();

  if (isDexMode && launch.graduatedAtChain) {
    // DexScreener Standard: For graduated tokens, start the chart cleanly at Uniswap V2 / Xero
    // pool inception. The opening price is determined by the real liquidity seeded into the pair:
    // usdcRaised / remainingTokens (totalSupply - tokensSold).
    const remainingTokens = decimalToBigInt(launch.totalSupply) - decimalToBigInt(launch.tokensSold);
    const initialDexPrice = remainingTokens > 0n
      ? (launch.usdcRaised * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / remainingTokens
      : 0n;
    const initialDexPriceStr = initialDexPrice.toString();

    const genesisBucket = Math.floor(launch.graduatedAtChain.getTime() / 1000 / intervalSeconds) * intervalSeconds;
    candlesByBucket.set(genesisBucket, {
      time: genesisBucket,
      open: initialDexPriceStr,
      high: initialDexPriceStr,
      low: initialDexPriceStr,
      close: initialDexPriceStr,
    });

    for (const trade of trades) {
      if (trade.createdAtChain < launch.graduatedAtChain) continue;
      const tokenAmount = decimalToBigInt(trade.tokenAmount);
      if (tokenAmount === 0n) continue;

      const price = (trade.usdcAmount * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / tokenAmount;
      const priceStr = price.toString();
      const bucketStart = Math.floor(trade.createdAtChain.getTime() / 1000 / intervalSeconds) * intervalSeconds;

      const existing = candlesByBucket.get(bucketStart);
      if (!existing) {
        candlesByBucket.set(bucketStart, { time: bucketStart, open: priceStr, high: priceStr, low: priceStr, close: priceStr });
        continue;
      }
      existing.close = priceStr;
      if (price > BigInt(existing.high)) existing.high = priceStr;
      if (price < BigInt(existing.low)) existing.low = priceStr;
    }

    if (isEvmPrismaChain(launch.chain) && isXeroDeployed(launch.chain) && launch.token) {
      const evmChainConfig = fromIndexerChainSlug(launch.chain);
      if (evmChainConfig?.usdcAddress) {
        try {
          const reserves = await getGraduatedPairReserves(launch.chain, launch.token as `0x${string}`, evmChainConfig.usdcAddress as `0x${string}`);
          if (reserves && reserves.tokenReserve > 0n) {
            const livePrice = (reserves.usdcReserve * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / reserves.tokenReserve;
            const livePriceStr = livePrice.toString();
            const nowBucket = Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
            const existing = candlesByBucket.get(nowBucket);
            if (existing) {
              existing.close = livePriceStr;
              if (livePrice > BigInt(existing.high)) existing.high = livePriceStr;
              if (livePrice < BigInt(existing.low)) existing.low = livePriceStr;
            } else {
              candlesByBucket.set(nowBucket, { time: nowBucket, open: livePriceStr, high: livePriceStr, low: livePriceStr, close: livePriceStr });
            }
          }
        } catch {
          // Defensive
        }
      }
    }
  } else {
    // Genesis point: the curve's true starting price (tokensSold=0), before any trade — anchors
    // the chart's leftmost point at where the curve actually started, matching this launch's own
    // FDV-at-zero-tokens-sold, rather than letting the first real trade's (possibly fee-inflated)
    // realized rate silently stand in for it.
    const genesisBucket = Math.floor(launch.createdAtChain.getTime() / 1000 / intervalSeconds) * intervalSeconds;
    const genesisPrice = priceAtTokensSold(launch.initialVirtualUsdcReserve, 0n, EVM_TOKEN_DECIMALS_FACTOR).toString();
    candlesByBucket.set(genesisBucket, { time: genesisBucket, open: genesisPrice, high: genesisPrice, low: genesisPrice, close: genesisPrice });

    let cumulativeTokensSold = 0n;
    for (const trade of trades) {
      if (launch.graduated && launch.graduatedAtChain && trade.createdAtChain >= launch.graduatedAtChain) {
        // In bonding curve history mode, omit post-graduation trades
        continue;
      }
      const tokenAmount = decimalToBigInt(trade.tokenAmount);
      if (tokenAmount === 0n) continue;

      cumulativeTokensSold += trade.side === TradeSide.BUY ? tokenAmount : -tokenAmount;
      const price = priceAtTokensSold(launch.initialVirtualUsdcReserve, cumulativeTokensSold, EVM_TOKEN_DECIMALS_FACTOR);
      const priceStr = price.toString();
      const bucketStart = Math.floor(trade.createdAtChain.getTime() / 1000 / intervalSeconds) * intervalSeconds;

      const existing = candlesByBucket.get(bucketStart);
      if (!existing) {
        candlesByBucket.set(bucketStart, { time: bucketStart, open: priceStr, high: priceStr, low: priceStr, close: priceStr });
        continue;
      }
      existing.close = priceStr;
      if (price > BigInt(existing.high)) existing.high = priceStr;
      if (price < BigInt(existing.low)) existing.low = priceStr;
    }
  }

  const candles = [...candlesByBucket.values()].sort((a, b) => a.time - b.time);
  return NextResponse.json({
    candles,
    graduated: Boolean(launch.graduated),
    mode: isDexMode ? "dex" : "curve",
  });
}
