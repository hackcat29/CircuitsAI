import { diceRoll, rouletteNumber, slotReels, uniformIndex } from "./provablyFair";

// Ported from sportystake's own src/lib/server/casino.ts (see provablyFair.ts's doc comment on
// why this is a copy rather than a cross-app import). Same algorithms, adapted to work directly
// in bigint raw USDC units (6dp) instead of round-tripping through decimal strings, since the
// caller already has a raw amount from the SDK's own parseUsdc.

export interface FairnessInputs {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface GameResult {
  win: boolean;
  payoutRaw: bigint;
  payoutMultiplier: number;
  detail: Record<string, unknown>;
}

export const CASINO_HOUSE_EDGE_BPS = {
  dice: 100, // 1%
  slots: 350, // 3.5%
  roulette: 270, // 2.70% (European)
  blackjack: 50,
  baccarat: 120,
} as const;

export function resolveDice(fair: FairnessInputs, amountRaw: bigint, target: number, direction: "over" | "under"): GameResult {
  if (target < 1 || target > 98) throw new Error("dice target must be in [1, 98]");
  const roll = diceRoll(fair.serverSeed, fair.clientSeed, fair.nonce);
  const win = direction === "over" ? roll > target : roll < target;
  const chance = direction === "over" ? (99 - target) / 100 : target / 100;
  const edge = CASINO_HOUSE_EDGE_BPS.dice / 10_000;
  const multiplier = win ? (1 - edge) / chance : 0;
  const payoutRaw = (amountRaw * BigInt(Math.round(multiplier * 1_000_000))) / 1_000_000n;
  return {
    win,
    payoutRaw,
    payoutMultiplier: Math.round(multiplier * 1000) / 1000,
    detail: { roll: Math.round(roll * 100) / 100, target, direction, multiplier },
  };
}

const SLOT_SYMBOLS = ["cherry", "lemon", "star", "diamond", "bell", "seven", "wild"];
const SLOT_PAYOUTS: Record<string, number> = {
  cherry: 2, lemon: 3, star: 5, bell: 8, diamond: 15, seven: 25, wild: 50,
};

export function resolveSlots(fair: FairnessInputs, amountRaw: bigint, lines: number): GameResult {
  const reels = slotReels(fair.serverSeed, fair.clientSeed, fair.nonce, SLOT_SYMBOLS.length);
  const cols = reels[0]!.length;
  const winLines: number[] = [];
  let totalMultiplier = 0;
  for (let r = 0; r < Math.min(reels.length, lines); r++) {
    const first = reels[r]![0];
    let matches = 1;
    for (let c = 1; c < cols; c++) {
      if (reels[r]![c] === first || reels[r]![c] === 6 /* wild */) matches++;
      else break;
    }
    if (matches >= 3) {
      winLines.push(r);
      const sym = SLOT_SYMBOLS[first!]!;
      const mult = SLOT_PAYOUTS[sym] ?? 1;
      totalMultiplier += mult * matches;
    }
  }
  const perLine = amountRaw / BigInt(Math.max(1, lines));
  const payoutRaw = (perLine * BigInt(Math.round(totalMultiplier * 1000))) / 1000n;
  return {
    win: payoutRaw > 0n,
    payoutRaw,
    payoutMultiplier: totalMultiplier,
    detail: { reels, symbols: SLOT_SYMBOLS, winLines, totalMultiplier },
  };
}

export function resolveRoulette(fair: FairnessInputs, amountRaw: bigint, bet: { type: string; selection?: number | string }): GameResult {
  const number = rouletteNumber(fair.serverSeed, fair.clientSeed, fair.nonce);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let multiplier = 0;
  const sel = bet.selection;
  switch (bet.type) {
    case "straight": if (Number(sel) === number) multiplier = 36; break;
    case "red": if (color === "red") multiplier = 2; break;
    case "black": if (color === "black") multiplier = 2; break;
    case "even": if (number > 0 && number % 2 === 0) multiplier = 2; break;
    case "odd": if (number % 2 === 1) multiplier = 2; break;
    case "low": if (number >= 1 && number <= 18) multiplier = 2; break;
    case "high": if (number >= 19 && number <= 36) multiplier = 2; break;
    case "dozen": {
      const d = Number(sel);
      if ((d === 1 && number >= 1 && number <= 12) || (d === 2 && number >= 13 && number <= 24) || (d === 3 && number >= 25 && number <= 36)) multiplier = 3;
      break;
    }
    case "column": {
      const c = Number(sel);
      if (number > 0 && number % 3 === (c === 3 ? 0 : c)) multiplier = 3;
      break;
    }
    default: multiplier = 0;
  }
  return {
    win: multiplier > 0,
    payoutRaw: amountRaw * BigInt(multiplier),
    payoutMultiplier: multiplier,
    detail: { number, color, multiplier },
  };
}

export function resolveBlackjack(fair: FairnessInputs, amountRaw: bigint): GameResult {
  const a = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 0) + 1;
  const b = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 4) + 1;
  const c = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 8) + 1;
  const d = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 12) + 1;
  let player = a + b;
  let dealer = c + d;
  if (player < 17) {
    const e = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 16) + 1;
    player += e;
  }
  while (dealer < 17) {
    const f = uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 11, 20) + 1;
    dealer += f;
    if (dealer >= 17) break;
  }
  const playerBust = player > 21;
  const dealerBust = dealer > 21;
  let multiplier = 0;
  if (playerBust) multiplier = 0;
  else if (dealerBust || player > dealer) multiplier = 2;
  else if (player === dealer) multiplier = 1;
  return {
    win: multiplier > 1,
    payoutRaw: amountRaw * BigInt(multiplier),
    payoutMultiplier: multiplier,
    detail: { player, dealer, playerBust, dealerBust },
  };
}

export function resolveBaccarat(fair: FairnessInputs, amountRaw: bigint, bet: "player" | "banker" | "tie"): GameResult {
  const p = (uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 10, 0) + uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 10, 4)) % 10;
  const b = (uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 10, 8) + uniformIndex(fair.serverSeed, fair.clientSeed, fair.nonce, 10, 12)) % 10;
  const winner = p > b ? "player" : b > p ? "banker" : "tie";
  let multiplier = 0;
  if (winner === bet) multiplier = bet === "tie" ? 9 : bet === "banker" ? 1.95 : 2;
  const payoutRaw = (amountRaw * BigInt(Math.round(multiplier * 100))) / 100n;
  return {
    win: multiplier > 0,
    payoutRaw,
    payoutMultiplier: multiplier,
    detail: { player: p, banker: b, winner, multiplier },
  };
}
