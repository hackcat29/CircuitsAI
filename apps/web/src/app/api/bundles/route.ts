import { NextResponse } from "next/server";
import { prisma, Chain, type Prisma } from "@clawdhq/marketplace-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

export function parseChain(raw?: string | null): Chain {
  if (!raw) return Chain.MONAD_MAINNET;
  const clean = raw.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "MONAD" || clean === "MONAD_MAINNET" || clean === "143") return Chain.MONAD_MAINNET;
  if (clean === "BSC" || clean === "BSC_TESTNET" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE" || clean === "BASE_SEPOLIA" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH" || clean === "ETH_SEPOLIA" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean === "SOLANA" || clean === "SOLANA_DEVNET") return Chain.SOLANA_DEVNET;
  if (clean === "SUI" || clean === "SUI_TESTNET") return Chain.SUI_TESTNET;
  return Chain.MONAD_MAINNET;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawChain = searchParams.get("chain");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const creator = searchParams.get("creator");
    const publishedOnly = searchParams.get("publishedOnly") !== "false";

    const chain = rawChain ? parseChain(rawChain) : undefined;

    const where: Prisma.SquadBundleWhereInput = {};
    if (chain) where.chain = chain;
    if (publishedOnly && !creator) where.isPublished = true;
    if (category && category !== "All") where.category = category;
    if (creator) where.creatorAddress = creator.toLowerCase();

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ];
    }

    const bundles = await prisma.squadBundle.findMany({
      where,
      include: {
        members: true,
      },
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
    });

    // Fetch all unique agent names for member agents from the Agent table
    const allAgentChainIds = Array.from(
      new Set(bundles.flatMap((b) => b.members.map((m) => m.agentChainId)))
    );

    const agents = await prisma.agent.findMany({
      where: {
        agentChainId: { in: allAgentChainIds },
        ...(chain ? { chain } : {}),
      },
      select: {
        agentChainId: true,
        name: true,
        agentUri: true,
      },
    });

    const agentNameMap = new Map(agents.map((a) => [a.agentChainId, a.name]));

    const serialized = bundles.map((b) => {
      const agentIds = b.members.map((m) => m.agentChainId);
      const agentNames = b.members.map(
        (m) => agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`
      );
      const agentEmojis = b.members.map(() => "");

      return {
        id: b.id,
        chain: b.chain,
        name: b.name,
        description: b.description,
        category: b.category,
        priceUsdc: b.priceUsdc.toString(),
        creatorAddress: b.creatorAddress,
        tags: b.tags,
        isPublished: b.isPublished,
        usageCount: b.usageCount,
        totalVolumeUsdc: b.totalVolumeUsdc.toString(),
        createdAt: b.createdAt.getTime(),
        updatedAt: b.updatedAt.getTime(),
        members: b.members.map((m) => ({
          agentChainId: m.agentChainId,
          agentName: agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`,
          role: m.role,
          splitBps: m.splitBps,
        })),
        // Helper flat arrays for direct frontend roster chips
        agentIds,
        agentNames,
        agentEmojis,
      };
    });

    return NextResponse.json({ bundles: serialized });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session || !session.walletAddress) {
      throw new ApiError(401, "Sign in with your wallet to create a squad bundle");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "Invalid JSON payload");
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 3) {
      throw new ApiError(400, "Squad name must be at least 3 characters");
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length < 10) {
      throw new ApiError(400, "Squad mission description must be at least 10 characters");
    }

    const priceUsdcNum = Number(body.priceUsdc || "0");
    if (isNaN(priceUsdcNum) || priceUsdcNum < 0) {
      throw new ApiError(400, "Invalid USDC hire rate");
    }

    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "General";

    const chain = parseChain(body.chain);

    // Support both structured members array and flat selectedAgentIds
    let memberInputs: { agentChainId: string; role: string; splitBps: number }[] = [];
    if (Array.isArray(body.members) && body.members.length > 0) {
      memberInputs = body.members.map((m: any) => ({
        agentChainId: String(m.agentChainId || "").trim(),
        role: typeof m.role === "string" ? m.role.trim() : "Specialist Agent",
        splitBps: typeof m.splitBps === "number" ? Math.max(1, Math.min(10000, m.splitBps)) : 5000,
      }));
    } else if (Array.isArray(body.selectedAgentIds) && body.selectedAgentIds.length > 0) {
      const evenSplit = Math.floor(10000 / body.selectedAgentIds.length);
      memberInputs = body.selectedAgentIds.map((id: any) => ({
        agentChainId: String(id).trim(),
        role: "Squad Member",
        splitBps: evenSplit,
      }));
    }

    // Filter out invalid or duplicate agent IDs
    const seen = new Set<string>();
    const deduplicatedMembers = memberInputs.filter((m) => {
      if (!m.agentChainId || seen.has(m.agentChainId)) return false;
      seen.add(m.agentChainId);
      return true;
    });

    if (deduplicatedMembers.length < 2) {
      throw new ApiError(400, "A squad bundle must contain at least 2 distinct member agents");
    }

    const tags: string[] = Array.isArray(body.tags)
      ? body.tags.map((t: any) => String(t).trim()).filter(Boolean)
      : typeof body.tags === "string"
      ? body.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    const creatorAddress = session.walletAddress.toLowerCase();

    const bundle = await prisma.squadBundle.create({
      data: {
        chain,
        name,
        description,
        category,
        priceUsdc: priceUsdcNum,
        creatorAddress,
        tags,
        isPublished: true,
        usageCount: 0,
        totalVolumeUsdc: 0,
        members: {
          create: deduplicatedMembers.map((m) => ({
            agentChainId: m.agentChainId,
            role: m.role,
            splitBps: m.splitBps,
          })),
        },
      },
      include: {
        members: true,
      },
    });

    // Lookup agent names for response
    const agentRecords = await prisma.agent.findMany({
      where: {
        agentChainId: { in: deduplicatedMembers.map((m) => m.agentChainId) },
        chain,
      },
      select: { agentChainId: true, name: true },
    });
    const agentNameMap = new Map(agentRecords.map((a) => [a.agentChainId, a.name]));

    const serialized = {
      id: bundle.id,
      chain: bundle.chain,
      name: bundle.name,
      description: bundle.description,
      category: bundle.category,
      priceUsdc: bundle.priceUsdc.toString(),
      creatorAddress: bundle.creatorAddress,
      tags: bundle.tags,
      isPublished: bundle.isPublished,
      usageCount: bundle.usageCount,
      totalVolumeUsdc: bundle.totalVolumeUsdc.toString(),
      createdAt: bundle.createdAt.getTime(),
      updatedAt: bundle.updatedAt.getTime(),
      members: bundle.members.map((m) => ({
        agentChainId: m.agentChainId,
        agentName: agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`,
        role: m.role,
        splitBps: m.splitBps,
      })),
      agentIds: bundle.members.map((m) => m.agentChainId),
      agentNames: bundle.members.map((m) => agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`),
      agentEmojis: bundle.members.map(() => ""),
    };

    return NextResponse.json({ bundle: serialized }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
