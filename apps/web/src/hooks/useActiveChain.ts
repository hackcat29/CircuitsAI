"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MONAD_MAINNET, SELECTABLE_CHAINS, type ChainId } from "@/lib/chains";

interface ActiveChainStore {
  activeChainId: ChainId;
  setActiveChainId: (chainId: ChainId) => void;
}

function getDefaultChainId(): ChainId {
  return MONAD_MAINNET.chainId;
}

export const useActiveChainStore = create<ActiveChainStore>()(
  persist(
    (set) => ({
      activeChainId: MONAD_MAINNET.chainId,
      setActiveChainId: (chainId) => set({ activeChainId: chainId }),
    }),
    { name: "circuitsprotocol-active-chain" },
  ),
);

function isSelectable(chainId: ChainId): boolean {
  return SELECTABLE_CHAINS.some((c) => c.chainId === chainId);
}

/** The chain the user has selected in the UI as their current ecosystem (Monad Mainnet).
 * Coerces to Monad Mainnet if a previously persisted active chain is no longer selectable. */
export function useActiveChain() {
  const activeChainId = useActiveChainStore((s) => s.activeChainId);
  const setActiveChainId = useActiveChainStore((s) => s.setActiveChainId);

  useEffect(() => {
    if (!isSelectable(activeChainId)) setActiveChainId(getDefaultChainId());
  }, [activeChainId, setActiveChainId]);

  return { activeChainId: isSelectable(activeChainId) ? activeChainId : getDefaultChainId(), setActiveChainId };
}
