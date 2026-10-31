import { NextResponse } from "next/server";
import { prisma as custodyPrisma, SpendAction, Prisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Owner-set authorization bounding what the hosted runtime may autonomously spend from the
// agent's AgentWallet — see custody-db/prisma/schema.prisma's AgentSpendPolicy doc comment and
// custody-core/src/agentSpendPolicy.ts's checkAgentSpendPolicy for how this gets enforced.
function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can configure an agent's spend policy");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

const ALL_SPEND_ACTIONS = Object.values(SpendAction);

// Owner-only both ways: unlike cognitive-layer/hosted-runtime config, spend authorization isn't
// public read — the cap and allowed actions are only this owner's business (a public read here
// would let anyone see exactly how much an agent's wallet can be autonomously drained for,
// information with no legitimate use to a non-owner).
export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);
    await requireOwnerSession(chain, agentChainId);

    const policy = await custodyPrisma.agentSpendPolicy.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });
    return NextResponse.json({
      policy: policy
        ? {
            dailyCapUsdc: policy.dailyCapUsdc.toString(),
            allowedActions: policy.allowedActions,
            isEnabled: policy.isEnabled,
            autonomousX402ResourceCapUsdc: policy.autonomousX402ResourceCapUsdc?.toString() ?? null,
          }
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    const existing = await custodyPrisma.agentSpendPolicy.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });

    let dailyCapUsdc: Prisma.Decimal;
    try {
      dailyCapUsdc = new Prisma.Decimal(typeof body?.dailyCapUsdc === "string" || typeof body?.dailyCapUsdc === "number" ? body.dailyCapUsdc : (existing?.dailyCapUsdc ?? 0));
    } catch {
      throw new ApiError(400, "Invalid dailyCapUsdc.");
    }
    if (dailyCapUsdc.isNegative()) throw new ApiError(400, "dailyCapUsdc can't be negative.");

    // Three states: omitted (leave whatever's already set), explicit null (clear it — turns the
    // autonomous PAY_X402_RESOURCE action back off), or a value (set the ceiling). Never sourced
    // from anywhere but this owner-authenticated request — see the schema field's own doc
    // comment on why the hosted-runtime LLM must never be the one proposing this number.
    let autonomousX402ResourceCapUsdc: Prisma.Decimal | null | undefined;
    if (body?.autonomousX402ResourceCapUsdc === null) {
      autonomousX402ResourceCapUsdc = null;
    } else if (typeof body?.autonomousX402ResourceCapUsdc === "string" || typeof body?.autonomousX402ResourceCapUsdc === "number") {
      try {
        autonomousX402ResourceCapUsdc = new Prisma.Decimal(body.autonomousX402ResourceCapUsdc);
      } catch {
        throw new ApiError(400, "Invalid autonomousX402ResourceCapUsdc.");
      }
      if (autonomousX402ResourceCapUsdc.isNegative()) throw new ApiError(400, "autonomousX402ResourceCapUsdc can't be negative.");
    }

    const allowedActions: SpendAction[] = Array.isArray(body?.allowedActions)
      ? body.allowedActions.filter((a: unknown): a is SpendAction => typeof a === "string" && ALL_SPEND_ACTIONS.includes(a as SpendAction))
      : (existing?.allowedActions ?? []);

    // isEnabled is a deliberate single flip, kept separate from dailyCapUsdc — see the schema's
    // own doc comment on why (revocation should be unambiguous in the audit trail, not read as
    // "temporarily out of budget").
    const isEnabled = typeof body?.isEnabled === "boolean" ? body.isEnabled : (existing?.isEnabled ?? false);

    const policy = await custodyPrisma.agentSpendPolicy.upsert({
      where: { chain_agentChainId: { chain: custodyChain, agentChainId } },
      create: {
        chain: custodyChain,
        agentChainId,
        dailyCapUsdc,
        allowedActions,
        isEnabled,
        autonomousX402ResourceCapUsdc: autonomousX402ResourceCapUsdc ?? null,
      },
      update: {
        dailyCapUsdc,
        allowedActions,
        isEnabled,
        // undefined here means "field omitted from the request" — Prisma's update leaves an
        // omitted field untouched, same semantics dailyCapUsdc/allowedActions/isEnabled already
        // get via their own `?? existing` fallbacks above, just expressed directly since this
        // field's "leave as-is" state has to stay distinguishable from its "clear it" (null) state.
        ...(autonomousX402ResourceCapUsdc !== undefined ? { autonomousX402ResourceCapUsdc } : {}),
      },
    });

    return NextResponse.json({
      policy: {
        dailyCapUsdc: policy.dailyCapUsdc.toString(),
        allowedActions: policy.allowedActions,
        isEnabled: policy.isEnabled,
        autonomousX402ResourceCapUsdc: policy.autonomousX402ResourceCapUsdc?.toString() ?? null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
