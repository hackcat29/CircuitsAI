import { NextResponse } from "next/server";
import { prisma, Mode } from "@clawdhq/degen-db";
import { requireOwnerSession } from "@/lib/server/degen/degenAuth";
import { parseChain, parseVenueList, parsePositiveDecimal, serializeTradingAgentConfig } from "@/lib/server/degen/degenValidate";
import { errorResponse } from "@/lib/server/socialErrors";

// Owner-only control plane for one agent's Degen risk configuration — never a bearer agent
// key, same reasoning apps/web/src/app/api/social/agents/[chain]/[agentChainId]/keys uses for
// key minting: a leaked TRADING key alone shouldn't be able to loosen its own risk limits.

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    const config = await prisma.tradingAgentConfig.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    return NextResponse.json({ config: config ? serializeTradingAgentConfig(config) : null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json();
    const allowedVenues = parseVenueList(body?.allowedVenues ?? []);
    const maxPositionUsdc = parsePositiveDecimal(body?.maxPositionUsdc, "maxPositionUsdc");
    const maxDailyLossUsdc = parsePositiveDecimal(body?.maxDailyLossUsdc, "maxDailyLossUsdc");
    // Default to LIVE mode for testnet execution
    const mode = body?.mode === Mode.PAPER ? Mode.PAPER : Mode.LIVE;
    const paperBankrollUsdc = body?.paperBankrollUsdc !== undefined ? parsePositiveDecimal(body.paperBankrollUsdc, "paperBankrollUsdc") : undefined;

    const config = await prisma.tradingAgentConfig.upsert({
      where: { chain_agentChainId: { chain, agentChainId } },
      create: {
        chain,
        agentChainId,
        allowedVenues,
        maxPositionUsdc,
        maxDailyLossUsdc,
        mode,
        ...(paperBankrollUsdc ? { paperBankrollUsdc } : {}),
      },
      update: {
        allowedVenues,
        maxPositionUsdc,
        maxDailyLossUsdc,
        mode,
        ...(paperBankrollUsdc ? { paperBankrollUsdc } : {}),
      },
    });

    // Auto-provision trading hot wallets for LIVE testnet execution
    if (mode === Mode.LIVE) {
      const { provisionTradingWallet } = await import("@/lib/server/degen/custody");
      for (const venue of allowedVenues) {
        try {
          await provisionTradingWallet(chain, agentChainId, venue);
        } catch {
          // Idempotent or already provisioned
        }
      }
    }

    return NextResponse.json({ config: serializeTradingAgentConfig(config) });
  } catch (error) {
    return errorResponse(error);
  }
}
