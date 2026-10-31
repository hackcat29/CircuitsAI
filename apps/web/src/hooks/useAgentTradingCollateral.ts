"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseAbi, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";

const TRADING_VAULT_ABI = parseAbi([
  "function depositCollateral(uint256 agentId) external payable",
  "function withdrawCollateral(uint256 agentId, uint256 amountUsdc) external",
  "function getAgentMarginBalance(uint256 agentId) external view returns (uint256)",
  "function getAgentTradingDetails(uint256 agentId) external view returns (uint256 marginBalanceUsdc, uint256 lifetimeVolumeUsdc, address ownerAddress)",
]);

export interface AgentTradingCollateral {
  marginBalanceUsdc: string;
  lifetimeVolumeUsdc: string;
  vaultAddress: string;
}

/** Manages an agent's on-chain isolated trading margin account.
 * Note: deposits are sent as the chain's native asset (18 decimals).
 * Deposits are sent directly as native msg.value without requiring ERC20 approvals. */
export function useAgentTradingCollateral(agentId: string | undefined) {
  const queryClient = useQueryClient();
  const { chain, address: userAddress } = useWallet();
  const activeChain = chain && isEvmChain(chain) ? chain : MONAD_MAINNET;
  const publicClient = usePublicClient({ chainId: activeChain.viemChain.id });
  const evmWalletClient = usePrivyWalletClient(activeChain);

  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vaultAddress = (activeChain.agentTradingVaultAddress || "") as Address;
  const queryKey = ["agent-trading-collateral", agentId];

  const collateralQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<AgentTradingCollateral> => {
      if (!agentId || !publicClient || !vaultAddress) {
        return { marginBalanceUsdc: "0.00", lifetimeVolumeUsdc: "0.00", vaultAddress };
      }
      try {
        const details = await publicClient.readContract({
          address: vaultAddress,
          abi: TRADING_VAULT_ABI,
          functionName: "getAgentTradingDetails",
          args: [BigInt(agentId)],
        });

        const [marginRaw, volumeRaw] = details as [bigint, bigint, Address];
        return {
          // Native asset amounts use 18 decimals
          marginBalanceUsdc: formatUnits(marginRaw, 18),
          lifetimeVolumeUsdc: formatUnits(volumeRaw, 18),
          vaultAddress,
        };
      } catch {
        return { marginBalanceUsdc: "0.00", lifetimeVolumeUsdc: "0.00", vaultAddress };
      }
    },
    enabled: Boolean(agentId && publicClient),
    refetchInterval: 8_000,
  });

  const depositCollateral = useCallback(
    async (amountUsdc: string): Promise<string> => {
      setError(null);
      if (!agentId) throw new Error("Agent ID is required");
      if (!evmWalletClient || !userAddress) throw new Error("Please sign in first");
      if (!vaultAddress) throw new Error("This feature isn't available on the current network.");
      if (!amountUsdc || Number(amountUsdc) <= 0) throw new Error("Please enter a valid USDC amount");

      setDepositing(true);
      try {
        // Native asset amounts use 18 decimals
        const parsedValue = parseUnits(amountUsdc, 18);

        // Direct native deposit without needing ERC20 approval
        const txHash = await evmWalletClient.writeContract({
          address: vaultAddress,
          abi: TRADING_VAULT_ABI,
          functionName: "depositCollateral",
          args: [BigInt(agentId)],
          value: parsedValue,
          chain: activeChain.viemChain,
          account: evmWalletClient.account!,
        });

        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        await queryClient.invalidateQueries({ queryKey });
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Collateral deposit failed";
        setError(msg);
        throw err;
      } finally {
        setDepositing(false);
      }
    },
    [agentId, evmWalletClient, userAddress, publicClient, vaultAddress, queryClient, queryKey]
  );

  const withdrawCollateral = useCallback(
    async (amountUsdc: string): Promise<string> => {
      setError(null);
      if (!agentId) throw new Error("Agent ID is required");
      if (!evmWalletClient || !userAddress) throw new Error("Please sign in first");
      if (!vaultAddress) throw new Error("This feature isn't available on the current network.");
      if (!amountUsdc || Number(amountUsdc) <= 0) throw new Error("Please enter a valid USDC amount");

      setWithdrawing(true);
      try {
        // Native asset amounts use 18 decimals
        const parsedAmount = parseUnits(amountUsdc, 18);

        const txHash = await evmWalletClient.writeContract({
          address: vaultAddress,
          abi: TRADING_VAULT_ABI,
          functionName: "withdrawCollateral",
          args: [BigInt(agentId), parsedAmount],
          chain: activeChain.viemChain,
          account: evmWalletClient.account!,
        });

        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        await queryClient.invalidateQueries({ queryKey });
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Collateral withdrawal failed";
        setError(msg);
        throw err;
      } finally {
        setWithdrawing(false);
      }
    },
    [agentId, evmWalletClient, userAddress, publicClient, vaultAddress, queryClient, queryKey]
  );

  return {
    collateral: collateralQuery.data ?? { marginBalanceUsdc: "0.00", lifetimeVolumeUsdc: "0.00", vaultAddress },
    isLoading: collateralQuery.isLoading,
    depositing,
    withdrawing,
    error,
    depositCollateral,
    withdrawCollateral,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
