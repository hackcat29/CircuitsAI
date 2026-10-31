"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmStakingAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmStakingAdapter` for a specific EVM chain — agent reliability bonds, a separate
 * contract from `useEvmAdapter`'s ClawdHQCore. Reads via wagmi's `usePublicClient`, writes via
 * Privy's wallet client (see usePrivyWalletClient.ts). Returns `undefined` until the
 * staking contract is deployed and configured (no address set) or the public client hasn't
 * loaded yet — staking is genuinely optional, unlike the exchange/launchpad adapters. */
export function useEvmStakingAdapter(chain: EvmChainConfig): EvmStakingAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.stakingAddress || !publicClient) return undefined;
    return new EvmStakingAdapter({
      contractAddress: chain.stakingAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.stakingAddress, publicClient, walletClient]);
}
