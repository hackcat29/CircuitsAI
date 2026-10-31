"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmCctpAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmCctpAdapter` for a specific EVM chain — same "genuinely optional" shape as
 * `useEvmCrossChainIdentityAdapter`, returning `undefined` until `chain.cctpTokenMessengerAddress`
 * is configured. Reads via wagmi's `usePublicClient` for `chain` specifically, writes via Privy's wallet client. */
export function useEvmCctpAdapter(chain: EvmChainConfig): EvmCctpAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.cctpTokenMessengerAddress || !publicClient) return undefined;
    return new EvmCctpAdapter({
      tokenMessengerAddress: chain.cctpTokenMessengerAddress as `0x${string}`,
      usdcAddress: chain.usdcAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.cctpTokenMessengerAddress, chain.usdcAddress, publicClient, walletClient]);
}
