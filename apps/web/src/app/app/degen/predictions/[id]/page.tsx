"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  ShieldCheck,
  Bot,
  ExternalLink,
  DollarSign,
  Clock,
  Check,
  Percent,
  Layers,
  BarChart3,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useMyAgents,
  useSinglePredictionMarket,
  useCircuitsPredictions,
  useDegenConfig,
  PredictionOutcome,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { CircuitsAiReasoningCard } from "@/components/degen";

export default function PredictionMarketDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: marketId } = use(params);
  const router = useRouter();
  const { chain, isConnected } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents } = useMyAgents();

  const { market, loading, error } = useSinglePredictionMarket(marketId);
  const { buyShares, busy: sdkBusy, error: sdkError } = useCircuitsPredictions();

  const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");
  const [stakeUsdc, setStakeUsdc] = useState<string>("50");
  const [betSuccess, setBetSuccess] = useState<boolean>(false);
  const [onchainTxHash, setOnchainTxHash] = useState<string | null>(null);

  // Agent bot configuration state
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedBotModel, setSelectedBotModel] = useState<string>("custom_text");
  const [customPrompt, setCustomPrompt] = useState<string>(
    "Monitor probability odds and oracle feeds. Accumulate shares when market is undervalued relative to fundamentals. Take profit before expiry.",
  );
  const [botDeployedSuccess, setBotDeployedSuccess] = useState<boolean>(false);

  const selectedAgent = (selectedAgentId && myAgents.find((a) => a.id === selectedAgentId)) || myAgents[0] || null;
  const { config, saveConfig } = useDegenConfig(chainSlug, selectedAgent?.id);

  // Payout math
  const parsedStake = parseFloat(stakeUsdc) || 0;
  const outcomePrice = market
    ? (selectedOutcome === "YES" ? market.yesPercent : market.noPercent) / 100
    : 0.5;
  const estimatedShares = outcomePrice > 0 ? (parsedStake / outcomePrice).toFixed(1) : "0.0";
  const potentialPayout = outcomePrice > 0 ? (parsedStake / outcomePrice).toFixed(2) : "0.00";
  const potentialProfit = outcomePrice > 0 ? (parseFloat(potentialPayout) - parsedStake).toFixed(2) : "0.00";

  const handlePlaceBet = async () => {
    if (parsedStake <= 0 || !market) return;
    try {
      const outcome = selectedOutcome === "YES" ? PredictionOutcome.YES : PredictionOutcome.NO;
      const res = await buyShares({
        marketId: market.id,
        question: market.title,
        outcome,
        amountUsdc: parsedStake,
        endTimeSeconds: market.endDateIso ? Math.floor(new Date(market.endDateIso).getTime() / 1000) : undefined,
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

  const handleDeployBot = async () => {
    if (!selectedAgent || !market) return;
    const prevVenues = config?.allowedVenues || [];
    const nextVenues = prevVenues.includes("SPORTYSTAKE_PREDICTIONS") ? prevVenues : [...prevVenues, "SPORTYSTAKE_PREDICTIONS" as const];
    const finalPrompt = selectedBotModel === "custom_text"
      ? customPrompt
      : selectedBotModel === "oracle_arb"
      ? `Oracle discrepancy arbitrage on "${market.title}". Frontrun spot feeds and capture mispricings on Monad.`
      : `NLP sentiment scalper on "${market.title}". Scan breaking crypto alpha and take momentum probability positions.`;

    await saveConfig.mutateAsync({
      allowedVenues: nextVenues,
      maxPositionUsdc: stakeUsdc || "100",
      maxDailyLossUsdc: "500",
      mode: "LIVE",
      strategyPrompt: finalPrompt,
    });
    setBotDeployedSuccess(true);
    setTimeout(() => setBotDeployedSuccess(false), 3000);
  };

  if (loading && !market) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 pb-20 flex flex-col gap-6">
        <div className="p-12 text-center text-text-quaternary font-mono text-sm">
          Loading market specifications from Polymarket &amp; Monad…
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 pb-20 flex flex-col gap-6">
        <div className="p-12 text-center text-text-quaternary flex flex-col items-center gap-3">
          <Scale className="h-10 w-10 text-text-tertiary opacity-40" />
          <span className="text-base font-bold text-text-primary">Prediction Market Not Found</span>
          <Link
            href="/degen/predictions"
            className="text-xs text-accent-violet hover:underline flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Prediction Markets Hub</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-20 flex flex-col gap-5">
      {/* Back to Markets Breadcrumb */}
      <div>
        <Link
          href="/degen/predictions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-tertiary hover:text-accent-violet transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Crypto Prediction Markets</span>
        </Link>
      </div>

      {/* Main Grid: Left Detailed Market View (8 cols) & Right Execution Slip (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Comprehensive Market Details */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Header Banner Card */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-accent-dark text-accent-violet font-mono text-[11px] font-extrabold border border-accent-violet/30">
                  {market.category}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-bg-surface3 text-text-secondary font-mono text-[10.5px] font-bold border border-border-subtle">
                  ${market.assetTag}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#0c2a1d] text-[#1FD487] font-mono text-[10.5px] font-bold border border-[#1FD487]/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                  <span>LIVE Settlement Pool</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-text-quaternary">
                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                <span>Ends: <strong className="text-text-secondary">{market.endsAt}</strong></span>
              </div>
            </div>

            <h1 className="text-[20px] md:text-[24px] font-extrabold text-text-primary leading-tight">
              {market.title}
            </h1>

            <p className="text-[13px] text-text-tertiary leading-relaxed">
              {market.desc}
            </p>

            {/* Quick Macro Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border-subtle/70">
              <div className="p-3 rounded-[10px] bg-bg-surface3/60 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block">YES Probability</span>
                <span className="text-[18px] font-mono font-extrabold text-[#1FD487]">
                  {market.yesPercent}% ({market.yesPercent}¢)
                </span>
              </div>

              <div className="p-3 rounded-[10px] bg-bg-surface3/60 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block">NO Probability</span>
                <span className="text-[18px] font-mono font-extrabold text-red-400">
                  {market.noPercent}% ({market.noPercent}¢)
                </span>
              </div>

              <div className="p-3 rounded-[10px] bg-bg-surface3/60 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block">Settlement Network</span>
                <span className="text-[18px] font-mono font-extrabold text-accent-violet">
                  Monad
                </span>
              </div>

              <div className="p-3 rounded-[10px] bg-bg-surface3/60 border border-border-subtle">
                <span className="text-[10px] uppercase font-bold text-text-quaternary block">Total Liquidity</span>
                <span className="text-[18px] font-mono font-extrabold text-text-primary">
                  {market.liquidityUsdc}
                </span>
              </div>
            </div>
          </div>

          {/* Probability Distribution Visualizer */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent-violet" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Market Probability Distribution
                </h3>
              </div>
              <span className="text-[11px] font-mono text-text-quaternary">
                Polymarket UMA &amp; Pyth Oracle Feed
              </span>
            </div>

            {/* Split Distribution Bar */}
            <div className="flex flex-col gap-2">
              <div className="h-5 w-full rounded-full bg-bg-surface3 overflow-hidden border border-border-strong flex">
                <div
                  style={{ width: `${market.yesPercent}%` }}
                  className="h-full bg-[#1FD487] flex items-center justify-start pl-3 text-[10px] font-mono font-bold text-black"
                >
                  {market.yesPercent > 15 ? `YES ${market.yesPercent}%` : ""}
                </div>
                <div
                  style={{ width: `${market.noPercent}%` }}
                  className="h-full bg-rose-500 flex items-center justify-end pr-3 text-[10px] font-mono font-bold text-white"
                >
                  {market.noPercent > 15 ? `NO ${market.noPercent}%` : ""}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-[#1FD487]">YES Outcome: {market.yesPercent}¢ per share</span>
                <span className="text-red-400">NO Outcome: {market.noPercent}¢ per share</span>
              </div>
            </div>
          </div>

          {/* Settlement Rules & Resolution Oracle Details */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
              <ShieldCheck className="h-4 w-4 text-accent-violet" />
              <h3 className="text-[14px] font-extrabold text-text-primary">
                Settlement Rules &amp; Oracle Resolution
              </h3>
            </div>

            <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
              <p>
                This market resolves to <strong>YES</strong> if the underlying crypto condition is officially verified before the expiration timestamp. If the condition is not met by the deadline, the market settles to <strong>NO</strong>.
              </p>

              <div className="p-3.5 rounded-[10px] bg-bg-surface3/60 border border-border-subtle space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-quaternary">Oracle Provider:</span>
                  <span className="font-bold text-text-primary">{market.oracleSource} (Optimistic Oracle)</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-quaternary">Settlement Vault:</span>
                  <span className="font-bold text-[#1FD487]">CircuitsPredictionVault (Monad)</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-quaternary">Vault Contract Address:</span>
                  <span className="font-mono text-accent-violet">0x4489c873bF567A9A04032b3eA1317A42Eb424EEC</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-quaternary">Collateral Currency:</span>
                  <span className="font-bold text-text-primary">Native USDC (6 Decimals)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Autonomous Fleet AI Strategy Assignment for this Market */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-violet" />
                <h3 className="text-[14px] font-extrabold text-text-primary">
                  Deploy Autonomous Bot on this Market
                </h3>
              </div>
              <span className="text-[10.5px] font-mono text-[#1FD487] font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                <span>Agent Fleet Ready</span>
              </span>
            </div>

            {myAgents.length === 0 ? (
              <div className="text-xs text-text-quaternary p-4 bg-bg-surface3 rounded-[10px] text-center">
                No registered agents in your fleet. Register an agent in Fleet Command to enable autonomous prediction trading.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-quaternary mb-1.5 block">
                    Select Fleet Agent
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "custom_text", name: "Custom Prompt Directive", desc: "Define plain-English AI rules for this specific market." },
                    { id: "oracle_arb", name: "Oracle Divergence Scalp", desc: "Frontruns price lags between spot feeds and share pricing." },
                    { id: "sentiment_nlp", name: "Cognitive Sentiment AI", desc: "Scans continuous crypto social & dev sentiment signals." },
                  ].map((strat) => (
                    <div
                      key={strat.id}
                      onClick={() => setSelectedBotModel(strat.id)}
                      className={cn(
                        "p-3 rounded-[10px] border transition-all cursor-pointer flex flex-col gap-1",
                        selectedBotModel === strat.id
                          ? "bg-accent-dark/40 border-accent-violet/40 text-text-primary ring-1 ring-accent-violet/20"
                          : "bg-bg-surface3/40 border-border-subtle hover:border-border-strong text-text-tertiary",
                      )}
                    >
                      <span className="text-[11.5px] font-bold text-text-primary">{strat.name}</span>
                      <p className="text-[10px] text-text-quaternary leading-normal">{strat.desc}</p>
                    </div>
                  ))}
                </div>

                {selectedBotModel === "custom_text" && (
                  <div className="space-y-1.5 p-3 rounded-[10px] bg-bg-surface3/40 border border-border-subtle">
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-quaternary">
                      <span>Custom Prompt Strategy</span>
                      <span className="font-mono text-accent-violet">CircuitsAI NLP</span>
                    </div>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={3}
                      placeholder="e.g. Monitor market odds. Buy YES when price < 45¢ with >$20K liquidity. Take profit when probability reaches 75%..."
                      className="w-full bg-bg-surface border border-border-strong rounded-[8px] p-2.5 text-xs text-text-primary font-mono outline-none focus:border-accent-violet/50"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        "Accumulate YES when < 40¢, exit at 70¢",
                        "Buy NO if YES > 85% and > 20 days left",
                        "Arbitrage against Pyth spot divergence",
                      ].map((tpl) => (
                        <button
                          key={tpl}
                          type="button"
                          onClick={() => setCustomPrompt(tpl)}
                          className="px-2 py-0.5 rounded-[6px] bg-bg-surface hover:bg-white/10 text-[9.5px] font-mono text-text-tertiary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={saveConfig.isPending || !selectedAgent}
                  onClick={handleDeployBot}
                  className="w-full py-2.5 rounded-full text-xs font-extrabold bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>
                    {saveConfig.isPending
                      ? "Deploying to Monad…"
                      : botDeployedSuccess
                      ? "Bot Deployed on Market!"
                      : `Deploy Bot to Trade ${market.assetTag} Predictions`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Trade Slip */}
        <div className="lg:col-span-4 flex flex-col gap-5 sticky top-20">
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-[14px] font-extrabold text-text-primary">Trade Probability Shares</span>
              <span className="text-[11px] font-mono text-[#1FD487] font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                <span>Monad Live</span>
              </span>
            </div>

            {/* Outcome Buttons: YES vs NO */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedOutcome("YES")}
                className={cn(
                  "py-3 px-3 rounded-[10px] border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-xs",
                  selectedOutcome === "YES"
                    ? "bg-[#0c2a1d] border-[#1FD487]/50 text-[#1FD487] ring-1 ring-[#1FD487]/30"
                    : "bg-bg-surface3 border-border-subtle text-text-quaternary hover:text-text-secondary",
                )}
              >
                <span className="text-[13px] font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Buy YES</span>
                </span>
                <span className="text-[11.5px] font-mono font-bold">
                  {market.yesPercent}¢
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOutcome("NO")}
                className={cn(
                  "py-3 px-3 rounded-[10px] border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-xs",
                  selectedOutcome === "NO"
                    ? "bg-[#2e1313] border-red-500/50 text-red-400 ring-1 ring-red-500/30"
                    : "bg-bg-surface3 border-border-subtle text-text-quaternary hover:text-text-secondary",
                )}
              >
                <span className="text-[13px] font-extrabold flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Buy NO</span>
                </span>
                <span className="text-[11.5px] font-mono font-bold">
                  {market.noPercent}¢
                </span>
              </button>
            </div>

            {/* Purchase Amount Input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-text-quaternary mb-1.5 block">
                Purchase Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={stakeUsdc}
                  onChange={(e) => setStakeUsdc(e.target.value)}
                  placeholder="50"
                  className="w-full bg-bg-surface3 border border-border-strong rounded-[10px] pl-3.5 pr-14 py-2.5 font-mono text-[13px] text-text-primary outline-none focus:border-accent-violet/50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-quaternary">
                  USDC
                </span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {["10", "50", "100", "250", "500"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStakeUsdc(preset)}
                    className="flex-1 py-1 rounded-[6px] bg-bg-surface3 hover:bg-white/10 text-[10.5px] font-mono font-bold text-text-secondary border border-border-subtle transition-colors cursor-pointer"
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Payout Summary */}
            <div className="p-3.5 rounded-[10px] bg-bg-surface3/50 border border-border-subtle space-y-1.5 text-[11px]">
              <div className="flex justify-between text-text-quaternary">
                <span>Estimated Shares</span>
                <span className="font-mono font-bold text-text-primary">{estimatedShares} Shares</span>
              </div>
              <div className="flex justify-between text-text-quaternary">
                <span>Max Payout (If {selectedOutcome})</span>
                <span className="font-mono font-bold text-[#1FD487]">${potentialPayout} USDC</span>
              </div>
              <div className="flex justify-between text-text-quaternary">
                <span>Potential Net Return</span>
                <span className="font-mono font-bold text-[#1FD487]">
                  +{potentialProfit} USDC ({outcomePrice > 0 ? ((1 / outcomePrice - 1) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>

            {sdkError && (
              <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                {sdkError}
              </div>
            )}

            {/* Submit Action */}
            {betSuccess ? (
              <div className="p-3.5 rounded-[10px] bg-[#0c2a1d] border border-[#1FD487]/30 text-center text-[12px] font-bold text-[#1FD487] flex flex-col items-center justify-center gap-1 animate-fadeIn">
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
                    ? "Submitting on Monad…"
                    : `Buy ${selectedOutcome} Shares ($${parsedStake} USDC)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
