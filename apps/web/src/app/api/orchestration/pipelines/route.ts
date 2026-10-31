import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { provisionPipelineWallet } from "@clawdhq/custody-core";
import { errorResponse } from "@/lib/server/socialErrors";
import { requireHumanSession } from "@/lib/server/orchestration/orchestrationAuth";
import { parseOrchestrationChain, parseExecutionMode, parseNonEmptyString, serializePipeline } from "@/lib/server/orchestration/validate";

export async function GET() {
  try {
    const { walletAddress } = await requireHumanSession();

    const pipelines = await prisma.pipeline.findMany({
      where: { ownerAddress: walletAddress },
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ pipelines: pipelines.map(serializePipeline) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { walletAddress } = await requireHumanSession();

    const body = await request.json().catch(() => null);
    const chain = parseOrchestrationChain(body?.chain);
    const name = parseNonEmptyString(body?.name, "name");
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const executionMode = parseExecutionMode(body?.executionMode);

    const pipeline = await prisma.pipeline.create({
      data: { chain, ownerAddress: walletAddress, name, description, executionMode },
    });

    // Provision the custodied wallet immediately — same "nowhere to deposit funds otherwise"
    // reasoning as /api/subscriptions' POST route.
    const wallet = await provisionPipelineWallet(pipeline.id, chain);

    return NextResponse.json({
      pipeline: serializePipeline({ ...pipeline, steps: [] }),
      wallet: { address: wallet.address, status: wallet.status },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
