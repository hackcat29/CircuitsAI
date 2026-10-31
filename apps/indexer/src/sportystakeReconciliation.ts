import "./loadEnv.js";
import { createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BettingClient,
  CasinoClient,
  CrashClient,
  CrashRoundStatus,
  formatUsdc,
  addresses as sportystakeAddresses,
} from "@clawdhq/sportystake-sdk";
import { prisma, Mode, Venue, BetSettlementStatus, Prisma, type Chain as DegenChain, type PendingBetSettlement } from "@clawdhq/degen-db";
import { viemChainFor, rpcTransportFor, type EvmPrismaChain } from "@clawdhq/custody-core";
import { getDecryptedTradingWallet } from "./degenCustody.js";
import { generateServerSeed } from "./provablyFair.js";
import { resolveDice, resolveSlots, resolveRoulette, resolveBlackjack, resolveBaccarat, type FairnessInputs, type GameResult } from "./casinoResolvers.js";

// Closes the gap the generic PAPER/liveEngine.ts position model can't handle on its own: a bet's
// real outcome is only known asynchronously (sports: a real-world event settles later; crash: a
// round resolves on sportystake's own worker's timeline), or is knowable immediately but still
// needs a settlement step this job — not placeOrder — is responsible for (casino instant games:
// see sportystakeCasino.ts's own doc comment on why settleGame happens here). This job polls
// PendingBetSettlement rows (written by liveEngine.ts whenever a venue's placeOrder returns
// FillResult.pendingSettlement) and, once resolved, feeds the real outcome back into
// Position.realizedPnlUsdc as a synthetic closing fill — see updatePositionForFill's own math in
// apps/web's positionLedger.ts, reproduced here rather than imported since that file is
// apps/web-only.
//
// Three independent resolution paths share this one PendingBetSettlement table, dispatched by
// venue/market shape:
//  - SPORTYSTAKE_PREDICTIONS/SPORTYSTAKE_SPORTSBOOK (BettingCore): player-signed
//    claimWinnings/claimRefund — see tickBetting.
//  - SPORTYSTAKE_CASINO, market starts with a game name (dice/slots/roulette/blackjack/
//    baccarat): operator-signed settleGame against sportystake's own CasinoHouse — see
//    tickCasinoHouseGames. Needs SPORTYSTAKE_OPERATOR_PRIVATE_KEY.
//  - SPORTYSTAKE_CASINO, market starts with "crash:": player-signed claim() against
//    CrashGame, batched per agent since claim() sweeps that address's ENTIRE pending payout in
//    one call — see tickCrash.

const TICK_INTERVAL_MS = Number(process.env.SPORTYSTAKE_RECONCILIATION_TICK_INTERVAL_MS ?? 60_000);
const MAX_PENDING_PER_TICK = 200;
const ARC_CHAIN: EvmPrismaChain = "ARC_TESTNET" as EvmPrismaChain;

// On-chain enum orderings — confirmed directly against IBettingCore.sol, not assumed.
const MarketStatus = { Open: 0, Suspended: 1, Settled: 2, Cancelled: 3 } as const;
const BetStatus = { Pending: 0, Won: 1, Lost: 2, Cancelled: 3, Cashed: 4 } as const;

let shuttingDown = false;
let tickInFlight = false;

// Position math duplicated from apps/web/src/lib/server/degen/positionLedger.ts (apps/web-only,
// not a shared package) — kept in exact sync with that file's own applyFillToPosition; any
// change there needs the same change here.
const POSITIVE_SIGN_ACTIONS = new Set(["BUY", "OPEN_LONG"]);
interface PositionState {
  netSizeUsdc: Prisma.Decimal;
  avgEntryPrice: Prisma.Decimal | null;
  realizedPnlUsdc: Prisma.Decimal;
}
function applyFillToPosition(current: PositionState, action: string, fillPrice: Prisma.Decimal, sizeUsdc: Prisma.Decimal): PositionState {
  const sign = POSITIVE_SIGN_ACTIONS.has(action) ? 1 : -1;
  const delta = sizeUsdc.mul(sign);
  const currentSign = current.netSizeUsdc.isZero() ? 0 : current.netSizeUsdc.isPositive() ? 1 : -1;
  if (currentSign === 0 || currentSign === sign) {
    const priorNotional = current.netSizeUsdc.abs();
    const newAvgEntry = current.avgEntryPrice
      ? current.avgEntryPrice.mul(priorNotional).plus(fillPrice.mul(sizeUsdc)).div(priorNotional.plus(sizeUsdc))
      : fillPrice;
    return { netSizeUsdc: current.netSizeUsdc.plus(delta), avgEntryPrice: newAvgEntry, realizedPnlUsdc: current.realizedPnlUsdc };
  }
  const entry = current.avgEntryPrice ?? fillPrice;
  const closingNotional = Prisma.Decimal.min(sizeUsdc, current.netSizeUsdc.abs());
  const priceReturn = fillPrice.div(entry).minus(1).mul(currentSign);
  const realizedPnlUsdc = current.realizedPnlUsdc.plus(closingNotional.mul(priceReturn));
  const netSizeUsdc = current.netSizeUsdc.plus(delta);
  const remainingNotional = sizeUsdc.minus(closingNotional);
  const avgEntryPrice = remainingNotional.gt(0) ? fillPrice : netSizeUsdc.isZero() ? null : entry;
  return { netSizeUsdc, avgEntryPrice, realizedPnlUsdc };
}
async function updatePositionForFill(
  tx: Prisma.TransactionClient,
  key: { chain: DegenChain; agentChainId: string; venue: Venue; mode: Mode; market: string },
  action: string,
  fillPrice: Prisma.Decimal,
  sizeUsdc: Prisma.Decimal,
): Promise<void> {
  const position = await tx.position.findUnique({ where: { chain_agentChainId_venue_mode_market: key } });
  const next = applyFillToPosition(
    { netSizeUsdc: position?.netSizeUsdc ?? new Prisma.Decimal(0), avgEntryPrice: position?.avgEntryPrice ?? null, realizedPnlUsdc: position?.realizedPnlUsdc ?? new Prisma.Decimal(0) },
    action,
    fillPrice,
    sizeUsdc,
  );
  await tx.position.upsert({ where: { chain_agentChainId_venue_mode_market: key }, create: { ...key, ...next }, update: next });
}

async function closePendingBet(row: PendingBetSettlement, payoutRaw: bigint): Promise<void> {
  const payoutHuman = new Prisma.Decimal(payoutRaw.toString()).div(1_000_000);
  // Synthetic closing fill: entry * payout / stake reproduces the exact realized PnL
  // (payout - stake) through applyFillToPosition's existing weighted-avg/realize-on-close math —
  // see sportystakeBetting.ts's own doc comment for the derivation. oddsAtEntry is always 1 for
  // SPORTYSTAKE_CASINO rows (no real odds concept), so this reduces to payout/stake there.
  const closingFillPrice = payoutHuman.isZero() ? new Prisma.Decimal(0) : row.oddsAtEntry.mul(payoutHuman).div(row.stakeUsdc);
  await prisma.$transaction(async (tx) => {
    await updatePositionForFill(tx, { chain: row.chain, agentChainId: row.agentChainId, venue: row.venue, mode: Mode.LIVE, market: row.market }, "SELL", closingFillPrice, row.stakeUsdc);
    await tx.pendingBetSettlement.update({ where: { id: row.id }, data: { status: BetSettlementStatus.SETTLED, settledAt: new Date() } });
  });
  console.log(`[sportystake-reconciliation] settled ${row.venue} ${row.market} (${row.chain}:${row.agentChainId}): payout=${payoutHuman.toString()} stake=${row.stakeUsdc.toString()}`);
}

function parseFixtureAndMarketType(market: string): { fixtureId: bigint; marketType: string } {
  const [fixtureIdStr, marketType] = market.split(":");
  return { fixtureId: BigInt(fixtureIdStr!), marketType: marketType! };
}

// ─── SPORTYSTAKE_PREDICTIONS / SPORTYSTAKE_SPORTSBOOK (BettingCore) ────────────────────────────

async function settleOneBet(row: PendingBetSettlement): Promise<void> {
  const wallet = await getDecryptedTradingWallet(row.chain, row.agentChainId, row.venue);
  if (!wallet) {
    console.error(`[sportystake-reconciliation] no TradingWallet for ${row.chain}:${row.agentChainId}:${row.venue}, cannot claim bet ${row.betId} (leaving PENDING)`);
    return;
  }

  const chain = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  const client = new BettingClient({
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });

  const bet = await client.getBet(row.betId as `0x${string}`);

  // No explicit account override on either claim call below, for the same reason
  // apps/web's sportystakeBetting.ts omits one on placeBet: the client's own walletClient
  // already carries wallet.privateKey as its local signing account, and re-passing that same
  // address as an override would make BettingClient sign via the transport's own
  // eth_sendTransaction instead of locally.
  let payoutRaw: bigint;
  if (bet.status === BetStatus.Won) {
    await client.claimWinnings(row.betId as `0x${string}`);
    payoutRaw = BigInt(Math.round(Number(formatUsdc(bet.potentialPayout, 10)) * 1_000_000));
  } else if (bet.status === BetStatus.Lost) {
    payoutRaw = 0n;
  } else if (bet.status === BetStatus.Cancelled) {
    await client.claimRefund(row.betId as `0x${string}`);
    payoutRaw = BigInt(row.stakeUsdc.mul(1_000_000).toFixed(0)); // full refund — exactly the original stake back
  } else {
    // Pending (market wasn't actually settled — shouldn't reach here) or Cashed (already
    // claimed by some other path, e.g. a manual admin action) — nothing safe to claim again.
    console.warn(`[sportystake-reconciliation] bet ${row.betId} has unexpected status ${bet.status}, marking settled with no PnL adjustment`);
    await prisma.pendingBetSettlement.update({ where: { id: row.id }, data: { status: BetSettlementStatus.SETTLED, settledAt: new Date() } });
    return;
  }

  await closePendingBet(row, payoutRaw);
}

async function tickBetting(pending: PendingBetSettlement[]): Promise<void> {
  if (pending.length === 0) return;

  // Batch the on-chain market-status read: multiple pending bets (different outcomes, or
  // different agents) commonly share the same fixture+marketType, and getMarket doesn't need a
  // wallet at all — a read-only BettingClient is enough.
  const readOnlyClient = new BettingClient({
    publicClient: createPublicClient({ chain: viemChainFor(ARC_CHAIN), transport: rpcTransportFor(ARC_CHAIN) }),
    addresses: sportystakeAddresses.arcTestnet,
  });

  const groups = new Map<string, PendingBetSettlement[]>();
  for (const row of pending) {
    const { fixtureId, marketType } = parseFixtureAndMarketType(row.market);
    const key = `${fixtureId}:${marketType}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const [key, rows] of groups) {
    const { fixtureId, marketType } = parseFixtureAndMarketType(rows[0]!.market);
    let marketView: Awaited<ReturnType<typeof readOnlyClient.getMarket>>;
    try {
      marketView = await readOnlyClient.getMarket(fixtureId, marketType);
    } catch (error) {
      console.error(`[sportystake-reconciliation] failed to read market ${key}:`, error instanceof Error ? error.message : error);
      continue;
    }
    if (marketView.status !== MarketStatus.Settled && marketView.status !== MarketStatus.Cancelled) continue; // not resolved yet

    for (const row of rows) {
      try {
        await settleOneBet(row);
      } catch (error) {
        // One bet's claim failing (RPC hiccup, a genuine revert) shouldn't stop the rest of
        // this tick's other bets — left PENDING, so a transient failure just retries next tick.
        console.error(`[sportystake-reconciliation] failed to settle bet ${row.betId}:`, error instanceof Error ? error.message : error);
      }
    }
  }
}

// ─── SPORTYSTAKE_CASINO — CasinoHouse instant games ─────────────────────────────────────────────

function operatorCasinoClient(): CasinoClient {
  const key = process.env.SPORTYSTAKE_OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error("SPORTYSTAKE_OPERATOR_PRIVATE_KEY is not set — cannot settle CasinoHouse bets");
  const chain = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(key as `0x${string}`);
  return new CasinoClient({
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });
}

function resolveCasinoHouseGame(game: string, params: string[], fair: FairnessInputs, amountRaw: bigint): GameResult {
  switch (game) {
    case "dice":
      return resolveDice(fair, amountRaw, Number(params[0]), params[1] as "over" | "under");
    case "slots":
      return resolveSlots(fair, amountRaw, Number(params[0]));
    case "roulette":
      return resolveRoulette(fair, amountRaw, { type: params[0]!, selection: params[1] });
    case "blackjack":
      return resolveBlackjack(fair, amountRaw);
    case "baccarat":
      return resolveBaccarat(fair, amountRaw, params[0] as "player" | "banker" | "tie");
    default:
      throw new Error(`Unknown CasinoHouse game "${game}"`);
  }
}

async function settleCasinoHouseBet(client: CasinoClient, row: PendingBetSettlement): Promise<void> {
  const requestId = row.betId as `0x${string}`;
  const existingBet = await client.getBet(requestId);

  let payoutRaw: bigint;
  if (existingBet.settled) {
    // Already settled by a previous tick whose local DB update didn't complete (e.g. the
    // process died between settleGame confirming and this row's UPDATE) — reuse the real
    // on-chain payout instead of resolving (and settling) a second time, which would revert
    // anyway via CasinoHouse's own BetAlreadySettled check.
    payoutRaw = existingBet.payout;
  } else {
    const md = (row.metadata as Record<string, unknown> | null) ?? {};
    const game = md.game as string | undefined;
    const params = (md.params as string[] | undefined) ?? [];
    const clientSeed = md.clientSeed as string | undefined;
    const amountRawStr = md.amountRaw as string | undefined;
    if (!game || !clientSeed || !amountRawStr) {
      console.error(`[sportystake-reconciliation] casino bet ${row.betId} missing game/clientSeed/amountRaw metadata, marking FAILED`);
      await prisma.pendingBetSettlement.update({ where: { id: row.id }, data: { status: BetSettlementStatus.FAILED, failReason: "missing game/clientSeed/amountRaw metadata" } });
      return;
    }

    const serverSeed = generateServerSeed();
    const result = resolveCasinoHouseGame(game, params, { serverSeed, clientSeed, nonce: 0 }, BigInt(amountRawStr));
    payoutRaw = result.payoutRaw;

    // Matches sportystake's own encoding: payoutMultiplier rounded to whole basis points.
    // settleGame stores randomResult opaquely — it doesn't itself verify it — so this is purely
    // an audit-trail value, not something the contract checks.
    const randomResultEncoded = BigInt(Math.round(result.payoutMultiplier * 10_000));
    await client.settleGame(requestId, randomResultEncoded, payoutRaw);
  }

  await closePendingBet(row, payoutRaw);
}

async function tickCasinoHouseGames(pending: PendingBetSettlement[]): Promise<void> {
  if (pending.length === 0) return;
  const client = operatorCasinoClient();
  for (const row of pending) {
    try {
      await settleCasinoHouseBet(client, row);
    } catch (error) {
      console.error(`[sportystake-reconciliation] failed to settle casino bet ${row.betId}:`, error instanceof Error ? error.message : error);
    }
  }
}

// ─── SPORTYSTAKE_CASINO — CrashGame rounds ──────────────────────────────────────────────────────

async function settleCrashForAgent(chain: DegenChain, agentChainId: string, rows: PendingBetSettlement[]): Promise<void> {
  const wallet = await getDecryptedTradingWallet(chain, agentChainId, Venue.SPORTYSTAKE_CASINO);
  if (!wallet) {
    console.error(`[sportystake-reconciliation] no TradingWallet for ${chain}:${agentChainId}:SPORTYSTAKE_CASINO, cannot settle crash rows (leaving PENDING)`);
    return;
  }

  const chainDef = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  const client = new CrashClient({
    publicClient: createPublicClient({ chain: chainDef, transport }),
    walletClient: createWalletClient({ account, chain: chainDef, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });

  // Resolve each row's exact payout via the round-keyed PayoutCredited log BEFORE calling
  // claim() — claim() sweeps this wallet's ENTIRE pending payout in one shot, so attributing the
  // right amount to the right row has to happen from event logs, not the aggregate balance (see
  // CrashClient.getPayoutCredited's own doc comment).
  const resolved: { row: PendingBetSettlement; payoutRaw: bigint }[] = [];
  for (const row of rows) {
    const md = (row.metadata as Record<string, unknown> | null) ?? {};
    const roundIdStr = md.roundId as string | undefined;
    const joinedAtBlockStr = md.joinedAtBlock as string | undefined;
    if (!roundIdStr || !joinedAtBlockStr) {
      console.error(`[sportystake-reconciliation] crash row ${row.id} missing roundId/joinedAtBlock metadata, marking FAILED`);
      await prisma.pendingBetSettlement.update({ where: { id: row.id }, data: { status: BetSettlementStatus.FAILED, failReason: "missing roundId/joinedAtBlock metadata" } });
      continue;
    }

    const roundId = BigInt(roundIdStr);
    let round: Awaited<ReturnType<typeof client.getRound>>;
    try {
      round = await client.getRound(roundId);
    } catch (error) {
      console.error(`[sportystake-reconciliation] failed to read crash round ${roundId}:`, error instanceof Error ? error.message : error);
      continue;
    }
    if (round.status !== CrashRoundStatus.Resolved) continue; // not resolved yet

    const payoutRaw = await client.getPayoutCredited(roundId, wallet.address as `0x${string}`, BigInt(joinedAtBlockStr));
    resolved.push({ row, payoutRaw });
  }

  if (resolved.length === 0) return;

  if (resolved.some((r) => r.payoutRaw > 0n)) {
    try {
      await client.claim();
    } catch (error) {
      // Leave every row in this batch PENDING — retrying claim() next tick is safe (it's
      // idempotent per the contract's own pendingPayout bookkeeping), whereas marking these
      // SETTLED without the claim actually landing would silently lose track of real funds.
      console.error(`[sportystake-reconciliation] crash claim() failed for ${chain}:${agentChainId}:`, error instanceof Error ? error.message : error);
      return;
    }
  }

  for (const { row, payoutRaw } of resolved) {
    await closePendingBet(row, payoutRaw);
  }
}

async function tickCrash(pending: PendingBetSettlement[]): Promise<void> {
  if (pending.length === 0) return;

  // Grouped by agent, not by round: CrashGame.claim() sweeps this address's entire pending
  // payout in one call, so settling two of an agent's resolved rounds with two separate claim()
  // calls would either double-claim or leave the second row's funds misattributed to the first.
  const groups = new Map<string, PendingBetSettlement[]>();
  for (const row of pending) {
    const key = `${row.chain}:${row.agentChainId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const [key, rows] of groups) {
    const [chain, agentChainId] = key.split(":") as [DegenChain, string];
    try {
      await settleCrashForAgent(chain, agentChainId, rows);
    } catch (error) {
      console.error(`[sportystake-reconciliation] failed to settle crash rows for ${key}:`, error instanceof Error ? error.message : error);
    }
  }
}

// ─── tick dispatcher ────────────────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const pending = await prisma.pendingBetSettlement.findMany({
    where: { status: BetSettlementStatus.PENDING },
    take: MAX_PENDING_PER_TICK,
  });
  if (pending.length === 0) return;

  const bettingRows: PendingBetSettlement[] = [];
  const casinoHouseRows: PendingBetSettlement[] = [];
  const crashRows: PendingBetSettlement[] = [];
  for (const row of pending) {
    if (row.venue !== Venue.SPORTYSTAKE_CASINO) bettingRows.push(row);
    else if (row.market.startsWith("crash:")) crashRows.push(row);
    else casinoHouseRows.push(row);
  }

  await tickBetting(bettingRows);
  await tickCasinoHouseGames(casinoHouseRows);
  await tickCrash(crashRows);
}

async function runTick(): Promise<void> {
  if (tickInFlight || shuttingDown) return;
  tickInFlight = true;
  try {
    await tick();
  } catch (error) {
    console.error("[sportystake-reconciliation] tick failed:", error);
  } finally {
    tickInFlight = false;
  }
}

async function main(): Promise<void> {
  console.log(`[sportystake-reconciliation] starting, tick every ${TICK_INTERVAL_MS}ms`);
  await runTick();
  const interval = setInterval(runTick, TICK_INTERVAL_MS);

  const shutdown = (signal: string) => {
    console.log(`[sportystake-reconciliation] ${signal} received, stopping new ticks (in-flight work is left to finish)`);
    shuttingDown = true;
    clearInterval(interval);
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[sportystake-reconciliation] fatal error", error);
  process.exitCode = 1;
});
