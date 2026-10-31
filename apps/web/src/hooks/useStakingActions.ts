"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { parseUnits } from "viem";
import { useWallet } from "./useWallet";
import { useEvmStakingAdapter } from "./useEvmStakingAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

/** Wraps ClawdHQStaking's write methods behind one signature, mirroring
 * `useAgentExchangeActions`/`useLaunchpadActions`. Reads (current bond, required bond) are done
 * directly against `useEvmStakingAdapter` by whichever component needs them — there's no
 * dedicated read hook here, same as the write-only shape those two hooks already use. */
export function useStakingActions() {
  const { chain } = useWallet();
  const evmStakingAdapter = useEvmStakingAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
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
    throw new Error(`Staking isn't configured on ${chain.chainName} yet.`);
  }

  async function postBond(agentId: string, amountUsdc: string): Promise<void> {
    await run(async () => {
      if (!evmStakingAdapter) unsupported();
      await evmStakingAdapter.postBond(BigInt(agentId), parseUnits(amountUsdc, 6));
      toast.success("Bond posted.");
    });
  }

  async function withdrawBond(agentId: string, amountUsdc: string): Promise<void> {
    await run(async () => {
      if (!evmStakingAdapter) unsupported();
      await evmStakingAdapter.withdrawBond(BigInt(agentId), parseUnits(amountUsdc, 6));
      toast.success("Bond withdrawn.");
    });
  }

  return { busy, postBond, withdrawBond };
}
