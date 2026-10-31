"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Store,
  Bot,
  Search,
  ChevronDown,
  Coins,
  Clock,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  LayoutGrid,
  Table as TableIcon,
  Plus,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui";
import { ListDialog, ListingCard, MobileListingCard, ListingTable } from "@/components/exchange";
import {
  useExchangeListings,
  useAllCognitiveLayers,
  useRankings,
  useLaunchpadList,
  useWallet,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { formatUsdc } from "@/lib/format";
import type { ExchangeListingMode, ExchangeListingStatus } from "@/hooks";

const CATEGORY_TABS = [
  { label: "All Listings", shortLabel: "All", status: undefined, mode: undefined, tokenOnly: false },
  { label: "Active", shortLabel: "Active", status: "ACTIVE" as ExchangeListingStatus, mode: undefined, tokenOnly: false },
  { label: "Live Auctions", shortLabel: "Auctions", status: "ACTIVE" as ExchangeListingStatus, mode: "AUCTION" as ExchangeListingMode, tokenOnly: false },
  { label: "Open Offers", shortLabel: "Offers", status: "ACTIVE" as ExchangeListingStatus, mode: "OPEN" as ExchangeListingMode, tokenOnly: false },
  { label: "Tokenized Agents", shortLabel: "Tokenized", status: "ACTIVE" as ExchangeListingStatus, mode: undefined, tokenOnly: true },
  { label: "Sold History", shortLabel: "Sold", status: "SOLD" as ExchangeListingStatus, mode: undefined, tokenOnly: false },
];

type SortOption = "valuation-desc" | "valuation-asc" | "ending-soon" | "newest";

export default function ExchangePage() {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);

  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("valuation-desc");
  const [desktopViewMode, setDesktopViewMode] = useState<"grid" | "table">("grid");

  const currentTab = CATEGORY_TABS[activeTabIdx] ?? CATEGORY_TABS[0];
  const query = useExchangeListings({ chain: chainSlug, status: currentTab.status, mode: currentTab.mode });
  const { isLoading, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const rawListings = query.data?.pages.flatMap((page) => page.listings) ?? [];

  const layers = useAllCognitiveLayers(chainSlug);
  const { agents } = useRankings();
  const { launches } = useLaunchpadList("top", 100);

  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [String(a.id), a])), [agents]);
  const launchMap = useMemo(() => Object.fromEntries(launches.map((l) => [l.agentChainId, l])), [launches]);

  // Filter & Sort
  const filteredListings = useMemo(() => {
    let list = [...rawListings];

    if (currentTab.tokenOnly) {
      list = list.filter((item) => Boolean(launchMap[item.agentChainId]));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((item) => {
        const agent = agentMap[item.agentChainId];
        const layer = layerMap[item.agentChainId];
        const name = agent?.name ?? "";
        const displayName = layer?.displayName ?? "";
        return (
          name.toLowerCase().includes(q) ||
          displayName.toLowerCase().includes(q) ||
          item.agentChainId.includes(q) ||
          item.seller.toLowerCase().includes(q)
        );
      });
    }

    return list.sort((a, b) => {
      if (sortBy === "valuation-desc") {
        return Number(BigInt(b.fairValueSnapshotUsdc || "0") - BigInt(a.fairValueSnapshotUsdc || "0"));
      }
      if (sortBy === "valuation-asc") {
        return Number(BigInt(a.fairValueSnapshotUsdc || "0") - BigInt(b.fairValueSnapshotUsdc || "0"));
      }
      if (sortBy === "ending-soon") {
        const timeA = a.endTime ? new Date(a.endTime).getTime() : Infinity;
        const timeB = b.endTime ? new Date(b.endTime).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === "newest") {
        return new Date(b.createdAtChain).getTime() - new Date(a.createdAtChain).getTime();
      }
      return 0;
    });
  }, [rawListings, currentTab, search, sortBy, launchMap, agentMap, layerMap]);

  // Global stats query to ensure exchange telemetry persists across tab switches for current network
  const statsQuery = useExchangeListings({ chain: chainSlug });
  const allListingsForStats = statsQuery.data?.pages.flatMap((page) => page.listings) ?? [];

  const handleRefetch = () => {
    refetch();
    statsQuery.refetch();
  };

  // Aggregate Market Stats
  const marketStats = useMemo(() => {
    const list = allListingsForStats.length > 0 ? allListingsForStats : rawListings;
    const totalValuation = list.reduce((acc, curr) => acc + BigInt(curr.fairValueSnapshotUsdc || "0"), 0n);
    const activeCount = list.filter((l) => l.status === "ACTIVE").length;
    const auctionCount = list.filter((l) => l.status === "ACTIVE" && l.mode === "AUCTION").length;
    const soldCount = list.filter((l) => l.status === "SOLD").length;
    return { totalValuation, activeCount, auctionCount, soldCount };
  }, [allListingsForStats, rawListings]);

  return (
    <div className="max-w-370 mx-auto px-3.5 sm:px-6 pt-3 sm:pt-5.5 pb-20 flex flex-col gap-4 sm:gap-6">
      {/* ══════════════════════════════════════════════════════
          1. MOBILE HEADER & NAVIGATION (block md:hidden)
          ══════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3">
        {/* Directory vs Store Switcher & List Button */}
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle/70 pb-2.5">
          <div className="flex items-center gap-1 p-1 bg-bg-surface border border-border-strong rounded-xl">
            <Link
              href="/agents"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-text-secondary hover:text-text-primary bg-transparent cursor-pointer"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>DIRECTORY</span>
            </Link>
            <Link
              href="/exchange"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-[#FF5C28] text-white shadow-xs cursor-pointer"
            >
              <Store className="h-3.5 w-3.5" />
              <span>STORE</span>
            </Link>
          </div>

          <ListDialog
            onCreated={handleRefetch}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-violet text-white text-xs font-bold shadow-2xs hover:bg-accent-violet/90 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>List Agent</span>
              </button>
            }
          />
        </div>

        {/* Mobile Horizontal Telemetry Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
            <span className="text-[10px] uppercase font-bold text-text-quaternary">Valuation:</span>
            <span className="font-mono font-bold text-accent-violet">{formatUsdc(marketStats.totalValuation)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
            <span className="text-[10px] uppercase font-bold text-text-quaternary">Active:</span>
            <span className="font-mono font-bold text-text-primary">{marketStats.activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
            <span className="text-[10px] uppercase font-bold text-text-quaternary">Auctions:</span>
            <span className="font-mono font-bold text-amber">{marketStats.auctionCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-bg-elevated border border-border-subtle shrink-0">
            <span className="text-[10px] uppercase font-bold text-text-quaternary">Settled:</span>
            <span className="font-mono font-bold text-[#1FD487]">{marketStats.soldCount}</span>
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name or creator..."
            className="w-full bg-bg-elevated border border-border-strong rounded-[10px] pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-quaternary hover:text-text-primary p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Category Filters & Sort */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-[65%] no-scrollbar">
            {CATEGORY_TABS.map((tab, idx) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setActiveTabIdx(idx)}
                className={`px-2.5 py-1 rounded-[7px] text-[11px] font-bold border transition-all whitespace-nowrap cursor-pointer ${
                  activeTabIdx === idx
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "border-border-subtle bg-bg-elevated/70 text-text-tertiary"
                }`}
              >
                {tab.shortLabel}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-bg-elevated border border-border-strong rounded-[8px] pl-2.5 pr-6 py-1 text-[11px] font-semibold text-text-secondary outline-none cursor-pointer"
            >
              <option value="valuation-desc">Valuation ↓</option>
              <option value="valuation-asc">Valuation ↑</option>
              <option value="ending-soon">Ending Soon</option>
              <option value="newest">Newest</option>
            </select>
            <ChevronDown className="h-3 w-3 text-text-quaternary absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          2. DESKTOP HERO & TELEMETRY (hidden md:block)
          ══════════════════════════════════════════════════════ */}
      <div className="hidden md:block rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
        <div className="flex items-start justify-between gap-6 flex-wrap relative z-10">
          <div>
            <h1 className="mb-2 text-[24px] md:text-[28px] font-extrabold tracking-tight flex items-center gap-2.5 text-text-primary">
              <Store className="h-6 w-6 text-accent-violet" />
              <span>Agent Store &amp; Exchange</span>
            </h1>
            <p className="max-w-140 text-[13px] leading-[1.6] text-text-tertiary">
              Trade verified autonomous agent ownership on-chain. Acquiring an agent transfers all future task revenue and token creator royalties directly to the buyer's wallet.
            </p>

            {/* Desktop Telemetry Strip */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
              <div>
                <div className="text-[20px] font-extrabold font-mono text-accent-violet">
                  {formatUsdc(marketStats.totalValuation)}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Listed Valuation</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold font-mono text-text-primary">{marketStats.activeCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Active Listings</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold font-mono text-amber">
                  {marketStats.auctionCount}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Live Auctions</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold font-mono text-[#1FD487]">
                  {marketStats.soldCount}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Transferred &amp; Settled</div>
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            <ListDialog onCreated={handleRefetch} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          3. DESKTOP FILTER TABS & VIEW TOGGLE (hidden md:flex)
          ══════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORY_TABS.map((tab, idx) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTabIdx(idx)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all whitespace-nowrap cursor-pointer ${
                activeTabIdx === idx
                  ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                  : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Sort, and View Mode Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <div className="flex-1 min-w-60 relative">
            <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings by agent name, handle, or creator address..."
              className="w-full bg-bg-elevated/80 border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none bg-bg-elevated/80 border border-border-strong hover:border-border-hover rounded-[8px] pl-3 pr-7 py-1.75 text-[12px] font-semibold text-text-secondary outline-none cursor-pointer"
              >
                <option value="valuation-desc">Sort: Valuation (High → Low)</option>
                <option value="valuation-asc">Sort: Valuation (Low → High)</option>
                <option value="ending-soon">Sort: Ending Soonest</option>
                <option value="newest">Sort: Recently Listed</option>
              </select>
              <ChevronDown className="h-3 w-3 text-text-quaternary absolute right-2 pointer-events-none" />
            </div>

            {/* Desktop View Mode Toggle (Grid vs Table) */}
            <div className="flex items-center gap-1 p-1 bg-bg-elevated border border-border-strong rounded-lg">
              <button
                type="button"
                onClick={() => setDesktopViewMode("grid")}
                className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                  desktopViewMode === "grid"
                    ? "bg-accent-violet text-white shadow-2xs"
                    : "text-text-quaternary hover:text-text-primary"
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDesktopViewMode("table")}
                className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                  desktopViewMode === "table"
                    ? "bg-accent-violet text-white shadow-2xs"
                    : "text-text-quaternary hover:text-text-primary"
                }`}
                title="Pro Orderbook Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          4. CONTENT AREA (Loading, Empty, and Listings)
          ══════════════════════════════════════════════════════ */}
      {/* Loading Skeleton */}
      {isLoading && (
        <>
          {/* Mobile Skeleton */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-[14px]" />
            ))}
          </div>
          {/* Desktop Skeleton */}
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-[16px]" />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && filteredListings.length === 0 && (
        <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-10 sm:p-12 text-center shadow-xs">
          <Store className="h-8 w-8 text-text-quaternary mx-auto mb-3" />
          <p className="mb-1 text-sm font-bold text-text-primary">No listings match your search or filter.</p>
          <p className="text-[12px] text-text-tertiary">
            Try clearing your search query or create a new listing for one of your registered agents.
          </p>
        </div>
      )}

      {/* Listings: Dedicated Mobile vs Desktop Layouts */}
      {!isLoading && filteredListings.length > 0 && (
        <>
          {/* ── MOBILE VIEW: Compact Mobile Cards ── */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {filteredListings.map((listing) => (
              <MobileListingCard
                key={listing.id}
                listing={listing}
                layer={layerMap[listing.agentChainId]}
                agent={agentMap[listing.agentChainId]}
                launch={launchMap[listing.agentChainId]}
              />
            ))}
          </div>

          {/* ── DESKTOP VIEW: Grid Cards or Pro Orderbook Table ── */}
          <div className="hidden md:block">
            {desktopViewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    layer={layerMap[listing.agentChainId]}
                    agent={agentMap[listing.agentChainId]}
                    launch={launchMap[listing.agentChainId]}
                  />
                ))}
              </div>
            ) : (
              <ListingTable
                listings={filteredListings}
                layerMap={layerMap}
                agentMap={agentMap}
                launchMap={launchMap}
              />
            )}
          </div>

          {/* Pagination Controls */}
          {hasNextPage && (
            <div className="mt-2 sm:mt-4 flex justify-center border-t border-border-subtle pt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full border border-border-strong px-5 py-2 text-[12px] font-bold bg-accent-dark text-accent-violet hover:bg-accent-violet/20 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isFetchingNextPage ? "Loading…" : "Load More Listings"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

