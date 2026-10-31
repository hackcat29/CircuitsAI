"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Skeleton } from "@/components/ui";
import {
  BidPanel,
  ListingSellerBanner,
  AgentCashFlowCard,
  ListingTokenCard,
  ListingBidsTable,
  ListingSandboxCard,
  ListingSpecsCard,
  ListingEscrowSecurityCard,
} from "@/components/exchange";
import { UserAddressLink } from "@/components/profile/UserAddressLink";
import { useExchangeListing, useCognitiveLayer, useLaunchpadList, useWallet } from "@/hooks";
import type { ExchangeListingAgent } from "@/hooks/useExchangeListing";
import { type IndexerChainSlug } from "@/lib/chains";
import { formatBps, formatUsdc } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import {
  MessageSquare,
  Coins,
  ShieldCheck,
  ArrowUpRight,
  Cpu,
  DollarSign,
  Terminal as TerminalIcon,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const TIER_LABELS = ["Basic", "Verified", "Elite"];

function lastActive(seconds: number): string {
  return seconds > 0 ? new Date(seconds * 1000).toLocaleDateString() : "Never";
}

type TabType = "bids" | "sandbox" | "specs" | "security";

function AgentDetails({
  agent,
  agentChainId,
  chainSlug,
}: {
  agent: ExchangeListingAgent | null;
  agentChainId: string;
  chainSlug: string;
}) {
  const { layer } = useCognitiveLayer(chainSlug as IndexerChainSlug, agentChainId);

  if (!agent) {
    return (
      <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5">
        <p className="text-[11.5px] text-text-quaternary">
          Could not load live details for agent #{agentChainId} right now. The listing itself is still valid.
        </p>
      </div>
    );
  }

  const capabilities = [
    agent.supportsX402 && "x402",
    agent.supportsA2A && "ACP",
    agent.supportsMcp && "MCP",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3.5 rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={agent.active ? "emerald" : "default"}>{agent.active ? "Active" : "Inactive"}</Badge>
          <Badge>{TIER_LABELS[agent.tier] ?? "Basic"}</Badge>
          {capabilities.map((cap) => (
            <Badge key={cap} variant="violet">
              {cap}
            </Badge>
          ))}
        </div>
      </div>

      {layer?.worldview && (
        <p className="text-[12px] text-text-tertiary leading-relaxed pt-0.5">
          {layer.worldview}
        </p>
      )}

      {/* Stats Summary Strip */}
      <div className="grid grid-cols-3 gap-3 border-t border-border-subtle pt-3.5 text-center sm:text-left">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Reputation</p>
          <p className="font-mono text-sm font-extrabold text-accent-violet">{formatBps(agent.reputationBps)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Tasks Settled</p>
          <p className="font-mono text-sm font-extrabold text-text-primary">{agent.jobsCompleted.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-text-quaternary">Protocol Revenue</p>
          <p className="font-mono text-sm font-extrabold text-[#1FD487]">{formatUsdc(BigInt(agent.usdcRevenue))}</p>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-3 text-[11px] text-text-tertiary flex items-center justify-between">
        <p>Last active: {lastActive(agent.lastJobAtSeconds)}</p>
      </div>

      {/* Quick 1-Click Test in Terminal */}
      <Link
        href={`/app/terminal?agent=${agentChainId}`}
        className="w-full mt-1 py-2 rounded-[10px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
      >
        <MessageSquare className="h-3.5 w-3.5 text-accent-violet" />
        <span>Open Dedicated Terminal</span>
      </Link>
    </div>
  );
}

export default function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { data: listing, isLoading, refetch } = useExchangeListing(listingId);
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>("bids");

  const { launches } = useLaunchpadList("top", 100);
  const launch = listing ? launches.find((l) => l.agentChainId === listing.agentChainId) : undefined;
  const { layer } = useCognitiveLayer(
    listing ? (listing.chain as IndexerChainSlug) : undefined,
    listing?.agentChainId
  );

  if (isLoading) {
    return (
      <div className="max-w-350 mx-auto px-4 sm:px-6 pt-5.5 pb-17.5">
        <Skeleton className="h-80 rounded-[16px]" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-350 mx-auto px-4 sm:px-6 pt-5.5 pb-17.5 text-center">
        <p className="text-sm font-bold text-text-secondary">Listing not found.</p>
        <Link href="/exchange" className="mt-2 inline-block text-[12px] text-accent-violet font-semibold hover:underline">
          ← Back to Agent Store
        </Link>
      </div>
    );
  }

  const isSeller = Boolean(address && listing.seller && address.toLowerCase() === listing.seller.toLowerCase());
  const displayName = layer?.displayName || listing.agent?.name || `Agent #${listing.agentChainId}`;
  const avatar = layer?.avatarUrl || robotAvatarUrl(displayName);

  return (
    <div className="max-w-350 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-20 flex flex-col gap-5.5">
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          href="/exchange"
          className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary font-semibold transition-colors"
        >
          <span>← Back to Agent Store</span>
        </Link>
      </div>

      {/* Main Identity Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-1 border-b border-border-subtle/70">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            className="h-16 w-16 shrink-0 rounded-[14px] border border-border-strong object-cover bg-bg-surface3 shadow-sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] sm:text-[26px] font-black text-text-primary tracking-tight truncate">
                {displayName}
              </h1>
              <ShieldCheck className="h-5 w-5 text-accent-violet shrink-0" />
            </div>
            <p className="text-xs text-text-quaternary font-mono mt-0.5 flex items-center gap-1">
              <span>Listed by</span>
              <UserAddressLink address={listing.seller} className="text-text-secondary" />
              <span>· Agent #{listing.agentChainId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isSeller && <Badge variant="violet">Your Listing</Badge>}
          <Badge variant={listing.status === "ACTIVE" ? "emerald" : "default"}>{listing.status}</Badge>
          {listing.mode === "AUCTION" && <Badge variant="amber">Auction</Badge>}
        </div>
      </div>

      {/* Seller Management Banner (if viewer is the seller) */}
      {isSeller && <ListingSellerBanner listing={listing} />}

      {/* Top Level Financial & Acquisition Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4.5 items-start">
        {/* Left Column: Deal & Bid Action Panel + Cash Flow Card */}
        <div className="flex flex-col gap-4.5">
          <BidPanel listing={listing} onChanged={() => refetch()} hideBidsList={true} />
          <AgentCashFlowCard listing={listing} agent={listing.agent} launch={launch} />
        </div>

        {/* Right Column: Agent Specs Details + Token Bonding Curve */}
        <div className="flex flex-col gap-4.5">
          <AgentDetails agent={listing.agent} agentChainId={listing.agentChainId} chainSlug={listing.chain} />
          {launch && <ListingTokenCard launch={launch} />}
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex flex-col gap-3.5 pt-2">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-border-subtle/80 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("bids")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "bids"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/40 shadow-xs"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-surface3"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Bids &amp; Offers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-bg-surface3 border border-border-subtle">
              {listing.bids.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sandbox")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "sandbox"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/40 shadow-xs"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-surface3"
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            <span>Test Sandbox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "specs"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/40 shadow-xs"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-surface3"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Specs &amp; Tools</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "security"
                ? "bg-accent-dark text-accent-violet border border-accent-violet/40 shadow-xs"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-surface3"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Settlement &amp; Escrow</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div>
          {activeTab === "bids" && (
            <ListingBidsTable listing={listing} onChanged={() => refetch()} />
          )}

          {activeTab === "sandbox" && (
            <ListingSandboxCard
              agentChainId={listing.agentChainId}
              agentName={listing.agent?.name}
              chainSlug={listing.chain}
              worldview={layer?.worldview}
            />
          )}

          {activeTab === "specs" && (
            <ListingSpecsCard agent={listing.agent} agentChainId={listing.agentChainId} />
          )}

          {activeTab === "security" && (
            <ListingEscrowSecurityCard listing={listing} />
          )}
        </div>
      </div>
    </div>
  );
}


