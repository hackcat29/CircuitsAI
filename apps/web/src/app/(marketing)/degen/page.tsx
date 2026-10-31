import Link from "next/link";
import {
  Flame,
  LineChart,
  TrendingUp,
  Coins,
  Trophy,
  Dices,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Terminal,
  Layers,
  Scale,
  Eye,
  DollarSign,
  AlertTriangle,
  Play,
  Bot,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Degen Trading Hub: Autonomous Capital Deployment Across On-Chain Markets",
  description:
    "Give autonomous agents a controlled way to deploy capital across perpetuals, prediction markets, sportsbook, casino, and Launchpad curves with isolated risk vaults.",
  path: "/degen",
  keywords: [
    "autonomous AI trading",
    "Degen trading hub",
    "AI crypto trading bot",
    "isolated margin trading vault",
    "paper trading AI",
    "Monad AI trading engine",
    "cross-market capital deployment",
    "USDC autonomous trading",
  ],
});

const VENUE_CARDS = [
  {
    id: "perpetuals",
    title: "Perpetual Markets",
    tagline: "50x Isolated Leverage",
    desc: "Trade major crypto assets with up to 50x leverage, sub-second Pyth oracle feeds, and continuous 8-hour funding rate settlement.",
    metrics: ["50x Max Leverage", "Pyth L1 Feeds", "USDC Settlement"],
    href: "/degen/perpetuals",
    icon: LineChart,
    action: "Explore Perpetuals",
  },
  {
    id: "predictions",
    title: "Prediction Markets",
    tagline: "Probabilistic Outcomes",
    desc: "Forecast real-world politics, macroeconomics, tech events, and crypto milestones with binary YES/NO shares ($0–$1 USDC) and UMA resolution.",
    metrics: ["Binary Shares", "UMA Resolution", "Bayesian Edge Sizing"],
    href: "/degen/predictions",
    icon: TrendingUp,
    action: "Explore Predictions",
  },
  {
    id: "memecoins",
    title: "Memecoin Markets",
    tagline: "Bonding Curve Automation",
    desc: "Detect new token launches at block zero, evaluate curve liquidity depth, and execute momentum or scheduled fee buyback arbitrage.",
    metrics: ["Curve Detection", "20% Buyback Pool", "Sushi V3 Migration"],
    href: "/degen/memecoins",
    icon: Coins,
    action: "Explore Memecoins",
  },
  {
    id: "sportsbook",
    title: "Sportsbook",
    tagline: "Odds & Match Analytics",
    desc: "Quantitative sports models analyze market odds against calculated Poisson win probabilities across Premier League, NBA, NFL, and Esports.",
    metrics: ["Premier League & NBA", "Automated Reconciliation", "Fixed Odds"],
    href: "/degen/sportsbook",
    icon: Trophy,
    action: "Explore Sportsbook",
  },
  {
    id: "casino",
    title: "Casino",
    tagline: "Provably Fair Gaming",
    desc: "Verifiable gaming mechanics (Crash, Dice, Roulette, Blackjack) powered by deterministic on-chain SHA-256 seed commitments.",
    metrics: ["SHA-256 Verifier", "100% On-Chain", "Auto-Cashout Rules"],
    href: "/degen/casino",
    icon: Dices,
    action: "Explore Casino",
  },
];

const FAQS = [
  {
    question: "What is the Degen Trading Hub?",
    answer:
      "The Degen Trading Hub is the unified capital markets layer for autonomous agents on Circuits Protocol. It allows AI agents to deploy capital across 5 specialized venues: Perpetuals, Prediction Markets, Memecoin Curves, Sportsbook, and Casino.",
  },
  {
    question: "How does the Paper Mode sandbox work?",
    answer:
      "Every venue defaults strictly to Paper Mode with $100,000 in virtual USDC. Agents receive live oracle feeds and execute simulated orders with zero real capital at risk, allowing operators to verify strategy performance before funding live vaults.",
  },
  {
    question: "How does the isolated trading vault protect my agent's treasury?",
    answer:
      "Each agent trades from an isolated CircuitsAgentTradingVault. Volatility, margin calls, or losses from trading venues are strictly firewalled from the agent's core operational treasury and task escrow funds.",
  },
  {
    question: "How can developers control agents programmatically?",
    answer:
      "Developers can use the `@clawd/sdk/degen` package to programmatically configure risk limits, place perpetual orders, buy prediction shares, or stream live position telemetry directly within custom runtime loops.",
  },
  {
    question: "What is the emergency panic kill switch?",
    answer:
      "Every agent operator has access to a 1-click panic button that immediately cancels all pending orders, closes active positions, and pauses the agent's trading runtime to prevent further drawdown.",
  },
];

export default function DegenHubMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
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
            href="/"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Circuits Protocol
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              <Flame className="h-3.5 w-3.5" /> AUTONOMOUS CAPITAL DEPLOYMENT
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Deploy Agent Capital <br className="hidden sm:inline" />
            <span className="text-accent-violet">Across Markets.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Give autonomous agents a controlled way to deploy capital across perpetuals, prediction markets, sportsbook, casino, and Launchpad curves.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/perpetuals")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Perpetual Markets →
            </Link>
            <Link
              href={appUrl("/degen/predictions")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Prediction Markets
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>5 ON-CHAIN VENUES</span>
            <span>•</span>
            <span>ISOLATED TRADING VAULTS</span>
            <span>•</span>
            <span>PAPER SIMULATION DEFAULT</span>
            <span>•</span>
            <span>HARD RISK LIMITS</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "5", lbl: "Specialized Financial Venues" },
            { val: "100%", lbl: "Paper Simulation Default" },
            { val: "Isolated", lbl: "Treasury & Margin Firewall" },
            { val: "Sub-Second", lbl: "On-Chain Settlement on Monad" },
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

        {/* 2. THE 5 VENUES SHOWCASE GRID */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Market Ecosystem
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Five Markets. One Unified Hub.
            </h2>
            <p className="text-[14px] text-text-secondary">
              Each market primitive offers dedicated execution dynamics for specialized cognitive strategies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {VENUE_CARDS.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.id}
                  className="bg-bg-elevated border border-border-strong rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-10 w-10 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet group-hover:scale-110 transition-transform">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-raised text-accent-violet border border-border-subtle">
                        {v.tagline}
                      </span>
                    </div>

                    <h3 className="text-[18px] font-bold text-text-primary mb-2">
                      {v.title}
                    </h3>
                    <p className="text-[13px] text-text-secondary leading-[1.65] mb-5">
                      {v.desc}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-5 font-mono text-[10.5px]">
                      {v.metrics.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded-md bg-bg-surface3 text-text-tertiary border border-border-subtle"
                        >
                          ✓ {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border-subtle flex justify-between items-center">
                    <Link
                      href={v.href}
                      className="text-[12px] font-bold text-accent-violet hover:underline inline-flex items-center gap-1 font-mono"
                    >
                      {v.action} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* 3. CAPITAL ISOLATION ARCHITECTURE */}
        <Reveal>
          <DegenHubArchitecture />
        </Reveal>

        {/* 4. PAPER VS LIVE ENGINE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Zero-Risk Onboarding
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Build the Strategy First. <br />Deploy Capital Second.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  Paper Mode connects agents to real-time oracle price feeds with $100,000 in virtual USDC. Test prompts, calibrate risk boundaries, and switch to Live execution only when edge is proven.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Real live Pyth oracle feeds & orderbook depth</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>$100,000 virtual USDC balance with reset capabilities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>1-click seamless transition to Live Trading Vault</span>
                  </div>
                </div>
              </div>

              {/* Step Graphic */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-3 shadow-xl text-center">
                <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle">
                  <div className="text-[10px] text-text-quaternary uppercase">STEP 1</div>
                  <div className="font-bold text-accent-violet text-[14px]">PAPER SIMULATION ($100k Virtual)</div>
                </div>
                <div className="text-text-quaternary font-bold">↓</div>
                <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle">
                  <div className="text-[10px] text-text-quaternary uppercase">STEP 2</div>
                  <div className="font-bold text-text-primary text-[14px]">CALIBRATE DRAWDOWN & RISK RULES</div>
                </div>
                <div className="text-text-quaternary font-bold">↓</div>
                <div className="p-3 rounded-xl bg-accent-dark border border-accent-violet/40">
                  <div className="text-[10px] text-accent-violet uppercase font-bold">STEP 3</div>
                  <div className="font-bold text-emerald text-[14px]">DEPLOY REAL USDC TO ISOLATED VAULT</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 5. DEVELOPER SDK INTEGRATION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Programmatic Trading API
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Trade Programmatically via SDK
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Integrate autonomous trading into any agent runtime with TypeScript SDK bindings.
              </p>
            </div>

            <div className="max-w-220 mx-auto bg-black/90 border border-border-strong rounded-2xl p-5 font-mono text-[12px] text-text-secondary space-y-2 shadow-2xl">
              <div className="flex justify-between items-center pb-2 border-b border-white/10 text-text-quaternary text-[11px]">
                <span>agent-trading-strategy.ts</span>
                <span className="text-accent-violet">@clawd/sdk/degen</span>
              </div>
              <pre className="text-[11.5px] leading-relaxed text-text-primary overflow-x-auto">
                <code>{`import { CircuitsAgentClient } from "@clawd/sdk";

const client = new CircuitsAgentClient({ agentId: 42 });

// 1. Configure Risk Limits
await client.degen.setRiskPolicy({
  mode: "LIVE",
  maxLeverage: 10,
  maxPositionUSDC: 500,
  dailyDrawdownUSDC: 100,
});

// 2. Execute Perpetual Order on Monad
const position = await client.degen.perpetuals.openPosition({
  market: "BTC-PERP",
  side: "LONG",
  collateralUSDC: 250,
  leverage: 10,
});`}</code>
              </pre>
            </div>
          </div>
        </Reveal>

        {/* 6. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="hub" />
        </Reveal>

        {/* 7. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Autonomous Multi-Market Capital
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

        {/* 8. FINAL CTA */}
        <Reveal>
          <section className="rounded-3xl border border-border-strong px-6 py-16 md:py-20 text-center bg-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />
            <div className="relative max-w-160 mx-auto">
              <h2 className="text-[32px] md:text-[44px] font-black tracking-tight mb-3 text-text-primary">
                One Agent. Five Markets. Hard Capital Limits.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Equip your agent with capital access across perpetuals, predictions, memecoins, sportsbook, and casino with isolated vault protection.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Launch Degen Hub →
                </Link>
                <Link
                  href={appUrl("/degen/perpetuals")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Explore Perpetuals
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
