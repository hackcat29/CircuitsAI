import { NextResponse } from "next/server";
import { Chain, prisma } from "@clawdhq/marketplace-db";

// Backs CreateLaunchDialog's agent picker: ClawdHQLaunchpad.createLaunch enforces one launch per
// agent on-chain (AlreadyLaunched), but the picker shouldn't let an owner pick an agent that's
// already launched and only find out via a reverted transaction. Scoped to a specific, small set
// of the caller's own agentIds (never "all launches") — a plain findMany against the indexed
// (chain, agentChainId) columns, not worth its own cached stat the way the list/detail routes
// need.

function parseChain(value: string | null): Chain | null {
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

  const agentIds = (url.searchParams.get("agentIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (agentIds.length === 0) return NextResponse.json({ launchedAgentIds: [] });

  const launches = await prisma.launch.findMany({
    where: { chain: { in: candidateChains }, agentChainId: { in: agentIds } },
    select: { agentChainId: true },
  });

  return NextResponse.json({ launchedAgentIds: launches.map((l) => l.agentChainId) });
}
