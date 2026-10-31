"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmAdapter` for a specific EVM chain — reads via wagmi's `usePublicClient` (plain
 * RPC, no wallet needed), writes via Privy's embedded wallet client (see
 * usePrivyWalletClient.ts). Returns `undefined` until
 * the contract is deployed (no address configured) or the public client hasn't loaded yet. */
export function useEvmAdapter(chain: EvmChainConfig): EvmAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.contractAddress || !publicClient) return undefined;
    return new EvmAdapter({
      contractAddress: chain.contractAddress as `0x${string}`,
      publicClient,
      walletClient,
      launchpadAddress: (chain.launchpadAddress as `0x${string}`) || undefined,
    });
  }, [chain.contractAddress, chain.launchpadAddress, publicClient, walletClient]);
}
