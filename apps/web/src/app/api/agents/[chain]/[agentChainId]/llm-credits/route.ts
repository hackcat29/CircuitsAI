import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { getAgentLlmCreditBalance, getAgentWalletLiveBalance, usdcToCredits, tierForHistoricalCost } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain, parsePageSize } from "@/lib/server/socialValidate";

// Owner-only view of a PLATFORM-billed agent's prepaid LLM balance (custody-db's
// AgentLlmCredit) and recent per-call debit log (AgentLlmUsage) — see agentLlmCredit.ts's own
// doc comment for how the balance is funded (a real on-chain transfer from the agent's
// AgentWallet, not an admin-settable number). Same owner-only-read stance as spend-policy: the
// balance isn't secret from a security standpoint, but it's nobody else's business either.
function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = toCustodyChain(chain);

    const session = await getSessionProfile();
    if (!session) throw new ApiError(401, "Sign in with your wallet first");
    if (session.kind !== "HUMAN" || !session.walletAddress) throw new ApiError(403, "Only a human wallet session can view an agent's LLM credits");
    await assertAgentOwner(chain, agentChainId, session.walletAddress);

    const { searchParams } = new URL(request.url);
    const take = parsePageSize(searchParams.get("pageSize"));

    const [balance, agentWalletBalanceRaw, usage] = await Promise.all([
      getAgentLlmCreditBalance(custodyChain, agentChainId),
      getAgentWalletLiveBalance(custodyChain, agentChainId),
      custodyPrisma.agentLlmUsage.findMany({ where: { chain: custodyChain, agentChainId }, orderBy: { createdAt: "desc" }, take }),
    ]);

    return NextResponse.json({
      balanceUsdc: balance.toString(),
      balanceCredits: usdcToCredits(balance),
      // Live AgentWallet balance, not the credit balance — what the top-up UI checks before
      // letting an owner pick an amount larger than the agent actually has.
      agentWalletBalanceUsdc: agentWalletBalanceRaw !== null ? formatUnits(agentWalletBalanceRaw, 6) : null,
      usage: usage.map((u) => ({
        id: u.id,
        callKind: u.callKind,
        provider: u.provider,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        costUsdc: u.costUsdc.toString(),
        costCredits: usdcToCredits(u.costUsdc),
        // Reverse-looked-up from costUsdc against the *current* rate table — null for a row
        // whose cost no longer matches any tier (an operator changed a rate env var since this
        // row was charged). See agentLlmCredit.ts's tierForHistoricalCost doc comment.
        tier: tierForHistoricalCost(u.callKind, u.costUsdc),
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
