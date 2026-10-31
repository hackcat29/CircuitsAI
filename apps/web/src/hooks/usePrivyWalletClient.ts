"use client";

import { useEffect, useState } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import type { EvmChainConfig } from "@/lib/chains";

/** Builds a viem WalletClient powered by Privy's embedded wallet — never an injected/external
 * one (e.g. a MetaMask browser extension), even if the signed-in user happens to have one linked
 * to their Privy account. Login is email-only (see PrivyAppProvider's loginMethods) and every
 * custody assumption elsewhere in this app is built around the embedded wallet only, so falling
 * back to `wallets[0]` here is unsafe: if an external wallet sorts first, switchChain() drives
 * that extension's real approval popup instead of the silent embedded-wallet chain switch, which
 * either stacks "already pending" RPC errors or the user rejecting a prompt they never expected.
 * Returns `undefined` until Privy has loaded and the embedded wallet is connected. */
export function usePrivyWalletClient(chain: EvmChainConfig): WalletClient | undefined {
  const { wallets } = useWallets();
  const activeWallet = getEmbeddedConnectedWallet(wallets) ?? undefined;
  const [walletClient, setWalletClient] = useState<WalletClient | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    if (!activeWallet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWalletClient(undefined);
      return;
    }

    (async () => {
      try {
        // Privy's embedded wallet defaults to Ethereum mainnet (chain id 1) and doesn't follow
        // whatever chain the app is targeting — without an explicit switch, viem throws
        // ChainMismatchError ("current chain of the wallet ... does not match the target chain")
        // the instant a write/signature is attempted on any other chain (i.e. every chain this
        // app actually uses). Per Privy's own docs, switchChain() does NOT update any
        // already-issued provider instance, so getEthereumProvider() must be re-requested after
        // it resolves — reusing a provider fetched before the switch silently keeps the old chain.
        await activeWallet.switchChain(chain.viemChain.id);
        if (cancelled) return;

        const ethereumProvider = await activeWallet.getEthereumProvider();
        if (cancelled) return;

        const client = createWalletClient({
          account: activeWallet.address as `0x${string}`,
          chain: chain.viemChain,
          transport: custom(ethereumProvider),
        });
        setWalletClient(client);
      } catch (err) {
        console.error("Failed to build Privy wallet client:", err);
        if (!cancelled) setWalletClient(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWallet, chain.viemChain]);

  return walletClient;
}
