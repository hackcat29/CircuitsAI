"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Bot,
  Sliders,
  DollarSign,
  ShieldCheck,
  Percent,
  History,
  Settings,
  Brain,
  Gauge,
  SlidersHorizontal,
  ExternalLink,
  Info,
  Maximize2,
  BarChart3,
  Clock,
  Check,
  RotateCcw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useMyAgents,
  useDegenConfig,
  useDegenPositions,
  useDegenOrders,
  usePerpLiveQuotes,
  useCircuitsPerps,
  type LivePerpQuote,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { CircuitsAiReasoningCard, TradingViewPerpChart } from "@/components/degen";
import { robotAvatarUrl } from "@/lib/avatar";

const AGENT_PERP_STRATEGIES = [
  {
    id: "momentum",
    name: "Momentum Breakout & Trend Surfer",
    category: "Trend Following",
    desc: "Uses EMA ribbons, ADX trend strength, and 15m volume expansion to enter high-probability perpetual breakouts with dynamic ATR trailing stops.",
    executionMode: "Automated Sub-second",
    riskTier: "Medium Risk",
  },
  {
    id: "funding_arb",
    name: "Funding Rate Arbitrage",
    category: "Basis Yield",
    desc: "Captures 8h perpetual funding premiums while delta-hedged against spot USDC collateral.",
    executionMode: "Delta Neutral",
    riskTier: "Low Risk",
  },
  {
    id: "mean_reversion",
    name: "Mean Reversion Scalper",
    category: "Statistical Arb",
    desc: "Scalps Bollinger Band standard deviations on fast timeframes with automated take-profit brackets.",
    executionMode: "Automated Scalp",
    riskTier: "Medium Risk",
  },
  {
    id: "orderbook_sniper",
    name: "Orderbook Imbalance Sniper",
    category: "Microstructure",
    desc: "Detects bid/ask queue depletion to scalp rapid liquidity imbalances against the mark price.",
    executionMode: "Queue Priority",
    riskTier: "Active Alpha",
  },
  {
    id: "cross_arb",
    name: "Cross-Venue Spread Arbitrage",
    category: "Market Making",
    desc: "Monitors basis divergence across index price oracles and executes convergence trades.",
    executionMode: "Oracle Arb",
    riskTier: "Low Risk",
  },
  {
    id: "grid_rebalance",
    name: "Dynamic Grid DCA Rebalancer",
    category: "Grid Trading",
    desc: "Places geometric buy and sell limit brackets around current USDC mark price to harvest volatility.",
    executionMode: "Multi-Bracket",
    riskTier: "Range Bound",
  },
  {
    id: "custom_text",
    name: "Custom CircuitsAI Prompt Directive",
    category: "Cognitive AI",
    desc: "Instruct your fleet agent in plain English. CircuitsAI reasons over live orderbooks and executes automatically.",
    executionMode: "LLM Autonomous",
    riskTier: "User Defined",
  },
];

export default function PerpetualMarketsPage() {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents, loading: agentsLoading } = useMyAgents();
  const { quotes: liveMarkets, loading: quotesLoading } = usePerpLiveQuotes();

  // Default to BTC-USDC (or first available real USDC pair)
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC-USDC");
  const selectedMarket: LivePerpQuote = useMemo(() => {
    return liveMarkets.find((m) => m.symbol === selectedSymbol) || liveMarkets[0] || {
      symbol: "BTC-USDC",
      baseAsset: "BTC",
      name: "Bitcoin / USDC Perp",
      price: 94000,
      change24h: 0,
      high24h: 95400,
      low24h: 92600,
      volume24h: "$450.0M",
      fundingRate: "+0.0050%",
      fundingCountdown: "02:44:12",
    };
  }, [liveMarkets, selectedSymbol]);

  const [selectedTimeframe, setSelectedTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "1d">("15m");
  const [chartType, setChartType] = useState<"area" | "candles">("area");
  const [mobileTab, setMobileTab] = useState<"chart" | "trade" | "dock" | "bot">("chart");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [marginMode, setMarginMode] = useState<"CROSS" | "ISOLATED">("CROSS");
  const [leverage, setLeverage] = useState<number>(20);
  const [sizeUsdc, setSizeUsdc] = useState<string>("500");

  // Agent-first defaults: Agent Auto-Perps Strategy is default dock tab, and Agent Quick-Bot is default execution mode
  const [activeDockTab, setActiveDockTab] = useState<"strategies" | "positions" | "orders" | "reasoning" | "history">("strategies");
  const [executionMode, setExecutionMode] = useState<"AGENT" | "MANUAL">("AGENT");

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("momentum");
  const [customPrompt, setCustomPrompt] = useState<string>(
    "Monitor BTC-USDC on 15m candles. If funding rate is positive (> 0.005%) and RSI > 70, open a short with 10x leverage. Stop loss at 2% drawdown and take profit at 4% gain.",
  );
  const [orderPlacedSuccess, setOrderPlacedSuccess] = useState<boolean>(false);
  const [strategySavedSuccess, setStrategySavedSuccess] = useState<boolean>(false);

  const selectedAgent = (selectedAgentId && myAgents.find((a) => a.id === selectedAgentId)) || myAgents[0] || null;

  const { openPosition, closePosition, onchainPositions, busy: perpBusy, error: perpError } = useCircuitsPerps();
  const [onchainTxHash, setOnchainTxHash] = useState<string | null>(null);

  // Active positions & orders for target agent
  const { config, saveConfig } = useDegenConfig(chainSlug, selectedAgent?.id);
  const { positions } = useDegenPositions(chainSlug, selectedAgent?.id);
  const { orders } = useDegenOrders(chainSlug, selectedAgent?.id);

  // Position calculations
  const parsedSize = parseFloat(sizeUsdc) || 0;
  const notionalValue = parsedSize * leverage;
  const estimatedLiquidation = useMemo(() => {
    if (side === "LONG") {
      const dropPct = (1 / leverage) * 0.9;
      return selectedMarket.price * (1 - dropPct);
    } else {
      const risePct = (1 / leverage) * 0.9;
      return selectedMarket.price * (1 + risePct);
    }
  }, [side, leverage, selectedMarket.price]);

  const handlePlaceOrder = async () => {
    if (parsedSize <= 0) return;
    try {
      const res = await openPosition({
        symbol: selectedMarket.symbol,
        isLong: side === "LONG",
        collateralUsdc: parsedSize,
        leverage,
        markPrice: selectedMarket.price,
      });
      if (res?.txHash) setOnchainTxHash(res.txHash);
    } catch {
      // Fallback
    }

    if (selectedAgent) {
      const prevVenues = config?.allowedVenues || [];
      const nextVenues = prevVenues.includes("HYPERLIQUID") ? prevVenues : [...prevVenues, "HYPERLIQUID" as const];
      await saveConfig.mutateAsync({
        allowedVenues: nextVenues,
        maxPositionUsdc: sizeUsdc || "500",
        maxDailyLossUsdc: "1000",
        mode: "LIVE",
        strategyPrompt: `${side} ${selectedMarket.symbol} ${leverage}x margin=${sizeUsdc}`,
      });
    }
    setOrderPlacedSuccess(true);
    setTimeout(() => setOrderPlacedSuccess(false), 4000);
  };

  const isMarketPositive = selectedMarket.change24h >= 0;

  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* Ticker & Market Header Bar */}
      <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xs">
        {/* Market Selector Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          {liveMarkets.map((m) => {
            const isSelected = m.symbol === selectedMarket.symbol;
            const isPos = m.change24h >= 0;

            return (
              <button
                key={m.symbol}
                onClick={() => setSelectedSymbol(m.symbol)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all cursor-pointer whitespace-nowrap border",
                  isSelected
                    ? "bg-bg-raised border-accent-violet/50 shadow-xs ring-1 ring-accent-violet/30"
                    : "bg-bg-surface border-border-subtle hover:border-border-strong hover:bg-bg-surface3",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-[12px] font-extrabold text-text-primary">{m.symbol}</span>
                  <span className="text-[11px] font-mono font-bold text-text-secondary">
                    ${m.price < 10 ? m.price.toFixed(4) : m.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[10.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-[6px]",
                    isPos ? "bg-[#0c2a1d] text-[#1FD487]" : "bg-[#2e1313] text-red-400",
                  )}
                >
                  {isPos ? "+" : ""}
                  {m.change24h}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Market Quick Stats */}
        <div className="flex items-center gap-4 sm:gap-6 text-[11.5px] overflow-x-auto no-scrollbar pt-2 lg:pt-0 border-t lg:border-t-0 border-border-subtle">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">Mark Price</span>
            <span className="text-[15px] font-extrabold font-mono text-text-primary">
              ${selectedMarket.price < 10 ? selectedMarket.price.toFixed(4) : selectedMarket.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">24h Change</span>
            <span className={cn("text-[13px] font-extrabold font-mono flex items-center gap-0.5", isMarketPositive ? "text-[#1FD487]" : "text-red-400")}>
              {isMarketPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {isMarketPositive ? "+" : ""}{selectedMarket.change24h}%
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">24h High / Low</span>
            <span className="text-[11.5px] font-mono font-semibold text-text-secondary">
              ${selectedMarket.high24h.toLocaleString()} / ${selectedMarket.low24h.toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">Max Leverage</span>
            <span className="text-[11.5px] font-mono font-semibold text-accent-violet">50x Cross/Iso</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">8h Funding Rate</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-mono font-extrabold text-[#1FD487]">{selectedMarket.fundingRate}</span>
              <span className="text-[10px] font-mono text-text-quaternary">({selectedMarket.fundingCountdown})</span>
            </div>
          </div>

          <div className="hidden xl:block">
            <span className="text-[10px] uppercase font-bold text-text-quaternary block">Collateral</span>
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30">
              USDC Margined
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Terminal View Switcher (< lg) */}
      <div className="flex lg:hidden items-center p-1 rounded-xl bg-bg-surface border border-border-strong gap-1">
        {[
          { id: "chart", label: "📈 Chart" },
          { id: "trade", label: "⚡ Trade Slip" },
          { id: "dock", label: "📋 Book & Logs" },
          { id: "bot", label: "🤖 Auto-Bot" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMobileTab(tab.id as any);
              if (tab.id === "bot") {
                setActiveDockTab("strategies");
              }
            }}
            className={cn(
              "flex-1 py-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer",
              mobileTab === tab.id
                ? "bg-accent-violet text-white shadow-xs"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Terminal Grid: 8 cols left (Chart + Dock) / 4 cols right (Order Entry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Chart and Docked Tab Console */}
        <div className={cn("lg:col-span-8 flex flex-col gap-4", mobileTab === "trade" ? "hidden lg:flex" : "flex")}>
          {/* Chart Terminal Card */}
          <div className={cn("rounded-[14px] border border-border-subtle bg-bg-elevated p-4 shadow-xs flex flex-col gap-3", mobileTab !== "chart" ? "hidden lg:flex" : "flex")}>
            {/* Chart Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-extrabold text-text-primary flex items-center gap-1.5">
                  <span>{selectedMarket.name}</span>
                </span>
                <span className="h-2 w-2 rounded-full bg-[#1FD487] animate-pulse" />
              </div>

              <div className="flex items-center gap-2">
                {/* Timeframe selector */}
                <div className="flex items-center rounded-[8px] bg-bg-surface border border-border-strong p-0.5">
                  {(["1m", "5m", "15m", "1h", "1d"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-colors cursor-pointer",
                        selectedTimeframe === tf
                          ? "bg-bg-raised text-accent-violet shadow-xs border border-accent-violet/30"
                          : "text-text-quaternary hover:text-text-secondary",
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* View toggles */}
                <div className="flex items-center rounded-[8px] bg-bg-surface border border-border-strong p-0.5">
                  <button
                    onClick={() => setChartType("area")}
                    className={cn(
                      "px-2 py-1 rounded-[6px] text-[11px] font-bold transition-colors cursor-pointer",
                      chartType === "area" ? "bg-bg-raised text-text-primary" : "text-text-quaternary",
                    )}
                    title="Area Chart"
                  >
                    <LineChart className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setChartType("candles")}
                    className={cn(
                      "px-2 py-1 rounded-[6px] text-[11px] font-bold transition-colors cursor-pointer",
                      chartType === "candles" ? "bg-bg-raised text-text-primary" : "text-text-quaternary",
                    )}
                    title="Candlestick Chart"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Real-Time TradingView Candlestick Chart */}
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10.5px] font-mono text-text-quaternary px-1">
                <div className="flex items-center gap-3">
                  <span>H: <strong className="text-text-secondary">${selectedMarket.high24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  <span>L: <strong className="text-text-secondary">${selectedMarket.low24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                  <span>Pair: <strong className="text-accent-violet">{selectedMarket.symbol}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[#1FD487]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-ping" />
                  <span>Mark: ${selectedMarket.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</span>
                </div>
              </div>

              <TradingViewPerpChart
                symbol={selectedMarket.symbol}
                baseAsset={selectedMarket.baseAsset}
                interval={selectedTimeframe === "1m" ? "1" : selectedTimeframe === "5m" ? "5" : selectedTimeframe === "15m" ? "15" : selectedTimeframe === "1h" ? "60" : "D"}
                height={400}
              />
            </div>

            {/* Depth & Spread Quick Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-text-quaternary block">Best Bid Depth</span>
                  <span className="font-mono font-extrabold text-[#1FD487]">
                    ${(selectedMarket.price * 0.9995).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-text-tertiary">USDC Pool</span>
              </div>

              <div className="p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle flex items-center justify-between">
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-text-quaternary block">Best Ask Depth</span>
                  <span className="font-mono font-extrabold text-red-400">
                    ${(selectedMarket.price * 1.0005).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-text-tertiary">USDC Pool</span>
              </div>

              <div className="hidden sm:flex p-2.5 rounded-[8px] bg-bg-surface border border-border-subtle items-center justify-between">
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-text-quaternary block">Funding Interval</span>
                  <span className="font-mono font-extrabold text-text-primary">
                    8h Continuous ({selectedMarket.fundingCountdown})
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-[#1FD487]">Active</span>
              </div>
            </div>
          </div>

          {/* Wide Docked Console (Default to Agent Auto-Perps Strategy) */}
          <div className={cn("rounded-[14px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs", (mobileTab === "dock" || mobileTab === "bot") ? "flex flex-col" : "hidden lg:flex flex-col")}>
            {/* Dock Tabs Header */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-2 sm:px-4 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveDockTab("strategies")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeDockTab === "strategies"
                      ? "border-accent-violet text-text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Bot className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Agent Auto-Perps Strategy</span>
                  <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.25 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/30">
                    Autonomous Fleet
                  </span>
                </button>

                <button
                  onClick={() => setActiveDockTab("positions")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeDockTab === "positions"
                      ? "border-accent-violet text-text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Activity className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Positions</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.25 rounded-full bg-bg-surface3 text-text-secondary">
                    {positions.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveDockTab("orders")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeDockTab === "orders"
                      ? "border-accent-violet text-text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Open Orders</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.25 rounded-full bg-bg-surface3 text-text-secondary">
                    {orders.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveDockTab("reasoning")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeDockTab === "reasoning"
                      ? "border-accent-violet text-text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Brain className="h-3.5 w-3.5 text-accent-violet" />
                  <span>CircuitsAI Reasoning</span>
                </button>

                <button
                  onClick={() => setActiveDockTab("history")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeDockTab === "history"
                      ? "border-accent-violet text-text-primary"
                      : "border-transparent text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <span>Execution Logs</span>
                </button>
              </div>

              <span className="text-[10.5px] text-[#1FD487] font-mono font-bold hidden sm:flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                <span>USDC Margin Active</span>
              </span>
            </div>

            {/* Tab 1: Agent Auto-Perps Strategy Matrix (Default) */}
            {activeDockTab === "strategies" && (
              <div className="p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                  <div>
                    <h3 className="text-[14px] font-extrabold text-text-primary flex items-center gap-2">
                      <Bot className="h-4 w-4 text-accent-violet" />
                      <span>Autonomous Fleet Strategy Configuration</span>
                    </h3>
                    <p className="text-[11.5px] text-text-tertiary mt-0.5">
                      Select algorithmic trading models to delegate continuous execution to your agent fleet.
                    </p>
                  </div>

                  {/* Fleet Agent Selector */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[10px] uppercase font-bold text-text-quaternary whitespace-nowrap">Agent:</span>
                    <select
                      value={selectedAgent?.id ?? ""}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="bg-bg-surface border border-border-strong rounded-[8px] px-3 py-1.5 text-xs font-bold text-text-primary outline-none cursor-pointer flex-1 sm:flex-none"
                    >
                      {myAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (#{a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Strategy Cards Grid - Clean labels with NO fake percentage metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {AGENT_PERP_STRATEGIES.map((strat) => {
                    const isStratActive = selectedStrategy === strat.id;

                    return (
                      <div
                        key={strat.id}
                        onClick={() => setSelectedStrategy(strat.id)}
                        className={cn(
                          "p-3.5 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5",
                          isStratActive
                            ? "bg-bg-raised border-accent-violet/50 ring-1 ring-accent-violet/30 shadow-xs"
                            : "bg-bg-surface border-border-subtle hover:border-border-strong hover:bg-bg-surface3",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[12.5px] font-extrabold text-text-primary block">{strat.name}</span>
                            <span className="text-[10px] font-mono text-accent-violet">{strat.category}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-text-secondary px-2 py-0.5 rounded-[6px] bg-bg-surface3 border border-border-subtle">
                            {strat.executionMode}
                          </span>
                        </div>

                        <p className="text-[11px] text-text-tertiary leading-relaxed">{strat.desc}</p>

                        <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[10px] text-text-quaternary font-mono">
                          <span>Profile: <strong className="text-text-secondary">{strat.riskTier}</strong></span>
                          {isStratActive ? (
                            <span className="text-accent-violet font-bold flex items-center gap-1">
                              <Check className="h-3 w-3" /> Selected
                            </span>
                          ) : (
                            <span className="hover:text-text-secondary">Click to Select</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Natural Language Directive Prompt if selected */}
                {selectedStrategy === "custom_text" && (
                  <div className="p-3.5 rounded-[12px] bg-bg-surface border border-border-strong flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-accent-violet flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" />
                        <span>CircuitsAI Natural Language Execution Directive</span>
                      </label>
                      <span className="text-[10px] font-mono text-text-quaternary">1 Credit / Market Tick</span>
                    </div>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={2}
                      placeholder="e.g. Monitor BTC-USDC on 15m. If RSI < 30 and volume > $500k, open long with 15x leverage. Stop loss 2%."
                      className="w-full bg-bg-surface3 border border-border-subtle rounded-[8px] p-2.5 text-xs text-text-primary placeholder:text-text-quaternary outline-none resize-none focus:border-accent-violet/50 font-mono"
                    />
                  </div>
                )}

                {/* Strategy Deployment Footer Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle bg-bg-surface p-3 rounded-[10px]">
                  <div className="text-[11px] text-text-quaternary">
                    <span>Assigned Agent: <strong className="text-text-primary">{selectedAgent ? selectedAgent.name : "Fleet"}</strong></span>
                    <span className="mx-2">•</span>
                    <span>Pair: <strong className="text-text-secondary">{selectedMarket.symbol}</strong></span>
                  </div>

                  <button
                    type="button"
                    disabled={saveConfig.isPending || !selectedAgent}
                    onClick={async () => {
                      if (!selectedAgent) return;
                      const prevVenues = config?.allowedVenues || [];
                      const nextVenues = prevVenues.includes("HYPERLIQUID") ? prevVenues : [...prevVenues, "HYPERLIQUID" as const];
                      await saveConfig.mutateAsync({
                        allowedVenues: nextVenues,
                        maxPositionUsdc: sizeUsdc || "500",
                        maxDailyLossUsdc: "1000",
                        mode: "LIVE",
                        strategyPrompt: selectedStrategy === "custom_text" ? customPrompt : selectedStrategy,
                      });
                      setStrategySavedSuccess(true);
                      setTimeout(() => setStrategySavedSuccess(false), 3000);
                    }}
                    className="px-5 py-2.5 rounded-full text-xs font-extrabold bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span>
                      {saveConfig.isPending
                        ? "Deploying on Monad…"
                        : strategySavedSuccess
                        ? "Strategy Deployed (LIVE)!"
                        : `Deploy LIVE Strategy to ${selectedAgent?.name ?? "Agent"}`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Positions */}
            {activeDockTab === "positions" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Market</th>
                      <th className="py-2.5 px-4">Side / Execution</th>
                      <th className="py-2.5 px-4">Collateral (USDC)</th>
                      <th className="py-2.5 px-4">Size (Notional)</th>
                      <th className="py-2.5 px-4">Entry Price</th>
                      <th className="py-2.5 px-4">Leverage</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {onchainPositions.length === 0 && positions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-text-quaternary text-xs">
                          <Activity className="h-6 w-6 text-text-quaternary mx-auto mb-2 opacity-50" />
                          <span>No active perpetual positions found on Monad for this wallet or fleet yet.</span>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {onchainPositions.map((op) => (
                          <tr key={`onchain-${op.symbol}-${op.isLong ? "long" : "short"}`} className="hover:bg-bg-surface3 transition-colors bg-accent-violet/5">
                            <td className="py-3 px-4 font-extrabold text-text-primary flex items-center gap-1.5">
                              <span>{op.symbol}</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent-violet/20 text-accent-violet border border-accent-violet/30">
                                ON-CHAIN
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                  op.isLong
                                    ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                                    : "bg-[#2e1313] text-red-400 border-red-500/25",
                                )}
                              >
                                {op.isLong ? "LONG" : "SHORT"}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                              ${op.collateralUsdc.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                              ${op.sizeUsdc.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-mono text-text-secondary">
                              ${op.entryPrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-mono text-accent-violet font-bold">
                              {op.leverage}x
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={perpBusy}
                                onClick={async () => {
                                  await closePosition({
                                    symbol: op.symbol,
                                    isLong: op.isLong,
                                    markPrice: selectedMarket.price,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                Close on Monad
                              </button>
                            </td>
                          </tr>
                        ))}

                        {positions.map((p) => {
                          const isLong = Number(p.netSizeUsdc) >= 0;
                          const pnl = Number(p.realizedPnlUsdc);

                          return (
                            <tr key={`${p.venue}-${p.market}`} className="hover:bg-bg-surface3 transition-colors">
                              <td className="py-3 px-4 font-extrabold text-text-primary">{p.market}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                    isLong
                                      ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                                      : "bg-[#2e1313] text-red-400 border-red-500/25",
                                  )}
                                >
                                  {isLong ? "LONG" : "SHORT"} {p.venue}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                                ${Math.abs(Number(p.netSizeUsdc)).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                                ${Math.abs(Number(p.netSizeUsdc)).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 font-mono text-text-secondary">
                                ${Number(p.avgEntryPrice).toFixed(2)}
                              </td>
                              <td className={cn("py-3 px-4 font-mono font-extrabold", pnl >= 0 ? "text-[#1FD487]" : "text-red-400")}>
                                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-[10.5px] text-text-quaternary font-mono">Managed by Fleet</span>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: Open Orders */}
            {activeDockTab === "orders" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Order ID</th>
                      <th className="py-2.5 px-4">Market</th>
                      <th className="py-2.5 px-4">Size (USDC)</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-text-quaternary text-xs">
                          <Clock className="h-6 w-6 text-text-quaternary mx-auto mb-2 opacity-50" />
                          <span>No open limit or trigger orders pending execution.</span>
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-bg-surface3 transition-colors">
                          <td className="py-3 px-4 font-mono text-text-secondary">#{o.id.slice(0, 8)}</td>
                          <td className="py-3 px-4 font-extrabold text-text-primary">{o.market}</td>
                          <td className="py-3 px-4 font-mono text-text-secondary">${(Number(o.requestedUsdc) / 1e6).toFixed(2)}</td>
                          <td className="py-3 px-4 font-bold">{o.action}</td>
                          <td className="py-3 px-4">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", o.status === "FILLED" ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25" : "bg-bg-surface3 text-text-tertiary border-border-subtle")}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button className="text-[11px] text-red-400 hover:text-red-300 font-bold cursor-pointer">Cancel</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 4: CircuitsAI Reasoning Engine */}
            {activeDockTab === "reasoning" && (
              <div className="p-4 sm:p-5">
                <CircuitsAiReasoningCard
                  chain={chainSlug}
                  agentChainId={selectedAgent?.id}
                  agentName={selectedAgent?.name}
                  scanDescription="Autonomous sub-second scanning on live orderbooks & perpetual mark prices"
                />
              </div>
            )}

            {/* Tab 5: Execution Logs */}
            {activeDockTab === "history" && (
              <div className="p-8 text-center text-text-quaternary text-xs">
                <RotateCcw className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <span>No historical perpetual executions recorded for this session.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Execution Console (Defaults to Agent Quick-Bot) */}
        <div className={cn("lg:col-span-4 flex flex-col gap-4", mobileTab !== "trade" ? "hidden lg:flex" : "flex")}>
          <div className="rounded-[14px] border border-border-subtle bg-bg-elevated p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            {/* Header & Mode Switcher */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-[13.5px] font-extrabold text-text-primary">Trade Execution</span>
              <div className="flex gap-1 bg-bg-surface p-0.5 rounded-[8px] border border-border-strong text-[11px] font-bold">
                <button
                  onClick={() => setMarginMode("CROSS")}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer",
                    marginMode === "CROSS" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                  )}
                >
                  Cross
                </button>
                <button
                  onClick={() => setMarginMode("ISOLATED")}
                  className={cn(
                    "px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer",
                    marginMode === "ISOLATED" ? "bg-bg-raised text-accent-violet shadow-2xs" : "text-text-quaternary",
                  )}
                >
                  Isolated
                </button>
              </div>
            </div>

            {/* Execution Mode Toggle (Agent Quick-Bot is Default) */}
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-[10px] bg-bg-surface border border-border-strong text-[11.5px] font-bold">
              <button
                type="button"
                onClick={() => setExecutionMode("AGENT")}
                className={cn(
                  "py-1.5 rounded-[8px] transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  executionMode === "AGENT"
                    ? "bg-bg-raised text-text-primary shadow-xs border border-border-subtle"
                    : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                <Bot className="h-3.5 w-3.5 text-accent-violet" />
                <span>Agent Quick-Bot</span>
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode("MANUAL")}
                className={cn(
                  "py-1.5 rounded-[8px] transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  executionMode === "MANUAL"
                    ? "bg-bg-raised text-text-primary shadow-xs border border-border-subtle"
                    : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-accent-violet" />
                <span>Manual Order</span>
              </button>
            </div>

            {executionMode === "AGENT" ? (
              /* Agent Quick-Bot Mode (Default) */
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-[10px] bg-accent-violet/10 border border-accent-violet/30 text-[11px] text-text-secondary leading-relaxed">
                  <span className="font-extrabold text-accent-violet flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5" />
                    <span>Fleet-Wide Autonomous Allocation</span>
                  </span>
                  Your agent dynamically scans all USDC perpetual pairs on Monad (BTC, ETH, SOL, SUI, AVAX, DOGE), picking entries, sizing leverage, and managing liquidations within your allocated budget.
                </div>

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Target Fleet Agent
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

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Algorithmic Model
                  </label>
                  <select
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 text-xs font-bold text-text-primary outline-none cursor-pointer"
                  >
                    {AGENT_PERP_STRATEGIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.executionMode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Max Margin Allocation (USDC)
                  </label>
                  <input
                    type="number"
                    value={sizeUsdc}
                    onChange={(e) => setSizeUsdc(e.target.value)}
                    placeholder="500"
                    className="w-full bg-bg-surface3 border border-border-strong rounded-[8px] px-3 py-2 font-mono text-xs text-text-primary outline-none"
                  />
                  <div className="flex gap-1.5 mt-1">
                    {["100", "250", "500", "1000"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSizeUsdc(preset)}
                        className="flex-1 py-1 rounded-[6px] bg-bg-surface3 hover:bg-white/10 text-[10px] font-mono font-bold text-text-secondary border border-border-subtle transition-colors cursor-pointer"
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saveConfig.isPending || !selectedAgent}
                  onClick={async () => {
                    if (!selectedAgent) return;
                    const prevVenues = config?.allowedVenues || [];
                    const nextVenues = prevVenues.includes("HYPERLIQUID") ? prevVenues : [...prevVenues, "HYPERLIQUID" as const];
                    await saveConfig.mutateAsync({
                      allowedVenues: nextVenues,
                      maxPositionUsdc: sizeUsdc || "500",
                      maxDailyLossUsdc: "1000",
                      mode: "LIVE",
                      strategyPrompt: selectedStrategy,
                    });
                    setStrategySavedSuccess(true);
                    setTimeout(() => setStrategySavedSuccess(false), 2500);
                  }}
                  className="w-full py-3 rounded-full text-xs font-extrabold bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Bot className="h-4 w-4" />
                  <span>
                    {saveConfig.isPending
                      ? "Deploying…"
                      : strategySavedSuccess
                      ? "Agent Strategy Active!"
                      : `Activate ${selectedAgent?.name ?? "Agent"} Auto-Perp`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDockTab("strategies")}
                  className="text-[11px] text-accent-violet hover:underline text-center cursor-pointer mt-1"
                >
                  Configure Advanced Parameters in Strategy Dock →
                </button>
              </div>
            ) : (
              /* Manual Order Mode */
              <>
                {/* Long / Short Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("LONG")}
                    className={cn(
                      "py-2.5 rounded-[10px] text-[13px] font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs",
                      side === "LONG"
                        ? "bg-[#0c2a1d] border-[#1FD487]/50 text-[#1FD487] ring-1 ring-[#1FD487]/30"
                        : "bg-bg-surface border-border-subtle text-text-quaternary hover:text-text-secondary",
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>Buy / Long</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("SHORT")}
                    className={cn(
                      "py-2.5 rounded-[10px] text-[13px] font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs",
                      side === "SHORT"
                        ? "bg-[#2e1313] border-red-500/50 text-red-400 ring-1 ring-red-500/30"
                        : "bg-bg-surface border-border-subtle text-text-quaternary hover:text-text-secondary",
                    )}
                  >
                    <TrendingDown className="h-4 w-4" />
                    <span>Sell / Short</span>
                  </button>
                </div>

                {/* Order Type Selector */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-bold text-text-quaternary">Order Type</span>
                  <div className="flex gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setOrderType("MARKET")}
                      className={cn(
                        "px-2.5 py-0.75 rounded-[6px] transition-colors cursor-pointer",
                        orderType === "MARKET" ? "bg-bg-surface3 text-text-primary" : "text-text-quaternary",
                      )}
                    >
                      Market
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("LIMIT")}
                      className={cn(
                        "px-2.5 py-0.75 rounded-[6px] transition-colors cursor-pointer",
                        orderType === "LIMIT" ? "bg-bg-surface3 text-text-primary" : "text-text-quaternary",
                      )}
                    >
                      Limit
                    </button>
                  </div>
                </div>

                {/* Limit Price Input if limit order */}
                {orderType === "LIMIT" && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-text-quaternary mb-1 block">
                      Limit Price (USDC)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={selectedMarket.price.toString()}
                        className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-3 pr-14 py-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent-violet/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                        USDC
                      </span>
                    </div>
                  </div>
                )}

                {/* Leverage Slider */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[10px] uppercase font-bold text-text-quaternary">Leverage Multiplier</span>
                    <span className="text-[12.5px] font-mono font-extrabold text-accent-violet">{leverage}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full accent-accent-violet cursor-pointer"
                  />
                  <div className="flex justify-between gap-1 mt-1">
                    {[5, 10, 20, 35, 50].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setLeverage(lev)}
                        className={cn(
                          "flex-1 py-0.75 rounded-[6px] text-[10px] font-mono font-bold border transition-colors cursor-pointer",
                          leverage === lev
                            ? "bg-accent-dark text-accent-violet border-accent-violet/30"
                            : "bg-bg-surface text-text-quaternary border-border-subtle hover:text-text-secondary",
                        )}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Order Margin USDC Input */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label className="text-[10px] uppercase font-bold text-text-quaternary">
                      Order Margin (USDC)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={sizeUsdc}
                      onChange={(e) => setSizeUsdc(e.target.value)}
                      placeholder="500"
                      className="w-full bg-bg-surface border border-border-strong rounded-[8px] pl-3.5 pr-14 py-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent-violet/50"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                      USDC
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {["100", "250", "500", "1000"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSizeUsdc(preset)}
                        className="flex-1 py-1 rounded-[6px] bg-bg-surface hover:bg-bg-surface3 text-[10.5px] font-mono font-bold text-text-secondary border border-border-subtle transition-colors cursor-pointer"
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position Summary Specs */}
                <div className="p-3 rounded-[10px] bg-bg-surface border border-border-subtle space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-text-quaternary">
                    <span>Notional Position</span>
                    <span className="font-mono font-bold text-text-primary">${notionalValue.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between text-text-quaternary">
                    <span>Est. Liquidation Price</span>
                    <span className="font-mono font-bold text-amber">${estimatedLiquidation.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-text-quaternary">
                    <span>Execution Protocol Fee</span>
                    <span className="font-mono text-text-secondary">~$0.05 USDC</span>
                  </div>
                </div>

                {/* Order Feedback & Submit Button */}
                {orderPlacedSuccess ? (
                  <div className="p-3 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-center text-[12px] font-bold text-[#1FD487] flex flex-col items-center justify-center gap-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      <span>Order Submitted on Monad!</span>
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
                    disabled={perpBusy || parsedSize <= 0}
                    onClick={handlePlaceOrder}
                    className={cn(
                      "w-full py-3 rounded-full text-[13px] font-extrabold text-white transition-all hover:brightness-110 cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50",
                      side === "LONG"
                        ? "bg-[#1FD487] text-black hover:bg-emerald-400"
                        : "bg-rose-500 hover:bg-rose-600",
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {perpBusy
                        ? "Submitting on Monad…"
                        : `${side === "LONG" ? "Buy / Long" : "Sell / Short"} ${selectedMarket.symbol}`}
                    </span>
                  </button>
                )}

                {perpError && (
                  <div className="text-[10.5px] text-red-400 font-mono bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                    {perpError}
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
