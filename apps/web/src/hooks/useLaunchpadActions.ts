"use client";

import { useState } from "react";
import type { BuybackInterval } from "@clawdhq/sdk";
import { useWallet } from "./useWallet";
import { useEvmLaunchpadAdapter } from "./useEvmLaunchpadAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

export interface CreateLaunchInput {
  agentId: string;
  name: string;
  symbol: string;
  /** Chosen buyback cadence (e.g. MONTHLY). */
  buybackInterval: BuybackInterval;
  /** Percentage of Agent Operating Treasury to spend per buyback (basis points, e.g. 2000 = 20%). */
  buybackBps?: number;
  /** Unix seconds trading should open at; undefined/0/past means immediately. Enforced on-chain
   * by buyTokens/sellTokens (LaunchNotStarted) — not just a UI countdown. */
  launchAt?: bigint;
}

/** Wraps the EVM SDK adapter's launchpad methods behind one signature, mirroring
 * `useMarketplaceActions`. */
export function useLaunchpadActions() {
  const { chain } = useWallet();
  const evmLaunchpadAdapter = useEvmLaunchpadAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  /** Returns the new launch's real numeric id (string), resolved from the `LaunchCreated`
   * event in the createLaunch transaction's own receipt (see
   * EvmLaunchpadAdapter.waitForLaunchCreation). */
  async function createLaunch(input: CreateLaunchInput, options?: { needsLaunchId?: boolean }): Promise<string> {
    return run(async () => {
      if (!evmLaunchpadAdapter) throw new Error("No wallet connected for the active chain.");

      const txHash = await evmLaunchpadAdapter.createLaunch({
        agentId: BigInt(input.agentId),
        name: input.name,
        symbol: input.symbol,
        buybackInterval: input.buybackInterval,
        buybackBps: input.buybackBps ?? 2000,
        launchAt: input.launchAt,
      });
      if (!options?.needsLaunchId) return "";
      const launchId = await evmLaunchpadAdapter.waitForLaunchCreation(txHash);
      return launchId.toString();
    });
  }

  async function setBuybackConfig(launchId: string, interval: BuybackInterval, buybackBps: number): Promise<void> {
    await run(async () => {
      if (!evmLaunchpadAdapter) return;
      await evmLaunchpadAdapter.setBuybackConfig(BigInt(launchId), interval, buybackBps);
    });
  }

  async function buyTokens(launchId: string, usdcAmount: bigint, minTokensOut: bigint): Promise<string> {
    return await run(async () => {
      if (!evmLaunchpadAdapter) throw new Error("No wallet connected for the active chain.");
      const txHash = await evmLaunchpadAdapter.buyTokens(BigInt(launchId), usdcAmount, minTokensOut);
      return txHash as string;
    });
  }

  async function sellTokens(
    launchId: string,
    tokenAmount: bigint,
    minUsdcOut: bigint,
    tokenAddress?: string
  ): Promise<string> {
    return await run(async () => {
      if (!evmLaunchpadAdapter) throw new Error("No wallet connected for the active chain.");
      const txHash = await evmLaunchpadAdapter.sellTokens(
        BigInt(launchId),
        tokenAmount,
        minUsdcOut,
        tokenAddress as `0x${string}` | undefined
      );
      return txHash as string;
    });
  }

  async function graduateLaunch(launchId: string): Promise<void> {
    await run(async () => {
      if (!evmLaunchpadAdapter) return;
      await evmLaunchpadAdapter.graduateLaunch(BigInt(launchId));
    });
  }

  async function startTradingNow(launchId: string): Promise<void> {
    await run(async () => {
      if (!evmLaunchpadAdapter) return;
      await evmLaunchpadAdapter.startTradingNow(BigInt(launchId));
    });
  }

  /** Permissionless — spends the configured percentage of the agent operating treasury
   * to repurchase-and-burn tokens from the curve at the current price. */
  async function executeBuyback(launchId: string): Promise<void> {
    await run(async () => {
      if (!evmLaunchpadAdapter) return;
      await evmLaunchpadAdapter.executeBuyback(BigInt(launchId));
    });
  }

  return { busy, createLaunch, setBuybackConfig, buyTokens, sellTokens, graduateLaunch, executeBuyback, startTradingNow };
}
