"use client";

import { useState } from "react";
import { Badge, Button, Spinner } from "@/components/ui";
import { useAgentExchangeActions, useWallet } from "@/hooks";
import type { ExchangeListingDetail } from "@/hooks/useExchangeListing";
import { formatUsdc } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { DollarSign, Clock, ShieldCheck, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ListingBidsTable({
  listing,
  onChanged,
}: {
  listing: ExchangeListingDetail;
  onChanged: () => void;
}) {
  const { address } = useWallet();
  const { acceptBid, withdrawBid, busy } = useAgentExchangeActions();
  const [actionError, setActionError] = useState<string | null>(null);

  const isSeller = Boolean(address && listing.seller && address.toLowerCase() === listing.seller.toLowerCase());
  const isActive = listing.status === "ACTIVE";
  const isAuction = listing.mode === "AUCTION";
  const fairValue = BigInt(listing.fairValueSnapshotUsdc || "1");

  async function handleAction(fn: () => Promise<void>) {
    setActionError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <span>Bids &amp; Offers</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-accent-violet/20 text-accent-violet">
              {listing.bids.length}
            </span>
          </h3>
          <p className="text-[11.5px] text-text-quaternary mt-0.5">
            On-chain orderbook settled via smart contracts
          </p>
        </div>

        {isAuction && listing.highestBidChainId && (
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Leading Bid:</span>
            <span className="font-mono font-bold text-accent-violet">
              {formatUsdc(BigInt(listing.bids.find((b) => b.chainBidId === listing.highestBidChainId)?.amountUsdc || "0"))}
            </span>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-xs text-red">
          {actionError}
        </div>
      )}

      {listing.bids.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border-subtle bg-bg-surface3/40 p-8 text-center flex flex-col items-center justify-center gap-2">
          <DollarSign className="h-8 w-8 text-text-quaternary mb-1" />
          <p className="text-sm font-bold text-text-secondary">No active bids yet</p>
          <p className="text-[12px] text-text-quaternary max-w-100 leading-relaxed">
            Be the first to submit an offer. Bids can be placed above or below the valuation (
            <span className="font-mono font-bold text-accent-violet">{formatUsdc(fairValue)}</span>).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                <th className="pb-2.5 pl-1">Bidder</th>
                <th className="pb-2.5">Offer Amount</th>
                <th className="pb-2.5">vs. Valuation</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right pr-1">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {listing.bids.map((bid) => {
                const isMine = address?.toLowerCase() === bid.bidder.toLowerCase();
                const isHighest = bid.chainBidId === listing.highestBidChainId;
                const bidAmount = BigInt(bid.amountUsdc || "0");
                const ratio = fairValue > 0n ? Number((bidAmount * 100n) / fairValue) : 100;

                return (
                  <tr key={bid.id} className="hover:bg-bg-surface3/30 transition-colors">
                    <td className="py-3 pl-1">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={robotAvatarUrl(bid.bidder)}
                          alt=""
                          className="h-7 w-7 rounded-full border border-border-strong bg-bg-surface3 object-cover"
                        />
                        <div>
                          <div className="font-mono font-bold text-text-primary flex items-center gap-1">
                            <UserAddressLink address={bid.bidder} />
                            {isMine && <span className="text-[10px] text-accent-violet font-normal">(You)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono font-black text-sm text-text-primary">
                      {formatUsdc(bidAmount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          ratio >= 100 ? "text-[#1FD487]" : "text-amber"
                        }`}
                      >
                        {ratio}% of Anchor
                      </span>
                    </td>
                    <td className="py-3">
                      {isHighest ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-violet/20 text-accent-violet border border-accent-violet/30 text-[10px] font-mono font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Highest Bid</span>
                        </span>
                      ) : bid.active ? (
                        <span className="text-[10.5px] font-mono text-text-tertiary">Active</span>
                      ) : (
                        <span className="text-[10.5px] font-mono text-text-quaternary">Settled / Withdrawn</span>
                      )}
                    </td>
                    <td className="py-3 text-right pr-1">
                      <div className="flex items-center justify-end gap-1.5">
                        {isActive && isSeller && !isAuction && bid.active && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => handleAction(() => acceptBid(listing.chainListingId, bid.chainBidId))}
                            className="bg-accent-violet hover:bg-accent-violet/90 text-white font-bold text-[11px]"
                          >
                            {busy && <Spinner className="h-3 w-3" />}
                            Accept Offer
                          </Button>
                        )}
                        {isMine && bid.active && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => handleAction(() => withdrawBid(bid.chainBidId))}
                            className="text-[11px]"
                          >
                            {busy && <Spinner className="h-3 w-3" />}
                            Withdraw
                          </Button>
                        )}
                        {!bid.active && (
                          <span className="text-[10.5px] text-text-quaternary">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
