import { NextResponse } from "next/server";
import { prisma as custodyPrisma, RuntimeMode, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { type Chain as SocialChain } from "@clawdhq/social-db";
import { resolveLlmKey, generateAgentReply, loadAgentPersonaContext, loadResolvedAgentSkills } from "@clawdhq/hosted-agent-runtime";
import { isEvmPrismaChain, postAgentChainActivityToClawdHq } from "@clawdhq/custody-core";
import { errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";
import { buildAgentX402Challenge, verifyAgentX402Payment } from "@/lib/server/agentX402";

// The on-chain `endpoint` a hosted-runtime agent registers (via the two-step registration flow
// — see useAgentRegistration.ts's waitForAgentRegistration + updateAgentMetadata). Speaks the
// same A2A `message/send` JSON-RPC shape apps/web/src/lib/server/a2aClient.ts already expects
// from any self-hosted agent's endpoint, so /api/agents/call and agentA2aLookup.ts need zero
// changes — this route is indistinguishable from a real owner-operated A2A server to the rest
// of the protocol. Synchronous: a human waiting in the hire-chat UI can't wait for a scheduled
// tick (Phase 5), so this always answers inline, unlike the goal-driven proactive loop.
//
// If HostedRuntimeConfig.x402ReplyPriceUsdc > 0, this also acts as a real x402 resource server
// (see agentX402.ts) — a request with no/invalid X-PAYMENT header gets a 402 challenge instead
// of a reply. No client-side changes needed anywhere: a2aClient.ts's callAgentViaA2a already
// pays a "circuitsprotocol-facilitator-pull" requirement and retries whenever *any* agent's endpoint
// returns 402 in this shape, so a paid hosted agent is just as callable through /api/agents/call
// as a free one always was.

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function jsonRpcMessage(id: unknown, text: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result: { kind: "message", parts: [{ kind: "text", text }] },
  });
}

function extractMessageText(body: unknown): string | null {
  const parts = (body as { params?: { message?: { parts?: unknown } } })?.params?.message?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p) => (typeof p === "object" && p !== null && "text" in p && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : null))
    .filter((t): t is string => Boolean(t))
    .join("\n");
  return text || null;
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  let requestId: unknown = null;
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = chain as unknown as CustodyChain;

    const body = await request.json().catch(() => null);
    requestId = (body as { id?: unknown })?.id ?? null;
    const message = extractMessageText(body);
    if (!message) return jsonRpcError(requestId, -32600, "Missing params.message.parts[].text");

    const config = await custodyPrisma.hostedRuntimeConfig.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });
    if (!config || config.mode !== RuntimeMode.HOSTED || !config.isActive) {
      return jsonRpcError(requestId, -32000, "This agent's hosted runtime isn't active.");
    }

    const priceUsdc = config.x402ReplyPriceUsdc.toString();
    if (Number(priceUsdc) > 0) {
      const paymentHeader = request.headers.get("X-PAYMENT");
      const resource = request.url;

      if (!paymentHeader) {
        const challenge = await buildAgentX402Challenge(custodyChain, agentChainId, priceUsdc, resource);
        if (!challenge) return jsonRpcError(requestId, -32000, "This agent has no wallet provisioned yet. Try again shortly.");
        return NextResponse.json(challenge, { status: 402 });
      }

      const verified = await verifyAgentX402Payment(custodyChain, agentChainId, priceUsdc, paymentHeader);
      if (!verified.ok) {
        const challenge = await buildAgentX402Challenge(custodyChain, agentChainId, priceUsdc, resource);
        return NextResponse.json({ ...(challenge ?? { x402Version: 1, accepts: [] }), error: verified.reason }, { status: 402 });
      }
      if (isEvmPrismaChain(custodyChain)) {
        await postAgentChainActivityToClawdHq(custodyChain, agentChainId, (name, profileUrl) =>
          `💰 ${name} just earned ${priceUsdc} USDC via x402 for a reply on Circuits Protocol. ${profileUrl}`
        );
      }
    }

    const socialChain = chain as unknown as SocialChain;
    const [persona, llmKey, skills] = await Promise.all([
      loadAgentPersonaContext(socialChain, agentChainId),
      resolveLlmKey(custodyChain, agentChainId, config.llmBilling),
      loadResolvedAgentSkills(socialChain, agentChainId),
    ]);
    const reply = await generateAgentReply(custodyChain, agentChainId, config.llmBilling, persona, message, llmKey, skills);

    await custodyPrisma.hostedRuntimeConfig.update({ where: { id: config.id }, data: { lastTickAt: new Date(), executionCount: { increment: 1 } } });

    return jsonRpcMessage(requestId, reply);
  } catch (error) {
    if (error instanceof Error) return jsonRpcError(requestId, -32000, error.message);
    return errorResponse(error);
  }
}
