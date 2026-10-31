import { NextResponse } from "next/server";
import { Chain, TradeSide, prisma } from "@clawdhq/marketplace-db";
import { parseEventLogs, getContract, type Address } from "viem";
import { clawdHQLaunchpadAbi, xeroPairAbi } from "@clawdhq/sdk";
import { isEvmPrismaChain, publicClientFor } from "@/lib/server/evmExchangeReaders";
import { fromIndexerChainSlug } from "@/lib/chains";

// Read-only: browses the indexer's mirror of ClawdHQLaunchpad.sol's TokensPurchased/
// TokensSold events. There's no write path here — buying/selling always goes directly
// on-chain from the caller's wallet via useLaunchpadActions.
//
// `trader` is optional (was required until this route grew a second use — see
// useLaunchpadTrades.ts's per-wallet history, which still passes it): omitting it, optionally
// combined with `launchChainId`, serves an all-traders feed for a single launch (the detail
// page's "Recent Trades" panel and the homepage's "Live Trades" panel — no `launchChainId` for
// the latter, across whichever `chain` is active).

// Mirrors SELECTABLE_CHAINS in apps/web/src/lib/chains.ts — see exchange/listings/route.ts's
// identical comment for why this isn't imported directly.
const DEFAULT_CHAINS: Chain[] = [Chain.MONAD_MAINNET, Chain.BASE_SEPOLIA, Chain.ETH_SEPOLIA, Chain.BSC_TESTNET];

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

function serializeTrade(trade: Awaited<ReturnType<typeof prisma.launchTrade.findMany>>[number]) {
  return {
    id: trade.id,
    chain: trade.chain,
    launchChainId: trade.launchChainId,
    traderAddress: trade.traderAddress,
    side: trade.side,
    // .toFixed(0), not .toString(): tokenAmount is Decimal(78,0) (see its doc comment in
    // schema.prisma), and Decimal's own toString() switches to exponential notation
    // ("3e+26") past ~21 digits, which BigInt(...) can't parse on the consuming side.
    tokenAmount: trade.tokenAmount.toFixed(0),
    usdcAmount: trade.usdcAmount.toString(),
    txHash: trade.txHash,
    createdAtChain: trade.createdAtChain.toISOString(),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawChain = url.searchParams.get("chain");
  const chain = rawChain ? parseChainParam(rawChain) : null;
  const trader = url.searchParams.get("trader");
  const launchChainId = url.searchParams.get("launchChainId");
  const sideParam = url.searchParams.get("side");
  const cursor = url.searchParams.get("cursor");
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT));

  if (rawChain && !chain) {
    return NextResponse.json({ error: `Unknown chain "${rawChain}"` }, { status: 400 });
  }
  if (sideParam && !(sideParam in TradeSide)) {
    return NextResponse.json({ error: `Unknown side "${sideParam}"` }, { status: 400 });
  }

  const chainFilter = chain ? chain : { in: DEFAULT_CHAINS };

  const trades = await prisma.launchTrade.findMany({
    where: {
      chain: chainFilter,
      traderAddress: trader ? { equals: trader, mode: "insensitive" } : undefined,
      launchChainId: launchChainId ?? undefined,
      side: sideParam ? (sideParam as TradeSide) : undefined,
    },
    orderBy: { createdAtChain: "desc" },
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = trades.length > pageSize;
  const page = hasMore ? trades.slice(0, pageSize) : trades;

  return NextResponse.json({
    trades: page.map(serializeTrade),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawChain = body.chain;
    const chain = rawChain ? parseChainParam(rawChain) : null;
    const txHash = typeof body.txHash === "string" ? body.txHash.trim() : null;

    if (!chain || !isEvmPrismaChain(chain)) {
      return NextResponse.json({ error: `Invalid chain "${rawChain}"` }, { status: 400 });
    }
    if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
      return NextResponse.json({ error: `Invalid txHash "${txHash}"` }, { status: 400 });
    }

    const publicClient = publicClientFor(chain);
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Address });
    if (!receipt) {
      return NextResponse.json({ error: "Transaction receipt not found" }, { status: 404 });
    }

    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    const blockTimestamp = new Date(Number(block.timestamp) * 1000);

    const evmChainConfig = fromIndexerChainSlug(chain);
    const usdcAddress = evmChainConfig?.usdcAddress?.toLowerCase();

    const createdTrades: string[] = [];

    // 1. Check for Xero/Uniswap V2 Pair Swap events
    try {
      const swapEvents = parseEventLogs({ abi: xeroPairAbi, logs: receipt.logs }).filter((e) => e.eventName === "Swap");
      for (const event of swapEvents) {
        const pairAddress = event.address as Address;
        const pairContract = getContract({
          address: pairAddress,
          abi: xeroPairAbi,
          client: { public: publicClient },
        }) as unknown as { read: { token0: () => Promise<Address>; token1: () => Promise<Address> } };

        const [token0, token1] = await Promise.all([pairContract.read.token0(), pairContract.read.token1()]);
        const token0Lower = token0.toLowerCase();
        const token1Lower = token1.toLowerCase();

        const token0IsUsdc = token0Lower === usdcAddress;
        const token1IsUsdc = token1Lower === usdcAddress;
        if (!token0IsUsdc && !token1IsUsdc) continue;

        const launchTokenAddress = token0IsUsdc ? token1Lower : token0Lower;
        const launch = await prisma.launch.findFirst({
          where: { chain, token: { equals: launchTokenAddress, mode: "insensitive" } },
          select: { launchChainId: true },
        });
        if (!launch) continue;

        const args = event.args as { sender: Address; to: Address; amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint };
        let side: TradeSide;
        let tokenAmount: bigint;
        let usdcAmount: bigint;
        let trader: string;

        if (token0IsUsdc) {
          if (args.amount0In > 0n) {
            side = TradeSide.BUY;
            usdcAmount = args.amount0In;
            tokenAmount = args.amount1Out;
            trader = args.to;
          } else {
            side = TradeSide.SELL;
            tokenAmount = args.amount1In;
            usdcAmount = args.amount0Out;
            trader = args.sender;
          }
        } else {
          if (args.amount1In > 0n) {
            side = TradeSide.BUY;
            usdcAmount = args.amount1In;
            tokenAmount = args.amount0Out;
            trader = args.to;
          } else {
            side = TradeSide.SELL;
            tokenAmount = args.amount0In;
            usdcAmount = args.amount1Out;
            trader = args.sender;
          }
        }

        const trade = await prisma.launchTrade.upsert({
          where: { chain_txHash_logIndex: { chain, txHash: receipt.transactionHash, logIndex: event.logIndex } },
          create: {
            chain,
            launchChainId: launch.launchChainId,
            traderAddress: trader,
            side,
            tokenAmount: tokenAmount.toString(),
            usdcAmount,
            txHash: receipt.transactionHash,
            logIndex: event.logIndex,
            createdAtChain: blockTimestamp,
          },
          update: {},
        });
        createdTrades.push(trade.id);
      }
    } catch (err) {
      console.warn("Error parsing Swap events in POST /api/launchpad/trades:", err);
    }

    // 2. Check for ClawdHQLaunchpad TokensPurchased / TokensSold events
    try {
      const launchpadEvents = parseEventLogs({ abi: clawdHQLaunchpadAbi, logs: receipt.logs });
      for (const event of launchpadEvents) {
        if (event.eventName === "TokensPurchased") {
          const args = event.args as { launchId: bigint; buyer: string; tokensOut: bigint; usdcIn: bigint };
          const trade = await prisma.launchTrade.upsert({
            where: { chain_txHash_logIndex: { chain, txHash: receipt.transactionHash, logIndex: event.logIndex } },
            create: {
              chain,
              launchChainId: args.launchId.toString(),
              traderAddress: args.buyer,
              side: TradeSide.BUY,
              tokenAmount: args.tokensOut.toString(),
              usdcAmount: args.usdcIn,
              txHash: receipt.transactionHash,
              logIndex: event.logIndex,
              createdAtChain: blockTimestamp,
            },
            update: {},
          });
          createdTrades.push(trade.id);
        } else if (event.eventName === "TokensSold") {
          const args = event.args as { launchId: bigint; seller: string; tokensIn: bigint; usdcOut: bigint };
          const trade = await prisma.launchTrade.upsert({
            where: { chain_txHash_logIndex: { chain, txHash: receipt.transactionHash, logIndex: event.logIndex } },
            create: {
              chain,
              launchChainId: args.launchId.toString(),
              traderAddress: args.seller,
              side: TradeSide.SELL,
              tokenAmount: args.tokensIn.toString(),
              usdcAmount: args.usdcOut,
              txHash: receipt.transactionHash,
              logIndex: event.logIndex,
              createdAtChain: blockTimestamp,
            },
            update: {},
          });
          createdTrades.push(trade.id);
        }
      }
    } catch (err) {
      console.warn("Error parsing Launchpad events in POST /api/launchpad/trades:", err);
    }

    return NextResponse.json({ success: true, count: createdTrades.length, tradeIds: createdTrades });
  } catch (error) {
    console.error("POST /api/launchpad/trades error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record trade" }, { status: 500 });
  }
}
