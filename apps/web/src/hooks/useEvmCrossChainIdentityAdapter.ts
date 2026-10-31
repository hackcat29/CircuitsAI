"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmCrossChainIdentityAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmCrossChainIdentityAdapter` for a specific EVM chain — unlike every other
 * `useEvm*Adapter` hook, this points at a genuinely different contract deployment per chain
 * (see chains.ts's `crossChainIdentityAddress` doc comment), not one shared address. Reads via
 * wagmi's `usePublicClient` for *any* configured chain (not just the currently active one — a
 * "linked identities" panel needs to read all 3 chains at once, see useLinkedIdentities.ts),
 * writes via Privy's wallet client only when `chain` matches the active wallet's chain.
 * Returns `undefined` until the contract is deployed and configured on `chain` — genuinely
 * optional, same as staking/evaluator-pool/negotiation. */
export function useEvmCrossChainIdentityAdapter(chain: EvmChainConfig): EvmCrossChainIdentityAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.crossChainIdentityAddress || !publicClient) return undefined;
    return new EvmCrossChainIdentityAdapter({
      contractAddress: chain.crossChainIdentityAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.crossChainIdentityAddress, publicClient, walletClient]);
}
