import { NextResponse } from "next/server";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Every hosted-runtime config for one chain, mirroring cognitive-layers/route.ts's exact shape
// and reasoning — a bounded "just fetch everything for the active chain" read for a
// testnet-scale agent count, so the Agent Directory / Marketplace hire picker / Terminal can
// badge "Hosted" without an N+1 fetch per agent. Public, same fields the per-agent GET route
// already exposes without gating (mode/billing aren't secret) — deliberately omits
// x402ReplyPriceUsdc/executionCount/lastTickAt/nextTickAt, which nothing bulk-listing needs.
export async function GET(request: Request, context: { params: Promise<{ chain: string }> }) {
  try {
    const { chain: chainParam } = await context.params;
    const chain = parseChain(chainParam);
    const custodyChain = chain as unknown as CustodyChain;

    const [configs, credits] = await Promise.all([
      custodyPrisma.hostedRuntimeConfig.findMany({ where: { chain: custodyChain } }),
      custodyPrisma.agentLlmCredit.findMany({ where: { chain: custodyChain } }),
    ]);
    const creditMap = new Map(credits.map((c) => [c.agentChainId, c.balanceUsdc.toString()]));

    const configMap = new Map(configs.map((c) => [c.agentChainId, c]));
    const agentChainIds = Array.from(
      new Set([...configs.map((c) => c.agentChainId), ...credits.map((c) => c.agentChainId)]),
    );

    return NextResponse.json({
      configs: agentChainIds.map((agentChainId) => {
        const c = configMap.get(agentChainId);
        const usdc = creditMap.get(agentChainId) ?? "0";
        const creditsNum = Math.round(parseFloat(usdc) * 100);
        return {
          agentChainId,
          mode: c?.mode ?? "HOSTED",
          llmBilling: c?.llmBilling ?? "PLATFORM",
          isActive: c?.isActive ?? false,
          balanceUsdc: usdc,
          balanceCredits: creditsNum.toString(),
        };
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
