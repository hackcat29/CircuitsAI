"use client";

import { getChainById, type EvmChainConfig } from "@/lib/chains";
import { useActiveChain } from "./useActiveChain";
import { useEvmWallet } from "./useEvmWallet";

export interface UnifiedWalletState {
  chain: EvmChainConfig;
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  disconnect: () => void;
}

export function useWallet(): UnifiedWalletState {
  const { activeChainId } = useActiveChain();
  const evm = useEvmWallet();

  const chain = getChainById(activeChainId);
  if (!chain) {
    throw new Error(`Unknown active chain id: ${String(activeChainId)}`);
  }

  return {
    chain,
    address: evm.address,
    isConnected: evm.isConnected,
    isConnecting: evm.isConnecting,
    disconnect: evm.disconnect,
  };
}
