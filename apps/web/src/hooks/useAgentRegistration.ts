"use client";

import { useState } from "react";
import { useWallet } from "./useWallet";
import { useEvmAdapter } from "./useEvmAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { sha256Hex } from "@/lib/hash";

export interface RegisterAgentInput {
  name: string;
  endpoint: string;
  agentUri: string;
  description: string;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
}

export function useAgentRegistration() {
  const { chain } = useWallet();
  const evmAdapter = useEvmAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [busy, setBusy] = useState(false);

  /** Returns the newly assigned on-chain agentId once the registration transaction confirms —
   * needed to persist anything keyed by (chain, agentChainId) right after registering, e.g. the
   * agent's persona (see RegisterWizard's submit flow) or a hosted-runtime's follow-up
   * updateAgentMetadata call. Null if no wallet is connected. */
  async function registerAgent(input: RegisterAgentInput): Promise<{ agentChainId: string } | null> {
    setBusy(true);
    try {
      if (!evmAdapter) return null;
      const metadataHash = await sha256Hex(input.description);
      const txHash = await evmAdapter.registerAgent({
        name: input.name,
        agentUri: input.agentUri,
        endpoint: input.endpoint,
        metadataHash,
        supportsX402: input.supportsX402,
        supportsA2A: input.supportsA2A,
        supportsMcp: input.supportsMcp,
      });
      const agentId = await evmAdapter.waitForAgentRegistration(txHash);
      return { agentChainId: agentId.toString() };
    } finally {
      setBusy(false);
    }
  }

  /** Second step of hosted-runtime registration: once `agentChainId` is known (from
   * {registerAgent}), points the on-chain `endpoint` at this agent's ClawdHQ-managed proxy URL
   * (`/api/agents/hosted/{chain}/{agentChainId}/a2a`) instead of an owner-operated server.
   * ClawdHQCore's `updateAgentMetadata` overwrites every field at once (no partial patch), so
   * every other field must be re-supplied unchanged — callers should pass back the same
   * RegisterAgentInput they just registered with, only `endpoint` replaced. */
  async function pointEndpointAtHostedProxy(agentChainId: string, input: RegisterAgentInput): Promise<void> {
    if (!evmAdapter) throw new Error("No wallet connected");
    const metadataHash = await sha256Hex(input.description);
    const txHash = await evmAdapter.updateAgentMetadata({
      agentId: BigInt(agentChainId),
      agentUri: input.agentUri,
      endpoint: input.endpoint,
      metadataHash,
      supportsX402: input.supportsX402,
      supportsA2A: input.supportsA2A,
      supportsMcp: input.supportsMcp,
    });
    await evmAdapter.waitForTransaction(txHash);
  }

  return { registerAgent, pointEndpointAtHostedProxy, busy };
}
