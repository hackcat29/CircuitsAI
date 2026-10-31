import { NextResponse } from "next/server";
import { prisma, KnowledgeContributionType, ProfileKind } from "@clawdhq/social-db";
import { prisma as custodyPrisma } from "@clawdhq/custody-db";
import { requireActor, getOptionalActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { serializeKnowledgeContribution } from "@/lib/server/knowledgeContributions";

// Real, server-persisted contribution catalog — the counterpart to the earlier
// localStorage-only "contribute" flow (useKnowledge.ts), same "replaces a browser-only mock"
// relationship /api/skills/published has to its own predecessor. Unlike Skills (verified and
// published in one step), Knowledge keeps the existing two-step Draft -> Publish UX the mock UI
// already had: this route only ever creates a draft (isPublished: false) — content verification
// happens in .../[id]/publish.

const TITLE_MAX = 120;
const DESC_MAX = 1000;
const TAG_MAX = 10;
const TAG_LENGTH_MAX = 30;
const MEMORY_NAMESPACE_MAX = 64;

function parseTags(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, "tags must be an array");
  if (raw.length > TAG_MAX) throw new ApiError(400, `A contribution can have at most ${TAG_MAX} tags`);
  return raw.map((t) => {
    if (typeof t !== "string" || !t.trim()) throw new ApiError(400, "Each tag must be a non-empty string");
    if (t.length > TAG_LENGTH_MAX) throw new ApiError(400, `Tags must be at most ${TAG_LENGTH_MAX} characters`);
    return t.trim();
  });
}

function parseUsdc(raw: unknown, field: string, allowZero: boolean): string {
  const value = raw === undefined || raw === null || raw === "" ? "0" : String(raw);
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new ApiError(400, `${field} must be a non-negative number`);
  if (!allowZero && Number(value) <= 0) throw new ApiError(400, `${field} must be greater than 0`);
  return value;
}

/** MEMORY is the only type that resolves against live ClawMem content instead of a static
 * contentUrl/contentBody — required so the resolve route knows which namespace to search (see
 * tickMemory.ts's recordTickMemory for what a hosted agent actually writes there). Ignored for
 * every other type, same as contentUrl/contentBody are unused for MEMORY. */
function parseMemoryNamespace(raw: unknown, type: KnowledgeContributionType): string | null {
  if (type !== KnowledgeContributionType.MEMORY) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new ApiError(400, "memoryNamespace is required for a MEMORY contribution");
  if (value.length > MEMORY_NAMESPACE_MAX) throw new ApiError(400, `memoryNamespace must be at most ${MEMORY_NAMESPACE_MAX} characters`);
  return value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeRaw = searchParams.get("type");
    const mine = searchParams.get("mine") === "true";

    let type: KnowledgeContributionType | undefined;
    if (typeRaw) {
      if (!Object.values(KnowledgeContributionType).includes(typeRaw as KnowledgeContributionType)) throw new ApiError(400, `Unknown type "${typeRaw}"`);
      type = typeRaw as KnowledgeContributionType;
    }

    let ownerId: string | undefined;
    if (mine) {
      const actor = await requireActor(request);
      ownerId = actor.profile.id;
    } else {
      // getOptionalActor isn't needed for browse — every non-owner view is unauthenticated-safe
      // metadata (see serializeKnowledgeContribution's own doc comment on why content is never
      // included here regardless of viewer).
      await getOptionalActor(request);
    }

    const contributions = await prisma.knowledgeContribution.findMany({
      where: { type, ownerId, isPublished: mine ? undefined : true },
      include: { owner: true },
      orderBy: { createdAt: "desc" },
    });

    if (!mine || contributions.length === 0) {
      return NextResponse.json({ contributions: contributions.map((c) => serializeKnowledgeContribution(c)) });
    }

    const usage = await custodyPrisma.knowledgeUsage.groupBy({
      by: ["contributionId"],
      where: { ownerProfileId: ownerId },
      _count: { id: true },
      _sum: { ownerShareUsdc: true },
    });
    const usageByContribution = new Map(usage.map((u) => [u.contributionId, { usageCount: u._count.id, earnedUsdc: (u._sum.ownerShareUsdc ?? 0).toString() }]));

    return NextResponse.json({ contributions: contributions.map((c) => serializeKnowledgeContribution(c, usageByContribution.get(c.id))) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireActor(request);
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const typeRaw = body?.type;

    if (!title || title.length > TITLE_MAX) throw new ApiError(400, `title is required (max ${TITLE_MAX} characters)`);
    if (!description || description.length > DESC_MAX) throw new ApiError(400, `description is required (max ${DESC_MAX} characters)`);
    if (!Object.values(KnowledgeContributionType).includes(typeRaw)) throw new ApiError(400, `type must be one of ${Object.values(KnowledgeContributionType).join(", ")}`);
    const type = typeRaw as KnowledgeContributionType;

    // A MEMORY contribution resolves against the owner's own ClawMem tick history
    // (memoryAgentKey(chain, agentChainId) — see tickMemory.ts), which only exists for an AGENT
    // profile running the hosted tick loop. A HUMAN profile has no such history to expose.
    if (type === KnowledgeContributionType.MEMORY && (profile.kind !== ProfileKind.AGENT || !profile.agentChainId)) {
      throw new ApiError(400, "MEMORY contributions can only be created by an AGENT profile with a hosted tick loop.");
    }

    const tags = parseTags(body?.tags);
    const priceUsdc = parseUsdc(body?.priceUsdc, "priceUsdc", true);
    const stakeUsdc = parseUsdc(body?.stakeUsdc, "stakeUsdc", true);
    const memoryNamespace = parseMemoryNamespace(body?.memoryNamespace, type);

    const contentUrl = typeof body?.contentUrl === "string" && body.contentUrl.trim() ? body.contentUrl.trim() : null;
    const contentBody = typeof body?.contentBody === "string" && body.contentBody.trim() ? body.contentBody.trim() : null;

    const contribution = await prisma.knowledgeContribution.create({
      data: { ownerId: profile.id, type, title, description, tags, priceUsdc, stakeUsdc, contentUrl, contentBody, memoryNamespace },
      include: { owner: true },
    });

    return NextResponse.json({ contribution: serializeKnowledgeContribution(contribution) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
