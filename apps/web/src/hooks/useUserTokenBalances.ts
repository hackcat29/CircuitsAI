"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseAbi } from "viem";
import { usePublicClient } from "wagmi";
import { useWallet } from "./useWallet";

const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export function useUserTokenBalances(tokenAddress: string | undefined) {
  const { chain, address } = useWallet();
  const publicClient = usePublicClient({ chainId: chain.viemChain.id });

  const query = useQuery({
    queryKey: ["user-launch-token-balances", chain.chainId, address, tokenAddress],
    queryFn: async () => {
      if (!address || !publicClient) {
        return {
          usdcBalance: "0",
          tokenBalance: "0",
          rawUsdcBalance: 0n,
          rawTokenBalance: 0n,
        };
      }

      let rawUsdcBalance = 0n;
      let usdcFormatted = "0";

      try {
        if (chain.usdcAddress) {
          rawUsdcBalance = (await publicClient.readContract({
            address: chain.usdcAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          })) as bigint;
          usdcFormatted = formatUnits(rawUsdcBalance, 6);
        }
      } catch {
        rawUsdcBalance = 0n;
        usdcFormatted = "0";
      }

      let rawTokenBalance = 0n;
      let tokenFormatted = "0";

      if (tokenAddress && tokenAddress.startsWith("0x")) {
        try {
          rawTokenBalance = (await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          })) as bigint;
          tokenFormatted = formatUnits(rawTokenBalance, 18);
        } catch {
          rawTokenBalance = 0n;
          tokenFormatted = "0";
        }
      }

      return {
        usdcBalance: usdcFormatted,
        tokenBalance: tokenFormatted,
        rawUsdcBalance,
        rawTokenBalance,
      };
    },
    enabled: Boolean(address && publicClient),
    refetchInterval: 10_000,
  });

  return {
    usdcBalance: query.data?.usdcBalance ?? "0",
    tokenBalance: query.data?.tokenBalance ?? "0",
    rawUsdcBalance: query.data?.rawUsdcBalance ?? 0n,
    rawTokenBalance: query.data?.rawTokenBalance ?? 0n,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
