"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Share2, Check, ExternalLink, Bot, Coins } from "lucide-react";
import type { ExchangeListingDetail } from "@/hooks/useExchangeListing";
import { formatUsdc } from "@/lib/format";
import toast from "react-hot-toast";

export function ListingSellerBanner({ listing }: { listing: ExchangeListingDetail }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Listing link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);

      const agentName = listing.agent?.name || `Agent #${listing.agentChainId}`;
      const tweetText = encodeURIComponent(
        `I just listed autonomous agent ${agentName} on Circuits Protocol (@circuitsxyz)!\n\nView listing & acquisition terms:\n${url}`
      );
      window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");
    }
  };

  return (
    <div className="rounded-[16px] border border-accent-violet/40 bg-bg-elevated p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-accent-violet/20 border border-accent-violet/40 flex items-center justify-center text-accent-violet">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-text-primary">You Own &amp; Control This Listing</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-violet/20 text-accent-violet border border-accent-violet/30">
                Verified Seller
              </span>
            </div>
            <p className="text-[12px] text-text-tertiary mt-0.5 leading-relaxed">
              Your agent is active on-chain. All future task royalties and cash-flow streams will transfer atomically upon deal settlement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] bg-accent-violet text-white text-[12px] font-bold hover:bg-accent-violet/90 transition-all shadow-xs cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copied ? "Link Copied!" : "Share Listing"}</span>
          </button>

          <Link
            href={`/agents`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[12px] font-bold transition-all cursor-pointer"
          >
            <Bot className="h-3.5 w-3.5 text-text-quaternary" />
            <span>Agent Directory</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border-subtle/70 mt-3.5 pt-3.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Listing Mode</p>
          <p className="text-xs font-bold text-text-secondary mt-0.5">
            {listing.mode === "AUCTION" ? "Timed Auction" : "Open Offers"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Active Bids Received</p>
          <p className="text-xs font-mono font-bold text-accent-violet mt-0.5">
            {listing.bids.length} {listing.bids.length === 1 ? "Offer" : "Offers"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Reserve Price</p>
          <p className="text-xs font-mono font-bold text-text-secondary mt-0.5">
            {BigInt(listing.reservePriceUsdc) > 0n ? formatUsdc(BigInt(listing.reservePriceUsdc)) : "None"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Fair Value Anchor</p>
          <p className="text-xs font-mono font-bold text-[#1FD487] mt-0.5">
            {formatUsdc(BigInt(listing.fairValueSnapshotUsdc))}
          </p>
        </div>
      </div>
    </div>
  );
}
