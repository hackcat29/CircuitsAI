"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmXeroRouterAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmXeroRouterAdapter` for a specific EVM chain — connects to the Uniswap V2 / Xero Router
 * (packages/contracts-evm/contracts/xero/XeroRouter.sol), the router used to trade a token once it
 * graduates off ClawdHQLaunchpad's bonding curve. Uniswap is the official graduation DEX on Monad mainnet;
 * under the hood, Xero is used on testnet until Uniswap deploys and publishes official contract addresses.
 * Same shape as useEvmLaunchpadAdapter — reads via wagmi's `usePublicClient`, writes via Privy's wallet
 * client. Returns `undefined` until the router is deployed on this chain (no address configured) or
 * the public client hasn't loaded yet. */
export function useEvmXeroRouterAdapter(chain: EvmChainConfig): EvmXeroRouterAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.xeroRouterAddress || !publicClient) return undefined;
    return new EvmXeroRouterAdapter({
      contractAddress: chain.xeroRouterAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.xeroRouterAddress, publicClient, walletClient]);
}
