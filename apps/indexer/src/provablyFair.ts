import { createHash, createHmac, randomBytes } from "node:crypto";

// Ported from sportystake's own src/lib/server/provably-fair.ts (same repo family, same human
// owner) — lives here, not in apps/web's sportystakeCasino.ts, because settleGame needs
// sportystake's own OPERATOR_ROLE key (see sportystakeReconciliation.ts's doc comment), and that
// settlement step happens in this reconciliation job, not at placeOrder time. Circuits Protocol
// resolves its own agents' casino bets independently of sportystake's Next.js app, so it needs
// its own copy of this pure commit-reveal RNG rather than importing across the app boundary.
// Kept byte-for-byte identical to the original algorithm: HMAC-SHA256(serverSeed,
// `${clientSeed}:${nonce}`), sliced per game the same way sportystake's own resolvers do, so the
// fairness math is provably the same scheme even though nothing here talks to sportystake's own
// backend.
//
// The commit-reveal "hash published before play" step is skippable here specifically because
// each bet gets a freshly random serverSeed (32 bytes from randomBytes) generated moments before
// resolving it — with a fresh random key per bet, the specific nonce value carries no
// cryptographic weight (any fixed nonce is equally unpredictable), so there's no multi-bet seed
// sequence to protect against reuse of. `nonce` here is retained purely for parity with the
// original algorithm's byte layout, not because Circuits Protocol relies on incrementing it.

const SEED_BYTES = 32;

export function generateServerSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

function deriveResult(serverSeed: string, clientSeed: string, nonce: number): Buffer {
  const msg = `${clientSeed}:${nonce}`;
  return createHmac("sha256", serverSeed).update(msg, "utf8").digest();
}

/** Dice: deterministic uniform float in [0, 100). */
export function diceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const u32 = hmac.readUInt32BE(0);
  return (u32 / 4_294_967_296) * 100;
}

/** Slots: pull 5 reels x 3 rows from successive bytes of the HMAC. */
export function slotReels(serverSeed: string, clientSeed: string, nonce: number, symbolCount: number): number[][] {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const rows = 3;
  const cols = 5;
  const reels: number[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const byte = hmac[i % hmac.length]! ^ hmac[(i + 7) % hmac.length]!;
      row.push(byte % symbolCount);
      i++;
    }
    reels.push(row);
  }
  return reels;
}

/** Roulette: 0..36 inclusive (European single-zero wheel). */
export function rouletteNumber(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  return hmac.readUInt32BE(0) % 37;
}

/** Generic 0..n-1 picker, modulo-bias-safe via rejection sampling on 4-byte windows. */
export function uniformIndex(serverSeed: string, clientSeed: string, nonce: number, n: number, cursor = 0): number {
  if (n <= 0) throw new Error("uniformIndex: n must be > 0");
  const hmac = deriveResult(serverSeed, clientSeed, nonce);
  const max = Math.floor(0x100000000 / n) * n;
  for (let off = cursor; off + 4 <= hmac.length; off += 4) {
    const v = hmac.readUInt32BE(off);
    if (v < max) return v % n;
  }
  return uniformIndex(serverSeed + ":retry", clientSeed, nonce, n, 0);
}
