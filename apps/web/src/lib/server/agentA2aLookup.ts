import { Chain } from "@clawdhq/marketplace-db";
import { getServerEvmAdapter, isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";

export interface AgentA2aInfo {
  endpoint: string;
  supportsA2A: boolean;
}

/** Resolves the subset of an agent's on-chain record the call route needs, live from its own
 * chain — same reader as `exchange/listings/[id]/route.ts`'s `fetchAgentDetail`. */
export async function getAgentA2aInfo(chain: Chain, agentChainId: string): Promise<AgentA2aInfo | undefined> {
  if (isEvmPrismaChain(chain)) {
    try {
      const agent = await getServerEvmAdapter(chain).getAgent(BigInt(agentChainId));
      return { endpoint: agent.endpoint, supportsA2A: agent.supportsA2A };
    } catch {
      return undefined;
    }
  }

  return undefined;
}
