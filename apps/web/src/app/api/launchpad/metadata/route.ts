import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { isLaunchCreator } from "@/lib/server/launchVerify";

// Off-chain-authored descriptive metadata for a launch (socials/team/description) — see
// LaunchMetadata's doc comment in packages/marketplace-db/prisma/schema.prisma.
// ClawdHQLaunchpad.sol has no concept of any of this on-chain; a launch is fully tradeable
// regardless of whether this row exists. Same isLaunchCreator-gated write pattern as
// scheduled-launches/route.ts.

function parseChain(value: unknown): Chain | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  if (clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chain = parseChain(body?.chain);
  const launchChainId = typeof body?.launchChainId === "string" ? body.launchChainId : "";
  const creator = typeof body?.creator === "string" ? body.creator : "";

  if (!chain) return NextResponse.json({ error: "Missing or unknown chain" }, { status: 400 });
  if (!launchChainId || !creator) return NextResponse.json({ error: "Missing launchChainId or creator" }, { status: 400 });

  const verified = await isLaunchCreator(chain, launchChainId, creator);
  if (!verified) return NextResponse.json({ error: "You are not the on-chain creator of this launch" }, { status: 403 });

  const websiteUrl = stringOrNull(body?.websiteUrl);
  const twitterUrl = stringOrNull(body?.twitterUrl);
  const telegramUrl = stringOrNull(body?.telegramUrl);
  const description = stringOrNull(body?.description);
  const team = Array.isArray(body?.team) ? body.team : null;

  await prisma.launchMetadata.upsert({
    where: { chain_launchChainId: { chain, launchChainId } },
    create: { chain, launchChainId, websiteUrl, twitterUrl, telegramUrl, description, team: team ?? undefined },
    update: { websiteUrl, twitterUrl, telegramUrl, description, team: team ?? undefined },
  });

  return NextResponse.json({ ok: true });
}
