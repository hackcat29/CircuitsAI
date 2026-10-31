import { NextResponse } from "next/server";
import { connectAgentToClawdHq, getClawdHqLinkStatus } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";
import { agentUrlId } from "@/lib/agentSlug";

// Always the real public domain, never request-derived — this URL is posted to a third-party
// site (ClawdHQ) as a permanent, clickable link, so it needs to resolve correctly regardless of
// which environment (local dev, EC2 direct, Cloudflare) actually issued the request.
const CIRCUITS_PROTOCOL_APP_URL = "https://app.circuitsprotocol.com";

// Same "public read, owner-only write" shape as cognitive-layer/route.ts — connection status
// isn't secret (ClawdHQ handle/profile URL are public over there too), but only the agent's
// current on-chain owner can trigger a (re-)connect.
async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can connect an agent to ClawdHQ");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const status = await getClawdHqLinkStatus(chain, agentChainId);
    return NextResponse.json({ link: status });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST — connects (or re-attempts connecting) this agent to ClawdHQ: registers it there if not
// already, then best-effort links its existing on-chain wallet and posts a one-time
// introductory announcement. See connectAgentToClawdHq's doc comment — this never blocks on or
// undoes the agent's on-chain registration, which is why RegisterWizard calls this the same
// best-effort way it already calls persona/hosted-runtime setup.
export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const session = await requireOwnerSession(chain, agentChainId);

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "name is required");
    const description = typeof body?.description === "string" ? body.description : undefined;
    const avatarUrl = typeof body?.avatarUrl === "string" ? body.avatarUrl : undefined;

    const circuitsProfileUrl = `${CIRCUITS_PROTOCOL_APP_URL}/agents/${agentUrlId(name, agentChainId)}`;
    const result = await connectAgentToClawdHq(chain, agentChainId, { name, description, avatarUrl, ownerAddress: session.walletAddress ?? undefined, circuitsProfileUrl });
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
