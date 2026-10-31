import { Chain } from "@clawdhq/marketplace-db";
import { getServerEvmLaunchpadAdapter, isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";

/** Confirms `claimedCreator` is actually the on-chain creator of launch `launchChainId` on
 * `chain`, before letting them write/delete a ScheduledLaunch row — otherwise anyone could
 * grief anyone else's launch by scheduling it into hiding. */
export async function isLaunchCreator(chain: Chain, launchChainId: string, claimedCreator: string): Promise<boolean> {
  if (isEvmPrismaChain(chain)) {
    try {
      const launch = await getServerEvmLaunchpadAdapter(chain).getLaunch(BigInt(launchChainId));
      return launch.creator.toLowerCase() === claimedCreator.toLowerCase();
    } catch {
      return false;
    }
  }
  return false;
}
