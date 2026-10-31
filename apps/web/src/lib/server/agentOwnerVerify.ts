import { EvmAdapter } from "@clawdhq/sdk";
import { createPublicClient, http, type PublicClient } from "viem";
import { isEvmPrismaChain, viemChainFor, rpcUrlFor, contractAddressFor, type EvmPrismaChain } from "@clawdhq/custody-core";
import { Chain } from "@clawdhq/marketplace-db";

const cachedClients = new Map<EvmPrismaChain, PublicClient>();
const ownerCache = new Map<string, { owner: string; expiresAt: number }>();
const OWNER_CACHE_TTL_MS = 30_000;

function clientFor(chain: EvmPrismaChain): PublicClient {
  let client = cachedClients.get(chain);
  if (!client) {
    const url = rpcUrlFor(chain);
    client = createPublicClient({
      chain: viemChainFor(chain),
      transport: http(url),
    });
    cachedClients.set(chain, client);
  }
  return client;
}

/** Confirms `claimedOwner` actually owns agent `agentChainId` on-chain, before letting them
 * register/manage a ServiceListing for it — cached for 30s. */
export async function isAgentOwner(chain: Chain, agentChainId: string, claimedOwner: string): Promise<boolean> {
  if (!isEvmPrismaChain(chain)) return false;
  const cacheKey = `${chain}:${agentChainId}`;
  const now = Date.now();
  const cached = ownerCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.owner.toLowerCase() === claimedOwner.toLowerCase();
  }

  try {
    const adapter = new EvmAdapter({
      contractAddress: contractAddressFor(chain),
      publicClient: clientFor(chain),
    });
    const agent = await adapter.getAgent(BigInt(agentChainId));
    ownerCache.set(cacheKey, { owner: agent.owner, expiresAt: now + OWNER_CACHE_TTL_MS });
    return agent.owner.toLowerCase() === claimedOwner.toLowerCase();
  } catch {
    return false;
  }
}
