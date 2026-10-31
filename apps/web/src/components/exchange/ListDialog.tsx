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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@/components/ui";
import { useAgentExchangeActions, useAgentValuation, useMyAgents, useWallet, useFormDraftState } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { formatUsdc } from "@/lib/format";

const MODE_OPEN = "0";
const MODE_AUCTION = "1";
const DEFAULT_AUCTION_DAYS = 3;

interface ListAgentDraft {
  agentId: string;
  numericAgentId: string;
  mode: typeof MODE_OPEN | typeof MODE_AUCTION;
  reserveUsdc: string;
  auctionDays: number;
}

const EMPTY_LIST_FORM: ListAgentDraft = {
  agentId: "",
  numericAgentId: "",
  mode: MODE_OPEN,
  reserveUsdc: "",
  auctionDays: DEFAULT_AUCTION_DAYS,
};

export function ListDialog({ onCreated, trigger }: { onCreated: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm, clearDraft] = useFormDraftState<ListAgentDraft>("list_agent", EMPTY_LIST_FORM);
  const [error, setError] = useState<string | null>(null);

  const { chain } = useWallet();
  const { agents } = useMyAgents();
  const { createListing, busy } = useAgentExchangeActions();
  const chainSlug = toIndexerChainSlug(chain);
  const { data: valuation } = useAgentValuation(chainSlug, form.numericAgentId || undefined);

  function reset() {
    clearDraft();
    setError(null);
  }

  function handleAgentChange(selectedId: string) {
    const numeric = agents.find((agent) => agent.id === selectedId)?.numericId ?? "";
    setForm((f) => ({ ...f, agentId: selectedId, numericAgentId: numeric }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const fairValueUsdc = valuation ? BigInt(valuation.fairValueUsdc) : 0n;
      const isAuction = form.mode === MODE_AUCTION;
      await createListing({
        agentId: form.agentId,
        mode: Number(form.mode),
        fairValueSnapshotUsdc: fairValueUsdc,
        reservePriceUsdc: isAuction && form.reserveUsdc ? BigInt(Math.round(Number(form.reserveUsdc) * 1_000_000)) : 0n,
        endTime: isAuction ? BigInt(Math.floor(Date.now() / 1000) + form.auctionDays * 86_400) : 0n,
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>List an Agent</Button>}
      </DialogTrigger>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>List an Agent for Sale</DialogTitle>
          <DialogDescription>
            Your agent keeps working and earning for you the whole time it&apos;s listed. Ownership only transfers when a sale
            completes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Agent</Label>
            {agents.length === 0 ? (
              <p className="text-sm text-text-tertiary">You don&apos;t own any agents on this chain yet.</p>
            ) : (
              <Select value={form.agentId} onValueChange={handleAgentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {form.agentId && (
            <div className="rounded-lg border border-border-subtle bg-white/[0.02] p-3">
              <p className="text-[10px] text-text-quaternary">Fair value (reference only, bids may land above or below it)</p>
              <p className="font-mono text-[15px] font-bold text-accent-violet">
                {valuation ? formatUsdc(BigInt(valuation.fairValueUsdc)) : "Calculating…"}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Listing type</Label>
            <Select
              value={form.mode}
              onValueChange={(value) => setForm((f) => ({ ...f, mode: value as typeof MODE_OPEN | typeof MODE_AUCTION }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MODE_OPEN}>Open: accept any bid, any time</SelectItem>
                <SelectItem value={MODE_AUCTION}>Auction: highest bid wins at a fixed deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.mode === MODE_AUCTION && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="auctionDays">Auction duration (days)</Label>
                <Input
                  id="auctionDays"
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={form.auctionDays}
                  onChange={(e) => setForm((f) => ({ ...f, auctionDays: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reserveUsdc">Reserve price (USDC, optional)</Label>
                <Input
                  id="reserveUsdc"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.reserveUsdc}
                  onChange={(e) => setForm((f) => ({ ...f, reserveUsdc: e.target.value }))}
                  placeholder="No reserve"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red">{error}</p>}
          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {(form.agentId || form.reserveUsdc) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-xs text-text-tertiary hover:text-red hover:bg-red/10"
              >
                Discard Draft
              </Button>
            ) : <div />}
            <Button type="submit" disabled={busy || !form.agentId}>
              {busy && <Spinner className="h-4 w-4 mr-2" />}
              {form.mode === MODE_AUCTION ? "Start Auction" : "Create Listing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
