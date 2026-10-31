import Link from "next/link";
import {
  Coins,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Layers,
  ShieldAlert,
  BarChart3,
  Rocket,
  RefreshCw,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Memecoin Markets: Autonomous Bonding Curve & Momentum Trading",
  description:
    "Autonomous agents monitor new token launches, read curve dynamics, measure liquidity depth, and execute predefined momentum and buyback arbitrage strategies on Circuits Launchpad markets.",
  path: "/degen/memecoins",
  keywords: [
    "AI memecoin trading",
    "bonding curve trading bot",
    "crypto momentum agent",
    "Launchpad buyback arbitrage",
    "liquidity depth trading",
    "Monad meme tokens",
    "automated curve sniper",
    "token graduation trading",
  ],
});

const CURVE_STRATEGIES = [
  {
    title: "Momentum Trend-Following",
    desc: "Measures 5-minute buy volume acceleration and unique holder expansion to ride steep bonding curve surges.",
    tag: "High Velocity",
    typicalHold: "15m – 4h",
  },
  {
    title: "Early Curve Detection",
    desc: "Monitors block zero token creation events on the Launchpad with anti-snipe fee decay calculation.",
    tag: "Sub-Second",
    typicalHold: "1h – 24h",
  },
  {
    title: "Liquidity Depth Scaling",
    desc: "Calculates slippage impact against the constant-product curve, scaling entries to prevent excessive price impact.",
    tag: "Slippage Bounded",
    typicalHold: "2h – 12h",
  },
  {
    title: "Buyback Arbitrage",
    desc: "Times entries ahead of scheduled 20% fee-funded creator buybacks that market-buy and burn tokens.",
    tag: "Event Driven",
    typicalHold: "Cyclic",
  },
];

const FAQS = [
  {
    question: "How is Degen Memecoin trading different from the Token Launchpad?",
    answer:
      "The Launchpad is where creators launch and tokenize new AI agents with 100% public supply. The Degen Memecoin venue is where autonomous trading agents monitor, analyze, and execute algorithmic strategies (momentum, breakout, buyback arbitrage) across active bonding curves.",
  },
  {
    question: "How do agents trade against bonding curves?",
    answer:
      "Agents interact programmatically with constant-product bonding curve smart contracts on Monad. Orders execute against deterministic mathematical pricing curves using USDC collateral from isolated trading vaults.",
  },
  {
    question: "How does buyback arbitrage work?",
    answer:
      "Every token on the Launchpad routes 20% of trading fees into a dedicated buyback-and-burn reserve. Creators configure automated buyback cycles (Daily, Weekly, or Monthly). Agents monitor accumulated buyback reserves and time positioning around programmatic market-buy events.",
  },
  {
    question: "What happens when a token graduates to Sushi V3?",
    answer:
      "When accumulated curve reserves hit the graduation threshold (~2,900 USDC), liquidity automatically migrates to Uniswap v4 on Monad with permanently locked full-range LP position NFTs. Agents detect graduation events to adjust execution from bonding curve pricing to AMM pools.",
  },
  {
    question: "What risk guardrails prevent catastrophic losses in memecoins?",
    answer:
      "Memecoin trading operates under hard risk limits: maximum position caps per token, strict daily drawdown stop-losses (e.g. max -100 USDC/day), and an instant 1-click emergency panic halt.",
  },
];

export default function MemecoinMarketsMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
    { name: "Memecoin Markets", url: "https://circuitsprotocol.com/degen/memecoins" },
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
              <Flame className="h-3.5 w-3.5" /> BONDING CURVE AUTOMATION
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Trade the Curve <br className="hidden sm:inline" />
            <span className="text-accent-violet">Before the Crowd.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Autonomous agents monitor new token launches, read curve dynamics, measure liquidity, and execute predefined strategies on Circuits Launchpad markets.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/memecoins")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Memecoin Markets →
            </Link>
            <Link
              href={appUrl("/degen")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Configure Agent Strategy
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>CONSTANT-PRODUCT CURVES</span>
            <span>•</span>
            <span>LIQUIDITY DEPTH ENGINE</span>
            <span>•</span>
            <span>BUYBACK ARBITRAGE</span>
            <span>•</span>
            <span>ISOLATED VAULT</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "<100ms", lbl: "Curve Detection Latency" },
            { val: "20% Fee Pool", lbl: "Automated Buyback Reserves" },
            { val: "Sushi V3", lbl: "Automated LP Graduation" },
            { val: "100% Isolated", lbl: "Dedicated Margin Vault" },
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

        {/* 2. RAPID TOKEN LAUNCH TERMINAL & ACTIVITY STREAM */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Real-Time Curve Execution
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Autonomous Launchpad Intelligence
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Watch an agent detect, analyze, and execute against a newly launched bonding curve in sub-seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Terminal View Card */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald animate-pulse" />
                    <span className="font-bold text-text-primary">$DEGEN42 (Agent Token)</span>
                  </div>
                  <span className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30">
                    CURVE: 78% COMPLETE
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-text-secondary">
                    <span>Bonding Curve Reserve</span>
                    <span className="text-accent-violet font-bold">2,260 / 2,900 USDC</span>
                  </div>
                  <div className="h-2.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1FD487]" style={{ width: "78%" }} />
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-3 bg-bg-surface3 p-3.5 rounded-xl border border-border-subtle text-[11.5px]">
                  <div>
                    <span className="text-text-quaternary block text-[10px]">CURRENT PRICE</span>
                    <span className="font-bold text-text-primary">0.000084 USDC</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">1H VOLUME SPIKE</span>
                    <span className="font-bold text-emerald">+142.8%</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">BUYBACK RESERVE</span>
                    <span className="font-bold text-accent-violet">1,240 USDC</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">SIGNAL STRENGTH</span>
                    <span className="font-bold text-emerald">MOMENTUM: STRONG</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-text-tertiary">Graduation: Sushi V3</span>
                  <Link
                    href={appUrl("/degen/memecoins")}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                  >
                    Trade Curve →
                  </Link>
                </div>
              </div>

              {/* Streaming Activity Log */}
              <div className="lg:col-span-6 space-y-2.5 font-mono text-[11.5px]">
                <div className="text-[11px] font-bold text-text-quaternary uppercase mb-2">
                  AGENT EXECUTION TELEMETRY STREAM
                </div>
                {[
                  { time: "00:02.14", tag: "LAUNCH", text: "New bonding curve detected: $DEGEN42 on Monad block #984,102", color: "text-accent-violet" },
                  { time: "00:05.80", tag: "LIQUIDITY", text: "Reserve threshold passed 10,000 USDC (+18% depth increase)", color: "text-emerald" },
                  { time: "00:08.32", tag: "BUYBACK", text: "Buyback accumulator reached 1,240 USDC (Next cycle in 4h)", color: "text-accent-violet" },
                  { time: "00:11.45", tag: "SIGNAL", text: "Momentum score (0.89) exceeds strategy execution threshold", color: "text-emerald" },
                  { time: "00:12.01", tag: "EXECUTE", text: "Order placed: 250 USDC buy against curve (0.42% slippage)", color: "text-text-primary" },
                ].map((log) => (
                  <div
                    key={log.time}
                    className="p-2.5 rounded-xl bg-bg-raised border border-border-subtle flex items-center gap-2.5"
                  >
                    <span className="text-text-quaternary text-[10px] shrink-0">{log.time}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded bg-bg-surface3 shrink-0 ${log.color}`}>
                      {log.tag}
                    </span>
                    <span className="text-text-secondary truncate text-[11.5px]">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. CORE STORY: EVERY CURVE TELLS A STORY */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Decision Framework
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Every Curve Tells a Story
            </h2>
            <p className="text-[14px] text-text-secondary">
              Break down the autonomous agent's mathematical decision model into five discrete evaluation layers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { num: "01", title: "Launch Detection", desc: "Monitors initial curve deployments at block zero before retail discovery." },
              { num: "02", title: "Curve Analysis", desc: "Evaluates constant-product reserve ratios (x * y = k) and pricing slopes." },
              { num: "03", title: "Liquidity Depth", desc: "Computes order impact and simulates slippage bounds before position sizing." },
              { num: "04", title: "Momentum Velocity", desc: "Tracks buying acceleration, net volume delta, and unique buyer expansion." },
              { num: "05", title: "Buyback Arbitrage", desc: "Times positioning around scheduled 20% fee-funded creator buybacks." },
            ].map((step) => (
              <div
                key={step.num}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-4 flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/30 inline-block mb-3">
                    STEP {step.num}
                  </div>
                  <h3 className="text-[13.5px] font-bold text-text-primary mb-1.5">{step.title}</h3>
                  <p className="text-[11.5px] text-text-secondary leading-[1.6]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4. LAUNCHPAD INTEGRATION ARCHITECTURE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Ecosystem Symbiosis
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Launchpad Creates. Degen Trades.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                A seamless economic flywheel: the Launchpad provides fair-launch bonding curve tokens, and Degen agents provide continuous liquidity and price discovery.
              </p>
            </div>

            {/* Visual Flywheel */}
            <div className="max-w-240 mx-auto p-4 rounded-2xl bg-bg-surface3 border border-border-subtle text-[11px] font-mono text-center flex items-center justify-center gap-2 flex-wrap text-text-tertiary">
              <span className="text-accent-violet font-bold">TOKEN LAUNCHPAD</span>
              <span>➔</span>
              <span className="text-text-primary font-bold">BONDING CURVE</span>
              <span>➔</span>
              <span className="text-accent-violet font-bold">DEGEN AGENT</span>
              <span>➔</span>
              <span className="text-emerald font-bold">MOMENTUM TRADE</span>
              <span>➔</span>
              <span className="text-emerald font-bold">SUSHI GRADUATION</span>
            </div>
          </div>
        </Reveal>

        {/* 5. STRATEGY MODES */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Autonomous Configurations
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Configurable Strategy Blueprints
            </h2>
            <p className="text-[14px] text-text-secondary">
              Pre-built algorithmic execution templates to deploy on your agent's trading runtime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CURVE_STRATEGIES.map((strat) => (
              <div
                key={strat.title}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30">
                      {strat.tag}
                    </span>
                    <span className="text-[10px] font-mono text-text-quaternary">Hold: {strat.typicalHold}</span>
                  </div>
                  <h3 className="text-[15px] font-bold text-text-primary mb-2">{strat.title}</h3>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6] mb-4">{strat.desc}</p>
                </div>

                <div className="pt-3 border-t border-border-subtle">
                  <Link
                    href={appUrl("/degen/memecoins")}
                    className="text-[11.5px] font-bold text-accent-violet hover:underline inline-flex items-center gap-1 font-mono"
                  >
                    Configure Strategy <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 6. VISIBLE HONESTY ABOUT RISK & GUARDRAILS */}
        <Reveal>
          <div className="rounded-3xl border border-accent-orange/30 bg-accent-dark/30 p-6 md:p-8 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="h-12 w-12 rounded-2xl bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center text-accent-orange shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-[18px] font-bold text-text-primary mb-1">
                  High Volatility. Automated Execution Does Not Eliminate Market Risk.
                </h3>
                <p className="text-[13px] text-text-secondary leading-[1.6]">
                  Bonding curve tokens experience rapid price fluctuations. Circuits enforces hard on-chain capital guardrails so an aggressive trading strategy never risks catastrophic drawdown.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-accent-orange/20 font-mono text-[11.5px] text-center">
              <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">MAX POSITION CAP</div>
                <div className="text-accent-violet font-bold text-[13px] mt-0.5">Strict per-token cap</div>
              </div>
              <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">DAILY DRAWDOWN</div>
                <div className="text-accent-orange font-bold text-[13px] mt-0.5">Automated halt</div>
              </div>
              <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">PANIC STOP</div>
                <div className="text-text-primary font-bold text-[13px] mt-0.5">1-click liquidation</div>
              </div>
              <div className="bg-bg-raised p-2.5 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">PAPER SIMULATION</div>
                <div className="text-emerald font-bold text-[13px] mt-0.5">$100k zero-risk</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 7. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="memecoins" />
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
              Built for Algorithmic Curve Trading
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
                Let Your Agent Hunt the Next Curve.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Deploy momentum strategies on live bonding curves. Test safely in Paper Mode and automate execution with hard drawdown boundaries.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen/memecoins")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Explore Memecoin Markets →
                </Link>
                <Link
                  href={appUrl("/launchpad")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Token Launchpad
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
