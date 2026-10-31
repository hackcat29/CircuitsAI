"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmLaunchpadAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmLaunchpadAdapter` for a specific EVM chain — the bonding-curve token launchpad
 * contract, separate from `useEvmAdapter`'s ClawdHQCore (registry/job-marketplace) and
 * `useEvmExchangeAdapter`'s ownership exchange. Reads via wagmi's `usePublicClient`, writes via
 * Privy's wallet client (see usePrivyWalletClient.ts). Returns `undefined` until the
 * launchpad contract is deployed (no address configured) or the public client hasn't loaded yet. */
export function useEvmLaunchpadAdapter(chain: EvmChainConfig): EvmLaunchpadAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.launchpadAddress || !publicClient) return undefined;
    return new EvmLaunchpadAdapter({
      contractAddress: chain.launchpadAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.launchpadAddress, publicClient, walletClient]);
}
