import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/custody-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { requireSubscriptionOwner } from "@/lib/server/subscriptions/subscriptionAuth";
import {
  isEvmPrismaChain,
  viemChainFor,
  rpcUrlFor,
  usdcAddressFor,
  readUsdcBalance,
  isSolanaPrismaChain,
  readSolanaUsdcBalance,
  isSuiPrismaChain,
  readSuiUsdcBalance,
} from "@clawdhq/custody-core";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const subscription = await requireSubscriptionOwner(id);

    const wallet = await prisma.subscriptionWallet.findUnique({ where: { subscriptionId: id } });
    if (!wallet) throw new ApiError(404, "No wallet has been provisioned for this subscription");

    let balance: bigint;
    if (isEvmPrismaChain(subscription.chain)) {
      const chain = subscription.chain;
      try {
        balance = await readUsdcBalance(wallet.address as `0x${string}`, viemChainFor(chain), rpcUrlFor(chain), usdcAddressFor(chain));
      } catch {
        throw new ApiError(502, `Couldn't reach ${chain} to read the wallet balance. Try again shortly.`);
      }
    } else if (isSolanaPrismaChain(subscription.chain)) {
      const chain = subscription.chain;
      try {
        balance = await readSolanaUsdcBalance(chain, wallet.address);
      } catch {
        throw new ApiError(502, `Couldn't reach ${chain} to read the wallet balance. Try again shortly.`);
      }
    } else if (isSuiPrismaChain(subscription.chain)) {
      const chain = subscription.chain;
      try {
        balance = await readSuiUsdcBalance(chain, wallet.address);
      } catch {
        throw new ApiError(502, `Couldn't reach ${chain} to read the wallet balance. Try again shortly.`);
      }
    } else {
      throw new ApiError(501, `Balance reads for ${subscription.chain} aren't wired up yet.`);
    }

    return NextResponse.json({ wallet: { address: wallet.address, status: wallet.status, balanceUsdc: balance.toString() } });
  } catch (error) {
    return errorResponse(error);
  }
}
