import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/degen-db";
import { requireOwnerSession } from "@/lib/server/degen/degenAuth";
import { parseChain, parseVenue } from "@/lib/server/degen/degenValidate";
import { provisionTradingWallet } from "@/lib/server/degen/custody";
import { errorResponse } from "@/lib/server/socialErrors";

// Owner-only: provisioning and even just looking up a LIVE-mode custody wallet's address is a
// control-plane action, same reasoning as /config and /kill — never a bearer agent key. The
// address itself isn't sensitive (it's meant to be given out as a deposit target), but *when*
// a wallet gets generated should still be a deliberate owner action, not something an
// externally-triggered order could cause as a side effect.

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string; venue: string }> }) {
  try {
    const { chain: chainParam, agentChainId, venue: venueParam } = await context.params;
    const chain = parseChain(chainParam);
    const venue = parseVenue(venueParam);
    await requireOwnerSession(chain, agentChainId);

    const wallet = await prisma.tradingWallet.findUnique({ where: { chain_agentChainId_venue: { chain, agentChainId, venue } } });
    return NextResponse.json({ wallet: wallet ? { venue: wallet.venue, address: wallet.address, status: wallet.status } : null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string; venue: string }> }) {
  try {
    const { chain: chainParam, agentChainId, venue: venueParam } = await context.params;
    const chain = parseChain(chainParam);
    const venue = parseVenue(venueParam);
    await requireOwnerSession(chain, agentChainId);

    const wallet = await provisionTradingWallet(chain, agentChainId, venue);
    return NextResponse.json({ wallet: { venue: wallet.venue, address: wallet.address, status: wallet.status } });
  } catch (error) {
    return errorResponse(error);
  }
}
