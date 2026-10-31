"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { EvmEvaluatorPoolAdapter } from "@clawdhq/sdk";
import type { EvmChainConfig } from "@/lib/chains";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

/** Builds an `EvmEvaluatorPoolAdapter` for a specific EVM chain — the permissionless staked
 * evaluator marketplace, a separate contract from `useEvmAdapter`'s ClawdHQCore. Reads via
 * wagmi's `usePublicClient`, writes via Privy's wallet client. Returns `undefined`
 * until the evaluator pool contract is deployed and configured — genuinely optional. */
export function useEvmEvaluatorPoolAdapter(chain: EvmChainConfig): EvmEvaluatorPoolAdapter | undefined {
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });
  const walletClient = usePrivyWalletClient(chain);

  return useMemo(() => {
    if (!chain.evaluatorPoolAddress || !publicClient) return undefined;
    return new EvmEvaluatorPoolAdapter({
      contractAddress: chain.evaluatorPoolAddress as `0x${string}`,
      publicClient,
      walletClient,
    });
  }, [chain.evaluatorPoolAddress, publicClient, walletClient]);
}
