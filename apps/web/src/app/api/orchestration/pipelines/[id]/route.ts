import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { serializePipeline } from "@/lib/server/orchestration/validate";
import { isEvmPrismaChain, viemChainFor, rpcUrlFor, usdcAddressFor, readUsdcBalance } from "@clawdhq/custody-core";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);
    return NextResponse.json({ pipeline: serializePipeline(pipeline) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);

    // Deleting cascades to PipelineWallet, destroying its encrypted key — refuse while it still
    // holds a balance, same "withdraw first" guard as subscriptions/[id]/route.ts's DELETE.
    const wallet = await prisma.pipelineWallet.findUnique({ where: { pipelineId: id } });
    if (wallet) {
      if (!isEvmPrismaChain(pipeline.chain)) {
        throw new ApiError(501, `Balance verification for ${pipeline.chain} isn't wired up yet, so this pipeline can't be safely deleted yet.`);
      }
      let balance: bigint;
      try {
        balance = await readUsdcBalance(wallet.address as `0x${string}`, viemChainFor(pipeline.chain), rpcUrlFor(pipeline.chain), usdcAddressFor(pipeline.chain));
      } catch {
        throw new ApiError(502, `Couldn't reach ${pipeline.chain} to verify the wallet balance before deleting. Try again shortly.`);
      }
      if (balance > 0n) {
        throw new ApiError(409, "This pipeline's wallet still holds a balance. Withdraw it first, then delete.");
      }
    }

    await prisma.pipeline.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
