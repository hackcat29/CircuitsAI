"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { keccak256, encodePacked, type Hex } from "viem";
import { useWallet } from "./useWallet";
import { useEvmEvaluatorPoolAdapter } from "./useEvmEvaluatorPoolAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

/** Wraps ClawdHQEvaluatorPool's write methods behind one signature, mirroring
 * `useAgentExchangeActions`/`useStakingActions`. Commit/reveal salts are generated and
 * persisted in localStorage (keyed by jobId) so a reveal can happen in a later page visit
 * without the caller having to remember their own random salt — losing it before revealing
 * would strand that evaluator's vote (see revealVote's InvalidReveal check). */
const SALT_STORAGE_PREFIX = "circuitsprotocol:evaluator-salt:";

function saltKey(jobId: string, userAddress?: string | null): string {
  const scope = userAddress?.toLowerCase() ? `${userAddress.toLowerCase()}:` : "guest:";
  return `${SALT_STORAGE_PREFIX}${scope}${jobId}`;
}

function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export function useEvaluatorPoolActions() {
  const { chain, address } = useWallet();
  const evaluatorPoolAdapter = useEvmEvaluatorPoolAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
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
    throw new Error(`The evaluator pool isn't configured on ${chain.chainName} yet.`);
  }

  async function registerEvaluator(): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      const bond = await evaluatorPoolAdapter.getRequiredEvaluatorBond();
      await evaluatorPoolAdapter.registerEvaluator(bond);
      toast.success("Registered as an evaluator.");
    });
  }

  async function unregisterEvaluator(): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      await evaluatorPoolAdapter.unregisterEvaluator();
      toast.success("Unregistered, bond returned.");
    });
  }

  async function requestEvaluation(jobId: string): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      const fee = await evaluatorPoolAdapter.getEvaluationRequestFee();
      await evaluatorPoolAdapter.requestEvaluation(BigInt(jobId), fee);
      toast.success("Evaluation requested.");
    });
  }

  /** Generates and locally persists a fresh salt, commits `keccak256(releaseToAgent, salt)`. */
  async function commitVote(jobId: string, releaseToAgent: boolean): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      const salt = randomSalt();
      localStorage.setItem(saltKey(jobId, address), JSON.stringify({ releaseToAgent, salt }));
      const commitHash = keccak256(encodePacked(["bool", "bytes32"], [releaseToAgent, salt]));
      await evaluatorPoolAdapter.commitVote(BigInt(jobId), commitHash);
      toast.success("Vote committed. Remember to come back and reveal before the deadline.");
    });
  }

  /** Reveals using the salt {commitVote} saved locally — throws if it's missing (e.g. a
   * different browser/device than the one that committed). */
  async function revealVote(jobId: string): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      const raw = localStorage.getItem(saltKey(jobId, address));
      if (!raw) throw new Error("No saved vote found for this job on this device. Reveal must happen from the same browser that committed.");
      const { releaseToAgent, salt } = JSON.parse(raw) as { releaseToAgent: boolean; salt: Hex };
      await evaluatorPoolAdapter.revealVote(BigInt(jobId), releaseToAgent, salt);
      localStorage.removeItem(saltKey(jobId, address));
      toast.success("Vote revealed.");
    });
  }

  function hasPendingReveal(jobId: string): boolean {
    if (!address) return false;
    return localStorage.getItem(saltKey(jobId, address)) !== null;
  }

  async function finalize(jobId: string): Promise<void> {
    await run(async () => {
      if (!evaluatorPoolAdapter) unsupported();
      await evaluatorPoolAdapter.finalize(BigInt(jobId));
      toast.success("Case finalized.");
    });
  }

  return { busy, registerEvaluator, unregisterEvaluator, requestEvaluation, commitVote, revealVote, hasPendingReveal, finalize };
}
