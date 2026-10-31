import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CasinoClient, CasinoGameType, CrashClient, CrashRoundStatus, addresses as sportystakeAddresses } from "@clawdhq/sportystake-sdk";
import { Prisma, Venue } from "@clawdhq/degen-db";
import { viemChainFor, rpcTransportFor } from "@clawdhq/custody-core";
import { VenueError, type DecryptedWallet, type FillResult, type OrderRequest, type Quote, type VenueAdapter } from "./types";

// Backs SPORTYSTAKE_CASINO — two different sportystake contracts, dispatched by the `market`
// string's own prefix:
//  - "dice:<target>:<direction>" | "slots:<lines>" | "roulette:<betType>:<selection>" |
//    "blackjack" | "baccarat:<bet>" -> CasinoHouse's instant-resolve games.
//  - "crash:<autoCashoutX100>" -> CrashGame's multiplayer rounds.
//
// Unlike sportystakeBetting.ts, placeOrder here ONLY does the "opening" half for both game
// families — it never calls CasinoHouse.settleGame or CrashGame.claim itself. That's
// deliberate: settleGame requires sportystake's own OPERATOR_ROLE key (a different signer than
// this agent's own custodied wallet), and CrashGame's rounds resolve on sportystake's own
// worker's timeline, not this call's. Both settlement paths live in
// sportystakeReconciliation.ts, exactly mirroring how sportystakeBetting.ts's placeOrder only
// places a bet and leaves claimWinnings/claimRefund to that same reconciliation job. See that
// file's own doc comment for why CasinoHouse resolution (compute outcome, call settleGame) also
// happens there rather than inline here even though the outcome is knowable immediately: it
// keeps every venue's placeOrder doing exactly one on-chain write, with the reconciliation job
// as the one place all closing logic lives.
const ARC_CHAIN = "ARC_TESTNET" as const;

// EV-based reference price only — no live "spin" happens here. PAPER mode simulates the
// statistical average outcome, not a random draw, same reasoning a Quote is a reference price on
// every other venue too. Matches the houseEdgeBps sportystake's own casino.ts/games catalog use.
const CASINO_HOUSE_EDGE_BPS: Record<string, number> = {
  dice: 100,
  slots: 350,
  roulette: 270,
  blackjack: 50,
  baccarat: 120,
  crash: 100,
};

const CASINO_GAME_TO_ONCHAIN_TYPE: Record<string, CasinoGameType> = {
  dice: CasinoGameType.Dice,
  slots: CasinoGameType.Slots,
  blackjack: CasinoGameType.Blackjack,
  roulette: CasinoGameType.Roulette,
  baccarat: CasinoGameType.Baccarat,
};

function gameKeyFromMarket(market: string): string {
  const key = market.split(":")[0] ?? "";
  if (!key) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `Malformed market "${market}"`);
  return key;
}

function casinoClientFor(wallet: DecryptedWallet): CasinoClient {
  const chain = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  return new CasinoClient({
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });
}

function crashClientFor(wallet: DecryptedWallet): CrashClient {
  const chain = viemChainFor(ARC_CHAIN);
  const transport = rpcTransportFor(ARC_CHAIN);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
  return new CrashClient({
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
    addresses: sportystakeAddresses.arcTestnet,
  });
}

async function placeCasinoHouseBet(wallet: DecryptedWallet, market: string, order: OrderRequest): Promise<FillResult> {
  const parts = market.split(":");
  const game = parts[0]!;
  const onchainGame = CASINO_GAME_TO_ONCHAIN_TYPE[game];
  if (onchainGame === undefined) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `Unknown casino game "${game}"`);

  // Validate the market's own params up front so a malformed order fails clearly instead of
  // burning a real on-chain bet the reconciliation job can't resolve later.
  if (game === "dice") {
    const target = Number(parts[1]);
    const direction = parts[2];
    if (!Number.isInteger(target) || target < 1 || target > 98) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `dice target must be an integer in [1, 98], got "${parts[1]}"`);
    if (direction !== "over" && direction !== "under") throw new VenueError(Venue.SPORTYSTAKE_CASINO, `dice direction must be "over" or "under", got "${direction}"`);
  } else if (game === "slots") {
    const lines = Number(parts[1]);
    if (!Number.isInteger(lines) || lines < 1 || lines > 20) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `slots lines must be an integer in [1, 20], got "${parts[1]}"`);
  } else if (game === "roulette") {
    if (!parts[1]) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `roulette market missing betType, expected "roulette:<betType>:<selection>"`);
  } else if (game === "baccarat") {
    if (parts[1] !== "player" && parts[1] !== "banker" && parts[1] !== "tie") throw new VenueError(Venue.SPORTYSTAKE_CASINO, `baccarat bet must be player/banker/tie, got "${parts[1]}"`);
  } else if (game !== "blackjack") {
    throw new VenueError(Venue.SPORTYSTAKE_CASINO, `Unknown casino game "${game}"`);
  }

  const clientSeed = randomBytes(16).toString("hex");
  const clientSeedHash = keccak256(toBytes(clientSeed));
  const client = casinoClientFor(wallet);

  // No explicit account override — casinoClientFor's walletClient already carries
  // wallet.privateKey as its own local signing account (see sportystakeBetting.ts's identical
  // note on why passing that same address again would force JSON-RPC-relay signing instead).
  const receipt = await client.placeCasinoBet({
    amountUsdc: order.sizeUsdc.toString(),
    game: onchainGame,
    clientSeedHash,
  });

  return {
    fillPrice: new Prisma.Decimal(1),
    txHashOrRef: receipt.txHash,
    pendingSettlement: {
      betId: receipt.requestId,
      stakeUsdc: order.sizeUsdc,
      oddsAtEntry: new Prisma.Decimal(1),
      metadata: {
        kind: "casinoHouse",
        game,
        params: parts.slice(1),
        clientSeed,
        amountRaw: receipt.amount.toString(),
      },
    },
  };
}

async function placeCrashJoin(wallet: DecryptedWallet, market: string, order: OrderRequest): Promise<FillResult> {
  const autoCashoutX100 = Number(market.split(":")[1]);
  if (!Number.isInteger(autoCashoutX100) || autoCashoutX100 <= 100 || autoCashoutX100 > 100_000) {
    // CrashGame.joinRound requires a nonzero autoCashoutX100 in (100, 100_000] — an unattended
    // agent has no live "watch the multiplier and cash out manually" loop, so a real
    // auto-cashout target is mandatory here, not optional the way a human player's UI allows.
    throw new VenueError(Venue.SPORTYSTAKE_CASINO, `crash market must be "crash:<autoCashoutX100>" with autoCashoutX100 in (100, 100000], got "${market}"`);
  }

  const client = crashClientFor(wallet);
  const roundId = await client.getCurrentRoundId();
  const round = await client.getRound(roundId);
  if (round.status !== CrashRoundStatus.Pending) {
    throw new VenueError(Venue.SPORTYSTAKE_CASINO, `No pending crash round to join right now (round ${roundId} is ${CrashRoundStatus[round.status]}) — try again shortly`);
  }

  const receipt = await client.joinRound(roundId, order.sizeUsdc.toString(), autoCashoutX100);

  return {
    fillPrice: new Prisma.Decimal(1),
    txHashOrRef: receipt.txHash,
    pendingSettlement: {
      betId: `${roundId}`,
      stakeUsdc: order.sizeUsdc,
      oddsAtEntry: new Prisma.Decimal(1),
      metadata: {
        kind: "crash",
        roundId: roundId.toString(),
        joinedAtBlock: receipt.blockNumber.toString(),
      },
    },
  };
}

export const sportystakeCasinoAdapter: VenueAdapter = {
  venue: Venue.SPORTYSTAKE_CASINO,

  async getQuote(market: string): Promise<Quote> {
    const game = gameKeyFromMarket(market);
    const edgeBps = CASINO_HOUSE_EDGE_BPS[game];
    if (edgeBps === undefined) throw new VenueError(Venue.SPORTYSTAKE_CASINO, `Unknown casino game "${game}"`);
    return { price: new Prisma.Decimal(1).minus(new Prisma.Decimal(edgeBps).div(10_000)), ts: Date.now() };
  },

  async placeOrder(wallet: DecryptedWallet, order: OrderRequest): Promise<FillResult> {
    if (order.action !== "BUY") {
      throw new VenueError(Venue.SPORTYSTAKE_CASINO, `Unknown action "${order.action}", expected BUY (casino games have no early exit)`);
    }
    const game = gameKeyFromMarket(order.market);
    return game === "crash" ? placeCrashJoin(wallet, order.market, order) : placeCasinoHouseBet(wallet, order.market, order);
  },
};
