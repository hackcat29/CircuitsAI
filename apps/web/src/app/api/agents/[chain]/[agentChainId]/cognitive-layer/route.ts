import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain, serializeCognitiveLayer, parseClientCommunicationStyle } from "@/lib/server/socialValidate";

// Same "public read, owner-only write" shape as the claim route (see .../claim/route.ts) and
// the API-key routes — persona content isn't secret, but only the agent's current on-chain
// owner may change it, verified live (never cached), so edit rights follow an Agent Exchange
// sale automatically same as everything else gated this way.
async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can edit an agent's persona");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const layer = await prisma.cognitiveLayer.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    return NextResponse.json({ layer: layer ? serializeCognitiveLayer(layer) : null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    const existing = await prisma.cognitiveLayer.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });

    const displayName = typeof body?.displayName === "string" ? body.displayName.slice(0, 48) : existing?.displayName ?? null;
    const avatarUrl = typeof body?.avatarUrl === "string" ? body.avatarUrl.slice(0, 500) : existing?.avatarUrl ?? null;
    const personality = Array.isArray(body?.personality) ? body.personality.filter((t: unknown) => typeof t === "string") : existing?.personality ?? [];
    const knowledgeDomains = Array.isArray(body?.knowledgeDomains) ? body.knowledgeDomains.filter((d: unknown) => typeof d === "string") : existing?.knowledgeDomains ?? [];
    const communicationStyle = body?.communicationStyle !== undefined ? parseClientCommunicationStyle(body.communicationStyle) : existing?.communicationStyle ?? "TECHNICAL";
    const worldview = typeof body?.worldview === "string" ? body.worldview.slice(0, 280) : existing?.worldview ?? null;
    const voicePersona = typeof body?.voicePersona === "string" ? body.voicePersona : existing?.voicePersona ?? null;
    const customSystemPrompt = typeof body?.customSystemPrompt === "string" ? body.customSystemPrompt : existing?.customSystemPrompt ?? null;
    const foundationModel = typeof body?.foundationModel === "string" ? body.foundationModel : existing?.foundationModel ?? "llama-3.3-70b";
    const slaHours = typeof body?.slaHours === "number" ? body.slaHours : existing?.slaHours ?? 24;
    const isLocked = typeof body?.isLocked === "boolean" ? body.isLocked : existing?.isLocked ?? false;

    const layer = await prisma.cognitiveLayer.upsert({
      where: { chain_agentChainId: { chain, agentChainId } },
      create: { chain, agentChainId, displayName, avatarUrl, personality, knowledgeDomains, communicationStyle, worldview, voicePersona, customSystemPrompt, foundationModel, slaHours, isLocked },
      update: { displayName, avatarUrl, personality, knowledgeDomains, communicationStyle, worldview, voicePersona, customSystemPrompt, foundationModel, slaHours, isLocked },
    });

    return NextResponse.json({ layer: serializeCognitiveLayer(layer) });
  } catch (error) {
    return errorResponse(error);
  }
}
