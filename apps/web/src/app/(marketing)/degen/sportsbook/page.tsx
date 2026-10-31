import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Scale,
  DollarSign,
  AlertTriangle,
  Play,
  Flame,
  Globe,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Sportsbook: Autonomous Odds Modeling & On-Chain Sports Wagering",
  description:
    "Autonomous sports strategies analyze markets, compare statistical model probabilities to bookmaker odds, and place onchain wagers with automated outcome reconciliation on Monad.",
  path: "/degen/sportsbook",
  keywords: [
    "crypto sportsbook AI",
    "autonomous sports betting agent",
    "SportyStake",
    "on-chain sports betting",
    "AI odds modeling",
    "automated bet reconciliation",
    "Monad sports prediction",
    "USDC sports betting",
  ],
});

const FEATURED_FIXTURES = [
  {
    league: "Premier League",
    match: "Arsenal vs Chelsea",
    time: "Tomorrow, 17:30 UTC",
    odds: { home: "1.82", draw: "3.60", away: "4.40" },
    agentProb: "58.7%",
    marketImplied: "54.9%",
    edge: "+3.8%",
    status: "Active Odds",
  },
  {
    league: "UEFA Champions League",
    match: "Real Madrid vs Bayern Munich",
    time: "Wednesday, 20:00 UTC",
    odds: { home: "2.10", draw: "3.50", away: "3.30" },
    agentProb: "51.2%",
    marketImplied: "47.6%",
    edge: "+3.6%",
    status: "Active Odds",
  },
  {
    league: "NBA Basketball",
    match: "Boston Celtics vs Golden State Warriors",
    time: "Tonight, 00:30 UTC",
    odds: { home: "1.65", draw: "—", away: "2.35" },
    agentProb: "64.5%",
    marketImplied: "60.6%",
    edge: "+3.9%",
    status: "Active Odds",
  },
  {
    league: "Counter-Strike 2 (Esports)",
    match: "FaZe Clan vs Natus Vincere",
    time: "Saturday, 14:00 UTC",
    odds: { home: "1.95", draw: "—", away: "1.85" },
    agentProb: "55.8%",
    marketImplied: "51.3%",
    edge: "+4.5%",
    status: "Active Odds",
  },
];

const SPORT_CATEGORIES = [
  {
    category: "Football (Soccer)",
    leagues: ["Premier League", "UEFA Champions League", "La Liga", "Serie A", "Bundesliga"],
    desc: "1X2 Match Winner, Over/Under Goals, Both Teams to Score, and Asian Handicaps.",
  },
  {
    category: "Basketball",
    leagues: ["NBA", "EuroLeague", "NCAA Basketball"],
    desc: "Moneyline, Point Spreads, Over/Under Totals, and Player Performance statistical models.",
  },
  {
    category: "American Football",
    leagues: ["NFL", "NCAA Football"],
    desc: "Spreads, Moneylines, Total Points, and drive-by-drive live market resolution.",
  },
  {
    category: "Esports",
    leagues: ["CS2 (Major/ESL)", "League of Legends (Worlds/LCK)", "Dota 2 (TI/Riyadh)"],
    desc: "Match Winner, Map Handicaps, First Blood, and real-time game state telemetry.",
  },
];

const FAQS = [
  {
    question: "How do autonomous agents place sports wagers?",
    answer:
      "Agents ingest live odds feeds, lineups, and injury telemetry via API. When statistical Poisson or machine learning models identify odds that underestimate a team's true win probability, the agent executes an on-chain ticket using isolated USDC collateral.",
  },
  {
    question: "How does automated bet reconciliation work?",
    answer:
      "When a match concludes, the official final score is verified via decentralized oracle feeds and official sports data APIs. The smart contract automatically reconciles all tickets and routes winnings directly to the agent's wallet.",
  },
  {
    question: "What sports and leagues are supported by SportyStake?",
    answer:
      "SportyStake covers top global football (Premier League, Champions League, La Liga), basketball (NBA, EuroLeague), American football (NFL), and major esports (Counter-Strike 2, League of Legends, Dota 2).",
  },
  {
    question: "How do risk limits protect my agent in sportsbook trading?",
    answer:
      "Every strategy operates under strict risk boundaries: maximum stake per wager (e.g. 50 USDC), daily cumulative loss limits (e.g. max -100 USDC/day), and an instant panic switch that halts all pending tickets.",
  },
  {
    question: "Can I test sports strategies in Paper Mode first?",
    answer:
      "Yes. Paper Mode allows agents to simulate wagers against live market odds with $100,000 virtual USDC, recording hit rates and simulated ROI before any real funds are deployed.",
  },
];

export default function SportsbookMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
    { name: "Sportsbook", url: "https://circuitsprotocol.com/degen/sportsbook" },
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
              <Trophy className="h-3.5 w-3.5" /> AUTONOMOUS SPORTS ANALYTICS
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Let Agents <br className="hidden sm:inline" />
            <span className="text-accent-violet">Trade the Odds.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Autonomous sports strategies analyze markets, compare probabilities, and place onchain wagers across major sports and esports.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/sportsbook")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Sportsbook →
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
            <span>PREMIER LEAGUE, NBA & NFL</span>
            <span>•</span>
            <span>AUTOMATED RECONCILIATION</span>
            <span>•</span>
            <span>ISOLATED VAULT</span>
            <span>•</span>
            <span>PAPER MODE DEFAULT</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "4 Major", lbl: "Sports & Esports Categories" },
            { val: "Automated", lbl: "Oracle Bet Reconciliation" },
            { val: "Zero Slippage", lbl: "Fixed-Odds Smart Execution" },
            { val: "Instant USDC", lbl: "Direct Payouts to Agent Wallet" },
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

        {/* 2. ODDS BOARD & AGENT MODEL VISUALIZATION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Quantitative Sports Modeling
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                From Odds to Expected Value
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                The agent doesn't guess winners. It compares estimated win probabilities against implied bookmaker odds to capture positive expectation.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Odds Board Centerpiece */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <span className="text-[10.5px] font-bold text-accent-violet bg-accent-dark px-2.5 py-0.5 rounded-full border border-accent-violet/30">
                    PREMIER LEAGUE (FIXTURE)
                  </span>
                  <span className="text-text-tertiary text-[11px]">Tomorrow, 17:30 UTC</span>
                </div>

                <div className="text-[16px] font-bold text-text-primary">
                  Arsenal vs Chelsea
                </div>

                {/* 3-Way Odds Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-bg-surface3 p-3 rounded-xl border-2 border-accent-violet/40">
                    <div className="text-[10px] text-accent-violet font-bold">1 (ARSENAL)</div>
                    <div className="text-[16px] font-black text-text-primary mt-0.5">1.82</div>
                    <div className="text-[10px] text-text-quaternary">54.9% Implied</div>
                  </div>
                  <div className="bg-bg-surface3 p-3 rounded-xl border border-border-subtle">
                    <div className="text-[10px] text-text-quaternary">X (DRAW)</div>
                    <div className="text-[16px] font-bold text-text-primary mt-0.5">3.60</div>
                    <div className="text-[10px] text-text-quaternary">27.8% Implied</div>
                  </div>
                  <div className="bg-bg-surface3 p-3 rounded-xl border border-border-subtle">
                    <div className="text-[10px] text-text-quaternary">2 (CHELSEA)</div>
                    <div className="text-[16px] font-bold text-text-primary mt-0.5">4.40</div>
                    <div className="text-[10px] text-text-quaternary">22.7% Implied</div>
                  </div>
                </div>

                {/* Agent Discrepancy Box */}
                <div className="p-3.5 rounded-xl bg-accent-dark border border-accent-violet/30 space-y-1 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-accent-violet">Agent Poisson Model:</span>
                    <span className="text-accent-violet font-bold">58.7% Arsenal Win</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Market Implied:</span>
                    <span className="text-text-primary">54.9%</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-accent-violet/20 font-bold">
                    <span className="text-emerald">STATISTICAL EDGE:</span>
                    <span className="text-emerald">+3.8% (Wager Sized)</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[11px] text-text-tertiary">Kelly Stake: 50 USDC</span>
                  <Link
                    href={appUrl("/degen/sportsbook")}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                  >
                    Place Ticket →
                  </Link>
                </div>
              </div>

              {/* Step-by-Step Explanation */}
              <div className="lg:col-span-6 space-y-3 font-mono text-[12px]">
                <div className="text-[11px] font-bold text-text-quaternary uppercase mb-2">
                  FROM ODDS TO EXECUTION
                </div>
                {[
                  { step: "01 INGEST", text: "Pull live fixture odds, team formations, and key player injury feeds" },
                  { step: "02 MODEL", text: "Run Poisson and expected-goals (xG) models to compute true win probabilities" },
                  { step: "03 EVALUATE", text: "Compare model expectation against bookmaker odds to detect discrepancies" },
                  { step: "04 STAKE", text: "Apply fractional Kelly stake sizing subject to agent daily risk limits" },
                  { step: "05 SETTLE", text: "Match conclusion triggers oracle verification and instant USDC payout routing" },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="p-3 rounded-xl bg-bg-raised border border-border-subtle flex items-start gap-3"
                  >
                    <span className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30 shrink-0">
                      {item.step}
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

        {/* 3. SPORT COVERAGE DIRECTORY */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Supported Markets
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Comprehensive Sports Coverage
            </h2>
            <p className="text-[14px] text-text-secondary">
              High-liquidity match markets across major international leagues and competitive esports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SPORT_CATEGORIES.map((cat) => (
              <div
                key={cat.category}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <h3 className="text-[17px] font-bold text-text-primary mb-2">{cat.category}</h3>
                  <p className="text-[13px] text-text-secondary leading-[1.6] mb-4">{cat.desc}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {cat.leagues.map((lg) => (
                      <span
                        key={lg}
                        className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-bg-surface3 text-text-secondary border border-border-subtle"
                      >
                        ✓ {lg}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border-subtle">
                  <Link
                    href={appUrl("/degen/sportsbook")}
                    className="text-[12px] font-bold text-accent-violet hover:underline inline-flex items-center gap-1 font-mono"
                  >
                    View {cat.category} Markets <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4. AUTOMATED BET RECONCILIATION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl text-center max-w-240 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              On-Chain Settlement
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
              Results Resolve Automatically.
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.65] max-w-160 mx-auto mb-6">
              When the final whistle sounds, official sports data feeds verify the outcome. Winnings are reconciled on-chain and settled to the agent's wallet.
            </p>

            <div className="p-4 rounded-2xl bg-bg-surface3 border border-border-subtle font-mono text-[12px] flex items-center justify-center gap-2 flex-wrap text-text-secondary">
              <span className="font-bold text-text-primary">MATCH FINAL</span>
              <span>➔</span>
              <span className="font-bold text-accent-violet">ORACLE VERIFICATION</span>
              <span>➔</span>
              <span className="font-bold text-emerald">RECONCILIATION</span>
              <span>➔</span>
              <span className="font-bold text-emerald">USDC PAYOUT</span>
            </div>
          </div>
        </Reveal>

        {/* 5. JURISDICTION & RESPONSIBLE WAGERING DISCLAIMER */}
        <Reveal>
          <div className="rounded-3xl border border-border-subtle bg-bg-raised/60 p-6 font-mono text-[11.5px] text-text-secondary space-y-2">
            <div className="text-[11px] font-bold text-text-quaternary uppercase flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-accent-orange" />
              <span>REGULATORY NOTICE & RESPONSIBLE WAGERING</span>
            </div>
            <p className="leading-relaxed">
              Sports wagering involves financial risk and uncertain outcomes. Statistical edge models and historical performance do not guarantee winnings. Participation may be subject to jurisdictional restrictions; users and autonomous agent operators are responsible for compliance with applicable local laws.
            </p>
          </div>
        </Reveal>

        {/* 6. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="sportsbook" />
        </Reveal>

        {/* 7. SHARED HUB ARCHITECTURE */}
        <Reveal>
          <DegenHubArchitecture />
        </Reveal>

        {/* 8. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Autonomous Sports Strategy
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

        {/* 9. FINAL CTA */}
        <Reveal>
          <section className="rounded-3xl border border-border-strong px-6 py-16 md:py-20 text-center bg-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />
            <div className="relative max-w-160 mx-auto">
              <h2 className="text-[32px] md:text-[44px] font-black tracking-tight mb-3 text-text-primary">
                Turn Sports Data Into Autonomous Decisions.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Deploy probabilistic models across major sports. Test in Paper Mode with $100,000 virtual USDC and enforce hard stake limits.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen/sportsbook")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Explore Sportsbook →
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
