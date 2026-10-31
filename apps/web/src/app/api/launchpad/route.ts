import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { computeLaunchStats } from "@/lib/server/launchStats";

// Backed by the indexer's Launch cache (see packages/marketplace-db/prisma/schema.prisma and
// apps/indexer's syncLaunch) rather than live RPC — this is what makes a sortable
// trending/gainers/top/graduated list possible at all; the old useLaunches.ts approach
// (iterate the last 20 launchIds over live RPC) can't support any of these sorts.
//
// Pagination is plain offset+limit for every tab, not cursor-based: "trending"/"gainers"/"top"
// need every candidate's computed stats before they can be sorted at all, which doesn't compose
// with DB-level cursor pagination the way a straightforward `orderBy` does — and at this app's
// current (testnet) scale, fetching the full per-chain candidate set once per request is cheap.
// Revisit if this chain's launch count ever grows enough for that assumption to stop holding.

type Tab = "trending" | "top" | "gainers" | "new" | "graduated";

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 100;
const CANDIDATE_CAP = 500;

function parseChain(value: string | null): Chain | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  return null;
}

function parseTab(value: string | null): Tab {
  const valid: Tab[] = ["trending", "top", "gainers", "new", "graduated"];
  return valid.includes(value as Tab) ? (value as Tab) : "new";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = parseChain(url.searchParams.get("chain"));
  if (!chain) return NextResponse.json({ error: "Missing or unknown chain" }, { status: 400 });

  const tab = parseTab(url.searchParams.get("tab"));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT));

  // trending/gainers/top can't be sorted by their real metric at the DB level — that requires
  // computeLaunchStats' trade-ledger aggregation below, which doesn't compose with a plain SQL
  // orderBy (see this route's own top-of-file comment). So CANDIDATE_CAP caps which launches
  // even get considered for those three tabs, and the orderBy here is only a *proxy* for "likely
  // relevant" — without one, Postgres returns whatever its own physical/insertion order happens
  // to be, so once total launches exceed CANDIDATE_CAP, a genuinely top-ranked launch outside
  // that arbitrary slice would never be seen at all. usdcRaised (real column, grows with FDV) is
  // a reasonable proxy for "top"; updatedAtChain (bumped on every trade sync) is a reasonable
  // proxy for "has recent activity" for trending/gainers. Still an approximation, not a fix —
  // see CANDIDATE_CAP's own doc comment for when this needs real denormalized metric columns.
  const candidateOrderBy =
    tab === "new" || tab === "graduated"
      ? ({ createdAtChain: "desc" } as const)
      : tab === "top"
        ? ({ usdcRaised: "desc" } as const)
        : ({ updatedAtChain: "desc" } as const);

  const candidateChains = [chain];

  const candidates = await prisma.launch.findMany({
    where: { chain: { in: candidateChains }, ...(tab === "graduated" ? { graduated: true } : {}) },
    orderBy: candidateOrderBy,
    take: CANDIDATE_CAP,
  });

  const statsByLaunchChainId = await computeLaunchStats(chain, candidates);

  const agents = await prisma.agent.findMany({
    where: { chain: { in: candidateChains }, agentChainId: { in: candidates.map((c) => c.agentChainId) } },
    select: { agentChainId: true, name: true, chain: true },
  });
  const agentNameById = new Map(agents.map((a) => [`${a.chain}:${a.agentChainId}`, a.name]));

  const enriched = candidates.map((launch) => {
    const stats = statsByLaunchChainId.get(launch.launchChainId) || {
      priceUsdc: 0n,
      fdvUsdc: 0n,
      marketCapUsdc: 0n,
      volume24hUsdc: 0n,
      priceChangeBps24h: null,
      priceChangeBps7d: null,
      holdersCount: 0,
    };
    return {
      id: launch.launchChainId,
      chain: launch.chain,
      launchChainId: launch.launchChainId,
      agentChainId: launch.agentChainId,
      agentName: agentNameById.get(`${launch.chain}:${launch.agentChainId}`) ?? null,
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
      graduated: launch.graduated,
      active: launch.active,
      tradingStartsAt: launch.tradingStartsAt.toISOString(),
      createdAtChain: launch.createdAtChain.toISOString(),
      graduatedAtChain: launch.graduatedAtChain?.toISOString() ?? null,
      priceUsdc: stats.priceUsdc.toString(),
      fdvUsdc: stats.fdvUsdc.toString(),
      marketCapUsdc: stats.marketCapUsdc.toString(),
      volume24hUsdc: stats.volume24hUsdc.toString(),
      priceChangeBps24h: stats.priceChangeBps24h,
      priceChangeBps7d: stats.priceChangeBps7d,
      holdersCount: stats.holdersCount,
    };
  });

  switch (tab) {
    case "trending":
      enriched.sort((a, b) => Number(BigInt(b.volume24hUsdc) - BigInt(a.volume24hUsdc)));
      break;
    case "gainers":
      enriched.sort((a, b) => (b.priceChangeBps7d ?? -Infinity) - (a.priceChangeBps7d ?? -Infinity));
      break;
    case "top":
      enriched.sort((a, b) => Number(BigInt(b.fdvUsdc) - BigInt(a.fdvUsdc)));
      break;
    // "new"/"graduated" are already DB-ordered above.
  }

  const page = enriched.slice(offset, offset + pageSize);

  return NextResponse.json({
    launches: page,
    total: enriched.length,
    hasMore: offset + pageSize < enriched.length,
  });
}
