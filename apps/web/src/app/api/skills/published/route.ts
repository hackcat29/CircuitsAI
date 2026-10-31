import { NextResponse } from "next/server";
import { prisma, SkillEndpointKind, SkillHttpMethod, Chain, Prisma } from "@clawdhq/social-db";
import { SKILL_CATEGORIES } from "@clawdhq/custody-core/skill-catalog";
import { getAgentWalletAddress } from "@clawdhq/custody-core";
import type { Chain as CustodyChain } from "@clawdhq/custody-db";
import { requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { parsePublishedSkillParams, verifyPublishedSkillEndpoint, serializePublishedSkill } from "@/lib/server/publishedSkills";
import { verifyListingFeeFields } from "@/lib/server/listingFeeVerify";

// Real, server-persisted publish flow — the counterpart to BUILTIN_SKILLS (custody-core's
// versioned-in-source catalog). Replaces the earlier client-only version (useSkills.ts's
// localStorage-based publish/removeCustom), which never left the publisher's own browser.

const NAME_MAX = 60;
const DESC_MAX = 500;
const EMOJI_MAX = 8;

export async function GET() {
  const skills = await prisma.publishedSkill.findMany({ include: { creator: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ skills: skills.map(serializePublishedSkill) });
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireActor(request);
    const body = await request.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const desc = typeof body?.desc === "string" ? body.desc.trim() : "";
    const emoji = typeof body?.emoji === "string" && body.emoji.trim() ? body.emoji.trim() : "🔧";
    const cat = typeof body?.cat === "string" ? body.cat : "";
    const priceUsdcRaw = body?.priceUsdc;

    if (!name || name.length > NAME_MAX) throw new ApiError(400, `name is required (max ${NAME_MAX} characters)`);
    if (!desc || desc.length > DESC_MAX) throw new ApiError(400, `desc is required (max ${DESC_MAX} characters)`);
    if (emoji.length > EMOJI_MAX) throw new ApiError(400, `emoji is too long`);
    if (!SKILL_CATEGORIES.includes(cat)) throw new ApiError(400, `Unknown category "${cat}"`);

    const priceUsdc = priceUsdcRaw === undefined || priceUsdcRaw === null || priceUsdcRaw === "" ? "0" : String(priceUsdcRaw);
    if (!/^\d+(\.\d{1,6})?$/.test(priceUsdc)) throw new ApiError(400, "priceUsdc must be a non-negative number");

    let endpointKind: SkillEndpointKind | null = null;
    let endpointUrl: string | null = null;
    let httpMethod: SkillHttpMethod | null = null;
    let params: ReturnType<typeof parsePublishedSkillParams> = [];
    let verifiedAt: Date | null = null;

    if (body?.endpoint) {
      const kindRaw = body.endpoint.kind;
      if (kindRaw !== "HTTP" && kindRaw !== "MCP") throw new ApiError(400, 'endpoint.kind must be "HTTP" or "MCP"');
      endpointKind = kindRaw === "HTTP" ? SkillEndpointKind.HTTP : SkillEndpointKind.MCP;

      const urlRaw = body.endpoint.url;
      if (typeof urlRaw !== "string" || !urlRaw.trim()) throw new ApiError(400, "endpoint.url is required");
      endpointUrl = urlRaw.trim();

      if (endpointKind === SkillEndpointKind.HTTP) {
        const methodRaw = body.endpoint.method;
        if (methodRaw !== "GET" && methodRaw !== "POST") throw new ApiError(400, 'endpoint.method must be "GET" or "POST"');
        httpMethod = methodRaw === "GET" ? SkillHttpMethod.GET : SkillHttpMethod.POST;
        params = parsePublishedSkillParams(body.params);
      }

      await verifyPublishedSkillEndpoint({ kind: endpointKind, url: endpointUrl, method: httpMethod ?? undefined });
      verifiedAt = new Date();
    }

    const payerAddress =
      profile.kind === "HUMAN"
        ? profile.walletAddress
        : profile.chain && profile.agentChainId
          ? await getAgentWalletAddress(profile.chain as unknown as CustodyChain, profile.agentChainId)
          : null;
    if (!payerAddress) throw new ApiError(400, "Could not resolve a wallet address to verify the listing fee from.");
    const fee = await verifyListingFeeFields("SKILL_LISTING_FEE_USDC", payerAddress, body?.feeChain, body?.feeTxHash);

    const skill = await prisma.publishedSkill.create({
      data: {
        creatorId: profile.id,
        emoji,
        name,
        desc,
        cat,
        priceUsdc,
        endpointKind: endpointKind ?? undefined,
        endpointUrl: endpointUrl ?? undefined,
        httpMethod: httpMethod ?? undefined,
        paramsJson: endpointKind === SkillEndpointKind.HTTP ? (params as unknown as Prisma.InputJsonValue) : undefined,
        verifiedAt: verifiedAt ?? undefined,
        feeChain: fee.feeChain ? (fee.feeChain as unknown as Chain) : undefined,
        feeTxHash: fee.feeTxHash ?? undefined,
      },
      include: { creator: true },
    });

    return NextResponse.json({ skill: serializePublishedSkill(skill) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
