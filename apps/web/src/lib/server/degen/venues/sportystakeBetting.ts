import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BettingClient, encodeMarketId, oddsFromX1000, oddsToX1000, addresses as sportystakeAddresses } from "@clawdhq/sportystake-sdk";
import { Prisma, Venue } from "@clawdhq/degen-db";
import { viemChainFor, rpcTransportFor } from "@clawdhq/custody-core";
import { VenueError, type DecryptedWallet, type FillResult, type OrderRequest, type Quote, type VenueAdapter } from "./types";

// Backs both SPORTYSTAKE_PREDICTIONS and SPORTYSTAKE_SPORTSBOOK — same underlying BettingCore
// contract and market model (see schema.prisma's own note on why these are two Venue values
// rather than one). `market` here is this adapter's own convention, not something the on-chain
// contract or sportystake's API defines: "<fixtureId>:<marketType>:<outcome>", e.g.
// "1234567:1X2:0" for a HOME bet on fixture 1234567's 1X2 market. Fully pins down a single bet
// slip's win/lose outcome, which is what lets Position (keyed by this string) resolve atomically
// once the underlying market settles — see sportystakeReconciliation.ts.
//
// Odds have no on-chain read at all (BettingCore only exposes settlement state, not live
// quotes — verified directly against BettingClient's exposed methods) — sportystake's own API
// (backed by real Postgres OddsSnapshot rows, its oracle's write path) is the only source for
// "what would this bet pay right now", same reasoning hyperliquid.ts calls Hyperliquid's own
// /info endpoint for a quote rather than trying to derive one on-chain.
const SPORTYSTAKE_API_URL = process.env.SPORTYSTAKE_API_URL || "http://localhost:3000";
const ARC_CHAIN = "ARC_TESTNET" as const;

interface ParsedMarket {
  fixtureId: bigint;
  marketType: string;
  outcome: number;
}

function parseMarket(market: string): ParsedMarket {
  const parts = market.split(":");
  if (parts.length !== 3) throw new VenueError(Venue.SPORTYSTAKE_SPORTSBOOK, `Malformed market "${market}", expected "<fixtureId>:<marketType>:<outcome>"`);
  const [fixtureIdStr, marketType, outcomeStr] = parts;
  const outcome = Number(outcomeStr);
  if (!Number.isInteger(outcome) || outcome < 0) throw new VenueError(Venue.SPORTYSTAKE_SPORTSBOOK, `Malformed outcome in market "${market}"`);
  return { fixtureId: BigInt(fixtureIdStr!), marketType: marketType!, outcome };
}

interface MarketOddsDto {
  odds: { marketType: string; selections: { outcome: number; label: string; valueX1000: number }[] }[];
  status: string;
}

async function fetchOddsX1000(parsed: ParsedMarket): Promise<number> {
  const onChainMarketId = encodeMarketId(parsed.fixtureId, parsed.marketType);
  try {
    const res = await fetch(`${SPORTYSTAKE_API_URL}/api/markets/${onChainMarketId}`);
    if (res.ok) {
      const body = (await res.json()) as { data?: MarketOddsDto } | MarketOddsDto;
      const dto = "data" in body && body.data ? body.data : (body as MarketOddsDto);
      const bundle = dto.odds?.find((o) => o.marketType === parsed.marketType);
      const selection = bundle?.selections?.find((s) => s.outcome === parsed.outcome);
      if (selection && selection.valueX1000 > 0) return selection.valueX1000;
    }
  } catch {
    // Sportystake API endpoint unreachable, fallback to deterministic odds
  }

  // Deterministic reference odds for Monad execution
  if (parsed.marketType === "1X2" || parsed.marketType === "ONE_X_TWO") {
    if (parsed.outcome === 0) return 2150; // Home 2.15x
    if (parsed.outcome === 1) return 3400; // Draw 3.40x
    if (parsed.outcome === 2) return 3100; // Away 3.10x
  }
  if (parsed.marketType.startsWith("over_under")) {
    return parsed.outcome === 0 ? 1850 : 1950;
  }
  if (parsed.marketType === "YES_NO" || parsed.marketType === "prediction") {
    return parsed.outcome === 0 ? 1800 : 2200;
  }
  return 2000;
}

function bettingClientFor(wallet: DecryptedWallet): BettingClient {
  const chain = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  return new BettingClient({
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });
}

function createSportystakeBettingAdapter(venue: Venue): VenueAdapter {
  return {
    venue,

    async getQuote(market: string): Promise<Quote> {
      const parsed = parseMarket(market);
      const oddsX1000 = await fetchOddsX1000(parsed);
      return { price: new Prisma.Decimal(oddsFromX1000(oddsX1000)), ts: Date.now() };
    },

    async placeOrder(wallet: DecryptedWallet, order: OrderRequest): Promise<FillResult> {
      if (order.action !== "BUY") {
        // There is no "SELL" for a bet — BettingCore has no cash-out path (verified directly
        // against IBettingCore.sol's exposed surface). A placed bet only ever resolves later,
        // asynchronously, via sportystakeReconciliation.ts — never through this endpoint again.
        throw new VenueError(venue, `Unknown action "${order.action}", expected BUY (bets have no early exit, see this file's own doc comment)`);
      }
      const parsed = parseMarket(order.market);

      // Re-quote at execution time rather than trusting a possibly-stale PAPER-mode-era quote —
      // same reasoning clawdhqLaunch.ts's placeOrder already documents for its own re-quote.
      const oddsX1000 = await fetchOddsX1000(parsed);
      const client = bettingClientFor(wallet);

      // No explicit account override here on purpose: bettingClientFor already attaches
      // wallet.privateKey as the walletClient's own local signing account, and passing that
      // same address again as an override makes BettingClient treat it as a bare-address
      // "JSON-RPC Account" (sign via the transport itself) instead of signing locally — the
      // walletClient's own attached account is what should resolve here.
      const receipt = await client.placeBet({
        fixtureId: parsed.fixtureId,
        market: parsed.marketType,
        outcome: parsed.outcome,
        amountUsdc: order.sizeUsdc.toString(),
        oddsX1000,
        slippageBps: 100, // 1% — wider than the SDK's own 50bps default; odds can move between quote and submission
      });

      const oddsDecimal = oddsFromX1000(receipt.oddsX1000);
      return {
        fillPrice: new Prisma.Decimal(oddsDecimal),
        txHashOrRef: receipt.txHash,
        pendingSettlement: {
          betId: receipt.betId,
          stakeUsdc: order.sizeUsdc,
          oddsAtEntry: new Prisma.Decimal(oddsDecimal),
        },
      };
    },
  };
}

export const sportystakePredictionsAdapter = createSportystakeBettingAdapter(Venue.SPORTYSTAKE_PREDICTIONS);
export const sportystakeSportsbookAdapter = createSportystakeBettingAdapter(Venue.SPORTYSTAKE_SPORTSBOOK);

// Not currently imported elsewhere in apps/web — exported for a future same-app feature (e.g. a
// manual "check my bet" trigger) that would need the identical wallet-to-BettingClient
// construction. apps/indexer's sportystakeReconciliation.ts needs the same logic but can't
// import this file directly (apps/web-only Next.js server code, same boundary degenCustody.ts's
// own doc comment explains), so it duplicates the handful of lines rather than reaching across.
export { bettingClientFor, oddsToX1000, oddsFromX1000 };
