import { Chain, TradeSide, prisma, type Launch } from "@clawdhq/marketplace-db";
import { currentPrice, priceAtTokensSold, fdvUsdc as fdvUsdcFor, EVM_TOKEN_DECIMALS_FACTOR, PRICE_PRECISION, TOTAL_WHOLE_SUPPLY } from "@/lib/bondingCurve";
import { getGraduatedPairReserves, isEvmPrismaChain, isXeroDeployed, type EvmPrismaChain } from "./evmExchangeReaders";
import { fromIndexerChainSlug } from "@/lib/chains";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Converts a Prisma `Decimal` (Launch.totalSupply/tokensSold, LaunchTrade.tokenAmount — see
 * their doc comments in schema.prisma for why they're Decimal(78,0) and not BigInt/BIGINT) to
 * a plain bigint. Deliberately `.toFixed(0)`, not `.toString()`: decimal.js's own `toString()`
 * switches to exponential notation ("3e+26") once a value exceeds ~21 digits, which
 * `BigInt(...)` cannot parse at all (throws `SyntaxError: Cannot convert ... to a BigInt`) —
 * a real crash this app hit immediately once a realistic-scale (1e27) value was ever stored.
 * `toFixed(0)` always returns plain fixed notation, which is exact here since these columns
 * only ever hold whole on-chain integer amounts (0 fractional digits). */
export function decimalToBigInt(value: { toFixed(dp: number): string } | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value.toFixed(0));
}

export interface LaunchStats {
  /** USDC (6dec) per whole token, right now. */
  priceUsdc: bigint;
  /** priceUsdc * total whole supply — a display stat only, never the graduation gate (see
   * ClawdHQLaunchpad.sol's usdcRaised-based threshold). */
  fdvUsdc: bigint;
  /** priceUsdc * circulating (sold) whole supply — distinct from fdvUsdc (total supply): shown
   * alongside it rather than instead of it, since the two answer different questions ("what's
   * this actually worth right now" vs. "what would it be worth fully diluted") and can diverge
   * a lot on a curve where most of the fixed 1B supply hasn't been bought yet. */
  marketCapUsdc: bigint;
  /** Sum of LaunchTrade.usdcAmount over the last 24h, both sides. */
  volume24hUsdc: bigint;
  /** (priceNow - price24hAgo) / price24hAgo, in basis points — null if there's no trade
   * history to reconstruct a 24h-ago price from (a brand-new launch). */
  priceChangeBps24h: number | null;
  /** (priceNow - price7dAgo) / price7dAgo, in basis points — null if there's no trade
   * history reaching back 7 days (e.g. a launch younger than a week, or one with no trades
   * at all in the window). Falls back to since-graduation change for graduated tokens. */
  priceChangeBps7d: number | null;
  /** Distinct traders with a net-positive position, derived from LaunchTrade (BUY - SELL per
   * address) — exact pre-graduation (every transfer is forced through the launchpad, see
   * AgentToken.sol), an approximation "as of graduation" afterward since real peer-to-peer
   * transfers aren't captured by this ledger. */
  holdersCount: number;
}

const statsCache = new Map<string, { stats: Map<string, LaunchStats>; expiresAt: number }>();
const inFlightStats = new Map<string, Promise<Map<string, LaunchStats>>>();
const STATS_CACHE_TTL_MS = 5_000;

export async function computeLaunchStats(
  chain: Chain,
  launches: (Pick<Launch, "launchChainId" | "tokensSold" | "usdcRaised" | "initialVirtualUsdcReserve" | "totalSupply"> & {
    chain?: Chain;
    graduated?: boolean;
    token?: string;
  })[]
): Promise<Map<string, LaunchStats>> {
  const launchChainIds = launches.map((l) => l.launchChainId);
  if (launchChainIds.length === 0) return new Map();

  // If launches span multiple chains, partition and compute per-chain
  const chainsPresent = new Set(launches.map((l) => l.chain || chain));
  if (chainsPresent.size > 1) {
    const merged = new Map<string, LaunchStats>();
    await Promise.all(
      Array.from(chainsPresent).map(async (c) => {
        const subset = launches.filter((l) => (l.chain || chain) === c);
        const stats = await computeLaunchStats(c, subset);
        for (const [k, v] of stats.entries()) {
          merged.set(k, v);
        }
      })
    );
    return merged;
  }

  const effectiveChain = launches[0]?.chain || chain;
  const cacheKey = `${effectiveChain}:${[...launchChainIds].sort().join(",")}`;
  const now = Date.now();
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.stats;
  }

  const inFlight = inFlightStats.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const since24h = new Date(Date.now() - DAY_MS);
      const since7d = new Date(Date.now() - WEEK_MS);

      const [allTimeGroups, last24hGroups, last7dGroups, holderGroups] = await Promise.all([
        prisma.launchTrade.groupBy({
          by: ["launchChainId", "side"],
          where: { chain, launchChainId: { in: launchChainIds }, createdAtChain: { gte: since24h } },
          _sum: { tokenAmount: true },
        }),
        prisma.launchTrade.groupBy({
          by: ["launchChainId", "side"],
          where: { chain, launchChainId: { in: launchChainIds }, createdAtChain: { gte: since24h } },
          _sum: { usdcAmount: true },
        }),
        prisma.launchTrade.groupBy({
          by: ["launchChainId", "side"],
          where: { chain, launchChainId: { in: launchChainIds }, createdAtChain: { gte: since7d } },
          _sum: { tokenAmount: true },
        }),
        prisma.launchTrade.groupBy({
          by: ["launchChainId", "traderAddress", "side"],
          where: { chain, launchChainId: { in: launchChainIds } },
          _sum: { tokenAmount: true },
        }),
      ]);

  // launchChainId -> net *raw 18-decimal* token delta bought in the last 24h (can be negative —
  // net sold) — same raw-unit convention as Launch.tokensSold, not whole tokens (tokenAmount is
  // Decimal(78,0), not BigInt, precisely because it's the full 18-decimal raw amount — see the
  // column's own doc comment in schema.prisma for why a plain bigint overflows here). Converted
  // to bigint immediately since it's always a whole integer on-chain amount; every arithmetic
  // site below stays in bigint, matching bondingCurve.ts's own convention.
  const netDelta24h = new Map<string, bigint>();
  for (const g of allTimeGroups) {
    const delta = decimalToBigInt(g._sum.tokenAmount);
    const signed = g.side === TradeSide.BUY ? delta : -delta;
    netDelta24h.set(g.launchChainId, (netDelta24h.get(g.launchChainId) ?? 0n) + signed);
  }

  // Same shape as netDelta24h but for the 7-day window.
  const netDelta7d = new Map<string, bigint>();
  for (const g of last7dGroups) {
    const delta = decimalToBigInt(g._sum.tokenAmount);
    const signed = g.side === TradeSide.BUY ? delta : -delta;
    netDelta7d.set(g.launchChainId, (netDelta7d.get(g.launchChainId) ?? 0n) + signed);
  }

  const volume24h = new Map<string, bigint>();
  for (const g of last24hGroups) {
    const amount = g._sum.usdcAmount ?? 0n;
    volume24h.set(g.launchChainId, (volume24h.get(g.launchChainId) ?? 0n) + amount);
  }

  // launchChainId -> traderAddress -> net token balance (all-time BUY - SELL).
  const netPositions = new Map<string, Map<string, bigint>>();
  for (const g of holderGroups) {
    const perTrader = netPositions.get(g.launchChainId) ?? new Map<string, bigint>();
    const amount = decimalToBigInt(g._sum.tokenAmount);
    const signed = g.side === TradeSide.BUY ? amount : -amount;
    perTrader.set(g.traderAddress, (perTrader.get(g.traderAddress) ?? 0n) + signed);
    netPositions.set(g.launchChainId, perTrader);
  }

  const graduatedLaunches = launches.filter((l) => {
    const c = l.chain || chain;
    return Boolean(l.graduated && l.token && isEvmPrismaChain(c) && isXeroDeployed(c));
  });
  const pairReservesByLaunch = new Map<string, { tokenReserve: bigint; usdcReserve: bigint }>();
  if (graduatedLaunches.length > 0) {
    const evmChainConfig = fromIndexerChainSlug(effectiveChain);
    if (evmChainConfig?.usdcAddress) {
      await Promise.all(
        graduatedLaunches.map(async (l) => {
          const c = (l.chain || chain) as EvmPrismaChain;
          try {
            const reserves = await getGraduatedPairReserves(c, l.token as `0x${string}`, evmChainConfig.usdcAddress as `0x${string}`);
            if (reserves && reserves.tokenReserve > 0n) {
              pairReservesByLaunch.set(l.launchChainId, reserves);
            }
          } catch {
            // Defensive fallback to curve snapshot
          }
        })
      );
    }
  }

  const stats = new Map<string, LaunchStats>();
  for (const launch of launches) {
    const tokensSold = decimalToBigInt(launch.tokensSold);
    const curveLaunch = { tokensSold, usdcRaised: launch.usdcRaised, initialVirtualUsdcReserve: launch.initialVirtualUsdcReserve };

    const reserves = pairReservesByLaunch.get(launch.launchChainId);
    let priceUsdc: bigint;
    let fdvUsdc: bigint;
    let marketCapUsdc: bigint;
    let priceChangeBps24h: number | null = null;
    let priceChangeBps7d: number | null = null;

    if (reserves && reserves.tokenReserve > 0n) {
      priceUsdc = (reserves.usdcReserve * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / reserves.tokenReserve;
      fdvUsdc = (priceUsdc * TOTAL_WHOLE_SUPPLY) / PRICE_PRECISION;
      marketCapUsdc = fdvUsdc;

      // For graduated tokens, fall back to since-graduation change for both windows
      // (no pre-graduation trade ledger to reconstruct 7d-ago price from).
      const initialTokensInPair = TOTAL_WHOLE_SUPPLY * EVM_TOKEN_DECIMALS_FACTOR - tokensSold;
      const graduationPrice = initialTokensInPair > 0n
        ? (launch.usdcRaised * EVM_TOKEN_DECIMALS_FACTOR * PRICE_PRECISION) / initialTokensInPair
        : 0n;
      if (graduationPrice > 0n) {
        priceChangeBps24h = Number(((priceUsdc - graduationPrice) * 10_000n) / graduationPrice);
        priceChangeBps7d = priceChangeBps24h;
      }
    } else {
      priceUsdc = currentPrice(curveLaunch, EVM_TOKEN_DECIMALS_FACTOR);
      fdvUsdc = fdvUsdcFor(curveLaunch);
      marketCapUsdc = (priceUsdc * (tokensSold / EVM_TOKEN_DECIMALS_FACTOR)) / PRICE_PRECISION;

      const delta24h = netDelta24h.get(launch.launchChainId) ?? 0n;
      const tokensSold24hAgo = tokensSold - delta24h;
      if (tokensSold24hAgo >= 0n && delta24h !== 0n) {
        const price24hAgo = priceAtTokensSold(launch.initialVirtualUsdcReserve, tokensSold24hAgo, EVM_TOKEN_DECIMALS_FACTOR);
        if (price24hAgo > 0n) {
          priceChangeBps24h = Number(((priceUsdc - price24hAgo) * 10_000n) / price24hAgo);
        }
      }

      const delta7d = netDelta7d.get(launch.launchChainId) ?? 0n;
      const tokensSold7dAgo = tokensSold - delta7d;
      if (tokensSold7dAgo >= 0n && delta7d !== 0n) {
        const price7dAgo = priceAtTokensSold(launch.initialVirtualUsdcReserve, tokensSold7dAgo, EVM_TOKEN_DECIMALS_FACTOR);
        if (price7dAgo > 0n) {
          priceChangeBps7d = Number(((priceUsdc - price7dAgo) * 10_000n) / price7dAgo);
        }
      }
    }

    const perTrader = netPositions.get(launch.launchChainId);
    const holdersCount = perTrader ? [...perTrader.values()].filter((balance) => balance > 0n).length : 0;

    stats.set(launch.launchChainId, {
      priceUsdc,
      fdvUsdc,
      marketCapUsdc,
      volume24hUsdc: volume24h.get(launch.launchChainId) ?? 0n,
      priceChangeBps24h,
      priceChangeBps7d,
      holdersCount,
    });
  }

  statsCache.set(cacheKey, { stats, expiresAt: Date.now() + STATS_CACHE_TTL_MS });
  return stats;
  } finally {
    inFlightStats.delete(cacheKey);
  }
})();

inFlightStats.set(cacheKey, promise);
return promise;
}

export interface HolderEntry {
  address: string;
  balance: string;
  isLiquidityPool: boolean;
}

/** Top-N holders for a single launch, derived from LaunchTrade net positions (see
 * LaunchStats.holdersCount's doc comment on the pre/post-graduation accuracy caveat). Unlike
 * computeLaunchStats (which only needs a count for the list view), this returns real ranked
 * balances for the detail page's holders panel — kept as a separate function since the two
 * call sites have different enough shapes that sharing one would mean the list route paying
 * for data it never uses. */
export async function getLaunchHolders(chain: Chain, launchChainId: string, limit = 20): Promise<HolderEntry[]> {
  const groups = await prisma.launchTrade.groupBy({
    by: ["traderAddress", "side"],
    where: { chain, launchChainId },
    _sum: { tokenAmount: true },
  });

  const perTrader = new Map<string, bigint>();
  for (const g of groups) {
    const amount = decimalToBigInt(g._sum.tokenAmount);
    const signed = g.side === TradeSide.BUY ? amount : -amount;
    perTrader.set(g.traderAddress, (perTrader.get(g.traderAddress) ?? 0n) + signed);
  }

  return [...perTrader.entries()]
    .filter(([, balance]) => balance > 0n)
    .sort(([, a], [, b]) => (b > a ? 1 : b < a ? -1 : 0))
    .slice(0, limit)
    .map(([address, balance]) => ({ address, balance: balance.toString(), isLiquidityPool: false }));
}
