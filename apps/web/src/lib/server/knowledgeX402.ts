import { parseUnits } from "viem";
import { prisma as custodyPrisma, Prisma, PaymentPullStatus, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { ProfileKind, type Profile } from "@clawdhq/social-db";
import { getAgentWalletAddress, usdcAddressFor, decodePaymentHeader, type EvmPrismaChain, type PaymentRequirements } from "@clawdhq/custody-core";

// Knowledge's own x402 challenge/verify pair, mirroring agentX402.ts's shape exactly but for a
// 50/50 owner/protocol split instead of one recipient: two PaymentRequirements in `accepts`
// (resource suffixed ":owner"/":protocol") instead of one, and two proof headers
// (X-PAYMENT-OWNER/X-PAYMENT-PROTOCOL) instead of one X-PAYMENT — a single X-PAYMENT header
// encodes exactly one FacilitatorPullPayload (see x402Wire.ts), so a two-leg payment needs two
// header slots rather than a wire-format change. No intermediate treasury wallet: both legs land
// straight at their final destination (owner's own wallet, and a plain configured
// KNOWLEDGE_PROTOCOL_FEE_ADDRESS) — see KnowledgeUsage's schema doc comment (custody-db).

function protocolFeeAddress(): string {
  const value = process.env.KNOWLEDGE_PROTOCOL_FEE_ADDRESS;
  if (!value) throw new Error("KNOWLEDGE_PROTOCOL_FEE_ADDRESS is not set. See .env.example");
  return value;
}

export function protocolShareOf(priceUsdc: string): string {
  return new Prisma.Decimal(priceUsdc).times(0.20).toDecimalPlaces(6).toString();
}

export function ownerShareOf(priceUsdc: string): string {
  const priceDec = new Prisma.Decimal(priceUsdc);
  const protoDec = priceDec.times(0.20).toDecimalPlaces(6);
  return priceDec.minus(protoDec).toDecimalPlaces(6).toString();
}

export function halfOf(priceUsdc: string): string {
  return protocolShareOf(priceUsdc);
}

/** Resolves where a contribution's owner gets paid. A HUMAN profile's `walletAddress` is
 * chain-agnostic (already a verified-owned address from their sign-in session, socialAuth.ts) —
 * any EVM chain works. An AGENT profile only has an AgentWallet on the one chain that profile
 * itself is registered on (Profile.chain), so a request on any other chain has nowhere to pay —
 * returns null rather than guessing, which the resolve route turns into a clear rejection. */
export async function resolveOwnerPayoutAddress(owner: Profile, chain: EvmPrismaChain): Promise<string | null> {
  if (owner.kind === ProfileKind.HUMAN) return owner.walletAddress;
  if (!owner.agentChainId || (owner.chain as unknown as EvmPrismaChain) !== chain) return null;
  return getAgentWalletAddress(chain as unknown as CustodyChain, owner.agentChainId);
}

function buildRequirement(chain: EvmPrismaChain, payTo: string, amountUsdc: string, resource: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: chain,
    maxAmountRequired: parseUnits(amountUsdc, 6).toString(),
    resource,
    description: "Circuits AI knowledge contribution",
    payTo,
    asset: usdcAddressFor(chain),
    extra: { settlement: "circuitsprotocol-facilitator-pull" },
  };
}

export interface KnowledgeX402Challenge {
  x402Version: number;
  accepts: PaymentRequirements[];
}

export function buildKnowledgeX402Challenge(contributionId: string, chain: EvmPrismaChain, ownerPayoutAddress: string, priceUsdc: string): KnowledgeX402Challenge {
  const ownerShare = ownerShareOf(priceUsdc);
  const protocolShare = protocolShareOf(priceUsdc);
  return {
    x402Version: 1,
    accepts: [
      buildRequirement(chain, ownerPayoutAddress, ownerShare, `knowledge:${contributionId}:owner`),
      buildRequirement(chain, protocolFeeAddress(), protocolShare, `knowledge:${contributionId}:protocol`),
    ],
  };
}

type LegVerifyResult = { ok: true; idempotencyKey: string; payerAddress: string } | { ok: false; reason: string };

async function verifyLeg(chain: EvmPrismaChain, expectedRecipient: string, expectedAmountUsdc: string, header: string | null): Promise<LegVerifyResult> {
  if (!header) return { ok: false, reason: "missing payment proof header." };
  const decoded = decodePaymentHeader(header);
  if (!decoded) return { ok: false, reason: "payment proof header is malformed." };
  if (decoded.payload.chain !== chain) return { ok: false, reason: "payment was made on a different chain than requested." };

  const idempotencyKey = decoded.payload.idempotencyKey;
  const pull = await custodyPrisma.paymentPull.findUnique({ where: { idempotencyKey } });
  if (!pull || pull.status !== PaymentPullStatus.SUCCEEDED) return { ok: false, reason: "no confirmed payment found for this idempotencyKey." };
  if (pull.recipientAddress.toLowerCase() !== expectedRecipient.toLowerCase()) return { ok: false, reason: "payment was made to a different recipient." };
  if (pull.amountUsdc.lessThan(expectedAmountUsdc)) return { ok: false, reason: `payment (${pull.amountUsdc.toString()} USDC) is below the required amount (${expectedAmountUsdc} USDC).` };

  return { ok: true, idempotencyKey, payerAddress: pull.payerAddress };
}

export type KnowledgeX402VerifyResult =
  | { ok: true; ownerIdempotencyKey: string; protocolIdempotencyKey: string; ownerPayerAddress: string }
  | { ok: false; reason: string };

/** Verifies both legs of a knowledge-resolve payment against real, already-confirmed PaymentPull
 * rows (written by pullPayment when the caller side actually paid) — every check is a hard
 * rejection, matching verifyAgentX402Payment's discipline. Replay protection is KnowledgeUsage's
 * own @unique ownerPullId/protocolPullId (checked by the resolve route right after this passes,
 * in the same transaction that writes the usage row), not a separate redemption table — a pull
 * that already backs a usage row can't back a second one. Returns `ownerPayerAddress` so the
 * resolve route can reject the trivial self-dealing case (an owner paying themselves from the
 * same wallet their own payout lands in to farm usage stats) — see that route's own comment. */
export async function verifyKnowledgeX402Payment(chain: EvmPrismaChain, ownerPayoutAddress: string, priceUsdc: string, ownerHeader: string | null, protocolHeader: string | null): Promise<KnowledgeX402VerifyResult> {
  const ownerShare = ownerShareOf(priceUsdc);
  const protocolShare = protocolShareOf(priceUsdc);

  const [ownerResult, protocolResult] = await Promise.all([verifyLeg(chain, ownerPayoutAddress, ownerShare, ownerHeader), verifyLeg(chain, protocolFeeAddress(), protocolShare, protocolHeader)]);

  if (!ownerResult.ok) return { ok: false, reason: `Owner payment: ${ownerResult.reason}` };
  if (!protocolResult.ok) return { ok: false, reason: `Protocol fee payment: ${protocolResult.reason}` };

  return { ok: true, ownerIdempotencyKey: ownerResult.idempotencyKey, protocolIdempotencyKey: protocolResult.idempotencyKey, ownerPayerAddress: ownerResult.payerAddress };
}
