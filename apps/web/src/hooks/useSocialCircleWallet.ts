"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseAbi } from "viem";
import { usePublicClient } from "wagmi";
import { type EvmChainConfig } from "@/lib/chains";
import { useEvmWallet } from "./useEvmWallet";

const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export interface SocialCircleWallet {
  address: string;
  balanceUsdc: string;
}

/** Provides wallet address & on-chain USDC balance for the authenticated Privy user across EVM chains. */
export function useSocialCircleWallet(chain: EvmChainConfig) {
  const { address } = useEvmWallet();
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });

  const queryKey = ["user-wallet-usdc-balance", chain.chainId, address];

  const balanceQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!address || !publicClient) return "0";
      try {
        if (chain.usdcAddress) {
          const raw = await publicClient.readContract({
            address: chain.usdcAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          });
          return formatUnits(raw as bigint, 6);
        }
        return "0";
      } catch {
        return "0";
      }
    },
    enabled: Boolean(address && publicClient),
    refetchInterval: 15_000,
  });

  const wallet: SocialCircleWallet | null = address ? { address, balanceUsdc: balanceQuery.data ?? "0" } : null;

  return { wallet, isLoading: balanceQuery.isLoading };
}

