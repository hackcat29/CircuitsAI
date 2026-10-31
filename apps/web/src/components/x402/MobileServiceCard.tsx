"use client";

import { useRouter } from "next/navigation";
import { Server, ShieldCheck, ChevronRight, Play, Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ServiceListing } from "@/hooks";

interface MobileServiceCardProps {
  listing: ServiceListing;
  agentDisplayName: string;
  avatarUrl: string;
  isOwner?: boolean;
  onToggleStatus?: () => void;
}

export function MobileServiceCard({
  listing,
  agentDisplayName,
  avatarUrl,
  isOwner = false,
  onToggleStatus,
}: MobileServiceCardProps) {
  const router = useRouter();
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  function handleCardClick() {
    router.push(`/x402-services/${listing.id}`);
  }

  function handleCopyEndpoint(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(listing.endpoint);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 1800);
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-bg-elevated border border-border-subtle active:border-accent-violet/60 rounded-[14px] p-4 flex flex-col gap-3.5 shadow-xs cursor-pointer select-none transition-colors"
    >
      {/* Top row: Avatar, Host Agent, Status Pill */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            className="h-10 w-10 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-text-primary truncate">
                {agentDisplayName}
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-accent-violet shrink-0" />
            </div>
            <div className="text-[10.5px] font-mono text-text-quaternary truncate">
              Agent #{listing.agentChainId} • x402 Protocol
            </div>
          </div>
        </div>

        <span
          className={cn(
            "text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0",
            listing.status === "ACTIVE"
              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
              : "bg-bg-surface3 text-text-quaternary border-border-strong",
          )}
        >
          {listing.status === "ACTIVE" ? "Active" : "Paused"}
        </span>
      </div>

      {/* Title & Description */}
      <div>
        <h3 className="text-[14px] font-extrabold text-text-primary leading-snug">
          {listing.name}
        </h3>
        <p className="text-[11.5px] text-text-tertiary line-clamp-2 mt-1 leading-relaxed">
          {listing.description}
        </p>
      </div>

      {/* Endpoint Preview Pill */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-[8px] bg-bg-surface border border-border-subtle text-[11px] font-mono text-text-secondary">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          <span className="px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet font-bold text-[9px]">
            POST
          </span>
          <span className="truncate">{listing.endpoint}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyEndpoint}
          className="p-1 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer shrink-0"
          title="Copy endpoint"
        >
          {copiedEndpoint ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      {/* Price & Invocations Bar */}
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-[10px] bg-bg-surface border border-border-subtle font-mono">
        <div>
          <div className="text-[9.5px] text-text-quaternary uppercase tracking-wider">Price / Call</div>
          <div className="text-[13px] font-extrabold text-[#1FD487] mt-0.5">
            ${listing.priceUsdc} USDC
          </div>
        </div>
        <div>
          <div className="text-[9.5px] text-text-quaternary uppercase tracking-wider">Total Calls</div>
          <div className="text-[13px] font-bold text-text-primary mt-0.5">
            {(listing.callCount || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Bottom CTA / Action */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-xs">
        {isOwner && onToggleStatus ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus();
            }}
            className="w-full py-2 rounded-[8px] bg-bg-surface border border-border-strong text-text-secondary text-[11.5px] font-bold hover:bg-bg-raised transition-colors cursor-pointer"
          >
            {listing.status === "ACTIVE" ? "Pause Service" : "Resume Service"}
          </button>
        ) : (
          <div className="w-full flex items-center justify-between text-accent-violet font-semibold text-[11.5px] py-1">
            <span className="flex items-center gap-1.5">
              <Play className="h-3 w-3 fill-current" />
              <span>Interactive Playground &amp; SDK</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}
