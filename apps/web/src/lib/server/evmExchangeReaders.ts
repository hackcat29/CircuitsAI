import { createPublicClient, getContract, http, type Address, type PublicClient } from "viem";
import {
  EvmAdapter,
  EvmAgentExchangeAdapter,
  EvmLaunchpadAdapter,
  EvmXeroRouterAdapter,
  xeroFactoryAbi,
  xeroPairAbi,
  xeroRouterAbi,
} from "@clawdhq/sdk";
import { Chain as PrismaChain } from "@clawdhq/marketplace-db";
import { BASE_SEPOLIA, ETH_SEPOLIA, BSC_TESTNET, MONAD_MAINNET, type EvmChainConfig } from "@/lib/chains";
import { env } from "@/lib/env";

// Server-only: builds read-only SDK adapters (no wallet client) directly from RPC, for API
// routes that need a live on-chain fallback when the indexer's Postgres cache has no row yet
// (e.g. a valuation for an agent the indexer hasn't processed a job for). Never used for
// writes — every state-changing action goes straight from the user's wallet, client-side.

const EVM_CHAIN_BY_PRISMA: Record<"BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET", EvmChainConfig> = {
  BASE_SEPOLIA,
  ETH_SEPOLIA,
  BSC_TESTNET,
  MONAD_MAINNET,
};

const RPC_URL_BY_PRISMA_CHAIN: Record<"BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET", string> = {
  BASE_SEPOLIA: env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  ETH_SEPOLIA: env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
  BSC_TESTNET: env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
  MONAD_MAINNET: MONAD_MAINNET.rpcUrl,
};

const EXCHANGE_ADDRESS_BY_PRISMA_CHAIN: Record<"BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET", string> = {
  BASE_SEPOLIA: env.NEXT_PUBLIC_BASE_SEPOLIA_EXCHANGE_ADDRESS,
  ETH_SEPOLIA: env.NEXT_PUBLIC_ETH_SEPOLIA_EXCHANGE_ADDRESS,
  BSC_TESTNET: env.NEXT_PUBLIC_BSC_TESTNET_EXCHANGE_ADDRESS || "0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc",
  MONAD_MAINNET: MONAD_MAINNET.exchangeAddress,
};

const LAUNCHPAD_ADDRESS_BY_PRISMA_CHAIN: Record<"BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET", string> = {
  BASE_SEPOLIA: env.NEXT_PUBLIC_BASE_SEPOLIA_LAUNCHPAD_ADDRESS,
  ETH_SEPOLIA: env.NEXT_PUBLIC_ETH_SEPOLIA_LAUNCHPAD_ADDRESS,
  BSC_TESTNET: env.NEXT_PUBLIC_BSC_TESTNET_LAUNCHPAD_ADDRESS || "0xfc4C43191f5336374A7Be184eE68ac818148A4ca",
  MONAD_MAINNET: MONAD_MAINNET.launchpadAddress,
};

const XERO_ROUTER_ADDRESS_BY_PRISMA_CHAIN: Record<"BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET", string> = {
  BASE_SEPOLIA: env.NEXT_PUBLIC_BASE_SEPOLIA_XERO_ROUTER_ADDRESS,
  ETH_SEPOLIA: env.NEXT_PUBLIC_ETH_SEPOLIA_XERO_ROUTER_ADDRESS,
  BSC_TESTNET: env.NEXT_PUBLIC_BSC_TESTNET_XERO_ROUTER_ADDRESS || "0x4F7b10d274F9Ba58739A57E9EdB520Aa0a5d6747",
  MONAD_MAINNET: MONAD_MAINNET.xeroRouterAddress,
};

export type EvmPrismaChain = keyof typeof EVM_CHAIN_BY_PRISMA;

export function isEvmPrismaChain(chain: PrismaChain): chain is EvmPrismaChain {
  return chain in EVM_CHAIN_BY_PRISMA;
}

/** Whether ClawdHQCore is actually deployed on this chain in the current environment — same
 * "no address configured means not deployed here yet" check `useEvmAdapter.ts` does client-side.
 * Server-side callers that iterate all EVM chains should skip undeployed ones rather than let an
 * empty-string contract address reach the RPC as a malformed `eth_call`. */
export function isChainDeployed(chain: EvmPrismaChain): boolean {
  return Boolean(EVM_CHAIN_BY_PRISMA[chain].contractAddress);
}

// contributorScore.ts (and anything else iterating every agent/launch id) fires many reads per
// chain per computation, so `batch.multicall` collapses same-tick `readContract` calls into one
// `eth_call` against Multicall3 (same approach as wagmi.ts's client config).
const publicClientsByChain = new Map<EvmPrismaChain, PublicClient>();

export function publicClientFor(chain: EvmPrismaChain): PublicClient {
  let client = publicClientsByChain.get(chain);
  if (!client) {
    client = createPublicClient({
      chain: EVM_CHAIN_BY_PRISMA[chain].viemChain,
      transport: http(RPC_URL_BY_PRISMA_CHAIN[chain]),
      batch: { multicall: { wait: 20 } },
    });
    publicClientsByChain.set(chain, client);
  }
  return client;
}

export function getServerEvmAdapter(chain: EvmPrismaChain): EvmAdapter {
  return new EvmAdapter({
    contractAddress: EVM_CHAIN_BY_PRISMA[chain].contractAddress as `0x${string}`,
    publicClient: publicClientFor(chain),
    launchpadAddress: LAUNCHPAD_ADDRESS_BY_PRISMA_CHAIN[chain] as `0x${string}`,
  });
}

export function getServerEvmExchangeAdapter(chain: EvmPrismaChain): EvmAgentExchangeAdapter {
  return new EvmAgentExchangeAdapter({
    contractAddress: EXCHANGE_ADDRESS_BY_PRISMA_CHAIN[chain] as `0x${string}`,
    publicClient: publicClientFor(chain),
  });
}

export function getServerEvmLaunchpadAdapter(chain: EvmPrismaChain): EvmLaunchpadAdapter {
  return new EvmLaunchpadAdapter({
    contractAddress: LAUNCHPAD_ADDRESS_BY_PRISMA_CHAIN[chain] as `0x${string}`,
    publicClient: publicClientFor(chain),
  });
}

/** Whether the Uniswap V2 / Xero Router is actually deployed on this chain in the current environment —
 * callers should check this before constructing an adapter (e.g. before a live reserves read
 * for a graduated launch's "Liquidity" stat), same pattern as isChainDeployed above. Uniswap v4 Hooks is the
 * official DEX on Monad mainnet; Xero is used under the hood on testnet. */
export function isXeroDeployed(chain: EvmPrismaChain): boolean {
  return Boolean(XERO_ROUTER_ADDRESS_BY_PRISMA_CHAIN[chain]);
}

export function getServerEvmXeroRouterAdapter(chain: EvmPrismaChain): EvmXeroRouterAdapter {
  return new EvmXeroRouterAdapter({
    contractAddress: XERO_ROUTER_ADDRESS_BY_PRISMA_CHAIN[chain] as `0x${string}`,
    publicClient: publicClientFor(chain),
  });
}

/** Live reserves for a graduated launch's token<->USDC pair on Uniswap (via Xero pair on testnet) —
 * deliberately scoped to a single detail-page load, not the full sortable list (see
 * apps/web/src/app/api/launchpad/route.ts's doc comment on why bulk live reads across every row would
 * reintroduce RPC rate limits, the entire reason the Launch cache exists). Returns null if the
 * router/factory isn't deployed on this chain, or no pair exists yet for this token (shouldn't happen
 * for an already-graduated launch, but defensive rather than throwing). */
export async function getGraduatedPairReserves(
  chain: EvmPrismaChain,
  tokenAddress: Address,
  usdcAddress: Address
): Promise<{ pairAddress: Address; tokenReserve: bigint; usdcReserve: bigint } | null> {
  if (!isXeroDeployed(chain)) return null;
  const publicClient = publicClientFor(chain);

  const router = getContract({
    address: XERO_ROUTER_ADDRESS_BY_PRISMA_CHAIN[chain] as Address,
    abi: xeroRouterAbi,
    client: { public: publicClient },
  }) as unknown as { read: { factory: () => Promise<Address> } };
  const factoryAddress = await router.read.factory();

  const factory = getContract({ address: factoryAddress, abi: xeroFactoryAbi, client: { public: publicClient } }) as unknown as {
    read: { getPair: (args: readonly [Address, Address]) => Promise<Address> };
  };
  const pairAddress = await factory.read.getPair([tokenAddress, usdcAddress]);
  if (pairAddress === "0x0000000000000000000000000000000000000000") return null;

  const pair = getContract({ address: pairAddress, abi: xeroPairAbi, client: { public: publicClient } }) as unknown as {
    read: {
      getReserves: () => Promise<readonly [bigint, bigint, number]>;
      token0: () => Promise<Address>;
    };
  };
  const [[reserve0, reserve1], token0] = await Promise.all([pair.read.getReserves(), pair.read.token0()]);
  const isTokenFirst = token0.toLowerCase() === tokenAddress.toLowerCase();
  return isTokenFirst
    ? { pairAddress, tokenReserve: reserve0, usdcReserve: reserve1 }
    : { pairAddress, tokenReserve: reserve1, usdcReserve: reserve0 };
}
