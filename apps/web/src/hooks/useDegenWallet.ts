"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseAbi, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { socialFetch } from "@/lib/social/api";
import { isEvmChain, fromIndexerChainSlug, type IndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";
import type { DegenVenue } from "@/hooks/useDegenConfig";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);
const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export interface DegenWallet {
  venue: DegenVenue;
  address: string;
  status: "ACTIVE" | "WITHDRAWN" | "REVOKED";
}

export interface DegenWithdrawResult {
  txHashOrRef: string;
  amount: string;
  asset: string;
}

/** LIVE-mode isolated trading custody wallet for one (agent, venue) pair — owner-only.
 * Keeps trading capital 100% segregated from the Agent Operating Treasury. */
export function useDegenWallet(chain: IndexerChainSlug | undefined, agentChainId: string | undefined, venue: DegenVenue) {
  const queryClient = useQueryClient();
  const queryKey = ["degen-wallet", chain, agentChainId, venue];
  const { chain: activeChain } = useWallet();
  const resolvedChain = (chain ? fromIndexerChainSlug(chain) : undefined) || (isEvmChain(activeChain) ? activeChain : MONAD_MAINNET);
  const evmWalletClient = usePrivyWalletClient(resolvedChain);
  const publicClient = usePublicClient({ chainId: resolvedChain.viemChain.id });
  const [depositing, setDepositing] = useState(false);

  const walletQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ wallet: DegenWallet | null }>(`/api/degen/agents/${chain}/${agentChainId}/wallets/${venue}`).then((d) => d.wallet),
    enabled: Boolean(chain && agentChainId),
  });

  const walletAddress = walletQuery.data?.address;

  const balanceQuery = useQuery({
    queryKey: ["degen-wallet-balance", venue, walletAddress],
    queryFn: async () => {
      if (!walletAddress || !publicClient) return "0.00";
      try {
        if (resolvedChain.usdcAddress) {
          const raw = await publicClient.readContract({
            address: resolvedChain.usdcAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          });
          return formatUnits(raw as bigint, 6);
        }
        const nativeRaw = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
        return formatUnits(nativeRaw, 18);
      } catch {
        return "0.00";
      }
    },
    enabled: Boolean(walletAddress && publicClient),
    refetchInterval: 10_000,
  });

  const provision = useMutation({
    mutationFn: () => socialFetch<{ wallet: DegenWallet }>(`/api/degen/agents/${chain}/${agentChainId}/wallets/${venue}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const withdraw = useMutation<DegenWithdrawResult, Error, { withdrawChain?: string } | void>({
    mutationFn: (input) =>
      socialFetch<DegenWithdrawResult>(`/api/degen/agents/${chain}/${agentChainId}/wallets/${venue}/withdraw`, {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["degen-wallet-balance", venue, walletAddress] });
    },
  });

  async function depositFromConnectedWallet(amountUsdc: string): Promise<void> {
    if (!walletAddress) throw new Error("This trading wallet hasn't been provisioned yet");
    if (!evmWalletClient) throw new Error("Please sign in first");

    setDepositing(true);
    try {
      await evmWalletClient.writeContract({
        address: resolvedChain.usdcAddress as Address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [walletAddress as Address, parseUnits(amountUsdc, 6)],
        chain: resolvedChain.viemChain,
        account: evmWalletClient.account!,
      });
    } finally {
      setDepositing(false);
    }
    await queryClient.invalidateQueries({ queryKey: ["degen-wallet-balance", venue, walletAddress] });
  }

  return {
    ...walletQuery,
    wallet: walletQuery.data ?? null,
    balanceUsdc: balanceQuery.data ?? "0.00",
    isBalanceLoading: balanceQuery.isLoading,
    provision,
    withdraw,
    depositFromConnectedWallet,
    depositing,
  };
}
