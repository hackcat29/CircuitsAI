import { Prisma, type Chain, type Mode, type Venue } from "@clawdhq/degen-db";

// Shared position-tracking math for both paperEngine.ts and liveEngine.ts — a fill is a fill
// regardless of whether the price came from a simulation or a real exchange, so this is the one
// place that logic lives rather than being duplicated per mode.

/** Actions that move a position's netSizeUsdc in the positive direction. Everything else
 * (SELL, OPEN_SHORT, CLOSE) moves it negative. This single sign, not an "increasing vs.
 * decreasing" label, is what decides whether a fill extends the existing position (weighted-
 * average entry price) or closes/flips it (realizes PnL) in applyFillToPosition below. */
const POSITIVE_SIGN_ACTIONS = new Set(["BUY", "OPEN_LONG"]);

export interface PositionState {
  netSizeUsdc: Prisma.Decimal;
  avgEntryPrice: Prisma.Decimal | null;
  realizedPnlUsdc: Prisma.Decimal;
}

export function applyFillToPosition(current: PositionState, action: string, fillPrice: Prisma.Decimal, sizeUsdc: Prisma.Decimal): PositionState {
  const sign = POSITIVE_SIGN_ACTIONS.has(action) ? 1 : -1;
  const delta = sizeUsdc.mul(sign);
  const currentSign = current.netSizeUsdc.isZero() ? 0 : current.netSizeUsdc.isPositive() ? 1 : -1;

  // Opening from flat, or adding to an existing position in the same direction: weighted-
  // average the entry price in, nothing realized yet.
  if (currentSign === 0 || currentSign === sign) {
    const priorNotional = current.netSizeUsdc.abs();
    const newAvgEntry = current.avgEntryPrice
      ? current.avgEntryPrice.mul(priorNotional).plus(fillPrice.mul(sizeUsdc)).div(priorNotional.plus(sizeUsdc))
      : fillPrice;
    return { netSizeUsdc: current.netSizeUsdc.plus(delta), avgEntryPrice: newAvgEntry, realizedPnlUsdc: current.realizedPnlUsdc };
  }

  // Reducing (or flipping through) an existing position: realize PnL on the portion that
  // closes out existing exposure. priceReturn is signed by currentSign so a short's gain is
  // priced correctly (a short profits when price falls).
  const entry = current.avgEntryPrice ?? fillPrice;
  const closingNotional = Prisma.Decimal.min(sizeUsdc, current.netSizeUsdc.abs());
  const priceReturn = fillPrice.div(entry).minus(1).mul(currentSign);
  const realizedPnlUsdc = current.realizedPnlUsdc.plus(closingNotional.mul(priceReturn));

  const netSizeUsdc = current.netSizeUsdc.plus(delta);
  const remainingNotional = sizeUsdc.minus(closingNotional);
  // remainingNotional > 0 means the fill was bigger than the open position and flipped it —
  // the excess opens a fresh position at the current fill price in the new direction.
  const avgEntryPrice = remainingNotional.gt(0) ? fillPrice : netSizeUsdc.isZero() ? null : entry;

  return { netSizeUsdc, avgEntryPrice, realizedPnlUsdc };
}

/** Reads the current position (or a flat default), applies a fill, and upserts the result —
 * within the caller's transaction so the position update and the TradingOrder row it's paired
 * with commit atomically. */
export async function updatePositionForFill(
  tx: Prisma.TransactionClient,
  key: { chain: Chain; agentChainId: string; venue: Venue; mode: Mode; market: string },
  action: string,
  fillPrice: Prisma.Decimal,
  sizeUsdc: Prisma.Decimal,
): Promise<PositionState> {
  const position = await tx.position.findUnique({ where: { chain_agentChainId_venue_mode_market: key } });
  const next = applyFillToPosition(
    {
      netSizeUsdc: position?.netSizeUsdc ?? new Prisma.Decimal(0),
      avgEntryPrice: position?.avgEntryPrice ?? null,
      realizedPnlUsdc: position?.realizedPnlUsdc ?? new Prisma.Decimal(0),
    },
    action,
    fillPrice,
    sizeUsdc,
  );

  await tx.position.upsert({
    where: { chain_agentChainId_venue_mode_market: key },
    create: { ...key, ...next },
    update: next,
  });

  return next;
}
