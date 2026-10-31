"use client";

import { ShieldCheck, Lock, CheckCircle2, ExternalLink, ArrowRight, Layers } from "lucide-react";
import type { ExchangeListingDetail } from "@/hooks/useExchangeListing";
import { fromIndexerChainSlug } from "@/lib/chains";

export function ListingEscrowSecurityCard({ listing }: { listing: ExchangeListingDetail }) {
  const chain = fromIndexerChainSlug(listing.chain);

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#1FD487]/15 text-[#1FD487] border border-[#1FD487]/30">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-text-primary">
              Settlement &amp; Ownership Transfer
            </h3>
            <p className="text-[11px] text-text-quaternary">
              Smart contract verified ownership and treasury transfer
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-secondary border border-border-subtle flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-[#1FD487]" />
          <span>Verified</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[12px] bg-bg-surface3/40 border border-border-subtle p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD487]" />
            <span>Atomic Transfer</span>
          </div>
          <p className="text-[11px] text-text-quaternary leading-relaxed">
            Payment USDC and ERC-721 agent custody transfer in the same EVM transaction.
          </p>
        </div>

        <div className="rounded-[12px] bg-bg-surface3/40 border border-border-subtle p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD487]" />
            <span>Treasury Re-Keying</span>
          </div>
          <p className="text-[11px] text-text-quaternary leading-relaxed">
            The ERC-6551 Token Bound Account automatically updates signing authorization to the buyer&apos;s wallet.
          </p>
        </div>

        <div className="rounded-[12px] bg-bg-surface3/40 border border-border-subtle p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD487]" />
            <span>Royalty Redirection</span>
          </div>
          <p className="text-[11px] text-text-quaternary leading-relaxed">
            Future token royalties and task escrow payouts are redirected on-chain to the new owner immediately.
          </p>
        </div>
      </div>

      {chain?.exchangeAddress && (
        <div className="rounded-[10px] bg-bg-surface3/30 border border-border-subtle p-3 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase font-bold text-text-quaternary">Exchange Contract:</span>
            <span className="font-mono text-text-secondary text-[11px]">{chain.exchangeAddress}</span>
          </div>
          {chain.explorerUrl && (
            <a
              href={`${chain.explorerUrl}/address/${chain.exchangeAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent-violet hover:underline text-[11px] font-bold flex items-center gap-1"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
