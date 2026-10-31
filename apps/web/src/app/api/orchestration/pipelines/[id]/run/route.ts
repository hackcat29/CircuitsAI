import { NextResponse } from "next/server";
import { startPipeline, PipelineRiskRejection } from "@clawdhq/custody-core";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { serializePipeline } from "@/lib/server/orchestration/validate";

// Owner-triggered "Run Pipeline" — posts the first step (SERIAL) or every step (PARALLEL) from
// the pipeline's custodied wallet. Later SERIAL steps are posted automatically by the indexer
// as their predecessor's on-chain job completes (see apps/indexer/src/pipelineEvents.ts) — this
// route only ever kicks off the run, it doesn't wait around for the whole pipeline to finish.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);

    await startPipeline(id);

    const fresh = await requirePipelineOwner(pipeline.id);
    return NextResponse.json({ pipeline: serializePipeline(fresh) });
  } catch (error) {
    if (error instanceof PipelineRiskRejection) return errorResponse(new ApiError(409, error.message));
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "The run failed. See the pipeline's steps for details."));
  }
}
