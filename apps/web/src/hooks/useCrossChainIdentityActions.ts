"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useWallet } from "./useWallet";
import { useEvmCrossChainIdentityAdapter } from "./useEvmCrossChainIdentityAdapter";
import { BASE_SEPOLIA, isEvmChain } from "@/lib/chains";

/** Wraps ClawdHQCrossChainIdentity's write methods behind one signature, mirroring
 * `useNegotiationActions`/`useStakingActions`. Both actions run against whichever chain the
 * connected wallet is currently on — {registerLink} originates (or idempotently re-broadcasts)
 * a link *from* that chain; {claimLocalAgent} attaches a local agent *on* that chain to a
 * globalId established elsewhere. Neither moves any USDC — no allowance step needed. */
export function useCrossChainIdentityActions() {
  const { chain } = useWallet();
  const evmChain = isEvmChain(chain) ? chain : BASE_SEPOLIA;
  const adapter = useEvmCrossChainIdentityAdapter(evmChain);
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
    throw new Error(`Cross-chain identity isn't configured on ${chain.chainName} yet.`);
  }

  async function registerLink(localAgentId: string): Promise<void> {
    await run(async () => {
      if (!adapter) unsupported();
      await adapter.registerLink(BigInt(localAgentId));
    });
  }

  async function claimLocalAgent(globalId: Hex, localAgentId: string): Promise<void> {
    await run(async () => {
      if (!adapter) unsupported();
      await adapter.claimLocalAgent(globalId, BigInt(localAgentId));
    });
  }

  return { busy, registerLink, claimLocalAgent };
}
