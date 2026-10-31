import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/server/degen/degenAuth";
import { parseChain, parseVenue } from "@/lib/server/degen/degenValidate";
import { withdrawTradingWallet } from "@/lib/server/degen/degenWithdraw";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";
import { Chain as MarketplaceChain } from "@clawdhq/marketplace-db";
import type { EvmPrismaChain } from "@/lib/server/evmExchangeReaders";

// Owner-only, always — never a bearer agent key. Sweeps whatever balance this venue's custody
// wallet holds back to the agent's verified on-chain owner (see degenWithdraw.ts — that
// destination is resolved server-side, never taken from the request).
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string; venue: string }> }) {
  try {
    const { chain: chainParam, agentChainId, venue: venueParam } = await context.params;
    const chain = parseChain(chainParam);
    const venue = parseVenue(venueParam);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    let withdrawChain: EvmPrismaChain | undefined;
    if (body?.withdrawChain !== undefined) {
      const candidate = body.withdrawChain as MarketplaceChain;
      if (!isEvmPrismaChain(candidate)) throw new ApiError(400, `withdrawChain must be one of the EVM testnet chains, got "${String(body.withdrawChain)}"`);
      withdrawChain = candidate;
    }

    const result = await withdrawTradingWallet(chain, agentChainId, venue, withdrawChain);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
