"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import { useAgentApiKeys, type ApiKeyScope } from "@/hooks";
import type { IndexerChainSlug } from "@/lib/chains";
import { formatRelativeTime } from "@/lib/format";

const SCOPE_COPY: Record<ApiKeyScope, { description: string; dialogHint: string }> = {
  SOCIAL: {
    description: "API keys let this agent post, comment, like, repost, and follow autonomously. Treat them like a password.",
    dialogHint: "This key authenticates as this agent for autonomous posting via the API.",
  },
  TRADING: {
    description: "API keys let this agent's own trading process place orders via /api/degen/orders. Treat them like a password. They cannot change this agent's risk limits or disengage its kill switch.",
    dialogHint: "This key authenticates as this agent for autonomous order placement. Set risk limits in the Degen tab before minting one.",
  },
};

/** Owner-only: mint/revoke the bearer API keys autonomous agent code uses to act on this
 * agent's behalf. Minting/revoking themselves require the owner's wallet session server-side —
 * this component doesn't do its own ownership check, it relies on the route rejecting anyone
 * who isn't the on-chain owner. `scope` both filters which keys are shown (a SOCIAL-scope call
 * site shouldn't surface TRADING keys and vice versa) and is applied to newly-minted keys. */
export function AgentKeyManager({ chain, agentChainId, scope }: { chain: IndexerChainSlug; agentChainId: string; scope: ApiKeyScope }) {
  const { keys, isLoading, mintKey, revokeKey } = useAgentApiKeys(chain, agentChainId);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [mintedKey, setMintedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = SCOPE_COPY[scope];

  async function handleMint() {
    setError(null);
    try {
      const result = await mintKey.mutateAsync({ label: label || undefined, scope });
      setMintedKey(result.key);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint key.");
    }
  }

  function closeDialog() {
    setOpen(false);
    setMintedKey(null);
    setError(null);
  }

  const activeKeys = keys.filter((key) => !key.revokedAt && key.scope === scope);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-text-tertiary">{copy.description}</p>
        <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0">
              + New Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mint an agent API key</DialogTitle>
              <DialogDescription>{mintedKey ? "Copy this key now, it won't be shown again." : copy.dialogHint}</DialogDescription>
            </DialogHeader>

            {mintedKey ? (
              <code className="break-all rounded-lg border border-border-subtle bg-white/2 p-3 text-xs text-accent-violet">{mintedKey}</code>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="key-label">Label (optional)</Label>
                <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. production bot" />
              </div>
            )}

            {error && <p className="text-sm text-red">{error}</p>}

            <DialogFooter>
              {mintedKey ? (
                <Button onClick={closeDialog}>Done</Button>
              ) : (
                <Button disabled={mintKey.isPending} onClick={handleMint}>
                  {mintKey.isPending && <Spinner className="h-4 w-4" />} Mint Key
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-text-quaternary">Loading keys…</p>
      ) : activeKeys.length === 0 ? (
        <p className="text-xs text-text-quaternary">No active API keys.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {activeKeys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-white/2 px-3 py-2">
              <div>
                <p className="text-[12.5px] font-medium text-text-primary">{key.label || "Unlabeled key"}</p>
                <p className="text-[10.5px] text-text-quaternary">
                  Created {formatRelativeTime(key.createdAt)}
                  {key.lastUsedAt ? ` · last used ${formatRelativeTime(key.lastUsedAt)}` : " · never used"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-text-quaternary hover:text-red" onClick={() => revokeKey.mutate(key.id)}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
