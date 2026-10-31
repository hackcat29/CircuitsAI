"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";

export interface RankedAgent {
  id: string;
  name: string;
  owner?: string;
  active: boolean;
  tier?: number;
  jobsCompleted: number;
  reputationBps: number;
  rawReputationBps?: number;
  metadataHash: string;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
  agentUri: string;
  usdcRevenue?: string;
  grade?: string;
  gradeLabel?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenUsdcRaised?: string;
  isTokenGraduated?: boolean;
}

export interface RankingsState {
  loading: boolean;
  loadingMore: boolean;
  agents: RankedAgent[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  /** True when the /api/agents read failed — distinct from `agents: []` genuinely meaning
   * zero agents registered. Callers should show a retry affordance rather than an empty
   * state when this is set. */
  error: boolean;
  retry: () => void;
}

interface ApiAgent {
  agentId: string;
  name: string;
  owner?: string;
  active: boolean;
  tier?: number;
  jobsCompleted: number;
  reputationBps: number;
  rawReputationBps?: number;
  metadataHash: string;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
  agentUri: string;
  usdcRevenue?: string;
  grade?: string;
  gradeLabel?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenUsdcRaised?: string;
  isTokenGraduated?: boolean;
}

const PAGE_SIZE = 50;

function toRankedAgent(a: ApiAgent): RankedAgent {
  return {
    id: a.agentId,
    name: a.name,
    owner: a.owner,
    active: a.active,
    tier: a.tier ?? 1,
    jobsCompleted: a.jobsCompleted,
    reputationBps: a.reputationBps,
    rawReputationBps: a.rawReputationBps ?? 0,
    metadataHash: a.metadataHash,
    supportsX402: a.supportsX402,
    supportsA2A: a.supportsA2A,
    supportsMcp: a.supportsMcp,
    agentUri: a.agentUri,
    usdcRevenue: a.usdcRevenue,
    grade: a.grade,
    gradeLabel: a.gradeLabel,
    tokenSymbol: a.tokenSymbol,
    tokenName: a.tokenName,
    tokenUsdcRaised: a.tokenUsdcRaised,
    isTokenGraduated: a.isTokenGraduated,
  };
}

function rank(agents: RankedAgent[], sortBy: "reputation" | "jobs" | "revenue" = "reputation"): RankedAgent[] {
  if (sortBy === "jobs") {
    return [...agents].sort((a, b) => b.jobsCompleted - a.jobsCompleted || b.reputationBps - a.reputationBps);
  }
  if (sortBy === "revenue") {
    return [...agents].sort((a, b) => Number(b.usdcRevenue || 0) - Number(a.usdcRevenue || 0) || b.reputationBps - a.reputationBps);
  }
  return [...agents].sort((a, b) => b.reputationBps - a.reputationBps || b.jobsCompleted - a.jobsCompleted);
}

/** Ranks agents by reputation, revenue, or jobs completed for the active chain. Reads from the
 * indexer's Agent cache (GET /api/agents/[chain]) rather than live RPC. */
export function useRankings(options: { paginate?: boolean; sortBy?: "reputation" | "jobs" | "revenue" } = {}): RankingsState {
  const paginate = options.paginate ?? false;
  const sortBy = options.sortBy ?? "reputation";
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const [state, setState] = useState<Omit<RankingsState, "retry" | "loadMore">>({
    loading: true,
    loadingMore: false,
    agents: [],
    total: 0,
    hasMore: false,
    error: false,
  });

  const fetchPage = useCallback(
    (offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setState((prev) => ({ ...prev, loading: replace, loadingMore: !replace }));

      const params = paginate ? `?pageSize=${PAGE_SIZE}&offset=${offset}&sortBy=${sortBy}` : `?sortBy=${sortBy}`;
      fetch(`/api/agents/${chainSlug}${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`GET /api/agents/${chainSlug} -> ${res.status}`);
          return res.json() as Promise<{ agents: ApiAgent[]; total?: number; hasMore?: boolean }>;
        })
        .then(({ agents, total, hasMore }) => {
          if (requestId !== requestIdRef.current) return; // superseded by a newer request — discard
          const mapped = agents.map(toRankedAgent);
          const newPage = rank(mapped, sortBy);
          setState((prev) => ({
            loading: false,
            loadingMore: false,
            error: false,
            agents: replace ? newPage : rank([...prev.agents, ...newPage], sortBy),
            total: total ?? newPage.length,
            hasMore: hasMore ?? false,
          }));
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setState({ loading: false, loadingMore: false, agents: [], total: 0, hasMore: false, error: true });
        });
    },
    [chainSlug, paginate, sortBy]
  );

  useEffect(() => {
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainSlug, paginate, sortBy, reloadKey]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.loading || prev.loadingMore || !prev.hasMore) return prev;
      fetchPage(prev.agents.length, false);
      return prev;
    });
  }, [fetchPage]);

  return { ...state, loadMore, retry: () => setReloadKey((k) => k + 1) };
}
