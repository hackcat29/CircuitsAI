import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requirePipelineOwner } from "@/lib/server/orchestration/orchestrationAuth";
import { isEvmPrismaChain, viemChainFor, rpcUrlFor, usdcAddressFor, readUsdcBalance } from "@clawdhq/custody-core";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pipeline = await requirePipelineOwner(id);

    const wallet = await prisma.pipelineWallet.findUnique({ where: { pipelineId: id } });
    if (!wallet) throw new ApiError(404, "No wallet has been provisioned for this pipeline");
    if (!isEvmPrismaChain(pipeline.chain)) throw new ApiError(501, `Balance reads for ${pipeline.chain} aren't wired up yet.`);

    let balance: bigint;
    try {
      balance = await readUsdcBalance(wallet.address as `0x${string}`, viemChainFor(pipeline.chain), rpcUrlFor(pipeline.chain), usdcAddressFor(pipeline.chain));
    } catch {
      throw new ApiError(502, `Couldn't reach ${pipeline.chain} to read the wallet balance. Try again shortly.`);
    }

    return NextResponse.json({ wallet: { address: wallet.address, status: wallet.status, balanceUsdc: balance.toString() } });
  } catch (error) {
    return errorResponse(error);
  }
}
