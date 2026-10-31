"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins,
  Flame,
  Rocket,
  Search,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Activity,
  Layers,
  Copy,
  Check,
  Percent,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWallet,
  useMyAgents,
  useLaunchpadList,
  useDegenConfig,
  type LaunchpadListItem,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { CircuitsAiReasoningCard } from "@/components/degen";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatUsdCompact, formatTokenPrice, parseTokenPrice } from "@/lib/format";

const SNIPER_STRATEGIES = [
  {
    id: "genesis_snipe",
    name: "Genesis Block Sniper",
    desc: "Snipes freshly deployed bonding curves within the first 3 blocks (< 2.5s) with automated safety limits.",
    speed: "< 25ms",
    risk: "High Alpha",
  },
  {
    id: "grad_frontrun",
    name: "Graduation Front-Runner",
    desc: "Accumulates tokens passing 80% bonding progress before automatic Xero AMM pair migration.",
    speed: "Sub-Second",
    risk: "Moderate",
  },
  {
    id: "whale_mirror",
    name: "Top Fleet Copy-Trader",
    desc: "Mirrors buy actions from the top 3 highest-PnL autonomous agents on Circuits Protocol.",
    speed: "Instant",
    risk: "Balanced",
  },
  {
    id: "volume_surge",
    name: "Volume Surge Momentum Tracer",
    desc: "Detects sudden 10x volume surges in 1-minute candle intervals and executes entry orders.",
    speed: "Reactive",
    risk: "Medium",
  },
  {
    id: "circuits_ai_nlp",
    name: "Cognitive AI Social & On-Chain Sniping",
    desc: "Autonomous LLM reasoning engine filtering dev wallet activity, token distribution, and social momentum.",
    speed: "Adaptive",
    risk: "Alpha NLP",
  },
  {
    id: "custom_text",
    name: "Custom CircuitsAI Prompt Directive",
    desc: "Instruct your agent in plain English. CircuitsAI monitors launchpad events and executes trades autonomously.",
    speed: "AI-Tuned",
    risk: "Custom",
  },
];

export default function DegenMemecoinsPage() {
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents } = useMyAgents();
  const { launches, loading: launchesLoading } = useLaunchpadList("trending", 50);

  const [selectedLaunchId, setSelectedLaunchId] = useState<string>("0");
  const [amountUsdc, setAmountUsdc] = useState<string>("50");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedSniperStrat, setSelectedSniperStrat] = useState<string>("grad_frontrun");
  const [customPrompt, setCustomPrompt] = useState<string>(
    "Snipe any new token launch with liquidity > $2,000 USDC within 5 seconds. Max 50 USDC stake per token. Auto-sell 50% at 2x profit and stop loss at 25% drop.",
  );
  const [sniperAssignedSuccess, setSniperAssignedSuccess] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"launches" | "sniper">("launches");

  const selectedAgent = (selectedAgentId && myAgents.find((a) => a.id === selectedAgentId)) || myAgents[0] || null;
  const { config, saveConfig } = useDegenConfig(chainSlug, selectedAgent?.id);

  const selectedToken: LaunchpadListItem | null = useMemo(() => {
    if (selectedLaunchId && launches.length > 0) {
      const found = launches.find((l) => l.id === selectedLaunchId || l.launchChainId === selectedLaunchId);
      if (found) return found;
    }
    return launches[0] || null;
  }, [launches, selectedLaunchId]);

  const parsedPrice = selectedToken?.priceUsdc ? parseTokenPrice(selectedToken.priceUsdc) : 0.0001;
  const parsedRaised = selectedToken?.usdcRaised ? Number(selectedToken.usdcRaised) / 1e6 : 0;
  const parsedTarget = selectedToken?.graduationThreshold ? Number(selectedToken.graduationThreshold) / 1e6 : 12000;
  const bondingProgressPct = Math.min(100, Math.round((parsedRaised / (parsedTarget || 12000)) * 100));
  const remainingForGraduation = Math.max(0, parsedTarget - parsedRaised);

  const handleAssignSniper = async () => {
    if (!selectedAgent) return;
    const prevVenues = config?.allowedVenues || [];
    const nextVenues = prevVenues.includes("CLAWDHQ_LAUNCH") ? prevVenues : [...prevVenues, "CLAWDHQ_LAUNCH" as const];
    await saveConfig.mutateAsync({
      allowedVenues: nextVenues,
      maxPositionUsdc: amountUsdc || "100",
      maxDailyLossUsdc: "1000",
      mode: "LIVE",
      strategyPrompt: selectedSniperStrat === "custom_text" ? customPrompt : selectedSniperStrat,
    });
    setSniperAssignedSuccess(true);
    setTimeout(() => setSniperAssignedSuccess(false), 2500);
  };

  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-16 flex flex-col gap-4">
      {/* Mobile Tab Switcher (< lg) */}
      <div className="flex lg:hidden items-center p-1 rounded-xl bg-bg-surface border border-border-strong gap-1">
        {[
          { id: "launches", label: "🔥 Active Launches" },
          { id: "sniper", label: "🎯 Auto-Sniper Engine" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id as any)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
              mobileTab === tab.id
                ? "bg-accent-violet text-white shadow-xs"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Trending Tokens & Bonding Curve Radar */}
        <div className={cn("lg:col-span-7 flex flex-col gap-5", mobileTab !== "launches" ? "hidden lg:flex" : "flex")}>
          {/* King of the Hill / Featured Bonding Curve */}
          {selectedToken ? (
            <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={robotAvatarUrl(selectedToken.symbol || selectedToken.name)}
                    alt=""
                    className="h-11 w-11 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shadow-xs"
                  />
                  <div>
                    <div className="text-[16px] font-extrabold text-text-primary flex items-center gap-2">
                      <span>{selectedToken.name}</span>
                      <span className="text-[11px] font-mono font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-full border border-accent-violet/25">
                        ${selectedToken.symbol}
                      </span>
                      {selectedToken.graduated && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30">
                          Graduated to Xero AMM
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-quaternary font-mono mt-0.5">
                      Launch #{selectedToken.launchChainId} • Price: {formatTokenPrice(selectedToken.priceUsdc)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/launchpad/${selectedToken.launchChainId || selectedToken.id}`}
                    className="text-[11.5px] font-bold text-accent-violet hover:text-white px-3 py-1.5 rounded-[8px] bg-accent-dark border border-accent-violet/30 hover:bg-accent-violet transition-all flex items-center gap-1"
                  >
                    <span>View Launchpad</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>

                  <div className="text-right">
                    <div className="text-[18px] font-extrabold font-mono text-[#1FD487]">
                      {bondingProgressPct}%
                    </div>
                    <div className="text-[10px] uppercase font-bold text-text-quaternary">Bonding Progress</div>
                  </div>
                </div>
              </div>

              {/* Invariant Bonding Curve Visualizer */}
              <div className="rounded-[12px] bg-bg-surface3/40 border border-border-strong/60 p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[11px] font-bold text-text-secondary">Linear Invariant Bonding Curve</span>
                  <span className="font-mono text-[11px] text-text-quaternary">
                    {selectedToken.graduated ? (
                      <strong className="text-[#1FD487]">100% Complete — Liquidity Burned to Xero Pair</strong>
                    ) : (
                      <span>${remainingForGraduation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC remaining to trigger Graduation</span>
                    )}
                  </span>
                </div>

                {/* Curve Progress Bar */}
                <div className="h-4 w-full rounded-full bg-bg-surface3 overflow-hidden border border-border-strong p-0.5">
                  <div
                    style={{ width: `${bondingProgressPct}%` }}
                    className="h-full rounded-full bg-[#1FD487] transition-all duration-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                  <div className="p-2 rounded bg-bg-surface3 border border-border-subtle">
                    <span className="text-text-quaternary block text-[9.5px]">Market Cap</span>
                    <span className="font-bold text-text-primary">{formatUsdCompact(selectedToken.marketCapUsdc)}</span>
                  </div>
                  <div className="p-2 rounded bg-bg-surface3 border border-border-subtle">
                    <span className="text-text-quaternary block text-[9.5px]">Token Holders</span>
                    <span className="font-bold text-text-primary">{selectedToken.holdersCount || 1}</span>
                  </div>
                  <div className="p-2 rounded bg-bg-surface3 border border-border-subtle">
                    <span className="text-text-quaternary block text-[9.5px]">Raised on Curve</span>
                    <span className="font-bold text-[#1FD487]">
                      ${parsedRaised.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${parsedTarget.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-8 text-center text-text-quaternary text-xs">
              {launchesLoading ? "Loading active launches from Monad…" : "No active bonding curve launches found on Monad."}
            </div>
          )}

          {/* Token Directory Board */}
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-accent-violet" />
                <span className="text-[13.5px] font-extrabold text-text-primary">Live Launches on Monad</span>
              </div>
              <span className="text-[11px] text-text-quaternary font-mono">
                {launches.length} Token{launches.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="divide-y divide-border-subtle/50">
              {launchesLoading ? (
                <div className="p-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 bg-bg-raised rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : launches.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-quaternary">
                  No memecoin launches deployed yet on this chain.
                </div>
              ) : (
                launches.map((tok) => {
                  const isSelected = selectedToken?.id === tok.id;
                  const itemPrice = parseTokenPrice(tok.priceUsdc);
                  const itemRaised = tok.usdcRaised ? Number(tok.usdcRaised) / 1e6 : 0;
                  const itemTarget = tok.graduationThreshold ? Number(tok.graduationThreshold) / 1e6 : 12000;
                  const itemProgress = Math.min(100, Math.round((itemRaised / (itemTarget || 12000)) * 100));

                  return (
                    <div
                      key={tok.id}
                      onClick={() => setSelectedLaunchId(tok.id)}
                      className={cn(
                        "p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer hover:bg-bg-raised",
                        isSelected ? "bg-accent-dark/20" : "",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={robotAvatarUrl(tok.symbol || tok.name)}
                          alt=""
                          className="h-10 w-10 rounded-[8px] border border-border-strong shrink-0 object-cover bg-bg-surface3"
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-extrabold text-text-primary truncate flex items-center gap-1.5">
                            <span>{tok.name}</span>
                            <span className="text-[11px] font-mono text-accent-violet font-bold">(${tok.symbol})</span>
                          </div>
                          <div className="text-[10.5px] text-text-quaternary font-mono">
                            Cap {formatUsdCompact(tok.marketCapUsdc)} • Monad
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-[13px] font-mono font-extrabold text-text-primary">
                            {formatTokenPrice(tok.priceUsdc)}
                          </div>
                          <div className="text-[10.5px] font-mono font-bold text-[#1FD487]">
                            ${itemRaised.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Raised
                          </div>
                        </div>

                        <div className="w-24 hidden sm:block">
                          <div className="flex justify-between text-[9.5px] font-mono text-text-quaternary mb-0.5">
                            <span>Progress</span>
                            <span>{itemProgress}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-bg-surface3 overflow-hidden border border-border-strong">
                            <div
                              style={{ width: `${itemProgress}%` }}
                              className="h-full bg-[#1FD487]"
                            />
                          </div>
                        </div>

                        <Link
                          href={`/launchpad/${tok.launchChainId || tok.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-[6px] bg-bg-surface3 text-text-quaternary hover:text-accent-violet hover:bg-accent-dark transition-all shrink-0"
                          title="View Token Details &amp; Chart"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Autonomous Token Sniper Engine */}
        <div className={cn("lg:col-span-5 flex flex-col gap-5", mobileTab !== "sniper" ? "hidden lg:flex" : "flex")}>
          <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent-violet" />
                <span className="text-[14px] font-extrabold text-text-primary">Agent Auto-Sniper Engine</span>
              </div>
              <span className="text-[10.5px] text-[#1FD487] font-mono font-bold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                <span>Mempool Scanner Active</span>
              </span>
            </div>

            {myAgents.length === 0 ? (
              <div className="text-xs text-text-quaternary p-4 bg-bg-surface3/40 rounded-[10px] text-center">
                Register an agent in Fleet Command to deploy autonomous launchpad sniping algorithms.
              </div>
            ) : (
              <>
                <div className="p-3 rounded-[10px] bg-accent-violet/10 border border-accent-violet/30 text-[11px] text-text-secondary leading-relaxed">
                  <span className="font-extrabold text-accent-violet flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5" />
                    <span>Autonomous Launchpad Scanner</span>
                  </span>
                  Your agent monitors Monad bonding curves and new token launches 24/7, auto-sniping entries and front-running graduation thresholds within your budget.
                </div>

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

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-text-quaternary block">
                    Choose Sniper Policy
                  </label>
                  {SNIPER_STRATEGIES.map((strat) => {
                    const isStratActive = selectedSniperStrat === strat.id;

                    return (
                      <div
                        key={strat.id}
                        onClick={() => setSelectedSniperStrat(strat.id)}
                        className={cn(
                          "p-3 rounded-[10px] border transition-all cursor-pointer flex flex-col gap-1",
                          isStratActive
                            ? "bg-accent-dark/40 border-accent-violet/40 text-text-primary ring-1 ring-accent-violet/20"
                            : "bg-bg-surface3/40 border-border-subtle hover:border-border-strong text-text-tertiary",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-text-primary">{strat.name}</span>
                          <span className="text-[10px] font-mono font-bold text-[#1FD487]">{strat.speed}</span>
                        </div>
                        <p className="text-[10.5px] leading-normal text-text-quaternary">{strat.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Capital Allocation per Snipe */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-text-quaternary mb-1.5 block">
                    Max Capital Allocation Per Snipe (USDC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amountUsdc}
                      onChange={(e) => setAmountUsdc(e.target.value)}
                      placeholder="50"
                      className="w-full bg-bg-surface3 border border-border-strong rounded-[10px] pl-3.5 pr-14 py-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent-violet/50"
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
                        onClick={() => setAmountUsdc(preset)}
                        className="flex-1 py-1 rounded-[6px] bg-bg-surface3 hover:bg-white/10 text-[10.5px] font-mono font-bold text-text-secondary border border-border-subtle transition-colors cursor-pointer"
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Text-Based Strategy Directive */}
                {selectedSniperStrat === "custom_text" && (
                  <div className="space-y-1.5 p-3 rounded-[10px] bg-bg-surface3/70 border border-border-strong animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-accent-violet flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        <span>CircuitsAI Memecoin Directive</span>
                      </label>
                      <span className="text-[9.5px] font-mono text-text-quaternary">1 Credit / Tick</span>
                    </div>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={3}
                      placeholder="e.g. Snipe launches with liquidity > $2,000 within 5 seconds. Max 50 USDC per token."
                      className="w-full bg-bg-surface2 border border-border-subtle rounded-[8px] p-2.5 text-xs text-text-primary placeholder:text-text-quaternary outline-none resize-none focus:border-accent-violet"
                    />
                  </div>
                )}

                {/* CircuitsAI Cognitive Reasoning Card */}
                <CircuitsAiReasoningCard
                  chain={chainSlug}
                  agentChainId={selectedAgent?.id}
                  agentName={selectedAgent?.name}
                  scanDescription="Autonomous mempool scanning & graduation threshold detection on Monad"
                />

                {/* Human Owner Separate USDC Allocation Notice */}
                <div className="p-3 rounded-[10px] bg-bg-surface3/40 border border-border-subtle space-y-1 text-[10.5px]">
                  <div className="flex justify-between font-bold text-text-secondary">
                    <span>Funding Source:</span>
                    <span className="text-text-primary">Owner Degen Allocation (Hot Wallet)</span>
                  </div>
                  <p className="text-text-quaternary leading-relaxed">
                    Token purchases draw exclusively from the human owner's separate USDC trading allocation. Agent Smart Wallet &amp; Treasury are 100% isolated.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={saveConfig.isPending || !selectedAgent}
                  onClick={handleAssignSniper}
                  className="w-full py-3 rounded-full text-xs font-extrabold bg-accent-dark text-accent-violet border border-accent-violet/30 hover:bg-accent-violet hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>{saveConfig.isPending ? "Deploying on Monad…" : sniperAssignedSuccess ? "LIVE Sniper Strategy Deployed!" : `Equip LIVE Sniper to ${selectedAgent?.name ?? "Agent"}`}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
