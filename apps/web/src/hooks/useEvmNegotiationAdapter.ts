"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmNegotiationAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmNegotiationAdapter` for a specific EVM chain — fully on-chain Client/Provider
 * negotiation, a separate contract from `useEvmAdapter`'s ClawdHQCore. Reads via wagmi's
 * `usePublicClient`, writes via Privy's wallet client. Returns `undefined` until the
 * negotiation contract is deployed and configured — genuinely optional. */
export function useEvmNegotiationAdapter(chain: EvmChainConfig): EvmNegotiationAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.negotiationAddress || !publicClient) return undefined;
    return new EvmNegotiationAdapter({
      contractAddress: chain.negotiationAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.negotiationAddress, publicClient, walletClient]);
}
