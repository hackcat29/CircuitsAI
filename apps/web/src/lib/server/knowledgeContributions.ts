import { prisma, KnowledgeContributionType, type KnowledgeContribution, type Profile } from "@clawdhq/social-db";
import { ApiError } from "@/lib/server/socialErrors";
import { serializeProfile } from "@/lib/server/socialValidate";
import { verifyHttpReachable } from "@/lib/server/publishedSkills";
import type { Actor } from "@/lib/server/socialAuth";

const MAX_CONTENT_BODY = 50_000;

/** Live-verifies a publisher-submitted contribution's content before it's accepted into the
 * catalog — the same reject-before-create discipline verifyPublishedSkillEndpoint applies to
 * skills, adapted per content shape: DATASET/MODEL point at an external URL (reuses the identical
 * reachability check skills use — same "is this real, not what it claims to contain" scope);
 * PROMPT is inline text with nothing to reach over the network, so verification is structural
 * instead. MEMORY has no content of its own to verify here at all — it resolves against the
 * owner's live ClawMem memory (memoryNamespace + AGENT ownership are both already enforced at
 * creation, in .../contributions' POST handler, and neither can change afterward). Throws
 * (rejects the publish outright) rather than ever storing a half-verified row — see
 * KnowledgeContribution's own schema doc comment. */
export async function verifyKnowledgeContributionContent(type: KnowledgeContributionType, contentUrl: string | null, contentBody: string | null): Promise<void> {
  if (type === KnowledgeContributionType.MEMORY) return;

  if (type === KnowledgeContributionType.DATASET || type === KnowledgeContributionType.MODEL) {
    if (!contentUrl) throw new ApiError(400, `contentUrl is required for a ${type} contribution`);
    let parsed: URL;
    try {
      parsed = new URL(contentUrl);
    } catch {
      throw new ApiError(400, "contentUrl must be a valid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new ApiError(400, "contentUrl must be http(s)");

    const reachable = await verifyHttpReachable(contentUrl);
    if (!reachable) throw new ApiError(422, "Couldn't reach that URL. Check it's correct and publicly accessible (not localhost or a private network).");
    return;
  }

  if (!contentBody || !contentBody.trim()) throw new ApiError(400, `contentBody is required for a ${type} contribution`);
  if (contentBody.length > MAX_CONTENT_BODY) throw new ApiError(400, `contentBody is too long (max ${MAX_CONTENT_BODY} characters)`);
}

/** Shared by the detail DELETE route and the publish route — both are owner-only, neither has
 * Pipelines'/Subscriptions' extra "withdraw first" wrinkle (a contribution holds no custodied
 * balance of its own to drain before it can be safely deleted). */
export async function requireContributionOwner(id: string, actor: Actor): Promise<KnowledgeContribution & { owner: Profile }> {
  const contribution = await prisma.knowledgeContribution.findUnique({ where: { id }, include: { owner: true } });
  if (!contribution) throw new ApiError(404, "Knowledge contribution not found");
  if (contribution.ownerId !== actor.profile.id) throw new ApiError(403, "You don't own this knowledge contribution");
  return contribution;
}

export interface SerializedKnowledgeContribution {
  id: string;
  type: KnowledgeContributionType;
  title: string;
  description: string;
  tags: string[];
  priceUsdc: string;
  stakeUsdc: string;
  /// MEMORY only — which ClawMem namespace a resolve searches. Metadata about what's for sale,
  /// not the content itself, so unlike contentUrl/contentBody it's safe to expose pre-payment.
  memoryNamespace: string | null;
  isPublished: boolean;
  verifiedAt: string | null;
  contentUrl?: string | null;
  contentPreview?: string | null;
  owner: ReturnType<typeof serializeProfile>;
  createdAt: string;
  usageCount: number;
  earnedUsdc: string;
}

export function serializeKnowledgeContribution(
  contribution: KnowledgeContribution & { owner: Profile },
  usage?: { usageCount: number; earnedUsdc: string },
): SerializedKnowledgeContribution {
  return {
    id: contribution.id,
    type: contribution.type,
    title: contribution.title,
    description: contribution.description,
    tags: contribution.tags,
    priceUsdc: contribution.priceUsdc,
    stakeUsdc: contribution.stakeUsdc,
    memoryNamespace: contribution.memoryNamespace,
    isPublished: contribution.isPublished,
    verifiedAt: contribution.verifiedAt ? contribution.verifiedAt.toISOString() : null,
    contentUrl: contribution.contentUrl ?? null,
    contentPreview: contribution.contentBody
      ? (contribution.contentBody.length > 800 ? `${contribution.contentBody.slice(0, 800)}…` : contribution.contentBody)
      : null,
    owner: serializeProfile(contribution.owner),
    createdAt: contribution.createdAt.toISOString(),
    usageCount: usage?.usageCount ?? 0,
    earnedUsdc: usage?.earnedUsdc ?? "0",
  };
}
