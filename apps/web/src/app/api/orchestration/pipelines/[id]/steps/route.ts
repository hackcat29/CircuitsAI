import { NextResponse } from "next/server";
import { prisma, PipelineStatus } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { parseStepRole, parseNonEmptyString, parsePositiveDecimal, parsePositiveInt, parseHiredAgentId, serializePipelineStep } from "@/lib/server/orchestration/validate";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);
    if (pipeline.status !== PipelineStatus.DRAFT) {
      throw new ApiError(409, "Steps can only be added before the pipeline is run.");
    }

    const body = await request.json().catch(() => null);
    const agentChainId = parseHiredAgentId(body?.agentChainId);
    const agentName = parseNonEmptyString(body?.agentName, "agentName");
    const role = parseStepRole(body?.role);
    const taskDescription = parseNonEmptyString(body?.taskDescription, "taskDescription");
    const budgetUsdc = parsePositiveDecimal(body?.budgetUsdc, "budgetUsdc");
    const deadlineDays = parsePositiveInt(body?.deadlineDays, "deadlineDays", 3);

    const { _max } = await prisma.pipelineStep.aggregate({ where: { pipelineId: id }, _max: { position: true } });
    const position = (_max.position ?? -1) + 1;

    const step = await prisma.pipelineStep.create({
      data: { pipelineId: id, position, agentChainId, agentName, role, taskDescription, budgetUsdc, deadlineDays },
    });

    return NextResponse.json({ step: serializePipelineStep(step) });
  } catch (error) {
    return errorResponse(error);
  }
}
