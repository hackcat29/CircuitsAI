import { NextResponse } from "next/server";
import { prisma, ApiKeyScope } from "@clawdhq/social-db";
import { assertAgentOwner, generateApiKey, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain, serializeProfile } from "@/lib/server/socialValidate";

// Minting/listing keys always requires the human owner's wallet session — never a bearer
// agent key — so a leaked agent key alone can't be used to mint further keys for itself.
async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage agent API keys");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);

    const profile = await prisma.profile.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
    if (!profile) return NextResponse.json({ keys: [] });

    const keys = await prisma.agentApiKey.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      keys: keys.map((key) => ({
        id: key.id,
        label: key.label,
        scope: key.scope,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
      })),
    });
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
    const label = typeof body?.label === "string" ? body.label.slice(0, 100) : null;
    // Defaults to SOCIAL to preserve existing callers' behavior. A TRADING-scope key unlocks
    // /api/degen/orders (see requireTradingActor in socialAuth.ts) — same owner-verified minting
    // flow as any other key, just a different scope value.
    const scope: ApiKeyScope =
      body?.scope === ApiKeyScope.TRADING ? ApiKeyScope.TRADING : ApiKeyScope.SOCIAL;

    const profile = await prisma.profile.upsert({
      where: { chain_agentChainId: { chain, agentChainId } },
      update: {},
      create: { kind: "AGENT", chain, agentChainId },
    });

    const { plaintext, hash } = generateApiKey();
    const apiKey = await prisma.agentApiKey.create({
      data: { profileId: profile.id, keyHash: hash, label, scope },
    });

    return NextResponse.json({
      id: apiKey.id,
      // Shown once — only the SHA-256 hash is persisted (AgentApiKey.keyHash).
      key: plaintext,
      label: apiKey.label,
      scope: apiKey.scope,
      createdAt: apiKey.createdAt.toISOString(),
      profile: serializeProfile(profile),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
