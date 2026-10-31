import { parseUnits } from "viem";
import { prisma as custodyPrisma, PaymentPullStatus, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { getAgentWalletAddress, usdcAddressFor, isEvmPrismaChain, decodePaymentHeader, type PaymentRequirements } from "@clawdhq/custody-core";

// Inbound x402 monetization for a hosted agent's reactive reply (see .../a2a/route.ts) — the
// server-side counterpart to a2aClient.ts's existing client-side x402 handling, which already
// knows how to pay a "circuitsprotocol-facilitator-pull" requirement and retry. Nothing needed to build
// on the caller side: /api/agents/call already negotiates payment automatically whenever *any*
// agent's endpoint returns a 402 in this shape, so wiring this up here is what actually turns
// HostedRuntimeConfig.x402ReplyPriceUsdc into a real paywall rather than a stored number nothing
// reads. EVM-only, matching payment infra elsewhere in this codebase (PaymentPull/pullPayment).

export type X402VerifyResult = { ok: true } | { ok: false; reason: string };

function buildRequirement(evmChain: CustodyChain, payTo: string, priceUsdc: string, resource: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: evmChain,
    maxAmountRequired: parseUnits(priceUsdc, 6).toString(),
    resource,
    description: "Circuits AI hosted agent reply",
    payTo,
    asset: usdcAddressFor(evmChain as Parameters<typeof usdcAddressFor>[0]),
    extra: { settlement: "circuitsprotocol-facilitator-pull" },
  };
}

/** Builds the 402 challenge body for an unpaid request — null if this agent has no AgentWallet
 * provisioned yet (nothing to pay into), same "not ready yet" outcome as any other AgentWallet-
 * dependent action in this codebase. */
export async function buildAgentX402Challenge(
  chain: CustodyChain,
  agentChainId: string,
  priceUsdc: string,
  resource: string,
): Promise<{ x402Version: number; error?: string; accepts: PaymentRequirements[] } | null> {
  if (!isEvmPrismaChain(chain)) return null;
  const payTo = await getAgentWalletAddress(chain, agentChainId);
  if (!payTo) return null;
  return { x402Version: 1, accepts: [buildRequirement(chain, payTo, priceUsdc, resource)] };
}

/** Verifies an inbound X-PAYMENT header against a real, already-confirmed facilitator pull
 * (PaymentPull — written by pullPayment when the caller side actually paid) and marks it
 * redeemed so the same payment can't unlock a second reply. Every check is a hard rejection, not
 * a warning: wrong recipient, insufficient amount, wrong chain, an unconfirmed/failed pull, or a
 * replayed idempotencyKey all fail closed. */
export async function verifyAgentX402Payment(chain: CustodyChain, agentChainId: string, priceUsdc: string, header: string): Promise<X402VerifyResult> {
  const decoded = decodePaymentHeader(header);
  if (!decoded) return { ok: false, reason: "X-PAYMENT header is malformed." };
  if (decoded.payload.chain !== chain) return { ok: false, reason: "Payment was made on a different chain than this request." };

  const payTo = await getAgentWalletAddress(chain, agentChainId);
  if (!payTo) return { ok: false, reason: "This agent has no wallet provisioned yet. Payment can't be verified." };

  const idempotencyKey = decoded.payload.idempotencyKey;

  const [pull, alreadyRedeemed] = await Promise.all([
    custodyPrisma.paymentPull.findUnique({ where: { idempotencyKey } }),
    custodyPrisma.agentX402Redemption.findUnique({ where: { idempotencyKey } }),
  ]);

  if (!pull || pull.status !== PaymentPullStatus.SUCCEEDED) return { ok: false, reason: "No confirmed payment found for this idempotencyKey." };
  if (pull.recipientAddress.toLowerCase() !== payTo.toLowerCase()) return { ok: false, reason: "Payment was made to a different recipient." };
  if (pull.amountUsdc.lessThan(priceUsdc)) {
    return { ok: false, reason: `Payment (${pull.amountUsdc.toString()} USDC) is below the required price (${priceUsdc} USDC).` };
  }
  if (alreadyRedeemed) return { ok: false, reason: "This payment has already been redeemed for a previous reply." };

  // Written *after* every check passes, not before — unlike a spend (executeAgentSpend), there's
  // nothing to roll back here if a later check fails, so there's no forensic-evidence reason to
  // write early the way that pattern elsewhere in this codebase does.
  await custodyPrisma.agentX402Redemption.create({ data: { idempotencyKey, chain, agentChainId } });
  return { ok: true };
}
