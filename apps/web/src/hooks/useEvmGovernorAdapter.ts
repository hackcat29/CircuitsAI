"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmGovernorAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmGovernorAdapter` for a specific EVM chain — on-chain protocol governance, a
 * separate contract from `useEvmAdapter`'s ClawdHQCore. Reads via wagmi's `usePublicClient`,
 * writes via Privy's wallet client (see usePrivyWalletClient.ts). Returns `undefined`
 * until the governor contract is deployed (no address set) or the public client hasn't loaded
 * yet — genuinely optional, same shape as `useEvmStakingAdapter`. */
export function useEvmGovernorAdapter(chain: EvmChainConfig): EvmGovernorAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.governorAddress || !publicClient) return undefined;
    return new EvmGovernorAdapter({
      contractAddress: chain.governorAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.governorAddress, publicClient, walletClient]);
}
