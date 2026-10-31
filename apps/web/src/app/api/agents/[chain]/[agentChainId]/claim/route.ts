import { NextResponse } from "next/server";
import { parseChain } from "@/lib/server/socialValidate";
import { claimForOwner, getAgentWalletInfo } from "@/lib/server/agentWalletClaim";
import { errorResponse } from "@/lib/server/socialErrors";

// GET: live wallet address + claimable balance (no auth — same "public read, owner-only write"
// shape every other on-chain-mirroring read route in this app already uses).
export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const info = await getAgentWalletInfo(chain, agentChainId);
    return NextResponse.json({ address: info?.address ?? null, claimableUsdc: info ? info.claimableUsdc.toString() : null });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST: sweeps the agent's AgentWallet balance to the caller's own wallet. Owner-only, always
// verified against a live on-chain read — never a bearer agent key, never a stored/cached
// owner value (see agentWalletClaim.ts's doc comment for why that matters after an Agent
// Exchange sale).
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    let amountUsdc: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body === "object" && typeof body.amountUsdc === "string") {
        amountUsdc = body.amountUsdc;
      }
    } catch {
      // Empty or non-JSON body is treated as a full sweep claim
    }
    const result = await claimForOwner(chain, agentChainId, amountUsdc);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
