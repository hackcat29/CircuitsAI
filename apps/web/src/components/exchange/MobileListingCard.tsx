"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { formatUsdc, formatBps } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import {
  useWallet,
  type ExchangeListing,
  type CognitiveLayer,
  type RankedAgent,
  type LaunchpadListItem,
} from "@/hooks";
import { AuctionCountdown } from "./AuctionCountdown";
import { Coins, MessageSquare, ArrowUpRight, ShieldCheck, Settings, Flame } from "lucide-react";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const STATUS_BADGE_VARIANT: Record<ExchangeListing["status"], "emerald" | "violet" | "default" | "amber"> = {
  ACTIVE: "emerald",
  SOLD: "violet",
  CANCELLED: "default",
  EXPIRED: "amber",
};

export function MobileListingCard({
  listing,
  layer,
  agent,
  launch,
}: {
  listing: ExchangeListing;
  layer?: CognitiveLayer;
  agent?: RankedAgent;
  launch?: LaunchpadListItem;
}) {
  const { address } = useWallet();
  const router = useRouter();
  const avatar = layer?.avatarUrl || robotAvatarUrl(agent?.name || listing.agentChainId);
  const displayName = layer?.displayName || agent?.name || `Agent #${listing.agentChainId}`;
  const isAuction = listing.mode === "AUCTION";
  const isSeller = Boolean(address && listing.seller && address.toLowerCase() === listing.seller.toLowerCase());

  return (
    <div
      onClick={() => router.push(`/exchange/${listing.id}`)}
      className="rounded-[14px] border border-border-subtle bg-bg-elevated p-3.5 flex flex-col gap-2.5 shadow-2xs active:scale-[0.99] transition-all cursor-pointer hover:border-accent-violet/40"
    >
      {/* Top Header: Identity & Status */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-[10px] border border-border-strong object-cover bg-bg-surface3"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-black text-text-primary truncate flex items-center gap-1">
              <span>{displayName}</span>
              <ShieldCheck className="h-3 w-3 text-accent-violet shrink-0" />
            </div>
            <div className="text-[10.5px] text-text-quaternary font-mono truncate flex items-center gap-1 mt-0.5">
              <span>@{agent?.name ?? listing.agentChainId}</span>
              <span>•</span>
              <span>by</span>
              <UserAddressLink address={listing.seller} asSpan className="text-text-secondary" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSeller && (
            <Badge variant="violet" className="text-[9px] px-1.5 py-0">Your Listing</Badge>
          )}
          <Badge variant={STATUS_BADGE_VARIANT[listing.status]} className="text-[9.5px]">
            {listing.status}
          </Badge>
        </div>
      </div>

      {/* Worldview brief snippet */}
      <p className="text-[11px] text-text-tertiary line-clamp-1 leading-normal">
        {layer?.worldview || "Autonomous agent registered on Circuits Protocol."}
      </p>

      {/* Tag Badges: Token, SLA */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {launch && (
          <Link
            href={`/app/launchpad/${launch.launchChainId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[10px] font-mono font-bold"
          >
            <Coins className="h-2.5 w-2.5" />
            <span>${launch.symbol}</span>
          </Link>
        )}

        {agent && (
          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-bg-surface3 text-text-quaternary border border-border-subtle">
            {formatBps(agent.reputationBps)} Rep
          </span>
        )}

        {isAuction && listing.endTime && (
          <div className="inline-flex items-center gap-1 text-[9.5px] font-mono text-amber ml-auto">
            <AuctionCountdown endTime={listing.endTime} />
          </div>
        )}
      </div>

      {/* Bottom Valuation & Quick Action Row */}
      <div className="flex items-center justify-between border-t border-border-subtle/60 pt-2.5 mt-0.5">
        <div>
          <span className="text-[9.5px] uppercase font-bold tracking-wider text-text-quaternary block">
            Valuation
          </span>
          <span className="font-mono text-sm font-black text-accent-violet">
            {formatUsdc(BigInt(listing.fairValueSnapshotUsdc))}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/app/terminal?agent=${listing.agentChainId}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle transition-all cursor-pointer"
            title="Chat in Terminal"
          >
            <MessageSquare className="h-3.5 w-3.5 text-accent-violet" />
          </Link>

          <Link
            href={`/exchange/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
              isSeller
                ? "bg-accent-violet/15 text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30"
                : "bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30"
            }`}
          >
            {isSeller ? (
              <>
                <Settings className="h-3 w-3" />
                <span>Manage</span>
              </>
            ) : (
              <>
                <span>{isAuction ? "Bid" : "Buy Agent"}</span>
                <ArrowUpRight className="h-3 w-3" />
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
