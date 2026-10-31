import { isEvmPrismaChain } from "@clawdhq/custody-core";
import { verifyUsdcTransfer } from "./serviceCallVerify";
import { ApiError } from "./socialErrors";

// Spam-prevention listing fees — publishing a skill or listing an x402 service are both pure
// off-chain Postgres writes with no contract to charge a fee inside (unlike
// ClawdHQCore.registrationFee / ClawdHQLaunchpad.launchFee, which deduct via safeTransferFrom in
// the same transaction). Same lightweight pattern serviceCallVerify.ts already uses for a paid
// service *call*, applied here to *listing* one instead: the client sends a direct USDC transfer
// to the treasury from its own wallet, then this app independently re-derives the truth from the
// transaction's own logs before allowing the write — never trusting the client's claim alone.

/** USDC amount required, in 6-decimal micros — null means the fee is disabled (unset or <= 0),
 * same "0 means free" convention `registrationFee`/`launchFee` already use on-chain. */
export function requiredListingFeeMicros(envVarName: string): bigint | null {
  const raw = process.env[envVarName];
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return BigInt(Math.round(amount * 1_000_000));
}

function requireTreasuryAddress(): string {
  const address = process.env.TREASURY_ADDRESS;
  if (!address) throw new ApiError(500, "A listing fee is enabled but no TREASURY_ADDRESS is configured.");
  return address;
}

/** Validates a caller-supplied {feeChain, feeTxHash} pair against `envVarName`'s configured fee
 * amount. Returns `{ feeChain: null, feeTxHash: null }` untouched when the fee is disabled —
 * callers should pass those straight to Prisma's nullable feeChain/feeTxHash columns either way.
 * Throws ApiError(400) for a malformed/missing chain or txHash, ApiError(402) if the payment
 * doesn't verify (wrong amount/parties, unconfirmed, or already used — verifyUsdcTransfer itself
 * doesn't distinguish those, and neither does this). */
export async function verifyListingFeeFields(
  envVarName: string,
  payerAddress: string,
  rawFeeChain: unknown,
  rawFeeTxHash: unknown,
): Promise<{ feeChain: string; feeTxHash: string } | { feeChain: null; feeTxHash: null }> {
  const requiredMicros = requiredListingFeeMicros(envVarName);
  if (requiredMicros === null) return { feeChain: null, feeTxHash: null };

  const treasury = requireTreasuryAddress();
  const feeChain = typeof rawFeeChain === "string" ? rawFeeChain : "";
  const feeTxHash = typeof rawFeeTxHash === "string" ? rawFeeTxHash : "";
  if (!isEvmPrismaChain(feeChain)) throw new ApiError(400, "A listing fee is required. feeChain must be one of the supported EVM chains.");
  if (!feeTxHash) throw new ApiError(400, "A listing fee is required. feeTxHash is missing.");

  const verified = await verifyListingFeeOnChain(feeChain, feeTxHash, payerAddress, treasury, requiredMicros);
  if (!verified) {
    throw new ApiError(
      402,
      `Couldn't verify the listing fee. Expected a confirmed USDC transfer of at least ${Number(requiredMicros) / 1_000_000} from your wallet to the treasury on ${feeChain}.`
    );
  }
  return { feeChain, feeTxHash };
}

/** Same shape as verifyListingFeeFields, for a caller (the services route) that already has its
 * own required `chain` field and only needs to verify+carry a single feeTxHash alongside it. */
export async function verifyListingFeeTxHash(envVarName: string, chain: string, payerAddress: string, rawFeeTxHash: unknown): Promise<string | null> {
  const requiredMicros = requiredListingFeeMicros(envVarName);
  if (requiredMicros === null) return null;

  const treasury = requireTreasuryAddress();
  const feeTxHash = typeof rawFeeTxHash === "string" ? rawFeeTxHash : "";
  if (!isEvmPrismaChain(chain)) throw new ApiError(400, "A listing fee is required but this chain isn't supported.");
  if (!feeTxHash) throw new ApiError(400, "A listing fee is required. feeTxHash is missing.");

  const verified = await verifyListingFeeOnChain(chain, feeTxHash, payerAddress, treasury, requiredMicros);
  if (!verified) {
    throw new ApiError(
      402,
      `Couldn't verify the listing fee. Expected a confirmed USDC transfer of at least ${Number(requiredMicros) / 1_000_000} from your wallet to the treasury on ${chain}.`
    );
  }
  return feeTxHash;
}

/** verifyUsdcTransfer is typed against marketplace-db's own Chain enum — cast at this one
 * boundary rather than threading a specific *-db package's nominal Chain type through this
 * shared helper, same "duplicated enum, cast at the seam" convention every cross-package Chain
 * reference in this codebase already uses (see e.g. apps/indexer/src/listeners/evm.ts's
 * toCustodyChain). Structurally identical string values across every *-db package's Chain enum. */
async function verifyListingFeeOnChain(chain: string, txHash: string, from: string, to: string, minAmountMicros: bigint): Promise<boolean> {
  return verifyUsdcTransfer(chain as Parameters<typeof verifyUsdcTransfer>[0], txHash, from, to, minAmountMicros);
}
