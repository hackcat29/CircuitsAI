import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchGuarded } from "./fetchPublicJson";
import { pullPayment, PaymentRejection, parseX402Body, encodePaymentHeader, type PaymentRequirements, type EvmPrismaChain } from "@clawdhq/custody-core";
import { formatUnits } from "viem";

// Speaks the A2A (Agent2Agent) protocol's `message/send` JSON-RPC 2.0 method — the one case
// where we actually know the wire format for an arbitrary registered agent (see
// agentA2aLookup.ts's doc comment on why "declares A2A support" isn't itself a trust
// guarantee). Parsed defensively with zod rather than asserted as a fixed shape: the on-chain
// `endpoint`/`supportsA2A` are self-declared and unverified, so there's no guarantee any given
// agent actually implements this correctly — separately from the protocol itself having moved
// through multiple draft versions. The discriminator field below is `kind` (not `type`), on
// both a Part and the top-level result ("message" vs "task") — verified against the A2A
// reference SDK/sample responses at the time this was written; worth spot-checking again if
// real agents start responding in an unrecognized shape.

const CALL_TIMEOUT_MS = 20_000;

const PartSchema = z.object({ kind: z.string(), text: z.string().optional() }).passthrough();

const MessageResultSchema = z.object({ kind: z.literal("message"), parts: z.array(PartSchema).optional() }).passthrough();
const TaskResultSchema = z.object({ kind: z.literal("task") }).passthrough();

const JsonRpcErrorSchema = z.object({ code: z.number().optional(), message: z.string() }).passthrough();

const A2aResponseSchema = z.object({
  result: z.union([MessageResultSchema, TaskResultSchema]).optional(),
  error: JsonRpcErrorSchema.optional(),
});

export type A2aCallResult =
  | { kind: "message"; text: string }
  | { kind: "task" }
  | { kind: "error"; detail: string };

/** A verified human payer, present only when the caller has a real signed-in session — see
 * agents/call/route.ts. Never accept this from unchecked request input: pullPayment moves real
 * funds out of `payerAddress`'s wallet via whatever ERC-20 allowance it has already granted the
 * facilitator, so this address must come from a cryptographically verified source (the same
 * SIWE session Subscriptions/the social feed already use), never a client-supplied field. */
export interface X402PaymentContext {
  chain: EvmPrismaChain;
  payerAddress: string;
}

/** POSTs `message` to an agent's declared A2A endpoint. Network-level failures (unreachable,
 * timeout, SSRF-blocked) throw (via fetchGuarded) — the caller's route should surface those as
 * hard errors. Everything else the agent might say back — a JSON-RPC error, an async "task"
 * instead of an immediate reply, or a response that doesn't parse as A2A at all — is returned as
 * data, not thrown: the request was attempted successfully, the agent's own response was just
 * unhelpful or confusing. A 402 is handled specially: if `paymentContext` is present (a real
 * signed-in human), this attempts a real x402 facilitator-pull payment and retries once with
 * proof; otherwise it falls back to surfacing the 402 as a passive error, same as before. */
export async function callAgentViaA2a(endpoint: string, message: string, paymentContext?: X402PaymentContext): Promise<A2aCallResult> {
  const requestBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: randomUUID(),
        parts: [{ kind: "text", text: message }],
      },
    },
  };

  const first = await fetchGuarded(endpoint, { method: "POST", body: requestBody, timeoutMs: CALL_TIMEOUT_MS, throwOnError: false });

  if (first.status !== 402) return parseA2aResponse(first.status, first.data);
  if (!paymentContext) return { kind: "error", detail: `Agent requires payment: ${extractPaymentDetail(first.data)}` };

  const requirements = parseX402Body(first.data);
  if (!requirements) return { kind: "error", detail: `Agent requires payment: ${extractPaymentDetail(first.data)}` };

  // Prefer a requirement explicitly advertising Circuits Protocol's own settlement scheme; otherwise fall
  // back to the first entry anyway — this app can only ever settle through its own facilitator
  // (it holds no other signer capable of a real EIP-3009 authorization), so this is a
  // best-effort attempt at whatever the agent listed, not a real negotiation between schemes.
  const requirement: PaymentRequirements = requirements.find((r) => r.extra?.settlement === "circuitsprotocol-facilitator-pull") ?? requirements[0];

  const idempotencyKey = randomUUID();
  let txHashOrRef: string;
  try {
    const amountUsdc = formatUnits(BigInt(requirement.maxAmountRequired), 6);
    const result = await pullPayment(paymentContext.chain, paymentContext.payerAddress, requirement.payTo, amountUsdc, idempotencyKey);
    txHashOrRef = result.txHashOrRef;
  } catch (error) {
    const detail = error instanceof PaymentRejection ? error.message : "the payment attempt failed unexpectedly.";
    return { kind: "error", detail: `Agent requires payment, and ${detail}` };
  }

  const paymentHeader = encodePaymentHeader(requirement, {
    chain: paymentContext.chain,
    payer: paymentContext.payerAddress,
    recipient: requirement.payTo,
    amount: requirement.maxAmountRequired,
    idempotencyKey,
    txHashOrRef,
  });

  const retry = await fetchGuarded(endpoint, {
    method: "POST",
    body: requestBody,
    timeoutMs: CALL_TIMEOUT_MS,
    throwOnError: false,
    headers: { "X-PAYMENT": paymentHeader },
  });

  if (retry.status === 402) {
    return { kind: "error", detail: `Payment succeeded (tx ${txHashOrRef}), but the agent still returned 402 on retry.` };
  }
  return parseA2aResponse(retry.status, retry.data);
}

function parseA2aResponse(status: number, data: unknown): A2aCallResult {
  if (data === null) {
    return { kind: "error", detail: `Agent responded with HTTP ${status} and no readable JSON body.` };
  }

  const parsed = A2aResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { kind: "error", detail: "Agent responded, but not in a format Circuits AI recognizes as A2A." };
  }

  if (parsed.data.error) {
    return { kind: "error", detail: parsed.data.error.message };
  }

  if (!parsed.data.result) {
    return { kind: "error", detail: "Agent returned an empty response." };
  }

  if (parsed.data.result.kind === "task") {
    return { kind: "task" };
  }

  const text = (parsed.data.result.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t))
    .join("\n");

  if (!text) return { kind: "error", detail: "Agent replied with no text content." };
  return { kind: "message", text };
}

function extractPaymentDetail(body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body && typeof (body as { message?: unknown }).message === "string") {
    return (body as { message: string }).message;
  }
  return "see agent for payment instructions (no structured detail in the 402 response).";
}
