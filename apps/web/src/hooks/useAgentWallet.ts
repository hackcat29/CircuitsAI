"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, parseUnits, type Address } from "viem";
import { socialFetch } from "@/lib/social/api";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, type IndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

export interface AgentClaimResult {
  txHashOrRef: string;
  amount: string;
  asset: string;
}

/** The agent's own canonical custodied wallet (see packages/custody-core/src/
 * agentWalletCustody.ts) — accumulates job payouts and launchpad creator allocations. Claiming
 * sweeps that balance to the caller's own wallet; only the agent's *current* on-chain owner can
 * claim (verified live server-side on every call, never cached), so claim rights follow an
 * Agent Exchange sale automatically. `claimableUsdc` is `null` until the indexer has processed
 * this agent's registration and provisioned its wallet — not the same as "0, but empty."
 *
 * `depositFromConnectedWallet` is the opposite direction — a plain client-side ERC20 transfer
 * *into* this address from the signed-in owner's own wallet, no server/custody
 * involvement at all, same pattern as useSubscriptionWallet.ts's identical method. Used right
 * after registration (RegisterWizard's success screen) so an owner can optionally seed a fresh
 * agent's wallet without a separate trip to its Wallet tab later. */
export function useAgentWallet(chain: IndexerChainSlug | undefined, agentChainId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["agent-wallet", chain, agentChainId];
  const { chain: activeChain } = useWallet();
  // Rules-of-hooks requires calling this unconditionally even when the active chain isn't EVM
  // right now — same "fall back to a fixed EVM chain, the result just goes unused" pattern
  // useSubscriptionWallet.ts's identical deposit method already uses.
  const evmWalletClient = usePrivyWalletClient(isEvmChain(activeChain) ? activeChain : MONAD_MAINNET);
  const [depositing, setDepositing] = useState(false);

  const walletQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ address: string | null; claimableUsdc: string | null }>(`/api/agents/${chain}/${agentChainId}/claim`),
    enabled: Boolean(chain && agentChainId),
    // Provisioning happens asynchronously (the indexer picks up the registration event, not this
    // request) — poll every few seconds until an address shows up, then stop; avoids indefinite
    // polling everywhere else this hook is used once a wallet already exists.
    refetchInterval: (query) => (query.state.data?.address ? false : 3000),
  });

  const claim = useMutation<AgentClaimResult, Error, { amountUsdc?: string } | void>({
    mutationFn: (variables) =>
      socialFetch<AgentClaimResult>(`/api/agents/${chain}/${agentChainId}/claim`, {
        method: "POST",
        body: variables?.amountUsdc ? JSON.stringify({ amountUsdc: variables.amountUsdc }) : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function depositFromConnectedWallet(amountUsdc: string): Promise<void> {
    const address = walletQuery.data?.address;
    if (!address) throw new Error("This agent's wallet hasn't been provisioned yet");
    if (!isEvmChain(activeChain)) throw new Error("Deposits for this chain aren't wired up yet");
    if (!evmWalletClient) throw new Error("Sign in first");

    setDepositing(true);
    try {
      await evmWalletClient.writeContract({
        address: activeChain.usdcAddress as Address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [address as Address, parseUnits(amountUsdc, 6)],
        chain: activeChain.viemChain,
        account: evmWalletClient.account!,
      });
    } finally {
      setDepositing(false);
    }
    await queryClient.invalidateQueries({ queryKey });
  }

  return {
    ...walletQuery,
    address: walletQuery.data?.address ?? null,
    claimableUsdc: walletQuery.data?.claimableUsdc ?? null,
    claim,
    depositFromConnectedWallet,
    depositing,
  };
}
