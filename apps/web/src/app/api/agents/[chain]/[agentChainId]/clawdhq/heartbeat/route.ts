import { NextResponse } from "next/server";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { getClawdHqLinkStatus } from "@clawdhq/custody-core";
import {
  loadHeartbeatState,
  updateHeartbeatSettings,
  runAgentHeartbeat,
  type HeartbeatState,
} from "@clawdhq/hosted-agent-runtime";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

export const dynamic = "force-dynamic";

function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can control agent heartbeat operations");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ chain: string; agentChainId: string }> },
) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);

    const [link, hostedConfig, heartbeatState] = await Promise.all([
      getClawdHqLinkStatus(custodyChain, agentChainId).catch(() => null),
      custodyPrisma.hostedRuntimeConfig.findUnique({
        where: { chain_agentChainId: { chain: custodyChain, agentChainId } },
      }).catch(() => null),
      loadHeartbeatState(custodyChain, agentChainId),
    ]);

    const now = Date.now();
    const hoursSinceLastPost = (now - (heartbeatState.lastPostAt || 0)) / (1000 * 60 * 60);
    const cooldownRemainingMinutes =
      hoursSinceLastPost < 2.0 ? Math.max(1, Math.round((2.0 - hoursSinceLastPost) * 60)) : 0;
    const isCooldownActive = cooldownRemainingMinutes > 0;

    return NextResponse.json({
      link,
      config: hostedConfig
        ? {
            isActive: hostedConfig.isActive,
            tickIntervalMinutes: hostedConfig.tickIntervalMinutes,
            lastTickAt: hostedConfig.lastTickAt,
            nextTickAt: hostedConfig.nextTickAt,
          }
        : null,
      heartbeat: {
        ...heartbeatState,
        cadenceMinutes: hostedConfig?.tickIntervalMinutes || heartbeatState.cadenceMinutes || 60,
        isCooldownActive,
        cooldownRemainingMinutes,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chain: string; agentChainId: string }> },
) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "pulse";

    if (action === "update_settings") {
      const updates: Partial<Pick<HeartbeatState, "quietMode" | "cadenceMinutes">> = {};
      if (typeof body?.quietMode === "boolean") updates.quietMode = body.quietMode;
      if (typeof body?.cadenceMinutes === "number" && body.cadenceMinutes > 0) {
        updates.cadenceMinutes = Math.max(1, Math.floor(body.cadenceMinutes));
        // Keep hosted runtime config cadence in sync
        try {
          await custodyPrisma.hostedRuntimeConfig.updateMany({
            where: { chain: custodyChain, agentChainId },
            data: { tickIntervalMinutes: updates.cadenceMinutes },
          });
        } catch {
          // ignore
        }
      }

      const updated = await updateHeartbeatSettings(custodyChain, agentChainId, updates);
      return NextResponse.json({ success: true, heartbeat: updated });
    }

    // Default action: "pulse" — trigger immediate heartbeat decision loop
    const result = await runAgentHeartbeat(custodyChain, agentChainId, {
      forceBroadcast: Boolean(body?.forceBroadcast),
      overrideQuietMode: Boolean(body?.overrideQuietMode),
      workContext: typeof body?.workContext === "string" ? body.workContext : undefined,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
