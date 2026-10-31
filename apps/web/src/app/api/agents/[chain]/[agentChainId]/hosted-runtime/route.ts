import { NextResponse } from "next/server";
import { prisma as custodyPrisma, RuntimeMode, LlmBilling, Prisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { hasActiveAgentLlmKey } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// HostedRuntimeConfig (custody-db) is the row a hosted agent's scheduler tick claims (Phase 5)
// and the row the reactive .../a2a proxy route checks before answering on an agent's behalf —
// see custody-db/prisma/schema.prisma's own doc comment on why this lives alongside AgentWallet
// rather than in social-db with the persona content. `social-db`'s Chain enum and this one are
// deliberate duplicates with identical string values (separate Prisma datasources can't share
// generated types) — cast at the boundary rather than plumbing two chain params everywhere.
function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can configure an agent's hosted runtime");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

// Public read (mode/billing aren't secret — the LLM key itself never appears in this response,
// see hasLlmKey), owner-only write, same shape as every other agent-scoped route in this app.
export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);

    let config: any = null;
    let hasLlmKey = false;

    try {
      [config, hasLlmKey] = await Promise.all([
        custodyPrisma.hostedRuntimeConfig.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } }),
        hasActiveAgentLlmKey(custodyChain, agentChainId).catch(() => false),
      ]);
    } catch (dbErr) {
      console.warn(`[hosted-runtime GET] db lookup fallback for ${chainParam}:${agentChainId}:`, dbErr);
    }

    return NextResponse.json({
      config: config
        ? {
            mode: config.mode,
            llmBilling: config.llmBilling,
            isActive: typeof config.isActive === "boolean" ? config.isActive : true,
            tickIntervalMinutes: Number(config.tickIntervalMinutes ?? 60),
            x402ReplyPriceUsdc: config.x402ReplyPriceUsdc ? config.x402ReplyPriceUsdc.toString() : "0",
            executionCount: Number(config.executionCount ?? 0),
            lastTickAt: config.lastTickAt ? new Date(config.lastTickAt).toISOString() : null,
            nextTickAt: config.nextTickAt ? new Date(config.nextTickAt).toISOString() : null,
          }
        : {
            mode: "HOSTED",
            llmBilling: "PLATFORM",
            isActive: true,
            tickIntervalMinutes: 60,
            x402ReplyPriceUsdc: "0",
            executionCount: 0,
            lastTickAt: null,
            nextTickAt: null,
          },
      hasLlmKey,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    let existing: any = null;
    try {
      existing = await custodyPrisma.hostedRuntimeConfig.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });
    } catch (e) {
      console.warn(`[hosted-runtime POST] existing lookup failed:`, e);
    }

    const mode: RuntimeMode = body?.mode === RuntimeMode.BYO_ENDPOINT ? RuntimeMode.BYO_ENDPOINT : RuntimeMode.HOSTED;
    const llmBilling: LlmBilling = body?.llmBilling === LlmBilling.BYO_KEY ? LlmBilling.BYO_KEY : LlmBilling.PLATFORM;
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : (existing?.isActive ?? true);

    let tickIntervalMinutes = existing?.tickIntervalMinutes ?? 60;
    if (typeof body?.tickIntervalMinutes === "number" && body.tickIntervalMinutes > 0) {
      tickIntervalMinutes = Math.max(1, Math.floor(body.tickIntervalMinutes));
    } else if (typeof body?.tickIntervalMinutes === "string" && !isNaN(Number(body.tickIntervalMinutes)) && Number(body.tickIntervalMinutes) > 0) {
      tickIntervalMinutes = Math.max(1, Math.floor(Number(body.tickIntervalMinutes)));
    }

    let x402ReplyPriceUsdc = existing?.x402ReplyPriceUsdc ?? new Prisma.Decimal(0);
    if (typeof body?.x402ReplyPriceUsdc === "string" || typeof body?.x402ReplyPriceUsdc === "number") {
      try {
        x402ReplyPriceUsdc = new Prisma.Decimal(body.x402ReplyPriceUsdc);
      } catch {
        throw new ApiError(400, "Invalid x402ReplyPriceUsdc.");
      }
      if (x402ReplyPriceUsdc.isNegative()) throw new ApiError(400, "x402ReplyPriceUsdc can't be negative.");
    }

    if (llmBilling === LlmBilling.BYO_KEY && !(await hasActiveAgentLlmKey(custodyChain, agentChainId))) {
      throw new ApiError(400, "Save an LLM provider key before switching this agent to bring-your-own-key billing.");
    }

    const config = await custodyPrisma.hostedRuntimeConfig.upsert({
      where: { chain_agentChainId: { chain: custodyChain, agentChainId } },
      create: { chain: custodyChain, agentChainId, mode, llmBilling, isActive, tickIntervalMinutes, x402ReplyPriceUsdc },
      update: { mode, llmBilling, isActive, tickIntervalMinutes, x402ReplyPriceUsdc },
    });

    return NextResponse.json({
      config: {
        mode: config.mode,
        llmBilling: config.llmBilling,
        isActive: config.isActive,
        tickIntervalMinutes: config.tickIntervalMinutes,
        x402ReplyPriceUsdc: config.x402ReplyPriceUsdc.toString(),
        executionCount: Number(config.executionCount ?? 0),
        lastTickAt: config.lastTickAt ? new Date(config.lastTickAt).toISOString() : null,
        nextTickAt: config.nextTickAt ? new Date(config.nextTickAt).toISOString() : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
