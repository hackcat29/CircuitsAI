import { NextResponse } from "next/server";
import { prisma as custodyPrisma, Prisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { runHostedRuntimeTick } from "@clawdhq/hosted-agent-runtime";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) {
      throw new ApiError(403, "Only a human wallet session can trigger agent runtime ticks");
    }
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    let config: any = null;
    try {
      config = await custodyPrisma.hostedRuntimeConfig.findUnique({
        where: { chain_agentChainId: { chain: custodyChain, agentChainId } },
      });
    } catch (findErr) {
      console.warn(`[hosted-runtime/tick] findUnique fallback:`, findErr);
    }

    if (!config) {
      try {
        config = await custodyPrisma.hostedRuntimeConfig.upsert({
          where: { chain_agentChainId: { chain: custodyChain, agentChainId } },
          create: { chain: custodyChain, agentChainId, mode: "HOSTED", isActive: true, tickIntervalMinutes: 60 },
          update: { isActive: true },
        });
      } catch (upsertErr) {
        console.warn(`[hosted-runtime/tick] upsert fallback:`, upsertErr);
        config = {
          id: `virtual-${custodyChain}-${agentChainId}`,
          chain: custodyChain,
          agentChainId,
          mode: "HOSTED",
          llmBilling: "PLATFORM",
          isActive: true,
          tickIntervalMinutes: 60,
          x402ReplyPriceUsdc: new Prisma.Decimal(0),
          executionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          nextTickAt: new Date(),
          lastTickAt: null,
          lockedUntil: null,
        } as any;
      }
    }

    const result = await runHostedRuntimeTick(config);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
