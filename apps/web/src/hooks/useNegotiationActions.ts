"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { usePublicClient } from "wagmi";
import { ensureErc20Allowance } from "@clawdhq/sdk";
import { useWallet } from "./useWallet";
import { useEvmNegotiationAdapter } from "./useEvmNegotiationAdapter";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { sha256Hex } from "@/lib/hash";
import { storeTaskDescription } from "./useMarketplaceActions";

export interface ProposeJobInput {
  employerAgentId: string;
  /** Empty proposes an open negotiation — any agent owner can engage via counterOffer. */
  counterpartyAgentId: string;
  taskDescription: string;
  budgetUsdc: string;
  deadlineDays: number;
}

/** Wraps ClawdHQNegotiation's write methods behind one signature, mirroring
 * `useMarketplaceActions`/`useAgentExchangeActions`. {commit} additionally ensures the Client
 * has approved *Core* (not this contract) for the agreed budget first — Core pulls the funds
 * directly, this contract never custodies them, so the allowance target is Core's address, not
 * the negotiation contract's. */
export function useNegotiationActions() {
  const { chain } = useWallet();
  const evmChain = isEvmChain(chain) ? chain : MONAD_MAINNET;
  const negotiationAdapter = useEvmNegotiationAdapter(evmChain);
  const publicClient = usePublicClient({ chainId: evmChain.viemChain.id });
  const walletClient = usePrivyWalletClient(evmChain);
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
    throw new Error(`Negotiation isn't configured on ${chain.chainName} yet.`);
  }

  async function proposeJob(input: ProposeJobInput): Promise<void> {
    await run(async () => {
      if (!negotiationAdapter) unsupported();
      const taskHash = await sha256Hex(input.taskDescription);
      await storeTaskDescription(taskHash, input.taskDescription);
      await negotiationAdapter.proposeJob({
        employerAgentId: BigInt(input.employerAgentId || "0"),
        counterpartyAgentId: BigInt(input.counterpartyAgentId || "0"),
        taskHash,
        budget: parseUnits(input.budgetUsdc, 6),
        deadlineDays: BigInt(input.deadlineDays),
      });
    });
  }

  async function counterOffer(negotiationId: string, providerAgentId: string, input: Omit<ProposeJobInput, "employerAgentId" | "counterpartyAgentId">): Promise<void> {
    await run(async () => {
      if (!negotiationAdapter) unsupported();
      const taskHash = await sha256Hex(input.taskDescription);
      await storeTaskDescription(taskHash, input.taskDescription);
      await negotiationAdapter.counterOffer({
        negotiationId: BigInt(negotiationId),
        providerAgentId: BigInt(providerAgentId || "0"),
        taskHash,
        budget: parseUnits(input.budgetUsdc, 6),
        deadlineDays: BigInt(input.deadlineDays),
      });
    });
  }

  async function acceptTerms(negotiationId: string): Promise<void> {
    await run(async () => {
      if (!negotiationAdapter) unsupported();
      await negotiationAdapter.acceptTerms(BigInt(negotiationId));
    });
  }

  /** `budgetUsdc` must match the negotiation's already-agreed terms — passed explicitly rather
   * than re-read from the contract so the allowance step below can run before the commit call
   * without an extra round trip. */
  async function commit(negotiationId: string, budgetUsdc: string): Promise<void> {
    await run(async () => {
      if (!negotiationAdapter || !publicClient || !walletClient?.account) unsupported();
      await ensureErc20Allowance(
        { public: publicClient, wallet: walletClient },
        evmChain.usdcAddress as `0x${string}`,
        walletClient.account.address,
        evmChain.contractAddress as `0x${string}`,
        parseUnits(budgetUsdc, 6)
      );
      await negotiationAdapter.commit(BigInt(negotiationId));
    });
  }

  async function withdraw(negotiationId: string): Promise<void> {
    await run(async () => {
      if (!negotiationAdapter) unsupported();
      await negotiationAdapter.withdraw(BigInt(negotiationId));
    });
  }

  return { busy, proposeJob, counterOffer, acceptTerms, commit, withdraw };
}
