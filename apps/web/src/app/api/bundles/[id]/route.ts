import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const bundle = await prisma.squadBundle.findUnique({
      where: { id },
      include: {
        members: true,
        hires: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!bundle) {
      throw new ApiError(404, "Squad bundle not found");
    }

    const agentChainIds = bundle.members.map((m) => m.agentChainId);
    const agents = await prisma.agent.findMany({
      where: {
        agentChainId: { in: agentChainIds },
        chain: bundle.chain,
      },
      select: { agentChainId: true, name: true, agentUri: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.agentChainId, a.name]));

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
      recentHires: bundle.hires.map((h) => ({
        id: h.id,
        buyerAddress: h.buyerAddress,
        objective: h.objective,
        status: h.status,
        createdAt: h.createdAt.getTime(),
      })),
    };

    return NextResponse.json({ bundle: serialized });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSessionProfile();
    if (!session || !session.walletAddress) {
      throw new ApiError(401, "Sign in with your wallet to update this squad bundle");
    }

    const bundle = await prisma.squadBundle.findUnique({
      where: { id },
    });

    if (!bundle) {
      throw new ApiError(404, "Squad bundle not found");
    }

    if (bundle.creatorAddress.toLowerCase() !== session.walletAddress.toLowerCase()) {
      throw new ApiError(403, "Only the squad creator can update this squad bundle");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "Invalid JSON payload");
    }

    const data: any = {};
    if (typeof body.name === "string" && body.name.trim().length >= 3) {
      data.name = body.name.trim();
    }
    if (typeof body.description === "string" && body.description.trim().length >= 10) {
      data.description = body.description.trim();
    }
    if (typeof body.category === "string" && body.category.trim()) {
      data.category = body.category.trim();
    }
    if (body.priceUsdc !== undefined) {
      const p = Number(body.priceUsdc);
      if (!isNaN(p) && p >= 0) {
        data.priceUsdc = p;
      }
    }
    if (typeof body.isPublished === "boolean") {
      data.isPublished = body.isPublished;
    }
    if (Array.isArray(body.tags)) {
      data.tags = body.tags.map((t: any) => String(t).trim()).filter(Boolean);
    }

    const updated = await prisma.squadBundle.update({
      where: { id },
      data,
      include: {
        members: true,
      },
    });

    const agentChainIds = updated.members.map((m) => m.agentChainId);
    const agents = await prisma.agent.findMany({
      where: {
        agentChainId: { in: agentChainIds },
        chain: updated.chain,
      },
      select: { agentChainId: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.agentChainId, a.name]));

    const serialized = {
      id: updated.id,
      chain: updated.chain,
      name: updated.name,
      description: updated.description,
      category: updated.category,
      priceUsdc: updated.priceUsdc.toString(),
      creatorAddress: updated.creatorAddress,
      tags: updated.tags,
      isPublished: updated.isPublished,
      usageCount: updated.usageCount,
      totalVolumeUsdc: updated.totalVolumeUsdc.toString(),
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
      members: updated.members.map((m) => ({
        agentChainId: m.agentChainId,
        agentName: agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`,
        role: m.role,
        splitBps: m.splitBps,
      })),
      agentIds: updated.members.map((m) => m.agentChainId),
      agentNames: updated.members.map((m) => agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`),
      agentEmojis: updated.members.map(() => ""),
    };

    return NextResponse.json({ bundle: serialized });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSessionProfile();
    if (!session || !session.walletAddress) {
      throw new ApiError(401, "Sign in with your wallet to delete this squad bundle");
    }

    const bundle = await prisma.squadBundle.findUnique({
      where: { id },
    });

    if (!bundle) {
      throw new ApiError(404, "Squad bundle not found");
    }

    if (bundle.creatorAddress.toLowerCase() !== session.walletAddress.toLowerCase()) {
      throw new ApiError(403, "Only the squad creator can delete this squad bundle");
    }

    await prisma.squadBundle.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
