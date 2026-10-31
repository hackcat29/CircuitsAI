"use client";

import { useState, useCallback, useEffect } from "react";
import { parseUnits, encodeFunctionData, type Address, type Hash, createPublicClient, http } from "viem";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { env } from "@/lib/env";

const PERP_VAULT_ABI = [
  {
    type: "function",
    name: "depositLiquidity",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "sharesMinted", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawLiquidity",
    inputs: [{ name: "sharesToBurn", type: "uint256" }],
    outputs: [{ name: "usdcReturned", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "openPosition",
    inputs: [
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "collateralUsdc", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "acceptablePrice", type: "uint256" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [{ name: "positionKey", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closePosition",
    inputs: [
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
  {
    type: "function",
    name: "getPosition",
    inputs: [
      { name: "trader", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trader", type: "address" },
          { name: "symbol", type: "string" },
          { name: "isLong", type: "bool" },
          { name: "collateralUsdc", type: "uint256" },
          { name: "sizeUsdc", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "leverage", type: "uint256" },
          { name: "openedAt", type: "uint256" },
          { name: "lastUpdatedBlock", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTraderPositions",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "trader", type: "address" },
          { name: "symbol", type: "string" },
          { name: "isLong", type: "bool" },
          { name: "collateralUsdc", type: "uint256" },
          { name: "sizeUsdc", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "leverage", type: "uint256" },
          { name: "openedAt", type: "uint256" },
          { name: "lastUpdatedBlock", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUnrealizedPnl",
    inputs: [
      { name: "trader", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [
      { name: "pnlUsdc", type: "int256" },
      { name: "markPrice", type: "uint256" },
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

export interface OnchainPerpPosition {
  trader: string;
  symbol: string;
  isLong: boolean;
  collateralUsdc: number;
  sizeUsdc: number;
  entryPrice: number;
  leverage: number;
  openedAt: number;
}

export function useCircuitsPerps() {
  const { chain, address } = useWallet();
  const activeChain = chain && isEvmChain(chain) ? chain : MONAD_MAINNET;
  const walletClient = usePrivyWalletClient(activeChain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onchainPositions, setOnchainPositions] = useState<OnchainPerpPosition[]>([]);

  const vaultAddress: Address = (activeChain.perpVaultAddress || "") as Address;

  const usdcAddress: Address = (activeChain.usdcAddress || "") as Address;

  const publicClient = createPublicClient({
    chain: activeChain.viemChain,
    transport: http(activeChain.rpcUrl),
  });

  const normalizePerpSymbol = (sym: string): string => {
    const clean = sym.toUpperCase().replace("-USDC", "").replace("/USDC", "").replace("-PERP", "");
    return `${clean}-PERP`;
  };

  const fetchOnchainPositions = useCallback(async () => {
    if (!address || !vaultAddress) return;
    try {
      const res = (await publicClient.readContract({
        address: vaultAddress,
        abi: PERP_VAULT_ABI,
        functionName: "getTraderPositions",
        args: [address as Address],
      })) as any[];

      if (Array.isArray(res)) {
        const formatted: OnchainPerpPosition[] = res
          .filter((p) => Number(p.collateralUsdc) > 0)
          .map((p) => ({
            trader: p.trader,
            symbol: p.symbol,
            isLong: p.isLong,
            collateralUsdc: Number(p.collateralUsdc) / 1e6,
            sizeUsdc: Number(p.sizeUsdc) / 1e6,
            entryPrice: Number(p.entryPrice) / 1e8,
            leverage: Number(p.leverage),
            openedAt: Number(p.openedAt),
          }));
        setOnchainPositions(formatted);
      }
    } catch {
      // Keep state
    }
  }, [address, vaultAddress, publicClient]);

  useEffect(() => {
    void fetchOnchainPositions();
    const interval = setInterval(() => void fetchOnchainPositions(), 15_000);
    return () => clearInterval(interval);
  }, [fetchOnchainPositions]);

  const openPosition = useCallback(
    async (params: {
      symbol: string;
      isLong: boolean;
      collateralUsdc: number;
      leverage: number;
      acceptablePrice?: number;
      markPrice: number;
    }): Promise<{ txHash: Hash }> => {
      setBusy(true);
      setError(null);
      try {
        if (!walletClient || !address) {
          throw new Error("Please sign in to execute trade.");
        }
        if (!vaultAddress) {
          throw new Error("This feature isn't available on the current network.");
        }

        const symbol = normalizePerpSymbol(params.symbol);
        const rawCollateral = parseUnits(params.collateralUsdc.toString(), 6);
        const rawMarkPrice = parseUnits(params.markPrice.toFixed(4), 8);
        const rawAcceptablePrice = params.acceptablePrice
          ? parseUnits(params.acceptablePrice.toFixed(4), 8)
          : 0n;

        // 1. Check & Approve USDC if needed
        const allowance = (await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as Address, vaultAddress],
        })) as bigint;

        if (allowance < rawCollateral) {
          const approveData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [vaultAddress, rawCollateral * 100n],
          });

          await walletClient.sendTransaction({
            account: address as Address,
            to: usdcAddress,
            data: approveData,
            chain: activeChain.viemChain,
          });
        }

        // 2. Open Position on Vault
        const openData = encodeFunctionData({
          abi: PERP_VAULT_ABI,
          functionName: "openPosition",
          args: [
            symbol,
            params.isLong,
            rawCollateral,
            BigInt(params.leverage),
            rawAcceptablePrice,
            rawMarkPrice,
          ],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: vaultAddress,
          data: openData,
          chain: activeChain.viemChain,
        });

        void fetchOnchainPositions();
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Failed to open perpetual position";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, vaultAddress, usdcAddress, publicClient, fetchOnchainPositions],
  );

  const closePosition = useCallback(
    async (params: {
      symbol: string;
      isLong: boolean;
      acceptablePrice?: number;
      markPrice: number;
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

        const symbol = normalizePerpSymbol(params.symbol);
        const rawMarkPrice = parseUnits(params.markPrice.toFixed(4), 8);
        const rawAcceptablePrice = params.acceptablePrice
          ? parseUnits(params.acceptablePrice.toFixed(4), 8)
          : 0n;

        const closeData = encodeFunctionData({
          abi: PERP_VAULT_ABI,
          functionName: "closePosition",
          args: [symbol, params.isLong, rawAcceptablePrice, rawMarkPrice],
        });

        const txHash = await walletClient.sendTransaction({
          account: address as Address,
          to: vaultAddress,
          data: closeData,
          chain: activeChain.viemChain,
        });

        void fetchOnchainPositions();
        return { txHash };
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Failed to close perpetual position";
        setError(msg);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [walletClient, address, vaultAddress, fetchOnchainPositions],
  );

  return {
    openPosition,
    closePosition,
    onchainPositions,
    refetchPositions: fetchOnchainPositions,
    busy,
    error,
    vaultAddress,
  };
}
