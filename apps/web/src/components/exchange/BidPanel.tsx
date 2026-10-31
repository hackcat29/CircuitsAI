"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Input, Label, Spinner } from "@/components/ui";
import { useAgentExchangeActions, useWallet } from "@/hooks";
import type { ExchangeListingDetail } from "@/hooks/useExchangeListing";
import { formatUsdc } from "@/lib/format";
import { checkOperationChain } from "@/lib/chainGuard";
import { AuctionCountdown } from "./AuctionCountdown";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** "Has this auction's endTime passed" needs a live clock, but not a per-second one (that's
 * AuctionCountdown's job) — just enough to flip the settle/bid UI within a reasonable window
 * without calling Date.now() directly during render (impure — breaks render purity/SSR). */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function BidPanel({
  listing,
  onChanged,
  hideBidsList = false,
}: {
  listing: ExchangeListingDetail;
  onChanged: () => void;
  hideBidsList?: boolean;
}) {
  const { address } = useWallet();
  const { cancelListing, placeBid, withdrawBid, acceptBid, settleAuction, busy } = useAgentExchangeActions();
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const now = useNow(15_000);

  const isSeller = address?.toLowerCase() === listing.seller.toLowerCase();
  const isActive = listing.status === "ACTIVE";
  const isAuction = listing.mode === "AUCTION";
  const auctionEnded = isAuction && listing.endTime ? new Date(listing.endTime).getTime() <= now : false;
  const highestBid = listing.bids.find((bid) => bid.chainBidId === listing.highestBidChainId);
  const fairValueNum = Number(listing.fairValueSnapshotUsdc || "0") / 1e6;

  const presets = [
    { label: "Valuation", value: fairValueNum > 0 ? fairValueNum.toFixed(2) : "1.00" },
    { label: "+10%", value: fairValueNum > 0 ? (fairValueNum * 1.1).toFixed(2) : "1.10" },
    { label: "+25%", value: fairValueNum > 0 ? (fairValueNum * 1.25).toFixed(2) : "1.25" },
    { label: "+50%", value: fairValueNum > 0 ? (fairValueNum * 1.5).toFixed(2) : "1.50" },
  ];

  async function withAction(fn: () => Promise<void>, actionDesc = "perform this action") {
    if (!checkOperationChain(listing.chain, actionDesc)) return;
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] uppercase font-bold tracking-wider text-text-quaternary">
            Valuation
          </p>
          <Badge variant={isAuction ? "amber" : "default"}>{isAuction ? "Timed Auction" : "Open Offers"}</Badge>
        </div>
        <p className="font-mono text-3xl font-black text-accent-violet">{formatUsdc(BigInt(listing.fairValueSnapshotUsdc))}</p>

        {isAuction && listing.endTime && (
          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">
                {auctionEnded ? "Auction Status" : "Time Remaining"}
              </p>
              <AuctionCountdown endTime={listing.endTime} className="font-mono text-sm font-bold text-text-primary" />
            </div>
            {BigInt(listing.reservePriceUsdc) > 0n && (
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Reserve Price</p>
                <p className="font-mono text-sm font-bold text-text-secondary">{formatUsdc(BigInt(listing.reservePriceUsdc))}</p>
              </div>
            )}
          </div>
        )}

        {isAuction && highestBid && (
          <p className="mt-2.5 text-[11.5px] text-text-tertiary">
            Leading bid: <span className="font-mono font-bold text-text-primary">{formatUsdc(BigInt(highestBid.amountUsdc))}</span> by{" "}
            <span className="font-mono">{truncateAddress(highestBid.bidder)}</span>
          </p>
        )}
      </div>

      {isActive && !isSeller && !(isAuction && auctionEnded) && (
        <div className="flex flex-col gap-2.5 rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <Label htmlFor="bidAmount" className="text-xs font-bold text-text-secondary">
              Place Bid (USDC)
            </Label>
            <span className="text-[10.5px] text-text-quaternary">USDC</span>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setBidAmount(p.value)}
                className="px-2 py-0.5 rounded-[6px] text-[10.5px] font-mono font-bold bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
              >
                {p.label} (${p.value})
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              id="bidAmount"
              type="number"
              min={0}
              step={0.01}
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="Enter bid amount (e.g. 0.25)"
              className="font-mono text-xs"
            />
            <Button
              disabled={busy || !bidAmount}
              onClick={() =>
                withAction(async () => {
                  await placeBid(listing.chainListingId, BigInt(Math.round(Number(bidAmount) * 1_000_000)));
                  setBidAmount("");
                }, "place a bid")
              }
              className="bg-accent-violet hover:bg-accent-violet/90 text-white font-bold text-xs shrink-0 px-4"
            >
              {busy && <Spinner className="h-4 w-4" />}
              Submit Bid
            </Button>
          </div>
        </div>
      )}

      {isActive && isSeller && !isAuction && (
        <div className="flex flex-col gap-2.5 rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 shadow-xs">
          <p className="text-xs font-bold text-text-secondary">Listing Controls</p>
          <p className="text-[11.5px] text-text-tertiary leading-relaxed">
            You can accept any active bid from the orderbook below, or cancel this listing if there are no open offers.
          </p>
          {listing.bids.every((bid) => !bid.active) && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => withAction(() => cancelListing(listing.chainListingId), "cancel this listing")}
              className="text-xs font-bold"
            >
              Cancel Listing
            </Button>
          )}
        </div>
      )}

      {isActive && isAuction && auctionEnded && (
        <div className="flex flex-col gap-2.5 rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 shadow-xs">
          <p className="text-[11.5px] text-text-tertiary leading-relaxed">
            This auction has concluded. Anyone can settle it on-chain to pay the seller and transfer agent custody.
          </p>
          <Button
            disabled={busy}
            onClick={() => withAction(() => settleAuction(listing.chainListingId), "settle this auction")}
            className="bg-accent-violet hover:bg-accent-violet/90 text-white font-bold text-xs"
          >
            {busy && <Spinner className="h-4 w-4" />}
            Settle Auction
          </Button>
        </div>
      )}

      {!hideBidsList && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-text-tertiary">Bids ({listing.bids.length})</p>
          {listing.bids.length === 0 && <p className="text-sm text-text-quaternary">No bids yet.</p>}
          {listing.bids.map((bid) => {
            const isMine = address?.toLowerCase() === bid.bidder.toLowerCase();
            const isHighest = bid.chainBidId === listing.highestBidChainId;
            return (
              <div key={bid.id} className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2">
                <div>
                  <p className="font-mono text-sm text-text-primary">{formatUsdc(BigInt(bid.amountUsdc))}</p>
                  <p className="text-[10.5px] text-text-quaternary">
                    {truncateAddress(bid.bidder)} {isHighest && <span className="text-accent-violet">· highest</span>}
                    {!bid.active && <span> · withdrawn or settled</span>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {isActive && isSeller && !isAuction && bid.active && (
                    <Button size="sm" disabled={busy} onClick={() => withAction(() => acceptBid(listing.chainListingId, bid.chainBidId), "accept this bid")}>
                      Accept
                    </Button>
                  )}
                  {isMine && bid.active && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => withAction(() => withdrawBid(bid.chainBidId), "withdraw this bid")}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red font-medium">{error}</p>}
    </div>
  );
}
