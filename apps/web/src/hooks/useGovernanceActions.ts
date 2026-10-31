"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "./useWallet";
import { useEvmGovernorAdapter } from "./useEvmGovernorAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

export interface CreateProposalInput {
  proposerAgentId: string;
  title: string;
  description: string;
  /** 0=Parameters,1=Treasury,2=Upgrade,3=Skill,4=Other */
  category: number;
  votingPeriodDays: number;
}

/** Wraps ClawdHQGovernor's write methods behind one signature, mirroring
 * `useAgentExchangeActions`/`useStakingActions`. Every action is signed from the connected
 * wallet's own agent — see ClawdHQGovernor.sol's NatSpec on why identity is per-agent, not
 * per-wallet. */
export function useGovernanceActions() {
  const { chain, address } = useWallet();
  const governorAdapter = useEvmGovernorAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  function unsupported(): never {
    throw new Error(`Governance isn't available on ${chain.chainName} yet.`);
  }

  async function createProposal(input: CreateProposalInput): Promise<void> {
    await run(async () => {
      if (!governorAdapter) unsupported();
      await governorAdapter.createProposal({
        proposerAgentId: BigInt(input.proposerAgentId),
        title: input.title,
        description: input.description,
        category: input.category,
        votingPeriodSeconds: BigInt(input.votingPeriodDays * 86_400),
      });
      toast.success("Proposal submitted on-chain.");
    });
  }

  async function vote(proposalId: string, voterAgentId: string, support: boolean): Promise<void> {
    await run(async () => {
      if (!governorAdapter) unsupported();
      await governorAdapter.vote(BigInt(proposalId), BigInt(voterAgentId), support);
      toast.success(support ? "Vote cast: for." : "Vote cast: against.");
    });
  }

  /** Ratification only — see ClawdHQGovernor.sol's NatSpec. Records the outcome on-chain; it
   * does not itself carry out the protocol change a proposal describes. */
  async function execute(proposalId: string): Promise<void> {
    await run(async () => {
      if (!governorAdapter) unsupported();
      await governorAdapter.execute(BigInt(proposalId));
      toast.success("Proposal ratified on-chain.");
    });
  }

  return { busy, address, createProposal, vote, execute };
}
