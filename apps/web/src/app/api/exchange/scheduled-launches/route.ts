import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";
import { isLaunchCreator } from "@/lib/server/launchVerify";

// Off-chain scheduling metadata for a launchpad launch — see ScheduledLaunch's doc comment
// in packages/marketplace-db/prisma/schema.prisma. The launch itself always goes on-chain
// immediately via createLaunch; this only gates the app's own UI (countdown, hidden buy/sell,
// hidden from "upcoming" discovery), not the contract — a determined buyer calling the
// contract directly during the "scheduled" window isn't blocked by this.

const MIN_LEAD_MS = 5 * 60 * 1000;

function parseChain(value: string | null | undefined): Chain | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  if (clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = parseChain(url.searchParams.get("chain"));
  if (!chain) return NextResponse.json({ error: "Missing or unknown chain" }, { status: 400 });

  const candidateChains = [chain];

  const idsParam = url.searchParams.get("launchChainIds");
  const launchChainIds = (idsParam ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (launchChainIds.length === 0) return NextResponse.json({ schedules: {} });

  const rows = await prisma.scheduledLaunch.findMany({
    where: { chain: { in: candidateChains }, launchChainId: { in: launchChainIds } },
  });

  const schedules: Record<string, string> = {};
  for (const row of rows) schedules[row.launchChainId] = row.scheduledAt.toISOString();

  return NextResponse.json({ schedules });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chain = parseChain(body?.chain);
  const launchChainId = typeof body?.launchChainId === "string" ? body.launchChainId : "";
  const creator = typeof body?.creator === "string" ? body.creator : "";
  const scheduledAtRaw = typeof body?.scheduledAt === "string" ? body.scheduledAt : "";

  if (!chain) return NextResponse.json({ error: "Missing or unknown chain" }, { status: 400 });
  if (!launchChainId || !creator) return NextResponse.json({ error: "Missing launchChainId or creator" }, { status: 400 });

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
  if (scheduledAt.getTime() < Date.now() + MIN_LEAD_MS) {
    return NextResponse.json({ error: "scheduledAt must be at least 5 minutes in the future" }, { status: 400 });
  }

  const verified = await isLaunchCreator(chain, launchChainId, creator);
  if (!verified) return NextResponse.json({ error: "You are not the on-chain creator of this launch" }, { status: 403 });

  await prisma.scheduledLaunch.upsert({
    where: { chain_launchChainId: { chain, launchChainId } },
    update: { scheduledAt, creator },
    create: { chain, launchChainId, creator, scheduledAt },
  });

  return NextResponse.json({ ok: true, scheduledAt: scheduledAt.toISOString() });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const chain = parseChain(body?.chain);
  const launchChainId = typeof body?.launchChainId === "string" ? body.launchChainId : "";
  const creator = typeof body?.creator === "string" ? body.creator : "";

  if (!chain) return NextResponse.json({ error: "Missing or unknown chain" }, { status: 400 });
  if (!launchChainId || !creator) return NextResponse.json({ error: "Missing launchChainId or creator" }, { status: 400 });

  const verified = await isLaunchCreator(chain, launchChainId, creator);
  if (!verified) return NextResponse.json({ error: "You are not the on-chain creator of this launch" }, { status: 403 });

  await prisma.scheduledLaunch.deleteMany({ where: { chain, launchChainId } });
  return NextResponse.json({ ok: true });
}
