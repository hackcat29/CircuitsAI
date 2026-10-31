import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { isEvmPrismaChain, withdrawPipelineWallet } from "@clawdhq/custody-core";

// Sweeps whatever balance this pipeline's custody wallet holds back to its verified owner (the
// session that just passed requirePipelineOwner) — never a caller-supplied address.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);
    if (!isEvmPrismaChain(pipeline.chain)) {
      throw new ApiError(501, `Withdrawal for ${pipeline.chain} isn't wired up yet.`);
    }

    const result = await withdrawPipelineWallet(id, pipeline.chain, pipeline.ownerAddress);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(502, error instanceof Error ? error.message : "Withdrawal failed."));
  }
}
