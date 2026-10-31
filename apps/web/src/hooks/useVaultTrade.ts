"use client";

import { useState, useCallback } from "react";
import { parseUnits, encodeFunctionData, type Address, type Hash, createPublicClient, http } from "viem";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { env } from "@/lib/env";
import { PredictionOutcome } from "./useCircuitsPredictions";

const TRADING_VAULT_ABI = [
  {
    type: "function",
    name: "executeTrade",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "venue", type: "address" },
      { name: "callData", type: "bytes" },
      { name: "maxSpendUsdc", type: "uint256" },
    ],
    outputs: [{ name: "returnData", type: "bytes" }],
    stateMutability: "nonpayable",
  },
] as const;

const PERP_VAULT_ABI = [
  {
    type: "function",
    name: "openPositionFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "collateralUsdc", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "acceptablePrice", type: "uint256" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [{ name: "positionKey", type: "bytes32" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "closePositionFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "acceptablePrice", type: "uint256" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [
      { name: "realizedPnl", type: "int256" },
      { name: "payoutUsdc", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

const PREDICTION_VAULT_ABI = [
  {
    type: "function",
    name: "buySharesFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "outcome", type: "uint8" },
      { name: "usdcAmount", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ name: "sharesMinted", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sellSharesFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
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
    name: "claimWinningsFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "marketId", type: "bytes32" },
    ],
    outputs: [{ name: "payout", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Unified autonomous agent execution hook.
 * Routes trades through the on-chain CircuitsAgentTradingVault without requiring
 * manual per-trade approvals or drawing from the human's primary wallet.
 */
export function useVaultTrade() {
  const { chain, address } = useWallet();
  const activeChain = chain && isEvmChain(chain) ? chain : MONAD_MAINNET;
  const walletClient = usePrivyWalletClient(activeChain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tradingVaultAddress = (activeChain.agentTradingVaultAddress || "") as Address;

  const perpVaultAddress = (activeChain.perpVaultAddress || "") as Address;

  const predictionVaultAddress = (activeChain.predictionVaultAddress || "") as Address;

  const publicClient = createPublicClient({
    chain: activeChain.viemChain,
    transport: http(activeChain.rpcUrl),
  });

  const executePerpTrade = useCallback(
    async (
      agentId: string,
      params: {
        symbol: string;
        isLong: boolean;
        collateralUsdc: number;
        leverage: number;
        acceptablePrice?: number;
        markPrice: number;
      }
    ): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!tradingVaultAddress || !perpVaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const rawCollateral = parseUnits(params.collateralUsdc.toString(), 18);
        const rawMarkPrice = parseUnits(params.markPrice.toFixed(4), 8);
        const rawAcceptablePrice = params.acceptablePrice
          ? parseUnits(params.acceptablePrice.toFixed(4), 8)
          : 0n;

        const openForData = encodeFunctionData({
          abi: PERP_VAULT_ABI,
          functionName: "openPositionFor",
          args: [
            address as Address,
            params.symbol,
            params.isLong,
            rawCollateral,
            BigInt(params.leverage),
            rawAcceptablePrice,
            rawMarkPrice,
          ],
        });

        const executeData = encodeFunctionData({
          abi: TRADING_VAULT_ABI,
          functionName: "executeTrade",
          args: [BigInt(agentId), perpVaultAddress, openForData, rawCollateral],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: tradingVaultAddress,
          data: executeData,
          chain: activeChain.viemChain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Autonomous perp trade execution failed";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, tradingVaultAddress, perpVaultAddress, publicClient]
  );

  const executeClosePerpTrade = useCallback(
    async (
      agentId: string,
      params: {
        symbol: string;
        isLong: boolean;
        acceptablePrice?: number;
        markPrice: number;
      }
    ): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!tradingVaultAddress || !perpVaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const rawMarkPrice = parseUnits(params.markPrice.toFixed(4), 8);
        const rawAcceptablePrice = params.acceptablePrice
          ? parseUnits(params.acceptablePrice.toFixed(4), 8)
          : 0n;

        const closeForData = encodeFunctionData({
          abi: PERP_VAULT_ABI,
          functionName: "closePositionFor",
          args: [address as Address, params.symbol, params.isLong, rawAcceptablePrice, rawMarkPrice],
        });

        const executeData = encodeFunctionData({
          abi: TRADING_VAULT_ABI,
          functionName: "executeTrade",
          args: [BigInt(agentId), perpVaultAddress, closeForData, 0n],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: tradingVaultAddress,
          data: executeData,
          chain: activeChain.viemChain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Autonomous perp position close failed";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, tradingVaultAddress, perpVaultAddress, publicClient]
  );

  const executePredictionBuy = useCallback(
    async (
      agentId: string,
      params: {
        marketId: `0x${string}`;
        outcome: PredictionOutcome;
        amountUsdc: number;
        minSharesOut?: number;
      }
    ): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!tradingVaultAddress || !predictionVaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const rawAmount = parseUnits(params.amountUsdc.toString(), 18);
        const minSharesRaw = params.minSharesOut ? parseUnits(params.minSharesOut.toString(), 18) : 0n;

        const buyForData = encodeFunctionData({
          abi: PREDICTION_VAULT_ABI,
          functionName: "buySharesFor",
          args: [address as Address, params.marketId, params.outcome, rawAmount, minSharesRaw],
        });

        const executeData = encodeFunctionData({
          abi: TRADING_VAULT_ABI,
          functionName: "executeTrade",
          args: [BigInt(agentId), predictionVaultAddress, buyForData, rawAmount],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: tradingVaultAddress,
          data: executeData,
          chain: activeChain.viemChain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Autonomous prediction share purchase failed";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, tradingVaultAddress, predictionVaultAddress, publicClient]
  );

  const executePredictionClaim = useCallback(
    async (agentId: string, marketId: `0x${string}`): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in.");
        }
        if (!tradingVaultAddress || !predictionVaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const claimForData = encodeFunctionData({
          abi: PREDICTION_VAULT_ABI,
          functionName: "claimWinningsFor",
          args: [address as Address, marketId],
        });

        const executeData = encodeFunctionData({
          abi: TRADING_VAULT_ABI,
          functionName: "executeTrade",
          args: [BigInt(agentId), predictionVaultAddress, claimForData, 0n],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: tradingVaultAddress,
          data: executeData,
          chain: activeChain.viemChain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Autonomous prediction payout claim failed";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, tradingVaultAddress, predictionVaultAddress, publicClient]
  );

  return {
    executePerpTrade,
    executeClosePerpTrade,
    executePredictionBuy,
    executePredictionClaim,
    busy,
    error,
    tradingVaultAddress,
  };
}
