"use client";

import { useEffect, useState } from "react";
import { useWallet } from "./useWallet";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";

export interface MyAgentSummary {
  id: string;
  numericId: string;
  name: string;
  owner: string;
  active: boolean;
  tier: number;
  jobsCompleted: number;
  jobsFailed: number;
  reputationBps: number;
  usdcRevenue: string;
  lastJobAt: string | null;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
  createdAtChain: string;
  updatedAtChain: string;
  raw: unknown;
}

export interface MyAgentsState {
  loading: boolean;
  agents: MyAgentSummary[];
  /** True when the /api/agents read failed — distinct from `agents: []` genuinely meaning
   * the connected wallet owns nothing on this chain. */
  error: boolean;
  retry: () => void;
}

interface ApiAgentResponse {
  agentId: string;
  owner: string;
  name: string;
  agentUri: string;
  endpoint: string;
  metadataHash: string;
  active: boolean;
  tier: number;
  jobsCompleted: number;
  jobsFailed: number;
  reputationBps: number;
  usdcRevenue: string;
  lastJobAt: string | null;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
  createdAtChain: string;
  updatedAtChain: string;
}

/** Fetches the connected wallet's agents on whichever chain is currently active, from the
 * indexer's Agent cache (GET /api/agents/[chain]?owner=...) rather than live RPC — see
 * useRankings.ts's doc comment for why. "My Agents" is scoped to the active chain rather than
 * queried across every chain, since an agent registered on one chain has no presence on the
 * others. */
export function useMyAgents(): MyAgentsState {
  const { chain, address, isConnected } = useWallet();
  const chainSlug = toIndexerChainSlug(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [reloadKey, setReloadKey] = useState(0);

  const [state, setState] = useState<Omit<MyAgentsState, "retry">>({ loading: false, agents: [], error: false });

  useEffect(() => {
    if (!isConnected || !address) {
      setState({ loading: false, agents: [], error: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    fetch(`/api/agents/${chainSlug}?owner=${address}`)
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/agents/${chainSlug} -> ${res.status}`);
        return res.json() as Promise<{ agents: ApiAgentResponse[] }>;
      })
      .then(({ agents }) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: false,
          agents: agents.map((agent) => ({
            id: agent.agentId,
            numericId: agent.agentId,
            name: agent.name,
            owner: agent.owner,
            active: agent.active,
            tier: agent.tier ?? 1,
            jobsCompleted: agent.jobsCompleted ?? 0,
            jobsFailed: agent.jobsFailed ?? 0,
            reputationBps: agent.reputationBps ?? 0,
            usdcRevenue: agent.usdcRevenue ?? "0",
            lastJobAt: agent.lastJobAt ?? null,
            supportsX402: agent.supportsX402 ?? false,
            supportsA2A: agent.supportsA2A ?? false,
            supportsMcp: agent.supportsMcp ?? false,
            createdAtChain: agent.createdAtChain ?? new Date().toISOString(),
            updatedAtChain: agent.updatedAtChain ?? new Date().toISOString(),
            raw: agent,
          })),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, agents: [], error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [chainSlug, address, isConnected, reloadKey]);

  return { ...state, retry: () => setReloadKey((k) => k + 1) };
}
