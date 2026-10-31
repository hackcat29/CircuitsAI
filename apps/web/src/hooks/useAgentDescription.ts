"use client";

import { useQuery } from "@tanstack/react-query";

// A freshly-registered-with-no-description agent's on-chain metadataHash is this (sha256 of an
// empty string is never actually computed for it — ClawdHQCore just leaves the bytes32 field at
// its Solidity default). Treated the same as "no metadataHash yet" — no point requesting a cache
// entry that structurally can never exist.
const ZERO_HASH = `0x${"0".repeat(64)}`;

/** An agent's registration-time description, resolved from the off-chain cache keyed by
 * `metadataHash` (the sha256 hash `registerAgent` actually commits on-chain — see
 * /api/marketplace/agent-descriptions). `null` is a normal outcome (cache miss, or the agent
 * never had one saved for it), not an error — most callers should just render nothing in that
 * case rather than surface a failure state. */
export function useAgentDescription(metadataHash: string | undefined) {
  const query = useQuery({
    queryKey: ["agent-description", metadataHash],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/agent-descriptions/${metadataHash}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to load description (${res.status})`);
      const data = (await res.json()) as { description: string };
      return data.description;
    },
    enabled: Boolean(metadataHash && metadataHash !== ZERO_HASH),
  });

  return { description: query.data ?? null, isLoading: query.isLoading };
}
