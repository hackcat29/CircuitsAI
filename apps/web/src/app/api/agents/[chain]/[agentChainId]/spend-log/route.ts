import { NextResponse } from "next/server";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain, parsePageSize } from "@/lib/server/socialValidate";

function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

// Owner-only audit trail of every autonomous spend attempt this agent's runtime has made
// (AgentSpendLog, append-only) — same owner-only-read stance as the spend-policy route, and the
// same shape useSubscriptionRuns already uses for its own audit log.
export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) throw new ApiError(403, "Only a human wallet session can view an agent's spend log");
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    const policy = await custodyPrisma.agentSpendPolicy.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });
    if (!policy) return NextResponse.json({ logs: [] });

    const { searchParams } = new URL(request.url);
    const take = parsePageSize(searchParams.get("pageSize"));

    const logs = await custodyPrisma.agentSpendLog.findMany({
      where: { agentSpendPolicyId: policy.id },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        amountUsdc: log.amountUsdc.toString(),
        targetRef: log.targetRef,
        status: log.status,
        txHashOrRef: log.txHashOrRef,
        error: log.error,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
