import { createNearEvmSigner, NearClient, nearConfig } from "@clawdhq/near";
import { viemChainFor, rpcUrlFor, type EvmPrismaChain } from "./evmChainConfig.js";

/** Environment contains scoped NEAR function-call keys only, indexed by the agent sub-account. */
export async function getNearAgentSigner(chain: EvmPrismaChain, nearAccountId: string, network: string) {
  const config = nearConfig();
  if (network !== config.network) throw new Error("NEAR wallet network does not match runtime network");
  const keys = JSON.parse(process.env.NEAR_RUNTIME_KEYS_JSON ?? "{}") as Record<string, string>;
  const secret = keys[nearAccountId];
  if (!secret) throw new Error("No scoped NEAR runtime key configured for this agent");
  const client = new NearClient(config.rpcUrl);
  const runtime = await client.runtime(nearAccountId, secret);
  return createNearEvmSigner({ client, runtime, mpc: config.mpc, chainId: viemChainFor(chain).id, evmRpcUrl: rpcUrlFor(chain) });
}

export async function getNearAgentRuntime(nearAccountId: string, network: string) {
  const config = nearConfig();
  if (network !== config.network) throw new Error("NEAR wallet network differs from this runtime");
  const keys = JSON.parse(process.env.NEAR_RUNTIME_KEYS_JSON ?? "{}") as Record<string, string>;
  if (!keys[nearAccountId]) throw new Error("Scoped runtime key not configured");
  const client = new NearClient(config.rpcUrl);
  return { client, config, runtime: await client.runtime(nearAccountId, keys[nearAccountId]) };
}
