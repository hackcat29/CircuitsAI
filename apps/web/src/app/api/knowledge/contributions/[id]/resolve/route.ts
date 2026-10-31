import { NextResponse } from "next/server";
import { prisma, ProfileKind, KnowledgeContributionType } from "@clawdhq/social-db";
import { prisma as custodyPrisma } from "@clawdhq/custody-db";
import { memoryAgentKey } from "@clawdhq/clawmem";
import { isEvmPrismaChain, postAgentChainActivityToClawdHq, type EvmPrismaChain } from "@clawdhq/custody-core";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { buildKnowledgeX402Challenge, verifyKnowledgeX402Payment, resolveOwnerPayoutAddress, ownerShareOf, protocolShareOf } from "@/lib/server/knowledgeX402";
import { clawMem } from "@/lib/server/clawMem";

// The one paid, public resource in the knowledge marketplace — everything else under
// .../contributions is free metadata (see knowledgeContributions.ts's serializer, which never
// selects contentUrl/contentBody). Genuinely public/x402-shaped: any caller that can pay both
// legs gets the content, not just ClawdHQ's own hosted-agent-runtime (see
// packages/custody-core's knowledgeResolveClient.ts for the one real caller this codebase ships
// today). `chain` is a required query param because the payment challenge itself is chain-specific
// (USDC/facilitator addresses) — it's the caller's own chain, not something this route can infer.
// `query` is optional and only meaningful for MEMORY (a live ClawMem search) — every other type
// ignores it and returns its static contentUrl/contentBody exactly as before.

const MEMORY_SEARCH_TOP_K = 5;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const chainRaw = url.searchParams.get("chain");
    if (!chainRaw || !isEvmPrismaChain(chainRaw)) throw new ApiError(400, "chain query param is required and must be a supported EVM chain");
    const chain: EvmPrismaChain = chainRaw;
    const query = url.searchParams.get("query")?.trim() || undefined;

    const contribution = await prisma.knowledgeContribution.findUnique({ where: { id }, include: { owner: true } });
    if (!contribution || !contribution.isPublished) throw new ApiError(404, "Knowledge contribution not found or not published");

    const ownerPayoutAddress = await resolveOwnerPayoutAddress(contribution.owner, chain);
    if (!ownerPayoutAddress) throw new ApiError(409, `This contribution's owner isn't reachable on ${chain}. Pay on the chain their profile is registered on instead.`);

    const ownerHeader = request.headers.get("X-PAYMENT-OWNER");
    const protocolHeader = request.headers.get("X-PAYMENT-PROTOCOL");

    if (!ownerHeader || !protocolHeader) {
      return NextResponse.json(buildKnowledgeX402Challenge(id, chain, ownerPayoutAddress, contribution.priceUsdc), { status: 402 });
    }

    const verified = await verifyKnowledgeX402Payment(chain, ownerPayoutAddress, contribution.priceUsdc, ownerHeader, protocolHeader);
    if (!verified.ok) {
      return NextResponse.json({ ...buildKnowledgeX402Challenge(id, chain, ownerPayoutAddress, contribution.priceUsdc), error: verified.reason }, { status: 402 });
    }

    // Self-dealing guard: an owner paying themselves from the very wallet their own payout lands
    // in would let them farm usage stats for the cost of the protocol fee alone. Doesn't catch a
    // more sophisticated Sybil (a second wallet/agent the same owner controls) — out of scope for
    // this check, same "bounds, doesn't eliminate" posture as pullPayment's own daily cap.
    if (verified.ownerPayerAddress.toLowerCase() === ownerPayoutAddress.toLowerCase()) {
      throw new ApiError(403, "A contribution's owner can't pay themselves to resolve their own content.");
    }

    // A previously-redeemed pair of idempotencyKeys is a captured/replayed proof, not a fresh
    // payment — checked explicitly (same discipline agentX402.ts's AgentX402Redemption check
    // applies) rather than letting KnowledgeUsage's @unique constraints fail loudly on create.
    const alreadyRedeemed = await custodyPrisma.knowledgeUsage.findUnique({ where: { ownerPullId: verified.ownerIdempotencyKey } });
    if (alreadyRedeemed) throw new ApiError(409, "This payment has already been redeemed for a previous resolve.");

    // Run before the KnowledgeUsage ledger write below: both PaymentPull legs have already moved
    // real funds by this point (payment was verified above), so a ClawDB failure here can't be
    // undone — but at least it means the ledger never records a resolve that returned nothing,
    // unlike DATASET/MODEL's own fetch step, which already happens *after* their 200 response and
    // ledger write (knowledgeAcquisition.ts, hosted-agent-runtime) and accepts that same residual
    // risk today.
    let memoryHits: { namespace: string; summary: string; recordedAt: string }[] | undefined;
    if (contribution.type === KnowledgeContributionType.MEMORY) {
      if (contribution.owner.kind !== ProfileKind.AGENT || !contribution.owner.agentChainId || !contribution.memoryNamespace) {
        throw new ApiError(409, "This MEMORY contribution's owner or namespace isn't configured correctly.");
      }
      const agentKey = memoryAgentKey(chain, contribution.owner.agentChainId);
      const hits = await clawMem.search(agentKey, contribution.memoryNamespace, query ?? `${contribution.title} ${contribution.description}`, MEMORY_SEARCH_TOP_K);
      memoryHits = hits.map((hit) => ({
        namespace: hit.namespace,
        summary: typeof hit.value === "object" && hit.value && "summary" in hit.value ? String((hit.value as { summary?: unknown }).summary) : JSON.stringify(hit.value),
        recordedAt: new Date(hit.updatedAt).toISOString(),
      }));
    }

    const ownerShare = ownerShareOf(contribution.priceUsdc);
    const protocolShare = protocolShareOf(contribution.priceUsdc);
    const consumerAgentWallet = await custodyPrisma.agentWallet.findFirst({ where: { chain, address: verified.ownerPayerAddress } });

    // Both PaymentPull rows already moved real funds by the time this write happens — this row is
    // the usage/earnings ledger and the replay guard (ownerPullId/protocolPullId are @unique), not
    // itself what makes the payment real.
    await custodyPrisma.knowledgeUsage.create({
      data: {
        contributionId: contribution.id,
        ownerProfileId: contribution.ownerId,
        ownerPayoutAddress,
        consumerChain: chain,
        consumerPayerAddress: verified.ownerPayerAddress,
        consumerAgentChainId: consumerAgentWallet?.agentChainId,
        priceUsdc: contribution.priceUsdc,
        ownerShareUsdc: ownerShare,
        protocolShareUsdc: protocolShare,
        ownerPullId: verified.ownerIdempotencyKey,
        protocolPullId: verified.protocolIdempotencyKey,
      },
    });

    // Only the owner's own share is worth announcing as "this agent earned something" — the
    // protocol fee leg isn't attributable to any agent's own activity.
    if (contribution.owner.kind === ProfileKind.AGENT && contribution.owner.agentChainId) {
      await postAgentChainActivityToClawdHq(chain, contribution.owner.agentChainId, (name, profileUrl) =>
        `📚 ${name} just earned ${ownerShare} USDC from a knowledge contribution resolve on Circuits Protocol. ${profileUrl}`
      );
    }

    return NextResponse.json({ contentUrl: contribution.contentUrl, contentBody: contribution.contentBody, memoryHits });
  } catch (error) {
    return errorResponse(error);
  }
}
