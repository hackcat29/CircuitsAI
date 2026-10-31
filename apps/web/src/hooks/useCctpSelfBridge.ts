"use client";

import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import { env } from "@/lib/env";
import { socialFetch } from "@/lib/social/api";
import type { EvmChainConfig } from "@/lib/chains";
import { toIndexerChainSlug } from "@/lib/chains";
import { useEvmCctpAdapter } from "./useEvmCctpAdapter";

export type CctpBridgePhase = "idle" | "burning" | "relaying" | "awaiting-attestation" | "complete" | "error";

interface IrisMessageEntry {
  status: "complete" | "pending_confirmations";
}
interface IrisMessagesResponse {
  messages: IrisMessageEntry[];
}

const POLL_INTERVAL_MS = 5_000;
// Bounds how long this tab polls Iris for visible progress, not how long the bridge itself can
// take — Circle's "standard" (free) CCTP v2 finality is slower on Ethereum Sepolia than on
// Base's fast L2 finality. The indexer's own relayer (unbounded, background) completes the mint
// regardless of whether this tab is still open; giving up here just stops the status narration.
const MAX_POLL_ATTEMPTS = 60; // 5 minutes

/** Bridges USDC from the signed-in owner's own Circle wallet on `sourceChain` to the same
 * address on `destinationChain`, via CCTP v2's burn-and-mint at standard (free) finality. Only
 * one signature is ever asked for — the burn on `sourceChain`. The mint on `destinationChain` is
 * completed by the indexer's already-running relayer (see
 * apps/indexer/src/relayers/crossChainIdentity.ts — generic to any tracked (chain, txHash), not
 * specific to ClawdHQCrossChainIdentity's own messages) once `/api/circle/wallet/self-bridge`
 * hands off the burn transaction hash. This hook polls Iris directly afterward purely to narrate
 * progress in the UI; it never itself submits a destination-chain transaction. */
export function useCctpSelfBridge(sourceChain: EvmChainConfig, destinationChain: EvmChainConfig, ownerAddress: string | undefined) {
  const adapter = useEvmCctpAdapter(sourceChain);
  const [phase, setPhase] = useState<CctpBridgePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setBurnTxHash(null);
  }, []);

  async function pollForAttestation(txHash: string): Promise<void> {
    if (!env.NEXT_PUBLIC_CIRCLE_IRIS_API_URL) return; // no polling URL configured — skip narration, relayer still completes it
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${env.NEXT_PUBLIC_CIRCLE_IRIS_API_URL}/v2/messages/${sourceChain.cctpDomain}?transactionHash=${txHash}`);
      if (response.ok) {
        const data = (await response.json()) as IrisMessagesResponse;
        if (data.messages.length > 0 && data.messages.every((m) => m.status === "complete")) return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  async function bridge(amountUsdc: string): Promise<void> {
    if (!adapter) throw new Error(`CCTP bridging isn't configured on ${sourceChain.chainName} yet.`);
    if (!ownerAddress) throw new Error("No connected wallet.");

    setError(null);
    setBurnTxHash(null);
    setPhase("burning");
    try {
      const amount = parseUnits(amountUsdc, 6);
      const hash = await adapter.depositForBurn(amount, destinationChain.cctpDomain, ownerAddress as `0x${string}`);
      setBurnTxHash(hash);

      setPhase("relaying");
      await socialFetch("/api/circle/wallet/self-bridge", {
        method: "POST",
        body: JSON.stringify({ sourceChain: toIndexerChainSlug(sourceChain), txHash: hash }),
      });

      setPhase("awaiting-attestation");
      await pollForAttestation(hash);
      setPhase("complete");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Bridge failed.");
      throw err;
    }
  }

  return { phase, error, burnTxHash, bridge, reset, supported: Boolean(adapter) };
}
