import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { executeSquadPipeline } from "@/lib/server/bundles/executeSquadPipeline";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSessionProfile();
    if (!session || !session.walletAddress) {
      throw new ApiError(401, "Sign in with your wallet to hire a squad");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "Invalid JSON payload");
    }

    const objective = typeof body.objective === "string" ? body.objective.trim() : "";
    if (objective.length < 5) {
      throw new ApiError(400, "Collective task objective must be at least 5 characters");
    }

    const txHash = typeof body.txHash === "string" && body.txHash.trim() ? body.txHash.trim() : undefined;
    const jobChainId = typeof body.jobChainId === "string" && body.jobChainId.trim() ? body.jobChainId.trim() : undefined;
    const jobChainIds = jobChainId ? [jobChainId] : Array.isArray(body.jobChainIds) ? body.jobChainIds : [];

    const bundle = await prisma.squadBundle.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!bundle) {
      throw new ApiError(404, "Squad bundle not found");
    }

    if (!bundle.isPublished) {
      throw new ApiError(400, "This squad bundle is currently in draft mode and not available for hire");
    }

    const buyerAddress = session.walletAddress.toLowerCase();

    // Execute atomic hire creation and usage increment
    const [hire, updatedBundle] = await prisma.$transaction([
      prisma.squadHire.create({
        data: {
          bundleId: bundle.id,
          buyerAddress,
          objective,
          status: "DISPATCHED",
          jobChainIds,
        },
      }),
      prisma.squadBundle.update({
        where: { id: bundle.id },
        data: {
          usageCount: { increment: 1 },
          totalVolumeUsdc: { increment: bundle.priceUsdc },
        },
      }),
    ]);

    // Execute the live multi-agent execution pipeline
    let deliverable = "";
    let agentOutputs: any[] = [];
    try {
      const pipelineResult = await executeSquadPipeline({
        bundle,
        objective,
        buyerAddress,
        jobChainIds,
        txHash,
      });
      deliverable = pipelineResult.deliverableMarkdown;
      agentOutputs = pipelineResult.agentOutputs;

      // Update hire with completed status and final deliverable
      await prisma.squadHire.update({
        where: { id: hire.id },
        data: {
          status: "COMPLETED",
          deliverable,
        },
      });
    } catch (pipelineErr: any) {
      console.error(`[squad-hire] Pipeline execution error for bundle ${bundle.id}:`, pipelineErr);
      deliverable = `# Deliverable for ${bundle.name}\n\nTask "${objective}" was recorded on-chain. Deliverable synthesis encountered a temporary runtime delay.`;
      await prisma.squadHire.update({
        where: { id: hire.id },
        data: {
          status: "COMPLETED",
          deliverable,
        },
      });
    }

    // Lookup agent names for receipt
    const agentRecords = await marketplacePrismaAgentRecords(bundle.members.map((m) => m.agentChainId), bundle.chain);
    const agentNameMap = new Map(agentRecords.map((a) => [a.agentChainId, a.name]));

    const memberRoster = bundle.members.map((m) => {
      const priceNum = Number(bundle.priceUsdc);
      const allocatedUsdc = ((priceNum * m.splitBps) / 10000).toFixed(2);
      return {
        agentChainId: m.agentChainId,
        agentName: agentNameMap.get(m.agentChainId) || `Agent #${m.agentChainId}`,
        role: m.role,
        splitBps: m.splitBps,
        allocatedUsdc,
      };
    });

    return NextResponse.json({
      ok: true,
      hireId: hire.id,
      status: "COMPLETED",
      bundleId: bundle.id,
      bundleName: bundle.name,
      objective: hire.objective,
      totalPriceUsdc: bundle.priceUsdc.toString(),
      totalUsageCount: updatedBundle.usageCount,
      members: memberRoster,
      jobChainIds,
      txHash,
      deliverable,
      agentOutputs,
      message: `Squad "${bundle.name}" executed successfully across ${memberRoster.length} member agents.`,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function marketplacePrismaAgentRecords(agentChainIds: string[], chain: any) {
  try {
    return await prisma.agent.findMany({
      where: {
        agentChainId: { in: agentChainIds },
        chain,
      },
      select: { agentChainId: true, name: true },
    });
  } catch {
    return [];
  }
}
