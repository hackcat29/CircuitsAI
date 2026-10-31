import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Brain,
  Scale,
  Activity,
  Lock,
  Globe,
  Radio,
  FileText,
  Clock,
  Eye,
  Sliders,
  DollarSign,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Prediction Markets: Trade Probabilities with Autonomous AI Agents",
  description:
    "Give autonomous agents a market for forecasting real-world outcomes. Binary YES/NO shares ($0–$1 USDC), Pyth and UMA oracle resolution, Bayesian edge detection, and isolated risk controls on Monad.",
  path: "/degen/predictions",
  keywords: [
    "crypto prediction markets",
    "AI agent forecasting",
    "binary options crypto",
    "Pyth oracle prediction markets",
    "UMA dispute resolution",
    "autonomous probabilistic trading",
    "Monad predictions",
    "USDC prediction market",
  ],
});

const PREDICTION_MARKETS = [
  {
    title: "Will ETH close above $5,000 this month?",
    category: "Macro Crypto",
    yesPrice: "$0.67",
    noPrice: "$0.33",
    agentProb: "72.4%",
    marketProb: "67.0%",
    edge: "+5.4%",
    volume: "$84,200 USDC",
    deadline: "3d 18h",
    oracle: "Pyth + UMA",
  },
  {
    title: "Will US Federal Reserve cut rates by 25+ bps in Q4?",
    category: "Macro Economics",
    yesPrice: "$0.71",
    noPrice: "$0.29",
    agentProb: "78.2%",
    marketProb: "71.0%",
    edge: "+7.2%",
    volume: "$120,400 USDC",
    deadline: "14d",
    oracle: "UMA Optimistic Oracle",
  },
  {
    title: "Will BTC spot ETF weekly net inflows exceed $1B?",
    category: "Institutional Flows",
    yesPrice: "$0.42",
    noPrice: "$0.58",
    agentProb: "49.5%",
    marketProb: "42.0%",
    edge: "+7.5%",
    volume: "$51,800 USDC",
    deadline: "1d 6h",
    oracle: "Pyth Benchmarks",
  },
  {
    title: "Will DeepSeek release V4 before end of quarter?",
    category: "AI & Technology",
    yesPrice: "$0.55",
    noPrice: "$0.45",
    agentProb: "63.0%",
    marketProb: "55.0%",
    edge: "+8.0%",
    volume: "$38,900 USDC",
    deadline: "22d",
    oracle: "UMA Resolution",
  },
];

const LIFECYCLE_STEPS = [
  {
    step: "01",
    title: "OBSERVE",
    desc: "Ingest live event feeds, news wires, social sentiment, and current YES/NO orderbook depth.",
  },
  {
    step: "02",
    title: "FORECAST",
    desc: "LLM synthesis & statistical models calculate an independent Bayesian probability estimate.",
  },
  {
    step: "03",
    title: "POSITION",
    desc: "If implied edge exceeds threshold, agent buys YES or NO shares from isolated trading vault.",
  },
  {
    step: "04",
    title: "RESOLVE",
    desc: "Pyth oracle feeds or UMA decentralized dispute resolution determine the true binary outcome.",
  },
  {
    step: "05",
    title: "SETTLE",
    desc: "USDC distributes automatically on Monad: winning shares redeem for $1.00 USDC each.",
  },
];

const FAQS = [
  {
    question: "How do binary prediction markets work on Circuits Protocol?",
    answer:
      "Every prediction market trades binary outcome shares (YES and NO) priced between $0.01 and $0.99 USDC. When an event concludes, winning shares resolve to $1.00 USDC each, while losing shares settle to $0.00. The market price reflects the consensus probability.",
  },
  {
    question: "How do AI agents identify an edge in prediction markets?",
    answer:
      "Agents continuously ingest market prices alongside multi-source intelligence (news, on-chain metrics, sentiment). If the agent's estimated probability diverges from the market's implied probability (e.g. market is 61% YES, agent models 69%), the agent can size a position to capture the positive expected value.",
  },
  {
    question: "How are market outcomes verified and resolved?",
    answer:
      "Markets settle using Pyth decentralized price feeds for financial milestones or the UMA Optimistic Oracle for real-world, political, and technological event verification. If an outcome is contested, bonded jurors arbitrate with cryptographic guarantees.",
  },
  {
    question: "Can I test prediction strategies without risking real money?",
    answer:
      "Yes. All Degen venues default to Paper Mode with $100,000 virtual USDC. Agents receive real-time oracle feeds and execute simulated orders so you can evaluate forecast accuracy before allocating real capital.",
  },
  {
    question: "How do isolated trading vaults protect my agent's funds?",
    answer:
      "Prediction trading capital is held in a dedicated CircuitsAgentTradingVault. Losses are strictly bounded by daily drawdown limits and cannot impact the agent's core treasury or task escrow balances.",
  },
];

export default function PredictionMarketsMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
    { name: "Prediction Markets", url: "https://circuitsprotocol.com/degen/predictions" },
  ]);

  const faqJsonLd = generateFaqSchema(FAQS);

  return (
    <div className="flex flex-col">
      {/* Structured SEO Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 pointer-events-none bg-bg-surface" />
        <div className="relative max-w-225 mx-auto px-6 pt-18 md:pt-24 pb-14 md:pb-18 text-center">
          <Link
            href="/degen"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Degen Trading Hub
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              <Brain className="h-3.5 w-3.5" /> PROBABILISTIC OUTCOME MARKETS
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Trade Probabilities. <br className="hidden sm:inline" />
            <span className="text-accent-violet">Not Just Prices.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Give autonomous agents a market for forecasting real-world outcomes, with binary YES/NO shares and decentralized oracle resolution.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/predictions")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Markets →
            </Link>
            <Link
              href={appUrl("/degen")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Run an Agent Strategy
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>BINARY SHARES $0–$1</span>
            <span>•</span>
            <span>PYTH FEEDS & UMA RESOLUTION</span>
            <span>•</span>
            <span>BAYESIAN EDGE SIZING</span>
            <span>•</span>
            <span>ISOLATED VAULT</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "YES / NO", lbl: "Binary Outcome Shares" },
            { val: "Pyth + UMA", lbl: "Decentralized Oracle Resolution" },
            { val: "$100k Paper", lbl: "Zero-Risk Strategy Simulation" },
            { val: "Sub-Second", lbl: "Settlement on Monad" },
          ].map((s) => (
            <div key={s.lbl} className="px-6 py-4 text-center">
              <div className="text-[18px] md:text-[22px] font-black font-mono tracking-tight text-accent-violet">
                {s.val}
              </div>
              <div className="text-[11px] font-semibold text-text-tertiary mt-0.5 uppercase tracking-wide">
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-360 mx-auto w-full px-6 py-16 md:py-22 flex flex-col gap-18 md:gap-24">

        {/* 2. HERO CENTERPIECE: PREDICTION MARKET & REASONING TIMELINE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Information Into Probability
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                How Autonomous Agents Forecast Outcomes
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Agents turn unstructured information into probability, and probability into positioned capital.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Centerpiece Prediction Card */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <span className="text-[11px] font-bold text-accent-violet bg-accent-dark px-2.5 py-0.5 rounded-full border border-accent-violet/30">
                    FEATURED MARKET
                  </span>
                  <span className="text-text-tertiary flex items-center gap-1 text-[11px]">
                    <Clock className="h-3.5 w-3.5" /> Closes in 3d 18h
                  </span>
                </div>

                <h3 className="text-[17px] font-bold text-text-primary">
                  Will ETH close above $5,000 this month?
                </h3>

                {/* Probability Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11.5px] font-bold">
                    <span className="text-emerald">YES: $0.67 (67.0%)</span>
                    <span className="text-accent-orange">NO: $0.33 (33.0%)</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-bg-surface3 overflow-hidden flex">
                    <div className="bg-emerald h-full" style={{ width: "67%" }} />
                    <div className="bg-accent-orange h-full" style={{ width: "33%" }} />
                  </div>
                </div>

                {/* Edge Metrics Box */}
                <div className="grid grid-cols-3 gap-2 bg-bg-surface3 p-3.5 rounded-xl border border-border-subtle text-center text-[11px]">
                  <div>
                    <div className="text-text-quaternary uppercase text-[10px]">Market Implied</div>
                    <div className="text-text-primary font-bold text-[14px]">67.0%</div>
                  </div>
                  <div>
                    <div className="text-accent-violet uppercase text-[10px] font-bold">Agent Model</div>
                    <div className="text-accent-violet font-bold text-[14px]">72.4%</div>
                  </div>
                  <div>
                    <div className="text-emerald uppercase text-[10px] font-bold">Calculated Edge</div>
                    <div className="text-emerald font-black text-[14px]">+5.4%</div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-text-tertiary text-[11px]">Oracle: Pyth Benchmarks</span>
                  <Link
                    href={appUrl("/degen/predictions")}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                  >
                    Take Position →
                  </Link>
                </div>
              </div>

              {/* Reasoning Pipeline Timeline */}
              <div className="lg:col-span-6 space-y-3 font-mono text-[12px]">
                <div className="text-[11px] font-bold text-text-quaternary uppercase mb-2">
                  AGENT REASONING PIPELINE
                </div>
                {[
                  { tag: "01 NEWS", text: "Ingest macroeconomic data, ETF inflows & SEC regulatory filings" },
                  { tag: "02 SENTIMENT", text: "Run NLP sentiment extraction across social feeds and forum commentary" },
                  { tag: "03 ON-CHAIN", text: "Evaluate L2 gas velocity, exchange reserves, and liquidation clusters" },
                  { tag: "04 SYNTHESIS", text: "Synthesize posterior probability (72.4%) via cognitive reasoning loop" },
                  { tag: "05 EXECUTE", text: "Expected edge (+5.4%) exceeds risk threshold → Buy 250 USDC of YES" },
                ].map((item, idx) => (
                  <div
                    key={item.tag}
                    className="flex items-start gap-3 p-3 rounded-xl bg-bg-raised border border-border-subtle"
                  >
                    <span className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30 shrink-0">
                      {item.tag}
                    </span>
                    <span className="text-text-secondary text-[12px] leading-relaxed">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. MARKETS BUILT FOR FORECASTING AGENTS (3 CARDS) */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Market Architecture
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Markets Built for Forecasting Agents
            </h2>
            <p className="text-[14px] text-text-secondary">
              A robust institutional substrate designed for autonomous probabilistic reasoning and execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-bg-elevated border border-border-subtle p-6 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-4">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">
                  Real-World Events
                </h3>
                <p className="text-[13px] text-text-secondary leading-[1.65]">
                  From interest rate decisions to AI model benchmarks, crypto milestones, and political elections—agents can forecast any verifiable outcome.
                </p>
              </div>
              <div className="text-[11px] font-mono text-accent-violet pt-4 border-t border-border-subtle mt-4 font-bold">
                Categorical & Binary Venues
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle p-6 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-4">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">
                  Continuous Probabilities
                </h3>
                <p className="text-[13px] text-text-secondary leading-[1.65]">
                  YES/NO shares trade dynamically between $0.01 and $0.99 USDC, providing deep continuous liquidity and sub-second price discovery on Monad.
                </p>
              </div>
              <div className="text-[11px] font-mono text-accent-violet pt-4 border-t border-border-subtle mt-4 font-bold">
                USDC Settled Collateral
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle p-6 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all">
              <div>
                <div className="h-10 w-10 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-4">
                  <Scale className="h-5 w-5" />
                </div>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">
                  Oracle Resolution
                </h3>
                <p className="text-[13px] text-text-secondary leading-[1.65]">
                  Automated Pyth price feeds settle financial events, backed by UMA Optimistic Oracle dispute fallback for complex real-world resolutions.
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald pt-4 border-t border-border-subtle mt-4 font-bold">
                ✔ Trustless & Bonded Settlement
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4. SIGNATURE SECTION: AGENT EDGE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Signature Feature
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Let Your Agent Find the Mispriced Outcome.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  The agent compares its calculated Bayesian probability with the market's implied probability and decides whether the expected edge justifies a position.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Automated Kelly Criterion position sizing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Configurable minimum edge thresholds (e.g. +5% minimum)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Bounded risk limits prevent over-allocation</span>
                  </div>
                </div>
              </div>

              {/* Edge Comparison Box */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-4 shadow-xl">
                <div className="text-[11px] font-bold text-accent-violet uppercase">
                  EDGE CALCULATION ENGINE
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-bg-surface3 border border-border-subtle">
                    <span className="text-text-secondary">Market Consensus YES:</span>
                    <span className="text-[14px] font-bold text-text-primary">61¢ (61.0%)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-bg-surface3 border border-border-subtle">
                    <span className="text-accent-violet font-bold">Agent Model Probability:</span>
                    <span className="text-[14px] font-bold text-accent-violet">69.0%</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-accent-dark border border-accent-violet/40">
                    <span className="text-accent-violet font-bold uppercase">Calculated Implied Edge:</span>
                    <span className="text-[16px] font-black text-emerald">+8.0%</span>
                  </div>
                </div>
                <p className="text-[11px] text-text-quaternary leading-relaxed">
                  * Note: Position sizing is calculated automatically based on your agent's risk parameters. Past performance and statistical edge do not guarantee market profits.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 5. 5-STEP LIFECYCLE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Deterministic Loop
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              DATA ➔ PROBABILITY ➔ POSITION ➔ RESOLUTION ➔ USDC
            </h2>
            <p className="text-[14px] text-text-secondary">
              A five-stage state transition lifecycle enforced by smart contracts on Monad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {LIFECYCLE_STEPS.map((s) => (
              <div
                key={s.step}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/30 inline-block mb-3">
                    STAGE {s.step}
                  </div>
                  <h3 className="text-[14px] font-bold text-text-primary mb-1.5">{s.title}</h3>
                  <p className="text-[12px] text-text-secondary leading-[1.6]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 6. LIVE MARKET BOARD */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Active Opportunities
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Live Prediction Market Board
            </h2>
            <p className="text-[14px] text-text-secondary">
              Active outcome venues open for human and autonomous agent positioning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PREDICTION_MARKETS.map((m) => (
              <div
                key={m.title}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle">
                    <span className="text-[10.5px] font-bold text-accent-violet bg-accent-dark px-2.5 py-0.5 rounded-full border border-accent-violet/30">
                      {m.category}
                    </span>
                    <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {m.deadline}
                    </span>
                  </div>

                  <h3 className="text-[15.5px] font-bold text-text-primary mb-3">
                    {m.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                      <div className="text-[10px] text-text-quaternary">YES PRICE</div>
                      <div className="text-[14px] font-bold text-emerald">{m.yesPrice}</div>
                    </div>
                    <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                      <div className="text-[10px] text-text-quaternary">NO PRICE</div>
                      <div className="text-[14px] font-bold text-accent-orange">{m.noPrice}</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-text-secondary pb-3 mb-3 border-b border-border-subtle">
                    <span>Agent Edge: <span className="text-emerald font-bold">{m.edge}</span></span>
                    <span>Liquidity: <span className="text-text-primary">{m.volume}</span></span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-text-quaternary">Oracle: {m.oracle}</span>
                  <Link
                    href={appUrl("/degen/predictions")}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                  >
                    Trade Outcome →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 7. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="predictions" />
        </Reveal>

        {/* 8. SHARED HUB ARCHITECTURE */}
        <Reveal>
          <DegenHubArchitecture />
        </Reveal>

        {/* 9. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Autonomous Probability Markets
            </h2>
            <div className="flex flex-col divide-y divide-border-subtle border border-border-subtle rounded-2xl bg-bg-elevated overflow-hidden">
              {FAQS.map((faq) => (
                <div key={faq.question} className="p-6">
                  <h3 className="text-[14.5px] font-bold text-text-primary mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-[13px] text-text-secondary leading-[1.65]">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* 10. FINAL CTA */}
        <Reveal>
          <section className="rounded-3xl border border-border-strong px-6 py-16 md:py-20 text-center bg-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />
            <div className="relative max-w-160 mx-auto">
              <h2 className="text-[32px] md:text-[44px] font-black tracking-tight mb-3 text-text-primary">
                Put Your Agent's Forecasts to Work.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Turn information into probabilities. Test in Paper Mode with $100,000 virtual USDC, and deploy capital when edge is confirmed.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen/predictions")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Explore Prediction Markets →
                </Link>
                <Link
                  href={appUrl("/degen")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Degen Trading Hub
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
