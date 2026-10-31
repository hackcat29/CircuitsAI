"use client";

import { usePrivy, useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { SOCIAL_SESSION_QUERY_KEY } from "./useSocialSession";
import { clearAppUserSession } from "@/lib/sessionCleanup";

export interface EvmWalletState {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;
  connectorName: string | undefined;
  disconnect: () => void;
}

/** "Connected" means signed in via Privy (Email Login) with the embedded EVM wallet — never an
 * injected/external wallet that happens to be linked to the account (see usePrivyWalletClient.ts
 * for why `wallets[0]`/`user.wallet` aren't safe here). */
export function useEvmWallet(): EvmWalletState {
  const { authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const activeWalletAddress = getEmbeddedConnectedWallet(wallets)?.address as `0x${string}` | undefined;

  return {
    address: activeWalletAddress,
    isConnected: Boolean(authenticated && activeWalletAddress),
    isConnecting: false,
    chainId: undefined,
    connectorName: activeWalletAddress ? "privy-email-auth" : undefined,
    disconnect: () => {
      void clearAppUserSession(queryClient).then(() => {
        void logout();
      });
    },
  };
}
