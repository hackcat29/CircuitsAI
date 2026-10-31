"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  Bot,
  Brain,
  Check,
  ExternalLink,
  Activity,
  RefreshCw,
  Loader2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Flame,
  Clock,
  ShieldCheck,
  Coins,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useMyAgents,
  useDegenConfig,
  useCircuitsPredictions,
  usePolymarketMarkets,
  PredictionOutcome,
  type PolymarketPrediction,
  type CryptoCategory,
  CRYPTO_SUB_CATEGORIES,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { CircuitsAiReasoningCard } from "@/components/degen";

const PREDICTION_BOT_STRATEGIES = [
  {
    id: "oracle_arb",
    name: "Oracle Discrepancy Sniper",
    category: "Oracle Arbitrage",
    desc: "Scans real-time Polymarket spot feeds vs. internal probability odds to capture mispricings.",
    executionMode: "Sub-Second",
    riskTier: "Low Risk",
  },
  {
    id: "sentiment_scalper",
    name: "LLM News Sentiment Scalper",
    category: "NLP Sentiment",
    desc: "Scans breaking crypto alpha feeds via AIP tools to buy probability momentum ahead of resolution.",
    executionMode: "Event Driven",
    riskTier: "Active Alpha",
  },
  {
    id: "contrarian_ev",
    name: "Contrarian Expected Value ($EV+)",
    category: "Statistical Value",
    desc: "Takes high-payout, low-probability outcome shares when mathematical expected value model triggers.",
    executionMode: "Probability Edge",
    riskTier: "High Reward",
  },
  {
    id: "consensus_convergence",
    name: "Consensus Convergence Scalper",
    category: "Market Consensus",
    desc: "Trades convergence patterns — accumulates shares trending towards resolution as consensus solidifies.",
    executionMode: "Trend Follow",
    riskTier: "Medium Risk",
  },
  {
    id: "custom_text",
    name: "Custom CircuitsAI Prompt Directive",
    category: "Cognitive AI",
    desc: "Instruct your agent in plain English. CircuitsAI monitors oracles and trades probability shares autonomously.",
    executionMode: "LLM Autonomous",
    riskTier: "User Defined",
  },
];

const ASSET_FILTERS = [
  { label: "All Crypto", value: "ALL" },
  { label: "Bitcoin", value: "Bitcoin" },
  { label: "Ethereum", value: "Ethereum" },
  { label: "Solana", value: "Solana" },
  { label: "DeFi & Infra", value: "DeFi & Infra" },
  { label: "Layer 2 & Alts", value: "Layer 2 & Altcoins" },
  { label: "ETFs & Regulation", value: "ETFs & Regulation" },
  { label: "Price Milestones", value: "Price Milestones" },
];

export default function DegenPredictionsPage() {
  const router = useRouter();
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents } = useMyAgents();
  const { buyShares, busy: sdkBusy, error: sdkError, vaultAddress } = useCircuitsPredictions();
  const { markets: polymarkets, loading: marketsLoading, refetch: refetchMarkets } = usePolymarketMarkets(60);

  // Sub-Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [timeframeFilter, setTimeframeFilter] = useState<"ALL" | "SOON" | "MONTH" | "YEAR">("ALL");
  const [sortBy, setSortBy] = useState<"LIQUIDITY" | "CLOSING_SOON" | "CLOSE_ODDS">("LIQUIDITY");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewLayout, setViewLayout] = useState<"grid" | "table">("grid");

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);

  // Mobile View Switcher State
  const [mobileView, setMobileView] = useState<"markets" | "slip">("markets");

  // Selection & Order State (Defaults to Auto Bot for agentic economy)
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");
  const [stakeUsdc, setStakeUsdc] = useState<string>("100");
  const [rightPanelTab, setRightPanelTab] = useState<"BOT_STRATEGY" | "BUY">("BOT_STRATEGY");

  // Bot Strategy State
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedBotStrategy, setSelectedBotStrategy] = useState<string>("oracle_arb");
  const [customPrompt, setCustomPrompt] = useState<string>(
    "Buy YES on crypto probability markets when YES price < $0.60 and 24h volume > $50K. Max 100 USDC per market.",
  );
  const [betSuccess, setBetSuccess] = useState<boolean>(false);
  const [botDeployedSuccess, setBotDeployedSuccess] = useState<boolean>(false);
  const [onchainTxHash, setOnchainTxHash] = useState<string | null>(null);

  // Filtered & Sorted Markets
  const filteredMarkets = useMemo(() => {
    let list = polymarkets.filter((m) => {
      // Asset category filter
      if (selectedCategory !== "ALL" && m.category !== selectedCategory) {
        return false;
      }

      // Timeframe filter
      if (timeframeFilter !== "ALL") {
        const endDate = new Date(m.endDateIso).getTime();
        const now = Date.now();
        const daysRemaining = (endDate - now) / (1000 * 60 * 60 * 24);

        if (timeframeFilter === "SOON" && (daysRemaining > 14 || daysRemaining < 0)) return false;
        if (timeframeFilter === "MONTH" && (daysRemaining > 45 || daysRemaining < 0)) return false;
        if (timeframeFilter === "YEAR" && daysRemaining < 45) return false;
      }

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesDesc = m.desc.toLowerCase().includes(q);
        const matchesTag = m.assetTag.toLowerCase().includes(q);
        const matchesCat = m.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTag && !matchesCat) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === "LIQUIDITY") return parseFloat(b.liquidityUsdc.replace(/[^0-9.]/g, "")) - parseFloat(a.liquidityUsdc.replace(/[^0-9.]/g, ""));
      if (sortBy === "CLOSING_SOON") return new Date(a.endDateIso).getTime() - new Date(b.endDateIso).getTime();
      if (sortBy === "CLOSE_ODDS") {
        const diffA = Math.abs(a.yesPercent - 50);
        const diffB = Math.abs(b.yesPercent - 50);
        return diffA - diffB;
      }
      return 0;
    });

    return list;
  }, [polymarkets, selectedCategory, timeframeFilter, sortBy, searchQuery]);

  const totalItems = filteredMarkets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(totalItems, startIndex + pageSize);
  const paginatedMarkets = useMemo(() => {
    return filteredMarkets.slice(startIndex, endIndex);
  }, [filteredMarkets, startIndex, endIndex]);

  const selectedMarket: PolymarketPrediction = useMemo(() => {
    if (selectedMarketId) {
      const found = filteredMarkets.find((m) => m.id === selectedMarketId) || polymarkets.find((m) => m.id === selectedMarketId);
      if (found) return found;
    }
    return filteredMarkets[0] || polymarkets[0]!;
  }, [filteredMarkets, polymarkets, selectedMarketId]);

  const selectedAgent = (selectedAgentId && myAgents.find((a) => a.id === selectedAgentId)) || myAgents[0] || null;
  const { config, saveConfig } = useDegenConfig(chainSlug, selectedAgent?.id);

  // Financial payout calculations
  const parsedStake = parseFloat(stakeUsdc) || 0;
  const outcomePrice = selectedMarket ? (selectedOutcome === "YES" ? selectedMarket.yesPercent : selectedMarket.noPercent) / 100 : 0.5;
  const estimatedShares = outcomePrice > 0 ? (parsedStake / outcomePrice).toFixed(1) : "0.0";
  const potentialPayout = outcomePrice > 0 ? (parsedStake / outcomePrice).toFixed(2) : "0.00";
  const potentialProfit = outcomePrice > 0 ? (parseFloat(potentialPayout) - parsedStake).toFixed(2) : "0.00";

  const handlePlaceBet = async () => {
    if (parsedStake <= 0 || !selectedMarket) return;
    try {
      const outcome = selectedOutcome === "YES" ? PredictionOutcome.YES : PredictionOutcome.NO;
      const res = await buyShares({
        marketId: selectedMarket.id,
        question: selectedMarket.title,
        outcome,
        amountUsdc: parsedStake,
        endTimeSeconds: selectedMarket.endDateIso ? Math.floor(new Date(selectedMarket.endDateIso).getTime() / 1000) : undefined,
      });
      if (res?.txHash) {
        setOnchainTxHash(res.txHash);
        setBetSuccess(true);
        setTimeout(() => setBetSuccess(false), 5000);
      }
    } catch {
      // Handled in hook
    }
  };

  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* Crypto Prediction Markets Hub Header Strip */}
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0c2a1d] border border-[#1FD487]/30 text-[11px] font-bold text-[#1FD487]">
            <span className="h-2 w-2 rounded-full bg-[#1FD487] animate-pulse" />
            <span>LIVE Crypto Polymarket Feed</span>
          </div>
          <span className="text-[12px] text-text-tertiary">
            <strong className="text-text-primary font-mono">{filteredMarkets.length}</strong> active crypto probability markets
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11.5px] font-mono text-text-quaternary">
          <div className="hidden md:flex items-center gap-1.5">
            <span>Oracle:</span>
            <strong className="text-text-secondary">Polymarket UMA &amp; Pyth</strong>
          </div>
          <div className="hidden lg:flex items-center gap-1.5">
            <span>Settlement:</span>
            <strong className="text-[#1FD487]">USDC Vault</strong>
          </div>
          <button
            onClick={() => refetchMarkets()}
            className="text-[11px] font-sans font-bold text-text-tertiary hover:text-accent-violet transition-colors cursor-pointer flex items-center gap-1 bg-bg-surface px-2.5 py-1 rounded-[6px] border border-border-subtle"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Multi-Tier Sub-Filters Console */}
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-3.5 flex flex-col gap-3 shadow-xs">
        {/* Tier 1: Asset / Sector Sub-Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {ASSET_FILTERS.map((f) => {
            const isActive = selectedCategory === f.value;
            return (
              <button
                key={f.value}
                onClick={() => {
                  setSelectedCategory(f.value);
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-bg-raised border-accent-violet/50 text-text-primary shadow-xs ring-1 ring-accent-violet/30"
                    : "border-border-subtle bg-bg-surface text-text-tertiary hover:border-border-strong hover:text-text-secondary hover:bg-bg-surface3",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Tier 2: Search, Timeframe, Sort, and View Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border-subtle text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-quaternary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search crypto questions, tokens, or price targets…"
              className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-8 pr-3.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-quaternary focus:border-accent-violet/50"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Timeframe Expiry Filter */}
            <div className="flex items-center gap-1 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1">
              <Clock className="h-3 w-3 text-text-quaternary" />
              <select
                value={timeframeFilter}
                onChange={(e) => {
                  setTimeframeFilter(e.target.value as any);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-text-secondary outline-none cursor-pointer"
              >
                <option value="ALL">All Expiries</option>
                <option value="SOON">Ending Soon (&lt; 14d)</option>
                <option value="MONTH">Next 45 Days</option>
                <option value="YEAR">Long Term (2026)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-bg-surface border border-border-strong rounded-[8px] px-2.5 py-1">
              <SlidersHorizontal className="h-3 w-3 text-text-quaternary" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-text-secondary outline-none cursor-pointer"
              >
                <option value="LIQUIDITY">Sort: Pool Liquidity</option>
                <option value="CLOSING_SOON">Sort: Closing Soon</option>
                <option value="CLOSE_ODDS">Sort: 50/50 Contested</option>
              </select>
            </div>

            {/* Grid / Table View Switcher */}
            <div className="flex items-center rounded-[8px] bg-bg-surface border border-border-strong p-0.5">
              <button
                onClick={() => setViewLayout("grid")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-colors cursor-pointer",
                  viewLayout === "grid" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewLayout("table")}
                className={cn(
                  "p-1.5 rounded-[6px] transition-colors cursor-pointer",
                  viewLayout === "table" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                )}
                title="Pro Table View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher (< lg) */}
      <div className="flex lg:hidden items-center p-1 rounded-xl bg-bg-surface border border-border-strong gap-1">
        {[
          { id: "markets", label: `🌐 Crypto Markets (${totalItems})` },
          { id: "slip", label: "⚡ Prediction Slip & Bot" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileView(tab.id as any)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
              mobileView === tab.id
                ? "bg-accent-violet text-white shadow-xs"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Terminal Grid: Left 8 Cols (Markets) / Right 4 Cols (Order Slip & Bot Desk) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Crypto Markets Directory */}
        <div className={cn("lg:col-span-8 flex flex-col gap-3", mobileView !== "markets" ? "hidden lg:flex" : "flex")}>
          {marketsLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-text-quaternary rounded-[14px] bg-bg-elevated border border-border-subtle">
              <Loader2 className="h-5 w-5 animate-spin text-accent-violet" />
              <span className="text-xs font-mono">Loading live crypto prediction markets…</span>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="text-center py-16 text-text-quaternary text-xs rounded-[14px] bg-bg-elevated border border-border-subtle">
              <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <span>No crypto markets match the selected sub-filters.</span>
            </div>
          ) : viewLayout === "grid" ? (
            /* Grid View: High-density cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedMarkets.map((market) => {
                const isSelected = selectedMarket?.id === market.id;

                return (
                  <div
                    key={market.id}
                    onClick={() => router.push(`/degen/predictions/${market.id}`)}
                    className={cn(
                      "p-4 rounded-[14px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group",
                      isSelected
                        ? "bg-bg-raised border-accent-violet/50 ring-1 ring-accent-violet/30 shadow-xs"
                        : "bg-bg-elevated border-border-subtle hover:border-accent-violet/40 hover:bg-bg-surface3",
                    )}
                  >
                    {/* Card Header: Category & Asset Tag */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25">
                          {market.assetTag}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-text-quaternary">{market.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-tertiary">Ends {market.endsAt}</span>
                        <span className="text-[10px] font-bold text-accent-violet group-hover:underline flex items-center gap-0.5">
                          <span>Details</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>

                    {/* Question Title */}
                    <h3 className="text-[13px] font-extrabold text-text-primary leading-snug line-clamp-2 group-hover:text-accent-violet transition-colors">
                      {market.title}
                    </h3>

                    {/* Dual Probability Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono font-extrabold">
                        <span className="text-[#1FD487] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>YES {market.yesPercent}¢</span>
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          <span>NO {market.noPercent}¢</span>
                          <XCircle className="h-3 w-3" />
                        </span>
                      </div>

                      <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden flex">
                        <div
                          className="h-full bg-[#1FD487] transition-all duration-500"
                          style={{ width: `${market.yesPercent}%` }}
                        />
                        <div
                          className="h-full bg-rose-500 transition-all duration-500"
                          style={{ width: `${market.noPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buy Buttons with Outcome Pricing */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMarketId(market.id);
                          setSelectedOutcome("YES");
                          setRightPanelTab("BUY");
                          setMobileView("slip");
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-[8px] text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer",
                          isSelected && selectedOutcome === "YES"
                            ? "bg-[#0c2a1d] border-[#1FD487]/50 text-[#1FD487]"
                            : "bg-bg-surface border-border-subtle text-text-secondary hover:border-[#1FD487]/30 hover:text-[#1FD487]",
                        )}
                      >
                        <span>Buy YES</span>
                        <span className="text-[10px] font-mono text-[#1FD487]">· {market.yesPercent}¢</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMarketId(market.id);
                          setSelectedOutcome("NO");
                          setRightPanelTab("BUY");
                          setMobileView("slip");
                        }}
                        className={cn(
                          "py-1.5 px-2 rounded-[8px] text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer",
                          isSelected && selectedOutcome === "NO"
                            ? "bg-[#2e1313] border-red-500/50 text-red-400"
                            : "bg-bg-surface border-border-subtle text-text-secondary hover:border-red-500/30 hover:text-red-400",
                        )}
                      >
                        <span>Buy NO</span>
                        <span className="text-[10px] font-mono text-red-400">· {market.noPercent}¢</span>
                      </button>
                    </div>

                    {/* Card Footer Metrics */}
                    <div className="flex items-center justify-between text-[10px] text-text-quaternary font-mono border-t border-border-subtle pt-2">
                      <span>Liquidity: <strong className="text-text-secondary">{market.liquidityUsdc}</strong></span>
                      <span>Network: <strong className="text-text-secondary">Monad</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Pro Table View */
            <div className="rounded-[14px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Asset / Question</th>
                      <th className="py-3 px-4">Subcategory</th>
                      <th className="py-3 px-4">YES Price</th>
                      <th className="py-3 px-4">NO Price</th>
                      <th className="py-3 px-4">Pool Liquidity</th>
                      <th className="py-3 px-4">Ends</th>
                      <th className="py-3 px-4 text-right">Quick Buy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {paginatedMarkets.map((m) => {
                      const isSelected = selectedMarket?.id === m.id;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => router.push(`/degen/predictions/${m.id}`)}
                          className={cn(
                            "cursor-pointer transition-colors group",
                            isSelected ? "bg-bg-raised" : "hover:bg-bg-surface3",
                          )}
                        >
                          <td className="py-3 px-4 max-w-[280px]">
                            <div className="font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate">{m.title}</div>
                            <div className="text-[10px] font-mono text-accent-violet mt-0.5">{m.assetTag}</div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-text-tertiary">{m.category}</td>
                          <td className="py-3 px-4 font-mono font-extrabold text-[#1FD487]">{m.yesPercent}¢</td>
                          <td className="py-3 px-4 font-mono font-extrabold text-red-400">{m.noPercent}¢</td>
                          <td className="py-3 px-4 font-mono text-text-secondary">{m.liquidityUsdc}</td>
                          <td className="py-3 px-4 font-mono text-text-quaternary text-[11px]">{m.endsAt}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMarketId(m.id);
                                setSelectedOutcome("YES");
                                setRightPanelTab("BUY");
                                setMobileView("slip");
                              }}
                              className="px-2.5 py-1 rounded-[6px] text-[10.5px] font-bold bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 hover:bg-[#1FD487]/20"
                            >
                              YES
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Toolbar */}
          {filteredMarkets.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 px-1 text-xs font-mono">
              <div className="flex items-center gap-2 text-text-quaternary text-[11px]">
                <span>
                  Showing <strong className="text-text-primary font-bold">{startIndex + 1}–{endIndex}</strong> of <strong className="text-text-primary font-bold">{totalItems}</strong> markets
                </span>
                <span className="text-border-strong">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-text-tertiary">Per page:</span>
                  {[12, 24, 48].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10.5px] font-bold transition-colors cursor-pointer",
                        pageSize === size
                          ? "bg-accent-violet text-white"
                          : "bg-bg-surface text-text-quaternary hover:text-text-secondary border border-border-subtle",
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-[6px] bg-bg-surface border border-border-strong text-text-secondary hover:text-text-primary hover:bg-bg-surface3 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer text-[11px] font-bold"
                >
                  ← Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push(`dots-${p}`);
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item) => {
                      if (typeof item === "string") {
                        return (
                          <span key={item} className="px-0.5 text-text-quaternary">
                            …
                          </span>
                        );
                      }
                      const isCurrent = item === safePage;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          className={cn(
                            "h-6.5 min-w-[26px] px-1 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center",
                            isCurrent
                              ? "bg-accent-violet text-white shadow-xs"
                              : "bg-bg-surface border border-border-subtle text-text-secondary hover:bg-bg-surface3 hover:text-text-primary",
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                </div>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-[6px] bg-bg-surface border border-border-strong text-text-secondary hover:text-text-primary hover:bg-bg-surface3 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer text-[11px] font-bold"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Execution Slip & Bot Desk (Defaults to Auto Bot) */}
        <div className={cn("lg:col-span-4 flex flex-col gap-4", mobileView !== "slip" ? "hidden lg:flex" : "flex")}>
          <div className="rounded-[14px] border border-border-subtle bg-bg-elevated p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            {/* Header with Switcher Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-[13.5px] font-extrabold text-text-primary">Prediction Execution</span>
              <div className="flex gap-1 bg-bg-surface p-0.5 rounded-[8px] border border-border-strong text-[11px] font-bold">
                <button
                  onClick={() => setRightPanelTab("BOT_STRATEGY")}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer",
                    rightPanelTab === "BOT_STRATEGY" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                  )}
                >
                  Auto Bot
                </button>
                <button
                  onClick={() => setRightPanelTab("BUY")}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer",
                    rightPanelTab === "BUY" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                  )}
                >
                  Manual Buy
                </button>
              </div>
            </div>

            {rightPanelTab === "BOT_STRATEGY" ? (
              /* Auto-Prediction Bot Strategy Desk (Default) */
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-[10px] bg-accent-violet/10 border border-accent-violet/30 text-[11px] text-text-secondary leading-relaxed">
                  <span className="font-extrabold text-accent-violet flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5" />
                    <span>Autonomous Fleet Allocation</span>
                  </span>
                  Your agent scans all crypto prediction markets on Monad &amp; Polymarket 24/7, autonomously selecting markets, sizing shares, and taking profit within your risk limits.
                </div>

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Assigned Fleet Agent
                  </label>
                  <select
                    value={selectedAgent?.id ?? ""}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 text-xs font-bold text-text-primary outline-none cursor-pointer"
                  >
                    {myAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (#{a.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Prediction Algorithmic Model
                  </label>
                  {PREDICTION_BOT_STRATEGIES.map((strat) => {
                    const isStratActive = selectedBotStrategy === strat.id;

                    return (
                      <div
                        key={strat.id}
                        onClick={() => setSelectedBotStrategy(strat.id)}
                        className={cn(
                          "p-2.5 rounded-[8px] border transition-all cursor-pointer flex flex-col gap-1",
                          isStratActive
                            ? "bg-bg-raised border-accent-violet/40 text-text-primary"
                            : "bg-bg-surface border-border-subtle hover:border-border-strong text-text-tertiary",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11.5px] font-bold text-text-primary">{strat.name}</span>
                          <span className="text-[9.5px] font-mono text-accent-violet">{strat.category}</span>
                        </div>
                        <p className="text-[10px] text-text-quaternary line-clamp-2">{strat.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Max Capital Allocation (USDC)
                  </label>
                  <input
                    type="number"
                    value={stakeUsdc}
                    onChange={(e) => setStakeUsdc(e.target.value)}
                    placeholder="100"
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 font-mono text-xs text-text-primary outline-none"
                  />
                </div>

                {/* Strategy Prompt Builder (Always editable for full custom prompt control) */}
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-text-quaternary flex items-center gap-1">
                      <Bot className="h-3 w-3 text-accent-violet" />
                      <span>CircuitsAI Strategy Directive Prompt</span>
                    </label>
                    <span className="text-[9.5px] font-mono text-accent-violet">Autonomous NLP Rule</span>
                  </div>

                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    placeholder="Describe how your agent should trade prediction markets in plain English..."
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] p-2.5 text-xs text-text-primary font-mono outline-none focus:border-accent-violet/50 leading-relaxed"
                  />

                  {/* Strategy Quick Prompt Templates */}
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-[9.5px] font-bold text-text-quaternary uppercase">Quick Prompt Presets:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "Oracle Arbitrage", text: "Scan Polymarket probability odds vs spot feeds. Buy YES/NO shares when odds diverge by >8% from fair value." },
                        { label: "Contrarian $EV+", text: "Buy undervalued NO shares on hyper-bullish sentiment when YES > 80% and expiry > 30 days. Max $50/trade." },
                        { label: "Consensus Scalper", text: "Accumulate winning outcome shares when probability breaks 70% and volume accelerates. Take profit at 95%." },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setCustomPrompt(preset.text);
                            setSelectedBotStrategy("custom_text");
                          }}
                          className="px-2 py-0.5 rounded-[6px] bg-bg-surface3 hover:bg-white/10 text-[9.5px] font-mono text-text-tertiary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saveConfig.isPending || !selectedAgent}
                  onClick={async () => {
                    if (!selectedAgent) return;
                    const prevVenues = config?.allowedVenues || [];
                    const nextVenues = prevVenues.includes("SPORTYSTAKE_PREDICTIONS") ? prevVenues : [...prevVenues, "SPORTYSTAKE_PREDICTIONS" as const];
                    const promptToSave = customPrompt.trim() || (
                      PREDICTION_BOT_STRATEGIES.find((s) => s.id === selectedBotStrategy)?.desc || "Autonomous prediction market trading."
                    );

                    await saveConfig.mutateAsync({
                      allowedVenues: nextVenues,
                      maxPositionUsdc: stakeUsdc || "100",
                      maxDailyLossUsdc: "500",
                      mode: "LIVE",
                      strategyPrompt: promptToSave,
                    });
                    setBotDeployedSuccess(true);
                    setTimeout(() => setBotDeployedSuccess(false), 2500);
                  }}
                  className="w-full py-3 rounded-full text-xs font-extrabold bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Bot className="h-4 w-4" />
                  <span>
                    {saveConfig.isPending
                      ? "Deploying…"
                      : botDeployedSuccess
                      ? "Prediction Strategy Active!"
                      : `Deploy Strategy to ${selectedAgent?.name ?? "Agent"}`}
                  </span>
                </button>
              </div>
            ) : (
              /* Manual Buy Slip */
              <>
                {/* Active Selected Crypto Market Summary */}
                {selectedMarket && (
                  <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-quaternary">
                      <span className="px-1.5 py-0.25 rounded bg-accent-dark text-accent-violet font-bold border border-accent-violet/20">
                        {selectedMarket.assetTag}
                      </span>
                      <span>Ends {selectedMarket.endsAt}</span>
                    </div>
                    <h4 className="text-[12.5px] font-extrabold text-text-primary leading-snug">
                      {selectedMarket.title}
                    </h4>
                  </div>
                )}

                {/* Outcome Selector: YES vs NO */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOutcome("YES")}
                    className={cn(
                      "py-2.5 px-3 rounded-[10px] border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-xs",
                      selectedOutcome === "YES"
                        ? "bg-[#0c2a1d] border-[#1FD487]/50 text-[#1FD487] ring-1 ring-[#1FD487]/30"
                        : "bg-bg-surface border-border-subtle text-text-quaternary hover:text-text-secondary",
                    )}
                  >
                    <span className="text-[12.5px] font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>YES Shares</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold">
                      {selectedMarket ? selectedMarket.yesPercent : 50}¢
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOutcome("NO")}
                    className={cn(
                      "py-2.5 px-3 rounded-[10px] border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-xs",
                      selectedOutcome === "NO"
                        ? "bg-[#2e1313] border-red-500/50 text-red-400 ring-1 ring-red-500/30"
                        : "bg-bg-surface border-border-subtle text-text-quaternary hover:text-text-secondary",
                    )}
                  >
                    <span className="text-[12.5px] font-extrabold flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>NO Shares</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold">
                      {selectedMarket ? selectedMarket.noPercent : 50}¢
                    </span>
                  </button>
                </div>

                {/* Stake Input (USDC) */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label className="text-[10px] uppercase font-bold text-text-quaternary">
                      Purchase Amount (USDC)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={stakeUsdc}
                      onChange={(e) => setStakeUsdc(e.target.value)}
                      placeholder="100"
                      className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-3.5 pr-14 py-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent-violet/50"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                      USDC
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {["50", "100", "250", "500", "1000"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setStakeUsdc(preset)}
                        className="flex-1 py-1 rounded-[6px] bg-bg-surface hover:bg-bg-surface3 text-[10.5px] font-mono font-bold text-text-secondary border border-border-subtle transition-colors cursor-pointer"
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout Breakdown */}
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-text-quaternary">
                    <span>Estimated Probability Shares</span>
                    <span className="font-mono font-bold text-text-primary">{estimatedShares} Shares</span>
                  </div>
                  <div className="flex justify-between text-text-quaternary">
                    <span>Potential Payout (Resolves {selectedOutcome})</span>
                    <span className="font-mono font-bold text-[#1FD487]">${potentialPayout} USDC</span>
                  </div>
                  <div className="flex justify-between text-text-quaternary">
                    <span>Potential Net Profit</span>
                    <span className="font-mono font-bold text-[#1FD487]">
                      +${potentialProfit} USDC
                    </span>
                  </div>
                  <div className="flex justify-between text-text-quaternary">
                    <span>Settlement Fee</span>
                    <span className="font-mono text-text-secondary">~$0.02 USDC</span>
                  </div>
                </div>

                {/* Submit Bet Button */}
                {betSuccess ? (
                  <div className="p-3 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-center text-[12px] font-bold text-[#1FD487] flex flex-col items-center justify-center gap-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      <span>Shares Purchased on Monad!</span>
                    </div>
                    {onchainTxHash && (
                      <a
                        href={`https://monadscan.com/tx/${onchainTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-[#1FD487]/80 hover:underline flex items-center gap-1"
                      >
                        <span>Tx: {onchainTxHash.slice(0, 8)}…{onchainTxHash.slice(-6)}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={sdkBusy || parsedStake <= 0}
                    onClick={handlePlaceBet}
                    className={cn(
                      "w-full py-3 rounded-full text-[13px] font-extrabold text-white transition-all hover:brightness-110 cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50",
                      selectedOutcome === "YES"
                        ? "bg-[#1FD487] text-black hover:bg-emerald-400"
                        : "bg-rose-500 hover:bg-rose-600",
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {sdkBusy
                        ? "Processing on Monad…"
                        : `Buy ${selectedOutcome} Shares ($${parsedStake} USDC)`}
                    </span>
                  </button>
                )}

                {sdkError && (
                  <div className="text-[10.5px] text-red-400 font-mono bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                    {sdkError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
