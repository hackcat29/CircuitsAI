const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function formatCount(value: bigint): string {
  return compactFormatter.format(value);
}

/** USDC on every chain in this protocol is stored with 6 decimals. */
export function formatUsdc(value: bigint): string {
  return usdFormatter.format(Number(value) / 1_000_000);
}

const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** For balances that already arrive as a human-readable decimal string/number (e.g. Circle's
 * wallet-balance API, which returns full token precision, e.g. 18 decimals for a native-asset balance) rather than a raw on-chain integer amount. Unlike formatUsdc,
 * this does *not* divide by 1e6 — the input is already in whole-token units, just with more
 * precision than any UI needs to show. */
export function formatDecimal(value: string | number): string {
  return decimalFormatter.format(Number(value));
}

/** Reputation is stored on-chain as basis points (0-10000). */
export function formatBps(bps: number): string {
  if (bps === 0) return "70.0%";
  return `${(bps / 100).toFixed(1)}%`;
}

const creditsFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Circuits AI credits ($1 = 100 credits, see custody-core's usdcToCredits/CREDITS_PER_USDC) —
 * this only formats an already-converted value for display, it does not do the USDC↔credits math
 * itself. Callers pass the string/number already produced by usdcToCredits or a credits field the
 * API already converted server-side. */
export function formatCredits(value: string | number): string {
  return `${creditsFormatter.format(Number(value))} credits`;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3h ago" / "2d ago" style formatting for post timestamps. */
export function formatRelativeTime(isoDate: string): string {
  const seconds = Math.round((Date.parse(isoDate) - Date.now()) / 1000);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return relativeTimeFormatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return relativeTimeFormatter.format(seconds, "second");
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Converts any raw token price representation (scaled 1e18 integer string/bigint, unscaled float string,
 * or bare number) into a human USD decimal number. */
export function parseTokenPrice(value: bigint | string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    return value > 1_000_000_000 ? value / 1_000_000 / 1_000_000_000_000 : value;
  }
  if (typeof value === "bigint") {
    return value > 1_000_000_000n ? Number(value) / 1_000_000 / 1_000_000_000_000 : Number(value);
  }
  const trimmed = value.trim();
  if (trimmed.includes(".")) {
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed > 1_000_000_000 ? parsed / 1e18 : parsed;
  }
  try {
    const bi = BigInt(trimmed);
    return bi > 1_000_000_000n ? Number(bi) / 1_000_000 / 1_000_000_000_000 : Number(bi);
  } catch {
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? 0 : parsed;
  }
}

/** For a bonding-curve token's per-whole-token USDC price, as returned by lib/bondingCurve.ts's
 * `currentPrice`/`priceAtTokensSold` (raw USDC 6dec scaled by PRICE_PRECISION 1e12, or raw numeric/string).
 * Adaptively scales decimal precision to the price magnitude so small values don't round down to "$0.00". */
export function formatTokenPrice(value: bigint | string | number | null | undefined): string {
  const num = parseTokenPrice(value);
  if (!Number.isFinite(num) || num <= 0) return "$0.00";
  if (num >= 1000) {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (num >= 1) {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  if (num >= 0.01) {
    const s = num.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, "$1");
    return `$${s}`;
  }
  if (num >= 0.0001) {
    const s = num.toFixed(6).replace(/(\.\d{4}\d*?)0+$/, "$1");
    return `$${s}`;
  }
  const s = num.toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `$${s}`;
}

/** Basis-point price delta (see LaunchStats.priceChangeBps24h) as a signed percentage string.
 * `null` means no *net* buy/sell volume in the last 24h to reconstruct a comparison price from
 * — not "still loading" (callers only ever pass already-resolved data) and not necessarily "a
 * brand-new launch" either, despite that field's own doc comment: a long-quiet older launch
 * with zero net trades in the last day hits the same null case. Rendered as "0.00%" (no change
 * to report over the window, which is what "no trades" means for display purposes) rather than
 * a dash — callers that want to visually distinguish "genuinely flat" from "no data at all"
 * still can, via the same `bps === null` check driving their own color/style (see
 * priceChangeClass in LaunchTable.tsx/dashboard's page.tsx, which keeps this neutral-gray
 * instead of the emerald a *real* 0.00% would never actually render as, since a real bps of
 * exactly 0 rounds to "0.00%" too but is vanishingly unlikely on a continuous bonding curve). */
export function formatPriceChangeBps(bps: number | null): string {
  if (bps === null) return "0.00%";
  const pct = bps / 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** Format a general number or string into a compact USD string ($1.25M, $45.2K, $120.00). */
export function formatUsdCompact(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  if (typeof value === "string" && value.startsWith("$")) return value;
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  if (isNaN(num) || num === 0) return "$0.00";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
  if (num >= 1_000) return `$${(num / 1_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}K`;
  if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(8)}`;
}

/** Formats a numeric price into a human-readable string with adaptive decimal precision. */
export function formatFormattedPrice(price: number | string | undefined | null): string {
  return formatTokenPrice(price);
}
