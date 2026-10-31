import { NextResponse } from "next/server";
import { Chain, ListingMode, ListingStatus, prisma } from "@clawdhq/marketplace-db";

// Read-only: browses the indexer's cached listings. All writes (list/bid/withdraw/accept/
// settle) go directly on-chain from the caller's wallet via the SDK — this route never accepts
// or processes a state change, so a stale or wrong cache row here can never cause a bad
// on-chain action (see packages/marketplace-db/prisma/schema.prisma).

// Mirrors SELECTABLE_CHAINS in apps/web/src/lib/chains.ts (not imported directly — this route
// only needs the enum values, not chains.ts's viem/wagmi setup). Keep in sync: the indexer's DB
// can still hold rows for chains this app no longer supports (see marketplace-db's Chain enum),
// so this must default to (and validate against) only the chains actually reachable from here.
const DEFAULT_CHAINS: Chain[] = [Chain.MONAD_MAINNET];

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 100;

function parseChainParam(param: string | null): Chain | null {
  if (!param) return null;
  const clean = param.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  return null;
}

function serializeListing(
  listing: Awaited<ReturnType<typeof prisma.listing.findMany>>[number],
  valMap?: Map<string, bigint>
) {
  const key = `${listing.chain}:${listing.agentChainId}`;
  const liveVal = valMap?.get(key);
  const fairValueSnapshotUsdc = (liveVal && liveVal > 0n ? liveVal : listing.fairValueSnapshotUsdc).toString();

  return {
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
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawChain = url.searchParams.get("chain");
  const chain = rawChain ? parseChainParam(rawChain) : null;
  const statusParam = url.searchParams.get("status");
  const modeParam = url.searchParams.get("mode");
  const cursor = url.searchParams.get("cursor");
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT));

  if (rawChain && !chain) {
    return NextResponse.json({ error: `Unknown chain "${rawChain}"` }, { status: 400 });
  }
  if (statusParam && !(statusParam in ListingStatus)) {
    return NextResponse.json({ error: `Unknown status "${statusParam}"` }, { status: 400 });
  }
  if (modeParam && !(modeParam in ListingMode)) {
    return NextResponse.json({ error: `Unknown mode "${modeParam}"` }, { status: 400 });
  }

  const chainFilter = chain ? chain : { in: DEFAULT_CHAINS };

  const listings = await prisma.listing.findMany({
    where: {
      chain: chainFilter,
      status: statusParam ? (statusParam as ListingStatus) : undefined,
      mode: modeParam ? (modeParam as ListingMode) : undefined,
    },
    orderBy: { createdAtChain: "desc" },
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = listings.length > pageSize;
  const page = hasMore ? listings.slice(0, pageSize) : listings;

  // Enrich listings with the upgraded v2 valuations from AgentValuationCache
  const agentIds = page.map((l) => l.agentChainId);
  const valuations = agentIds.length > 0
    ? await prisma.agentValuationCache.findMany({
        where: {
          chain: chainFilter,
          agentChainId: { in: agentIds },
        },
        select: { chain: true, agentChainId: true, fairValueUsdc: true },
      })
    : [];
  const valMap = new Map(valuations.map((v) => [`${v.chain}:${v.agentChainId}`, v.fairValueUsdc]));

  return NextResponse.json({
    listings: page.map((l) => serializeListing(l, valMap)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
