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
import { Coins, MessageSquare, ArrowUpRight, ShieldCheck, Settings, Bot } from "lucide-react";
import { UserAddressLink } from "@/components/profile/UserAddressLink";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ListingTable({
  listings,
  layerMap,
  agentMap,
  launchMap,
}: {
  listings: ExchangeListing[];
  layerMap: Record<string, CognitiveLayer>;
  agentMap: Record<string, RankedAgent>;
  launchMap: Record<string, LaunchpadListItem>;
}) {
  const { address } = useWallet();
  const router = useRouter();

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-surface3/40 text-[10.5px] uppercase font-bold text-text-quaternary tracking-wider">
              <th className="py-3 px-4">Agent Identity</th>
              <th className="py-3 px-3">Seller</th>
              <th className="py-3 px-3">Status &amp; Mode</th>
              <th className="py-3 px-3">Token Stream</th>
              <th className="py-3 px-3">Reputation</th>
              <th className="py-3 px-3">Valuation</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/50">
            {listings.map((listing) => {
              const layer = layerMap[listing.agentChainId];
              const agent = agentMap[listing.agentChainId];
              const launch = launchMap[listing.agentChainId];

              const avatar = layer?.avatarUrl || robotAvatarUrl(agent?.name || listing.agentChainId);
              const displayName = layer?.displayName || agent?.name || `Agent #${listing.agentChainId}`;
              const isAuction = listing.mode === "AUCTION";
              const isSeller = Boolean(address && listing.seller && address.toLowerCase() === listing.seller.toLowerCase());

              return (
                <tr
                  key={listing.id}
                  onClick={() => router.push(`/exchange/${listing.id}`)}
                  className="hover:bg-bg-surface3/40 transition-colors cursor-pointer group"
                >
                  {/* Agent Identity */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-[13px] text-text-primary group-hover:text-accent-violet transition-colors flex items-center gap-1">
                          <span>{displayName}</span>
                          <ShieldCheck className="h-3.5 w-3.5 text-accent-violet shrink-0" />
                        </div>
                        <div className="text-[11px] text-text-quaternary font-mono">
                          @{agent?.name ?? listing.agentChainId}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Seller */}
                  <td className="py-3.5 px-3">
                    <UserAddressLink address={listing.seller} className="text-[11px]" />
                  </td>

                  {/* Status & Mode */}
                  <td className="py-3.5 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1">
                        {isSeller && (
                          <Badge variant="violet" className="text-[9px] px-1.5 py-0">Your Listing</Badge>
                        )}
                        <Badge variant={listing.status === "ACTIVE" ? "emerald" : "default"} className="text-[10px]">
                          {listing.status}
                        </Badge>
                      </div>
                      {isAuction && listing.endTime && (
                        <div className="text-[10px] font-mono text-amber flex items-center gap-1">
                          <span>Auction:</span>
                          <AuctionCountdown endTime={listing.endTime} />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Token Stream */}
                  <td className="py-3.5 px-3">
                    {launch ? (
                      <Link
                        href={`/app/launchpad/${launch.launchChainId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-[10.5px] font-mono font-bold hover:bg-accent-violet hover:text-white transition-all shadow-2xs"
                        title="30% Token Creator Royalty Stream"
                      >
                        <Coins className="h-3 w-3" />
                        <span>${launch.symbol}</span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-text-quaternary font-mono">—</span>
                    )}
                  </td>

                  {/* Reputation */}
                  <td className="py-3.5 px-3">
                    {agent ? (
                      <div>
                        <div className="font-mono font-bold text-accent-violet text-xs">
                          {formatBps(agent.reputationBps)}
                        </div>
                        <div className="text-[10px] text-text-quaternary font-mono">
                          {agent.jobsCompleted} tasks
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-quaternary font-mono">—</span>
                    )}
                  </td>

                  {/* Valuation */}
                  <td className="py-3.5 px-3">
                    <span className="font-mono text-sm font-black text-accent-violet">
                      {formatUsdc(BigInt(listing.fairValueSnapshotUsdc))}
                    </span>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/app/terminal?agent=${listing.agentChainId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle transition-all cursor-pointer"
                        title="Test in Terminal"
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
                            <span>{isAuction ? "Place Bid" : "Buy Agent"}</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </>
                        )}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
