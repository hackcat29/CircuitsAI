"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";
import { toIndexerChainSlug, isEvmChain } from "@/lib/chains";

export type ProposalStatus = "active" | "passed" | "rejected" | "quorum_not_met" | "canceled" | "executed";
export type ProposalCategory = "parameters" | "treasury" | "upgrade" | "skill" | "other";

export interface Proposal {
  /** DB row id — used for the /api/governance/proposals/[id] detail lookup. */
  id: string;
  chain?: string;
  /** The on-chain proposal id — used for every on-chain vote()/execute() call. */
  chainProposalId: string;
  title: string;
  description: string;
  category: ProposalCategory;
  proposer: string;
  proposerAgentChainId: string;
  /** USDC (not micros) — ClawdHQGovernor's vote weight is an agent's posted USDC bond. */
  votesFor: number;
  votesAgainst: number;
  quorumRequired: number;
  status: ProposalStatus;
  endTime: number;
  createdAt: number;
  /** On-chain agent ids that have already voted on this proposal — see
   * ClawdHQGovernor.sol: voting identity is per-agent, not per-wallet. */
  votedAgentChainIds: string[];
}

interface ApiProposal {
  id: string;
  chain?: string;
  chainProposalId: string;
  proposer: string;
  proposerAgentChainId: string;
  category: string;
  title: string;
  description: string;
  state: string;
  startTime: string;
  endTime: string;
  quorumRequired: string;
  votesFor: string;
  votesAgainst: string;
  createdAtChain: string;
  updatedAtChain: string;
  votedAgentChainIds: string[];
}

const CATEGORY_FROM_API: Record<string, ProposalCategory> = {
  PARAMETERS: "parameters",
  TREASURY: "treasury",
  UPGRADE: "upgrade",
  SKILL: "skill",
  OTHER: "other",
};

const STATUS_FROM_API: Record<string, ProposalStatus> = {
  ACTIVE: "active",
  SUCCEEDED: "passed",
  DEFEATED: "rejected",
  QUORUM_NOT_MET: "quorum_not_met",
  CANCELED: "canceled",
  EXECUTED: "executed",
};

const USDC_DECIMALS = 1_000_000;

/** The indexer only re-syncs a proposal's cached `state` when a later on-chain event fires
 * (see apps/indexer/src/listeners/evm.ts's syncProposal) — but a proposal's voting window can
 * close with no further votes and nobody ever calling `execute`, so a cached "ACTIVE" row can
 * go stale purely from time passing with no corresponding event. `votesFor`/`votesAgainst` are
 * always fresh as of the last real vote though (and quorum/endTime never change), so recompute
 * the *displayed* status from those directly whenever the window has actually closed, rather
 * than trusting a cached ACTIVE that may just never have been re-synced. Canceled/Executed are
 * left as-is — those only ever change via a real event, and this codebase already accepts the
 * same "cache can lag the source of truth by one missing resync" tradeoff elsewhere (e.g.
 * ListingStatus.EXPIRED).
 */
function effectiveStatus(apiStatus: ProposalStatus, endTime: number, votesFor: number, votesAgainst: number, quorumRequired: number): ProposalStatus {
  if (apiStatus !== "active" || Date.now() < endTime) return apiStatus;
  const total = votesFor + votesAgainst;
  if (total < quorumRequired) return "quorum_not_met";
  return votesFor > votesAgainst ? "passed" : "rejected";
}

function fromApi(proposal: ApiProposal): Proposal {
  const votesFor = Number(BigInt(proposal.votesFor)) / USDC_DECIMALS;
  const votesAgainst = Number(BigInt(proposal.votesAgainst)) / USDC_DECIMALS;
  const quorumRequired = Number(BigInt(proposal.quorumRequired)) / USDC_DECIMALS;
  const endTime = new Date(proposal.endTime).getTime();
  const apiStatus = STATUS_FROM_API[proposal.state] ?? "active";

  return {
    id: proposal.id,
    chain: proposal.chain,
    chainProposalId: proposal.chainProposalId,
    title: proposal.title,
    description: proposal.description,
    category: CATEGORY_FROM_API[proposal.category] ?? "other",
    proposer: proposal.proposer,
    proposerAgentChainId: proposal.proposerAgentChainId,
    votesFor,
    votesAgainst,
    quorumRequired,
    status: effectiveStatus(apiStatus, endTime, votesFor, votesAgainst, quorumRequired),
    endTime,
    createdAt: new Date(proposal.createdAtChain).getTime(),
    votedAgentChainIds: proposal.votedAgentChainIds,
  };
}

/** Reads governance proposals from the indexer's cache (see /api/governance/proposals) —
 * every proposal/vote is real on-chain ClawdHQGovernor state; writes happen directly on-chain
 * via `useGovernanceActions`, never through this hook. Refetches on an interval so newly
 * indexed votes/proposals show up without a manual reload. */
export function useGovernance() {
  const { chain } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const chainSlug = isEvmChain(chain) ? toIndexerChainSlug(chain) : undefined;
      const params = new URLSearchParams({ pageSize: "100" });
      if (chainSlug) params.set("chain", chainSlug);

      const res = await fetch(`/api/governance/proposals?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { proposals: ApiProposal[] };
      setProposals(data.proposals.map(fromApi));
    } finally {
      setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 15_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const activeProposals = proposals.filter((p) => p.status === "active");
  const completedProposals = proposals.filter((p) => p.status !== "active");

  return { proposals, activeProposals, completedProposals, loading, refetch };
}
