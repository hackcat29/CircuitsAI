import { Prisma, type Venue } from "@clawdhq/degen-db";

/** A read-only price/quote for a market on a venue. No key or custody involved — this is what
 * PAPER mode runs on entirely, and what LIVE mode uses for pre-trade pricing before signing. */
export interface Quote {
  /** USDC per unit, where "unit" is venue-defined (1 perp contract's mark price, 1 launch
   * token, 1 YES/NO contract on a prediction market, etc). */
  price: Prisma.Decimal;
  ts: number;
}

export interface OrderRequest {
  action: string;
  market: string;
  sizeUsdc: Prisma.Decimal;
}

export interface FillResult {
  fillPrice: Prisma.Decimal;
  txHashOrRef: string;
  /** Set only by a venue whose fill doesn't fully resolve immediately — a placed bet awaiting an
   * asynchronous real-world outcome, as opposed to Hyperliquid/ClawdHQ Launch's synchronous
   * mark-to-market fills. liveEngine.ts persists this as a PendingBetSettlement row in the same
   * transaction as the TradingOrder/Position write; see sportystakeReconciliation.ts for the job
   * that later resolves it and feeds the real outcome back into Position.realizedPnlUsdc. */
  pendingSettlement?: {
    betId: string;
    stakeUsdc: Prisma.Decimal;
    oddsAtEntry: Prisma.Decimal;
    /** Venue-specific extras the reconciliation job needs at settlement time (e.g. sportystake
     * casino's game/params/clientSeed, or a crash join's joinedAtBlock) — must be JSON-safe
     * (no bigint/Decimal), see PendingBetSettlement.metadata in degen-db's schema. */
    metadata?: Prisma.InputJsonValue;
  };
}

/** Decrypted key material for LIVE-mode signing, handed to placeOrder for the duration of a
 * single call — see lib/server/degen/custody.ts's getDecryptedTradingWallet. Never logged or
 * persisted by a venue adapter. */
export interface DecryptedWallet {
  address: string;
  privateKey: string;
}

/** One implementation per Venue. getQuote is read-only and has no signing dependency — it's
 * what paperEngine.ts calls for every venue in PAPER mode, and what the risk engine's pre-trade
 * checks use regardless of mode. placeOrder is LIVE-mode only: it signs and submits a real
 * order using the agent's own custodied wallet, and is never called while
 * TradingAgentConfig.mode is PAPER. */
export interface VenueAdapter {
  readonly venue: Venue;
  getQuote(market: string): Promise<Quote>;
  placeOrder(wallet: DecryptedWallet, order: OrderRequest): Promise<FillResult>;
}

export class VenueError extends Error {
  constructor(
    public venue: Venue,
    message: string,
  ) {
    super(message);
  }
}

/** Decimal USDC/token amount -> raw on-chain integer units (e.g. 6dp for USDC, 18dp for an
 * EVM launch token). Truncates rather than rounds — never sends more raw units than the
 * caller's decimal amount actually represents. */
export function toRawUnits(amount: Prisma.Decimal, decimals: number): bigint {
  return BigInt(amount.mul(new Prisma.Decimal(10).pow(decimals)).toFixed(0, Prisma.Decimal.ROUND_DOWN));
}
