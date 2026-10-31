import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { Prisma, Venue } from "@clawdhq/degen-db";
import { VenueError, type DecryptedWallet, type FillResult, type OrderRequest, type Quote, type VenueAdapter } from "./types";

// Hyperliquid's public POST /info endpoint with {"type":"allMids"} returns a flat map of bare
// ticker -> mid price string (e.g. {"BTC":"62271.5", ...}), no auth needed — verified live
// against both HYPERLIQUID_API_URL's testnet default and mainnet before writing this. market
// accepts either the bare ticker ("BTC") or the "-PERP"-suffixed form used in this feature's
// own API examples ("BTC-PERP"); both resolve to the same lookup.
//
// LIVE-mode order placement is built on @nktkas/hyperliquid — the established community
// TypeScript SDK — rather than hand-rolled signing. Hyperliquid's own docs are explicit that
// order placement uses "L1 action" signing: msgpack-encode the action, keccak-hash it with the
// nonce, wrap that hash in an EIP-712 "phantom agent" struct (chainId 1337, fixed for L1
// actions regardless of testnet/mainnet — a completely different scheme from a plain wallet
// signature), and field order inside the msgpack payload is significant. Getting any of that
// subtly wrong produces an invalid signature, which Hyperliquid rejects outright (a safe
// failure — no funds move on a bad signature) but a hand-rolled implementation is exactly
// where a subtle bug would hide; the SDK's signing module is what real Hyperliquid bots use in
// practice, not something this codebase should re-derive from scratch.
const HYPERLIQUID_API_URL = process.env.HYPERLIQUID_API_URL || "https://api.hyperliquid-testnet.xyz";
const IS_TESTNET = HYPERLIQUID_API_URL.includes("testnet");
// A marketable IOC limit order needs to cross the spread far enough to guarantee a fill (HL
// has no separate "market order" type) — 5% through the mid is generous enough for normal
// market conditions without being unbounded; the exchange never fills worse than this price.
const MARKETABLE_SLIPPAGE = new Prisma.Decimal("0.05");

function normalizeCoin(market: string): string {
  return market.toUpperCase().endsWith("-PERP") ? market.slice(0, -"-PERP".length) : market;
}

interface AssetMeta {
  index: number;
  szDecimals: number;
}

async function getAssetMeta(coin: string): Promise<AssetMeta> {
  const res = await fetch(`${HYPERLIQUID_API_URL}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });
  if (!res.ok) throw new VenueError(Venue.HYPERLIQUID, `Hyperliquid /info returned ${res.status}`);

  const meta = (await res.json()) as { universe: { name: string; szDecimals: number }[] };
  const index = meta.universe.findIndex((a) => a.name === coin);
  if (index === -1) throw new VenueError(Venue.HYPERLIQUID, `Unknown Hyperliquid asset "${coin}"`);
  return { index, szDecimals: meta.universe[index]!.szDecimals };
}

/** Rounds to at most maxDecimals places and drops trailing zeros via Decimal's own minimal
 * string form — Hyperliquid's docs specifically call out trailing zeros in price/size strings
 * as a common source of rejected orders. */
function formatHlNumber(value: Prisma.Decimal, maxDecimals: number): string {
  return value.toDecimalPlaces(Math.max(0, maxDecimals), Prisma.Decimal.ROUND_DOWN).toString();
}

export const hyperliquidAdapter: VenueAdapter = {
  venue: Venue.HYPERLIQUID,

  async getQuote(market: string): Promise<Quote> {
    const coin = normalizeCoin(market);
    const res = await fetch(`${HYPERLIQUID_API_URL}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    if (!res.ok) throw new VenueError(Venue.HYPERLIQUID, `Hyperliquid /info returned ${res.status}`);

    const mids = (await res.json()) as Record<string, string>;
    const mid = mids[coin];
    if (!mid) throw new VenueError(Venue.HYPERLIQUID, `No Hyperliquid mid price found for "${coin}"`);

    return { price: new Prisma.Decimal(mid), ts: Date.now() };
  },

  async placeOrder(wallet: DecryptedWallet, order: OrderRequest): Promise<FillResult> {
    const coin = normalizeCoin(order.market);
    if (!["OPEN_LONG", "OPEN_SHORT", "CLOSE"].includes(order.action)) {
      throw new VenueError(Venue.HYPERLIQUID, `Unknown action "${order.action}", expected OPEN_LONG, OPEN_SHORT, or CLOSE`);
    }

    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    const transport = new HttpTransport({ apiUrl: HYPERLIQUID_API_URL, isTestnet: IS_TESTNET });
    const exchange = new ExchangeClient({ transport, wallet: account });
    const info = new InfoClient({ transport });

    const [assetMeta, quote] = await Promise.all([getAssetMeta(coin), hyperliquidAdapter.getQuote(order.market)]);

    let isBuy: boolean;
    let reduceOnly: boolean;
    if (order.action === "CLOSE") {
      const state = await info.clearinghouseState({ user: wallet.address as `0x${string}` });
      const position = state.assetPositions.find((p) => p.position.coin === coin);
      const signedSize = new Prisma.Decimal(position?.position.szi ?? "0");
      if (signedSize.isZero()) throw new VenueError(Venue.HYPERLIQUID, `No open ${coin} position to close`);
      isBuy = signedSize.isNegative(); // closing a short means buying back
      reduceOnly = true;
    } else {
      isBuy = order.action === "OPEN_LONG";
      reduceOnly = false;
    }

    const limitPrice = isBuy ? quote.price.mul(Prisma.Decimal.sum(1, MARKETABLE_SLIPPAGE)) : quote.price.mul(new Prisma.Decimal(1).minus(MARKETABLE_SLIPPAGE));
    const sizeAsset = order.sizeUsdc.div(quote.price);

    const result = await exchange.order({
      orders: [
        {
          a: assetMeta.index,
          b: isBuy,
          p: formatHlNumber(limitPrice, Math.max(0, 6 - assetMeta.szDecimals)),
          s: formatHlNumber(sizeAsset, assetMeta.szDecimals),
          r: reduceOnly,
          t: { limit: { tif: "Ioc" } },
        },
      ],
      grouping: "na",
    });

    const status = result.response.data.statuses[0];
    if (!status) throw new VenueError(Venue.HYPERLIQUID, "Hyperliquid returned no order status");
    // "waitingForFill"/"waitingForTrigger" are trigger-order statuses (stop-loss/take-profit) —
    // this adapter only ever sends a plain IOC limit order, so seeing one here would mean the
    // response shape isn't what was expected, not a real trigger-order state to handle.
    if (typeof status === "string") throw new VenueError(Venue.HYPERLIQUID, `Unexpected order status "${status}" for a plain IOC order`);
    if ("error" in status) throw new VenueError(Venue.HYPERLIQUID, `Order rejected: ${status.error}`);

    if ("filled" in status) {
      return { fillPrice: new Prisma.Decimal(status.filled.avgPx), txHashOrRef: `hl-oid-${status.filled.oid}` };
    }
    // IOC orders that don't fully fill immediately are cancelled by Hyperliquid rather than
    // left resting, but report whatever oid we got rather than assuming a fill at quote price.
    return { fillPrice: quote.price, txHashOrRef: `hl-oid-${status.resting.oid}` };
  },
};
