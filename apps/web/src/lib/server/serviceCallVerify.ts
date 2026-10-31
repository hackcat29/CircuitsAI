import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { isEvmPrismaChain, viemChainFor, rpcUrlFor, usdcAddressFor } from "@clawdhq/custody-core";
import { Chain } from "@clawdhq/marketplace-db";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** Confirms `txHash` is a real, confirmed on-chain USDC transfer of at least `minAmountMicros`
 * from `from` to `to` on `chain` — the actual payment verification for a metered service call
 * (see /api/marketplace/services/[id]/call/route.ts). The client only ever *claims* it paid;
 * this is what makes that claim trustworthy, by reading the transaction's own logs rather than
 * anything the client asserts about it. Returns false (never throws) for anything that isn't a
 * clean match — an unconfirmed/reverted tx, a transfer of the wrong token, wrong parties, or an
 * insufficient amount are all just "not verified," not distinguished failure modes the caller
 * needs to branch on. */
export async function verifyUsdcTransfer(chain: Chain, txHash: string, from: string, to: string, minAmountMicros: bigint): Promise<boolean> {
  if (!isEvmPrismaChain(chain)) return false;

  try {
    const publicClient = createPublicClient({ chain: viemChainFor(chain), transport: http(rpcUrlFor(chain)) });
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== "success") return false;

    const usdcAddress = usdcAddressFor(chain).toLowerCase();
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress) continue;
      try {
        const decoded = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics });
        if (
          decoded.args.from.toLowerCase() === from.toLowerCase() &&
          decoded.args.to.toLowerCase() === to.toLowerCase() &&
          decoded.args.value >= minAmountMicros
        ) {
          return true;
        }
      } catch {
        continue; // a log from the USDC contract that isn't a Transfer event — not our concern
      }
    }
    return false;
  } catch {
    return false;
  }
}
