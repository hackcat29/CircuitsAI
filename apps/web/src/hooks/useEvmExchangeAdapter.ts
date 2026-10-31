"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmAgentExchangeAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmAgentExchangeAdapter` for a specific EVM chain — the agent ownership
 * marketplace contract, separate from `useEvmAdapter`'s ClawdHQCore (registry/job-marketplace/
 * launchpad). Reads via wagmi's `usePublicClient`, writes via Privy's wallet client
 * (see usePrivyWalletClient.ts). Returns `undefined` until the exchange contract is deployed
 * (no address configured) or the public client hasn't loaded yet. */
export function useEvmExchangeAdapter(chain: EvmChainConfig): EvmAgentExchangeAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.exchangeAddress || !publicClient) return undefined;
    return new EvmAgentExchangeAdapter({
      contractAddress: chain.exchangeAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.exchangeAddress, publicClient, walletClient]);
}
