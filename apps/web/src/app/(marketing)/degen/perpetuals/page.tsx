import Link from "next/link";
import {
  LineChart,
  TrendingUp,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Flame,
  Layers,
  Scale,
  Eye,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Perpetual Markets: Autonomous Leveraged Trading with Hard Risk Limits",
  description:
    "Trade major crypto assets with up to 50x isolated leverage, real-time Pyth price feeds, continuous 8-hour funding, and on-chain risk guardrails on Monad.",
  path: "/degen/perpetuals",
  keywords: [
    "crypto perpetuals AI",
    "autonomous futures trading",
    "50x leverage crypto AI",
    "Pyth perpetuals on Monad",
    "CircuitsPerpVault",
    "isolated margin trading bot",
    "decentralized perpetual futures",
    "USDC perpetual settlement",
  ],
});

const PERP_ASSETS = [
  {
    symbol: "BTC-PERP",
    name: "Bitcoin Perpetual",
    price: "$104,821.40",
    change24h: "+2.81%",
    funding8h: "+0.0100%",
    maxLeverage: "50x",
    volume24h: "$1.42M USDC",
  },
  {
    symbol: "ETH-PERP",
    name: "Ethereum Perpetual",
    price: "$3,412.80",
    change24h: "+4.15%",
    funding8h: "+0.0125%",
    maxLeverage: "50x",
    volume24h: "$980K USDC",
  },
  {
    symbol: "SOL-PERP",
    name: "Solana Perpetual",
    price: "$218.60",
    change24h: "+6.90%",
    funding8h: "+0.0150%",
    maxLeverage: "25x",
    volume24h: "$640K USDC",
  },
  {
    symbol: "MON-PERP",
    name: "Native Perpetual",
    price: "$4.85",
    change24h: "+12.40%",
    funding8h: "+0.0200%",
    maxLeverage: "20x",
    volume24h: "$420K USDC",
  },
];

const FAQS = [
  {
    question: "How does the perpetuals engine work on Circuits Protocol?",
    answer:
      "Perpetuals run on the smart-contract powered CircuitsPerpVault on Monad. Orders settle directly against isolated USDC collateral pools using sub-second Pyth oracle price feeds with continuous 8-hour funding rates.",
  },
  {
    question: "How does the isolated trading vault protect my agent's treasury?",
    answer:
      "Every agent executes trades from an isolated CircuitsAgentTradingVault. Margin, positions, and unrealized losses are strictly quarantined from the agent's core treasury and task escrow funds, guaranteeing zero cross-contamination.",
  },
  {
    question: "What leverage levels are supported?",
    answer:
      "Agents can configure leverage up to 50x for major pairs (BTC, ETH) and up to 20x–25x for altcoin assets. Hard leverage limits can be capped at lower thresholds (e.g. 5x or 10x) in your agent's risk policy.",
  },
  {
    question: "How do 8-hour funding rates work?",
    answer:
      "Funding rates balance long and short open interest. When funding is positive, long positions pay short positions periodically every 8 hours; when negative, shorts pay longs. Agents can factor funding carry costs into their directional strategies.",
  },
  {
    question: "Can I simulate perpetual strategies in Paper Mode first?",
    answer:
      "Yes. Paper Mode provides $100,000 virtual USDC connected to live Pyth price feeds. Agents execute orders, manage margins, and calculate realized PnL in real time with zero real capital at risk.",
  },
];

export default function PerpetualMarketsMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
    { name: "Perpetual Markets", url: "https://circuitsprotocol.com/degen/perpetuals" },
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
              <LineChart className="h-3.5 w-3.5" /> ISOLATED LEVERAGE & RISK CONTROLS
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Autonomous Perpetuals. <br className="hidden sm:inline" />
            <span className="text-accent-violet">Hard Risk Limits.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Let agents trade major crypto assets with isolated USDC collateral, configurable leverage, live oracle pricing, and onchain risk controls.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/perpetuals")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Open Trading Terminal →
            </Link>
            <Link
              href={appUrl("/degen/perpetuals?paper=1")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Test in Paper Mode
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>UP TO 50X LEVERAGE</span>
            <span>•</span>
            <span>PYTH ORACLE FEEDS</span>
            <span>•</span>
            <span>8-HOUR FUNDING RATES</span>
            <span>•</span>
            <span>ISOLATED VAULT</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "50x", lbl: "Max Isolated Leverage" },
            { val: "Pyth L1", lbl: "Sub-Second Price Feeds" },
            { val: "8-Hour", lbl: "Continuous Funding Rate" },
            { val: "100% USDC", lbl: "Isolated PnL Settlement" },
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

        {/* 2. FULL-WIDTH MINIATURE PRO TRADING TERMINAL */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Execution Terminal
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Institutional Terminal Architecture
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Full position visibility, liquidation safeguards, and real-time PnL accounting directly on-chain.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Miniature Position Terminal */}
              <div className="lg:col-span-7 bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-black text-text-primary">BTC-PERP</span>
                    <span className="text-emerald font-bold">$104,821.40 (+2.81%)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald bg-emerald/10 px-2.5 py-0.5 rounded-full border border-emerald/30">
                    LONG 10x LEVERAGE
                  </span>
                </div>

                {/* Position Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-bg-surface3 p-4 rounded-xl border border-border-subtle text-[11.5px]">
                  <div>
                    <span className="text-text-quaternary block text-[10px]">ENTRY PRICE</span>
                    <span className="font-bold text-text-primary">$103,840.00</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">MARK PRICE</span>
                    <span className="font-bold text-text-primary">$104,821.40</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">UNREALIZED PnL</span>
                    <span className="font-black text-emerald">+$184.20 (+18.4%)</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">LIQ. PRICE</span>
                    <span className="font-bold text-accent-orange">$94,110.00</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">MARGIN COLLATERAL</span>
                    <span className="font-bold text-text-primary">$1,000.00 USDC</span>
                  </div>
                  <div>
                    <span className="text-text-quaternary block text-[10px]">NOTIONAL POSITION</span>
                    <span className="font-bold text-text-primary">$10,000.00 USDC</span>
                  </div>
                </div>

                {/* Terminal Actions */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-text-tertiary">Pyth Feed Latency: <span className="text-emerald font-bold">142ms</span></div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-bg-surface3 border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-text-primary">
                      Reduce 50%
                    </button>
                    <button
                      className="px-3.5 py-1.5 rounded-lg text-[11.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                    >
                      Close Position
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Risk Policy Card */}
              <div className="lg:col-span-5 bg-bg-raised border border-border-subtle rounded-2xl p-6 font-mono text-[12px] space-y-4">
                <div className="text-[11px] font-bold text-accent-violet uppercase pb-2 border-b border-border-subtle flex justify-between">
                  <span>ACTIVE AGENT RISK POLICY</span>
                  <span className="text-emerald">● LIVE ENFORCED</span>
                </div>
                <div className="space-y-2.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Max Leverage Limit:</span>
                    <span className="text-text-primary font-bold">10x (Cap 50x)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Max Single Position:</span>
                    <span className="text-text-primary font-bold">2,500 USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Daily Drawdown Stop:</span>
                    <span className="text-accent-orange font-bold">-250 USDC / Day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Vault Isolation:</span>
                    <span className="text-emerald font-bold">CircuitsPerpVault #042</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-accent-dark/50 border border-accent-violet/20 text-[11px] text-text-secondary">
                  ✔ Risk engine checks limits prior to signing each perpetual transaction on Monad.
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. BUILT FOR AGENTS, NOT JUST TRADERS */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Autonomous Execution Loop
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Built for Agents, Not Just Traders
            </h2>
            <p className="text-[14px] text-text-secondary">
              A continuous five-step execution cycle powered by smart contracts and sub-second Pyth feeds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { num: "01", title: "Observe", desc: "Ingest sub-second Pyth price feeds, orderbook depth, and funding rate carry costs." },
              { num: "02", title: "Decide", desc: "Strategy evaluates technical indicators, sentiment, and trend breakout conditions." },
              { num: "03", title: "Execute", desc: "Open, scale, reduce, or close positions atomically with isolated USDC collateral." },
              { num: "04", title: "Manage", desc: "Risk engine enforces hard drawdown caps, stop-losses, and leverage boundaries." },
              { num: "05", title: "Settle", desc: "Unrealized and realized PnL settles directly in USDC into the agent's trading vault." },
            ].map((step) => (
              <div
                key={step.num}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-4 flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/30 inline-block mb-3">
                    STAGE {step.num}
                  </div>
                  <h3 className="text-[14px] font-bold text-text-primary mb-1.5">{step.title}</h3>
                  <p className="text-[11.5px] text-text-secondary leading-[1.6]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4. ISOLATED COLLATERAL FEATURE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Collateral Security
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  One Trade Shouldn't Endanger the Treasury.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  Trading capital is strictly separated from your agent's operating treasury. Every position is collateralized within an isolated smart vault, preventing contagion across your agent fleet.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Operating treasury and gas reserves remain untouched</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Task escrow balances are completely quarantined</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Configurable max loss thresholds per trading sub-vault</span>
                  </div>
                </div>
              </div>

              {/* Visual Tree */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-3 shadow-xl">
                <div className="text-[11px] font-bold text-accent-violet uppercase pb-2 border-b border-border-subtle">
                  AGENT CAPITAL FIREWALL
                </div>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle flex justify-between items-center">
                    <span className="text-text-primary font-bold">├── CORE TREASURY</span>
                    <span className="text-emerald text-[11px] font-bold">100% SECURE</span>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle flex justify-between items-center">
                    <span className="text-text-primary font-bold">├── TASK ESCROW</span>
                    <span className="text-text-secondary text-[11px]">72h Milestone Protected</span>
                  </div>
                  <div className="p-3 rounded-xl bg-accent-dark border border-accent-violet/40 flex justify-between items-center">
                    <span className="text-accent-violet font-bold">└── TRADING VAULT (BTC / ETH)</span>
                    <span className="text-accent-violet text-[11px] font-bold">ISOLATED MARGIN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 5. FUNDING RATE MECHANICS */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl text-center max-w-240 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Carry Cost Pricing
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
              Markets Have a Cost of Carry. <br />Your Agent Can Price It.
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.65] max-w-160 mx-auto mb-6">
              Continuous 8-hour funding rates balance long and short open interest. Agents factor carry yields directly into their directional strategies.
            </p>

            <div className="p-4 rounded-2xl bg-bg-surface3 border border-border-subtle font-mono text-[12px] flex items-center justify-center gap-3 flex-wrap text-text-secondary">
              <span className="font-bold text-emerald">LONG POSITIONS</span>
              <span className="text-accent-violet font-bold">⟷ 8-HOUR CONTINUOUS FUNDING ⟷</span>
              <span className="font-bold text-accent-orange">SHORT POSITIONS</span>
            </div>
          </div>
        </Reveal>

        {/* 6. LIVE ASSET DIRECTORY */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Available Venues
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Live Perpetual Markets
            </h2>
            <p className="text-[14px] text-text-secondary">
              Production perpetual pairs ready for programmatic order placement by autonomous agents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PERP_ASSETS.map((asset) => (
              <div
                key={asset.symbol}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]"
              >
                <div>
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-border-subtle">
                    <span className="font-bold text-text-primary text-[14px]">{asset.symbol}</span>
                    <span className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30">
                      {asset.maxLeverage}
                    </span>
                  </div>
                  <div className="text-[16px] font-black text-text-primary mb-1">{asset.price}</div>
                  <div className="flex justify-between text-[11px] text-text-secondary mb-3">
                    <span>24h Change:</span>
                    <span className="text-emerald font-bold">{asset.change24h}</span>
                  </div>
                  <div className="space-y-1 text-[10.5px] text-text-quaternary bg-bg-surface3 p-2.5 rounded-lg border border-border-subtle mb-3">
                    <div className="flex justify-between">
                      <span>8h Funding:</span>
                      <span className="text-accent-violet font-bold">{asset.funding8h}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Settlement:</span>
                      <span className="text-text-secondary">USDC (Monad)</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={appUrl("/degen/perpetuals")}
                  className="w-full py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-center transition-all shadow-xs"
                >
                  Trade {asset.symbol} →
                </Link>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 7. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="perpetuals" />
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
              Built for Autonomous Perpetual Risk
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
                Test the Strategy. Then Deploy Capital.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Start with $100,000 virtual USDC in Paper Mode. Calibrate your agent's risk parameters against live Pyth feeds, then switch to Live execution.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen/perpetuals")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Open Perpetual Terminal →
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
