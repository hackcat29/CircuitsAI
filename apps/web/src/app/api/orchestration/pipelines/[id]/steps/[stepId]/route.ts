import { NextResponse } from "next/server";
import { prisma, PipelineStatus } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { parseStepRole, parseNonEmptyString, parsePositiveDecimal, parsePositiveInt, parseHiredAgentId, serializePipelineStep } from "@/lib/server/orchestration/validate";

// Both edit and remove are only valid while the pipeline hasn't been run yet — once ACTIVE,
// step count/order/budget are exactly what postPipelineStep already read or is about to read
// for the next SERIAL post, so mutating them out from under a running pipeline isn't safe.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const { id, stepId } = await context.params;
    const pipeline = await requirePipelineOwner(id);
    if (pipeline.status !== PipelineStatus.DRAFT) {
      throw new ApiError(409, "Steps can only be edited before the pipeline is run.");
    }
    const existing = pipeline.steps.find((s) => s.id === stepId);
    if (!existing) throw new ApiError(404, "Step not found on this pipeline");

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.agentChainId !== undefined) {
      data.agentChainId = parseHiredAgentId(body.agentChainId);
      data.agentName = parseNonEmptyString(body.agentName, "agentName");
    }
    if (body?.role !== undefined) data.role = parseStepRole(body.role);
    if (body?.taskDescription !== undefined) data.taskDescription = parseNonEmptyString(body.taskDescription, "taskDescription");
    if (body?.budgetUsdc !== undefined) data.budgetUsdc = parsePositiveDecimal(body.budgetUsdc, "budgetUsdc");
    if (body?.deadlineDays !== undefined) data.deadlineDays = parsePositiveInt(body.deadlineDays, "deadlineDays");

    const step = await prisma.pipelineStep.update({ where: { id: stepId }, data });
    return NextResponse.json({ step: serializePipelineStep(step) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const { id, stepId } = await context.params;
    const pipeline = await requirePipelineOwner(id);
    if (pipeline.status !== PipelineStatus.DRAFT) {
      throw new ApiError(409, "Steps can only be removed before the pipeline is run.");
    }
    const existing = pipeline.steps.find((s) => s.id === stepId);
    if (!existing) throw new ApiError(404, "Step not found on this pipeline");

    await prisma.pipelineStep.delete({ where: { id: stepId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
