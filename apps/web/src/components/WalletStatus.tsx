"use client";

import { useEvmAdapter, useWallet } from "@/hooks";
import { BASE_SEPOLIA } from "@/lib/chains";

/** Temporary smoke-test widget for the wallet hooks; superseded by the real layout shell's
 * wallet button in a later phase. */
export function WalletStatus() {
  const wallet = useWallet();
  const evmAdapter = useEvmAdapter(BASE_SEPOLIA);

  return (
    <div className="text-sm text-text-secondary">
      <p>Active chain: {wallet.chain.chainName}</p>
      <p>Connected: {wallet.isConnected ? wallet.address : "no"}</p>
      <p>Adapter ready: evm={String(Boolean(evmAdapter))}</p>
    </div>
  );
}
