import { NextResponse } from "next/server";
import { LlmProvider, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { saveAgentLlmKey, revokeAgentLlmKey, hasActiveAgentLlmKey } from "@clawdhq/custody-core";
import { assertAgentOwner, getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";

// Write-only by design: unlike cognitive-layer/hosted-runtime, GET here never returns the key
// itself (or even a masked form of it) — only whether one is currently stored — since a leaked
// response here would hand out a live provider credential, not just app-level config. The key
// never touches localStorage or any client-persisted path either (see RegisterWizard's hosted-
// runtime step) — it goes straight from the owner's browser to this route to envelope-encrypted
// storage (packages/custody-core/src/agentLlmKeyCustody.ts).
function toCustodyChain(chain: Awaited<ReturnType<typeof parseChain>>): CustodyChain {
  return chain as unknown as CustodyChain;
}

async function requireOwnerSession(chain: Awaited<ReturnType<typeof parseChain>>, agentChainId: string) {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage an agent's LLM key");
  }
  await assertAgentOwner(chain, agentChainId, session.walletAddress);
  return session;
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    const hasLlmKey = await hasActiveAgentLlmKey(toCustodyChain(chain), agentChainId);
    return NextResponse.json({ hasLlmKey });
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
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) throw new ApiError(400, "Missing apiKey.");

    // BYO keys are provider-specific (the owner's own Anthropic/OpenAI/Gemini account, called
    // directly — see packages/hosted-agent-runtime/src/llmClient.ts) — unlike PLATFORM billing,
    // which always routes through a single ClawdHQ-held OpenRouter key regardless of what an
    // owner picks here.
    const BYO_PROVIDERS = [LlmProvider.ANTHROPIC, LlmProvider.OPENAI, LlmProvider.GEMINI];
    const provider: LlmProvider = BYO_PROVIDERS.includes(body?.provider) ? body.provider : LlmProvider.ANTHROPIC;

    await saveAgentLlmKey(toCustodyChain(chain), agentChainId, provider, apiKey);
    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  try {
    const { chain: chainParam, agentChainId } = await context.params;
    const chain = parseChain(chainParam);
    await requireOwnerSession(chain, agentChainId);
    await revokeAgentLlmKey(toCustodyChain(chain), agentChainId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
