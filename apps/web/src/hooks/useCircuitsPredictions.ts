"use client";

import { useState, useCallback, useEffect } from "react";
import { parseUnits, encodeFunctionData, type Address, type Hash, keccak256, stringToHex, createPublicClient, http } from "viem";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { env } from "@/lib/env";

export enum PredictionOutcome {
  UNRESOLVED = 0,
  YES = 1,
  NO = 2,
  INVALID = 3,
}

const PREDICTION_VAULT_ABI = [
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "question", type: "string" },
      { name: "endTime", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyShares",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "outcome", type: "uint8" },
      { name: "usdcAmount", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ name: "sharesMinted", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sellShares",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "outcome", type: "uint8" },
      { name: "sharesAmount", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
    ],
    outputs: [{ name: "usdcReturned", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimWinnings",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ name: "payout", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getUserPosition",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "userYes", type: "uint256" },
      { name: "userNo", type: "uint256" },
      { name: "hasClaimed", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarket",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "marketId", type: "bytes32" },
          { name: "question", type: "string" },
          { name: "endTime", type: "uint256" },
          { name: "totalYesShares", type: "uint256" },
          { name: "totalNoShares", type: "uint256" },
          { name: "totalUsdcPool", type: "uint256" },
          { name: "feePool", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "winningOutcome", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "resolvedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function useCircuitsPredictions() {
  const { chain, address } = useWallet();
  const activeChain = chain && isEvmChain(chain) ? chain : MONAD_MAINNET;
  const walletClient = usePrivyWalletClient(activeChain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vaultAddress: Address = (activeChain.predictionVaultAddress || "") as Address;

  const usdcAddress: Address = (activeChain.usdcAddress || "") as Address;

  const publicClient = createPublicClient({
    chain: activeChain.viemChain,
    transport: http(activeChain.rpcUrl),
  });

  const formatMarketId = (rawId: string): `0x${string}` => {
    if (rawId.startsWith("0x") && rawId.length === 66) {
      return rawId as `0x${string}`;
    }
    return keccak256(stringToHex(rawId));
  };

  const buyShares = useCallback(
    async (params: {
      marketId: string;
      question?: string;
      outcome: PredictionOutcome;
      amountUsdc: number;
      minSharesOut?: number;
      endTimeSeconds?: number;
    }): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in to purchase shares.");
        }
        if (!vaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const formattedMarketId = formatMarketId(params.marketId);
        const rawAmount = parseUnits(params.amountUsdc.toString(), 6);
        const minSharesRaw = params.minSharesOut ? parseUnits(params.minSharesOut.toString(), 6) : 0n;

        // 1. Check if market exists on-chain; if not, create it first
        try {
          const marketData = (await publicClient.readContract({
            address: vaultAddress,
            abi: PREDICTION_VAULT_ABI,
            functionName: "getMarket",
            args: [formattedMarketId],
          })) as any;

          if (!marketData || Number(marketData.createdAt) === 0) {
            const question = params.question || "Will this crypto outcome resolve YES?";
            const defaultEndTime = params.endTimeSeconds || Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

            const createData = encodeFunctionData({
              abi: PREDICTION_VAULT_ABI,
              functionName: "createMarket",
              args: [formattedMarketId, question, BigInt(defaultEndTime)],
            });

            await walletClient.sendTransaction({
              account: address as Address,
              to: vaultAddress,
              data: createData,
              chain: activeChain.viemChain,
            });
          }
        } catch {
          // If read fails or market not yet created, proceed with creation
          try {
            const question = params.question || "Will this crypto outcome resolve YES?";
            const defaultEndTime = params.endTimeSeconds || Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

            const createData = encodeFunctionData({
              abi: PREDICTION_VAULT_ABI,
              functionName: "createMarket",
              args: [formattedMarketId, question, BigInt(defaultEndTime)],
            });

            await walletClient.sendTransaction({
              account: address as Address,
              to: vaultAddress,
              data: createData,
              chain: activeChain.viemChain,
            });
          } catch {
            // Market might already exist
          }
        }

        // 2. Check & Approve USDC
        const allowance = (await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as Address, vaultAddress],
        })) as bigint;

        if (allowance < rawAmount) {
          const approveData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [vaultAddress, rawAmount * 100n],
          });

          await walletClient.sendTransaction({
            account: address as Address,
            to: usdcAddress,
            data: approveData,
            chain: activeChain.viemChain,
          });
        }

        // 3. Buy Shares on Vault
        const buyData = encodeFunctionData({
          abi: PREDICTION_VAULT_ABI,
          functionName: "buyShares",
          args: [formattedMarketId, params.outcome, rawAmount, minSharesRaw],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: vaultAddress,
          data: buyData,
          chain: activeChain.viemChain,
        });

        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Failed to buy prediction shares";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, vaultAddress, usdcAddress, publicClient],
  );

  const sellShares = useCallback(
    async (params: {
      marketId: string;
      outcome: PredictionOutcome;
      sharesAmount: number;
      minUsdcOut?: number;
    }): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!vaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const formattedMarketId = formatMarketId(params.marketId);
        const rawShares = parseUnits(params.sharesAmount.toString(), 6);
        const minUsdcRaw = params.minUsdcOut ? parseUnits(params.minUsdcOut.toString(), 6) : 0n;

        const sellData = encodeFunctionData({
          abi: PREDICTION_VAULT_ABI,
          functionName: "sellShares",
          args: [formattedMarketId, params.outcome, rawShares, minUsdcRaw],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: vaultAddress,
          data: sellData,
          chain: activeChain.viemChain,
        });

        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Failed to sell prediction shares";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, vaultAddress],
  );

  const claimWinnings = useCallback(
    async (marketId: string): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!vaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const formattedMarketId = formatMarketId(marketId);
        const claimData = encodeFunctionData({
          abi: PREDICTION_VAULT_ABI,
          functionName: "claimWinnings",
          args: [formattedMarketId],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: vaultAddress,
          data: claimData,
          chain: activeChain.viemChain,
        });

        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Failed to claim winnings";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, vaultAddress],
  );

  return {
    buyShares,
    sellShares,
    claimWinnings,
    busy,
    error,
    vaultAddress,
  };
}
