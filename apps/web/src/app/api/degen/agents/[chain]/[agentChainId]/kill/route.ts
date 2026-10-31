import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/degen-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { requireOwnerSession, requireTradingActor, toSocialChain } from "@/lib/server/degen/degenAuth";
import { parseChain } from "@/lib/server/degen/degenValidate";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// Engaging the kill switch accepts either the owner's session OR the agent's own TRADING-scope
// bearer key (a defensive circuit breaker the agent can trip on itself — e.g. its own strategy
// detects something wrong and wants to self-halt). Disengaging is owner-session only, always —
// never the bearer key, so a compromised or misbehaving agent can't un-kill itself.
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const body = await request.json().catch(() => ({}));
    const engage = body?.engage !== false; // POSTing with no body engages, by far the more common/urgent call

    if (!engage) {
      await requireOwnerSession(chain, agentChainId);
    } else {
      const session = await getSessionProfile();
      if (session?.kind === "HUMAN" && session.walletAddress) {
        await requireOwnerSession(chain, agentChainId);
      } else {
        const actor = await requireTradingActor(request);
        if (actor.profile.chain !== toSocialChain(chain) || actor.profile.agentChainId !== agentChainId) {
          throw new ApiError(403, "This key does not belong to this agent");
        }
      }
    }

    const existing = await prisma.tradingAgentConfig.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    if (!existing) throw new ApiError(404, "Trading is not configured for this agent yet");

    const config = await prisma.tradingAgentConfig.update({
      where: { chain_agentChainId: { chain, agentChainId } },
      data: engage
        ? { killSwitchEnabled: true, killedAt: new Date(), killedReason: typeof body?.reason === "string" ? body.reason : "Manually engaged" }
        : { killSwitchEnabled: false, killedAt: null, killedReason: null },
    });

    return NextResponse.json({ killSwitchEnabled: config.killSwitchEnabled, killedAt: config.killedAt?.toISOString() ?? null, killedReason: config.killedReason });
  } catch (error) {
    return errorResponse(error);
  }
}
