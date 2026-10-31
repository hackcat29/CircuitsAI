"use client";

import { useEffect, useState } from "react";
import type { BuybackInterval } from "@clawdhq/sdk";
import { useWallet } from "./useWallet";
import { useEvmAdapter } from "./useEvmAdapter";
import { useEvmLaunchpadAdapter } from "./useEvmLaunchpadAdapter";
import { BASE_SEPOLIA, isEvmChain, toIndexerChainSlug, type EvmChainConfig } from "@/lib/chains";
import { EVM_TOKEN_DECIMALS_FACTOR } from "@/lib/bondingCurve";

const MAX_RECENT_LAUNCHES = 20;

export interface MarketplaceLaunch {
  id: string;
  numericId: string;
  agentId: string;
  token: string;
  creator: string;
  name: string;
  symbol: string;
  tokensSold: bigint;
  usdcRaised: bigint;
  graduationThreshold: bigint;
  /** USDC (6dec), fixed at creation — the v3 constant-product curve's starting virtual reserve
   * (see ClawdHQLaunchpad.sol's contract-level doc comment and lib/bondingCurve.ts). */
  initialVirtualUsdcReserve: bigint;
  graduated: boolean;
  active: boolean;
  buybackPoolUsdc: bigint;
  buybackBps: number;
  /** Fixed at creation or adjusted by owner — the chosen buyback cadence. */
  buybackInterval: BuybackInterval;
  /** Unix seconds — executeBuyback reverts until this passes. */
  nextBuybackAt: bigint;
  tokenDecimals: number;
  tokenDecimalsFactor: bigint;
  /** Unix seconds — buyTokens/sellTokens revert (LaunchNotStarted) on-chain before this. The
   * real, authoritative gate — see ClawdHQLaunchpad.sol's AgentLaunch.tradingStartsAt doc
   * comment. Unlike `scheduledAt` below, this comes straight from `getLaunch` (already part of
   * the on-chain read this hook does anyway), not a separate off-chain annotation fetch. */
  tradingStartsAt: bigint;
  /** Off-chain-only scheduling metadata (see packages/marketplace-db's ScheduledLaunch) — pure
   * UI countdown/discovery-hiding annotation, not the enforcement mechanism (tradingStartsAt
   * above is). null means either never scheduled, or the scheduled time has already passed. */
  scheduledAt: string | null;
}

/** Batch-fetches ScheduledLaunch rows for the given launches and merges them in — one extra
 * request per useLaunches() call instead of one per launch. Failing open (no schedules) on
 * any error, since this is UI-only metadata and shouldn't block the real on-chain launch list
 * from rendering. */
async function withSchedules(chain: EvmChainConfig, launches: MarketplaceLaunch[]): Promise<MarketplaceLaunch[]> {
  if (launches.length === 0) return launches;
  try {
    const chainSlug = toIndexerChainSlug(chain);
    const ids = launches.map((l) => l.numericId).join(",");
    const res = await fetch(`/api/exchange/scheduled-launches?chain=${chainSlug}&launchChainIds=${ids}`);
    if (!res.ok) return launches;
    const { schedules } = (await res.json()) as { schedules: Record<string, string> };
    return launches.map((l) => ({ ...l, scheduledAt: schedules[l.numericId] ?? null }));
  } catch {
    return launches;
  }
}

export interface LaunchesState {
  loading: boolean;
  launches: MarketplaceLaunch[];
}

export function useLaunches(): LaunchesState {
  const { chain } = useWallet();
  const evmAdapter = useEvmAdapter(isEvmChain(chain) ? chain : BASE_SEPOLIA);
  const evmLaunchpadAdapter = useEvmLaunchpadAdapter(isEvmChain(chain) ? chain : BASE_SEPOLIA);

  const [state, setState] = useState<LaunchesState>({ loading: true, launches: [] });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    async function load(): Promise<LaunchesState> {
      if (!evmAdapter || !evmLaunchpadAdapter) return { loading: false, launches: [] };

      const stats = await evmAdapter.getProtocolStats();
      const total = stats.totalLaunches;
      if (total === 0n) return { loading: false, launches: [] };
      const fromId = total > BigInt(MAX_RECENT_LAUNCHES) ? total - BigInt(MAX_RECENT_LAUNCHES) + 1n : 1n;
      const ids = bigintRange(fromId, total).reverse();
      const launches = await Promise.all(ids.map((id) => evmLaunchpadAdapter.getLaunch(id)));
      return {
        loading: false,
        launches: await withSchedules(
          chain as EvmChainConfig,
          launches.map((launch) => ({
            ...launch,
            id: launch.launchId,
            numericId: launch.launchId,
            tokenDecimals: 18,
            tokenDecimalsFactor: EVM_TOKEN_DECIMALS_FACTOR,
            scheduledAt: null,
          })),
        ),
      };
    }

    load()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, launches: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [chain, evmAdapter, evmLaunchpadAdapter]);

  return state;
}

function bigintRange(from: bigint, to: bigint): bigint[] {
  const result: bigint[] = [];
  for (let i = from; i <= to; i++) result.push(i);
  return result;
}
