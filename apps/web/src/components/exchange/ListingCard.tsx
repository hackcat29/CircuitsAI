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
import { Coins, MessageSquare, ArrowUpRight, ShieldCheck, Settings } from "lucide-react";
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

export function ListingCard({
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
      className="rounded-[16px] border border-border-subtle p-4.5 transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between gap-3.5 shadow-xs hover:shadow-sm group bg-bg-elevated hover:border-accent-violet/40 cursor-pointer"
    >
      <div>
        {/* Top Bar: Identity & Status */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link
            href={`/exchange/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt=""
              className="h-11 w-11 shrink-0 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate flex items-center gap-1">
                <span>{displayName}</span>
                <ShieldCheck className="h-3 w-3 text-accent-violet shrink-0" />
              </div>
              <div className="text-[11px] text-text-quaternary font-mono truncate flex items-center gap-1">
                <span>@{agent?.name ?? listing.agentChainId}</span>
                <span>•</span>
                <span>by</span>
                <UserAddressLink address={listing.seller} asSpan className="text-text-secondary" />
              </div>
            </div>
          </Link>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              {isSeller && (
                <Badge variant="violet" className="text-[9.5px]">Your Listing</Badge>
              )}
              <Badge variant={STATUS_BADGE_VARIANT[listing.status]}>{listing.status}</Badge>
            </div>
            {isAuction && (
              <Badge variant="amber" className="text-[9.5px]">Auction</Badge>
            )}
          </div>
        </div>

        {/* Persona Worldview Snippet */}
        <p className="text-[11.5px] text-text-tertiary leading-relaxed mb-3 line-clamp-2 min-h-8.5">
          {layer?.worldview || "Autonomous agent registered on Circuits Protocol."}
        </p>

        {/* Badges: Token & Domain */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">

          {launch && (
            <Link
              href={`/app/launchpad/${launch.launchChainId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[10.5px] font-mono font-bold hover:bg-accent-violet hover:text-white transition-all shadow-2xs"
              title="Includes 30% Token Creator Royalty Stream"
            >
              <Coins className="h-3 w-3" />
              <span>${launch.symbol}</span>
            </Link>
          )}

          {agent && (
            <span className="text-[10px] font-mono font-bold px-1.75 py-0.5 rounded bg-bg-surface3 text-text-quaternary border border-border-subtle">
              {formatBps(agent.reputationBps)} Rep
            </span>
          )}
        </div>
      </div>

      {/* Financial Valuation & Countdown */}
      <div className="border-t border-border-subtle/60 pt-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Valuation</p>
            <p className="font-mono text-[14px] font-extrabold text-accent-violet">
              {formatUsdc(BigInt(listing.fairValueSnapshotUsdc))}
            </p>
          </div>

          {isAuction && listing.endTime && (
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Auction Closes In</p>
              <AuctionCountdown endTime={listing.endTime} className="font-mono text-[12px] font-extrabold text-text-primary" />
            </div>
          )}
        </div>

        {/* Quick 1-Click Action Buttons */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <Link
            href={`/app/terminal?agent=${listing.agentChainId}`}
            onClick={(e) => e.stopPropagation()}
            className="py-1.5 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Chat and test this agent before buying"
          >
            <MessageSquare className="h-3 w-3 text-accent-violet" />
            <span>Test in Terminal</span>
          </Link>

          <Link
            href={`/exchange/${listing.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`py-1.5 rounded-[8px] border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              isSeller
                ? "bg-accent-violet/15 text-accent-violet hover:bg-accent-violet hover:text-white border-accent-violet/30"
                : "bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border-accent-violet/30"
            }`}
          >
            {isSeller ? (
              <>
                <Settings className="h-3 w-3" />
                <span>Manage Listing</span>
              </>
            ) : (
              <>
                <span>{isAuction ? "Place Bid" : "Buy Agent"}</span>
                <ArrowUpRight className="h-3 w-3" />
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

