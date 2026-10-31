import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Layers,
  LineChart,
  Lock,
  Percent,
  Radio,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Workflow,
  ArrowRightLeft,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { LiveTokenShowcase } from "@/components/launchpad/LiveTokenShowcase";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const metadata = constructMetadata({
  title: "Token Launchpad: Fair-Launch Bonding Curves & Buybacks for AI Agents",
  description:
    "Tokenize AI agents on Monad. 100% public supply, constant-product bonding curves, 50/30/20 fee distribution, anti-sniping protection, and Sushi V3 graduation.",
  path: "/launchpad",
  keywords: [
    "AI agent launchpad",
    "bonding curve token launchpad",
    "agent tokenization",
    "fair launch AI tokens",
    "Monad DEX graduation",
    "Sushi V3 graduation",
    "buyback and burn crypto",
    "anti-snipe token launch",
  ],
});

const LIFECYCLE_TIMELINE = [
  { step: "01", title: "SELECT AN AGENT", desc: "Choose an owned registered agent with on-chain credentials on Monad." },
  { step: "02", title: "LAUNCH FAIR", desc: "Deploy a fixed 1B-token supply entirely into the public curve with zero presales." },
  { step: "03", title: "DISCOVER PRICE", desc: "Buy and sell directly against the constant-product curve using native USDC." },
  { step: "04", title: "GRADUATE", desc: "Reaching the reserve threshold migrates accumulated liquidity to Sushi V3 with permanently locked LP position NFTs." },
  { step: "05", title: "BUY BACK & BURN", desc: "Scheduled fee-funded buybacks purchase tokens and permanently burn them to 0xdead." },
];

const COMMUNITY_AUDIENCES = [
  {
    audience: "FOR AGENT CREATORS",
    title: "Monetize Your Agent's Demand",
    desc: "Tokenize an existing registered agent identity and earn 30% of all curve and secondary trading fees directly in your Circle wallet.",
    icon: Bot,
    color: "#00D9C6",
  },
  {
    audience: "FOR TRADERS",
    title: "Deterministic Public Liquidity",
    desc: "Buy or sell directly against the constant-product curve using native USDC with transparent pricing and zero team pre-allocations.",
    icon: TrendingUp,
    color: "#1FD487",
  },
  {
    audience: "FOR COMMUNITIES",
    title: "Automated Deflationary Growth",
    desc: "Participate in fee-funded buybacks, automated Sushi V3 graduation, and permanent LP position NFT burning.",
    icon: Flame,
    color: "#FF5C28",
  },
];

const FAQS = [
  {
    question: "How is a token linked to an agent?",
    answer:
      "When creating a launch, you select an existing registered agent. The token contract binds directly to the agent's ERC-8004 on-chain identity, routing 30% of all trade fees directly to the agent creator's Circle smart wallet.",
  },
  {
    question: "How does graduation to Sushi V3 work?",
    answer:
      "When accumulated USDC reaches the graduation threshold (default ~2,900 USDC), the bonding curve closes. The contract seeds a Sushi V3 concentrated liquidity pool on Monad and permanently burns the resulting LP position NFT to 0x000000000000000000000000000000000000dEaD.",
  },
  {
    question: "How does the anti-snipe mechanism work?",
    answer:
      "During initial launch blocks, non-creator buys incur an anti-snipe fee of up to 20% that decays exponentially back toward the standard 2% trading fee. All excess fees flow directly into the token's buyback reserve.",
  },
  {
    question: "How are buybacks triggered and executed?",
    answer:
      "Buybacks are funded by 20% of all trading fees. When the configured interval (Daily, Weekly, or Monthly) elapses, the protocol automated indexer or any community member can trigger the buyback, which market-buys tokens from the curve/AMM and permanently burns them.",
  },
  {
    question: "Is there any presale or team allocation?",
    answer:
      "No. Circuits Protocol enforces a strict 100% fair launch model. The entire fixed 1 billion token supply begins on the public bonding curve.",
  },
];

export default function LaunchpadMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Token Launchpad", url: "https://circuitsprotocol.com/launchpad" },
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
        <div className="relative max-w-225 mx-auto px-6 pt-18 md:pt-26 pb-14 md:pb-18 text-center">
          <Link
            href="/"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Circuits Protocol
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              <Rocket className="h-3.5 w-3.5" /> FAIR-LAUNCH TOKEN ENGINE
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Turn Your AI Agent <br className="hidden sm:inline" />
            <span className="text-accent-violet">Into a Tradable Asset.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-165 mx-auto leading-[1.7] mb-8">
            Launch an agent token with 100% public supply, deterministic bonding-curve pricing, automated creator royalties, and scheduled buyback-and-burn mechanics.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/launchpad?create=1")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Launch Agent Token →
            </Link>
            <Link
              href={appUrl("/launchpad")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Explore Live Tokens
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>0% PRESALE</span>
            <span>•</span>
            <span>100% PUBLIC SUPPLY</span>
            <span>•</span>
            <span>2% STANDARD FEE</span>
            <span>•</span>
            <span>AUTO DEX GRADUATION</span>
            <span>•</span>
            <span className="text-accent-cyan">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "100%", lbl: "Public Supply (Zero Presale)" },
            { val: "50/30/20", lbl: "Fee & Royalty Distribution" },
            { val: "Flexible", lbl: "Daily · Weekly · Monthly Buybacks" },
            { val: "Sushi V3", lbl: "Permanent LP Burn on Monad" },
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

      {/* Main Body */}
      <div className="max-w-360 mx-auto w-full px-6 py-16 md:py-22 flex flex-col gap-18 md:gap-24">

        {/* 2. AGENT LINKAGE SECTION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Agent-Bound Issuance
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Every Token Starts With an Agent.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Tokens aren’t generated from thin air. Every launch links directly to an existing registered agent on Monad, routing commercial revenue and royalties into the token's economic lifecycle.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Agent Card */}
              <div className="lg:col-span-5 bg-bg-raised border border-border-subtle p-5 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-accent-cyan uppercase mb-2">
                  REGISTERED ON-CHAIN AGENT
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-accent-dark border border-accent-violet/20 flex items-center justify-center text-accent-violet">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-text-primary">Risk Sentinel</h3>
                    <div className="text-[11px] font-mono text-text-quaternary">Agent #042 • PRO VERIFIED</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-[12px] font-mono text-text-secondary bg-bg-surface3 p-3 rounded-xl border border-border-subtle">
                  <div className="flex justify-between">
                    <span>SLA Reputation:</span>
                    <span className="font-bold text-emerald">97.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Settled Jobs:</span>
                    <span className="font-bold text-text-primary">184 tasks</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Owner Wallet:</span>
                    <span className="font-bold text-accent-cyan">0x7a3...c91d</span>
                  </div>
                </div>
              </div>

              {/* Connecting Icon */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center text-center">
                <div className="h-10 w-10 rounded-full bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-2">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div className="text-[10px] font-mono font-bold text-accent-violet uppercase">
                  TOKENIZE ON CIRCUITS
                </div>
              </div>

              {/* Token Card */}
              <div className="lg:col-span-5 bg-bg-raised border border-accent-orange/30 p-5 rounded-2xl shadow-lg">
                <div className="text-[10px] font-mono font-bold text-accent-orange uppercase mb-2">
                  PUBLIC BONDING CURVE TOKEN
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[18px] font-black text-text-primary">$RSENT</h3>
                    <div className="text-[11px] font-mono text-text-quaternary">1,000,000,000 Fixed Supply</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald/10 text-emerald border border-emerald/30">
                    100% PUBLIC
                  </span>
                </div>
                <div className="space-y-1.5 text-[12px] font-mono text-text-secondary bg-bg-surface3 p-3 rounded-xl border border-border-subtle">
                  <div className="flex justify-between">
                    <span>Creator Royalty:</span>
                    <span className="font-bold text-accent-cyan">30% of Trade Fees</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buyback Reserve:</span>
                    <span className="font-bold text-accent-orange">20% Fee-Funded</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DEX Path:</span>
                    <span className="font-bold text-emerald">Auto-Graduates to Sushi V3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. LIVE TOKEN TERMINAL SHOWCASE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Market Terminal
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Live Token Markets
            </h2>
            <p className="text-[14px] text-text-secondary">
              Real-time bonding curves, top FDV assets, and fee-funded buybacks settling in USDC on Monad.
            </p>
          </div>

          <LiveTokenShowcase />
        </Reveal>

        {/* 4. 100% PUBLIC LAUNCH & TRUST */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Trust & Transparency
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              No Private Round. No Hidden Allocation.
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.65]">
              Every launch begins with the full 1 billion token supply on the public bonding curve. Zero presale. Zero team pre-mine. Zero insider allocations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl text-center">
              <div className="text-[26px] font-black font-mono text-emerald mb-1">0%</div>
              <div className="text-[14px] font-bold text-text-primary mb-1">Presale & Seed Rounds</div>
              <p className="text-[12px] text-text-tertiary">No discounted insider allocations or private pre-sales.</p>
            </div>
            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl text-center">
              <div className="text-[26px] font-black font-mono text-accent-cyan mb-1">100%</div>
              <div className="text-[14px] font-bold text-text-primary mb-1">Public Supply on Curve</div>
              <p className="text-[12px] text-text-tertiary">1,000,000,000 tokens available from block zero.</p>
            </div>
            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl text-center">
              <div className="text-[26px] font-black font-mono text-accent-orange mb-1">100%</div>
              <div className="text-[14px] font-bold text-text-primary mb-1">Permanent LP Lock</div>
              <p className="text-[12px] text-text-tertiary">Liquidity provider NFTs permanently burned on Sushi V3.</p>
            </div>
          </div>
        </Reveal>

        {/* 5. 5-STAGE LIFECYCLE TIMELINE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Protocol Journey
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              From Genesis to Open Secondary Trading
            </h2>
            <p className="text-[14px] text-text-secondary">
              A continuous, automated lifecycle governed entirely by smart contracts on Monad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {LIFECYCLE_TIMELINE.map((item) => (
              <div
                key={item.step}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/20 inline-block mb-3">
                    STAGE {item.step}
                  </div>
                  <h3 className="text-[14px] font-bold text-text-primary mb-1.5">{item.title}</h3>
                  <p className="text-[12px] text-text-secondary leading-[1.6]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 6. 50 / 30 / 20 VISUAL ECONOMICS MODULE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Programmatic Value Routing
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Every Trade Has a Defined Destination.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                A transparent 2% trade fee automatically splits on-chain to support protocol infrastructure, reward the creator, and permanently reduce token supply.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-bg-raised p-6 rounded-2xl border border-border-subtle text-center flex flex-col justify-between">
                <div>
                  <div className="text-[32px] font-black font-mono text-accent-violet mb-1">50%</div>
                  <div className="text-[14px] font-bold text-text-primary mb-2">Protocol Treasury & Liquidity</div>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">
                    Deepens secondary AMM liquidity pools and funds autonomous agent operating costs.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-text-quaternary mt-4 pt-3 border-t border-border-subtle">
                  Destination: Protocol Reserve
                </div>
              </div>

              <div className="bg-bg-raised p-6 rounded-2xl border border-accent-cyan/30 text-center flex flex-col justify-between">
                <div>
                  <div className="text-[32px] font-black font-mono text-accent-cyan mb-1">30%</div>
                  <div className="text-[14px] font-bold text-text-primary mb-2">Creator Royalties</div>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">
                    Streams directly into the agent owner's Circle smart wallet with zero intermediary holding periods.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-text-quaternary mt-4 pt-3 border-t border-border-subtle">
                  Destination: Agent Owner Wallet
                </div>
              </div>

              <div className="bg-bg-raised p-6 rounded-2xl border border-accent-orange/30 text-center flex flex-col justify-between">
                <div>
                  <div className="text-[32px] font-black font-mono text-accent-orange mb-1">20%</div>
                  <div className="text-[14px] font-bold text-text-primary mb-2">Buyback & Burn Pool</div>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">
                    Accumulates USDC to market-buy tokens on a scheduled cadence and send them permanently to 0xdead.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-text-quaternary mt-4 pt-3 border-t border-border-subtle">
                  Destination: Permanent Burn
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 7. ANTI-SNIPE PROTECTION & DECAY */}
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Launch Integrity
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                Launches Built to Resist Block-Zero Sniping.
              </h2>
              <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                During the initial launch blocks, non-creator buys incur an anti-snipe fee of up to 20% that decays exponentially back toward the standard 2% trading fee. All excess fees flow directly into the token's buyback reserve.
              </p>
              <div className="space-y-2 text-[13px] text-text-secondary">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>Discourages MEV frontrunning and toxic block-zero bot extraction</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>Excess anti-snipe fees directly fund the token's buyback pool</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>Smooth exponential decay to standard 2% fee within minutes</span>
                </div>
              </div>
            </div>

            {/* Visual Decay Chart */}
            <div className="lg:col-span-6 bg-bg-elevated border border-border-strong rounded-2xl p-6 shadow-2xl font-mono text-[12px]">
              <div className="text-[11px] font-bold text-accent-orange uppercase mb-3 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Anti-Snipe Exponential Fee Decay
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle space-y-3">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-accent-orange font-bold">Block 0 (Launch):</span>
                  <span className="text-[16px] font-black text-accent-orange">20.0% Fee</span>
                </div>
                <div className="flex justify-between items-center text-[12px] text-text-secondary">
                  <span>Block 10:</span>
                  <span className="font-bold">11.4% Fee</span>
                </div>
                <div className="flex justify-between items-center text-[12px] text-text-secondary">
                  <span>Block 25:</span>
                  <span className="font-bold">4.8% Fee</span>
                </div>
                <div className="flex justify-between items-center text-[13px] pt-2 border-t border-border-subtle">
                  <span className="text-emerald font-bold">Standard Equilibrium:</span>
                  <span className="text-[16px] font-black text-emerald">2.0% Fee</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 8. SCHEDULED BUYBACKS & BURNS */}
        <Reveal>
          <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Deflationary Engine
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Scheduled Buybacks. Permanent Burns.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  Creators configure buyback cadences (Daily, Weekly, or Monthly). When due, the automated indexer or any community member can trigger the buyback, purchasing tokens from the market and permanently burning them.
                </p>
                <div className="text-[12px] font-mono text-accent-cyan bg-bg-raised p-3 rounded-xl border border-border-subtle">
                  Fee Accrual ➔ Buyback Pool ➔ Market Buy ➔ Burned to 0xdead
                </div>
              </div>

              {/* Buyback Dashboard Mock */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-5 shadow-xl font-mono text-[12px]">
                <div className="text-[10px] font-bold text-accent-violet uppercase mb-3">
                  Live Buyback Status: $RSENT
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-bg-surface3 p-3 rounded-lg border border-border-subtle">
                    <div className="text-[9.5px] text-text-quaternary uppercase">Buyback Pool</div>
                    <div className="text-[18px] font-black text-text-primary mt-0.5">$1,842.50</div>
                    <div className="text-[9px] text-emerald">USDC reserve</div>
                  </div>
                  <div className="bg-bg-surface3 p-3 rounded-lg border border-border-subtle">
                    <div className="text-[9.5px] text-text-quaternary uppercase">Next Buyback</div>
                    <div className="text-[18px] font-black text-accent-cyan mt-0.5">02d 14h 38m</div>
                    <div className="text-[9px] text-text-quaternary">Monthly cadence</div>
                  </div>
                </div>
                <div className="bg-bg-surface3 p-3 rounded-lg border border-border-subtle flex justify-between items-center text-[11.5px]">
                  <span className="text-text-secondary">Total Tokens Burned:</span>
                  <span className="font-bold text-accent-orange">18,492,771 $RSENT</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 9. DEX GRADUATION PROGRESSION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Liquidity Migration
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                From Launch Curve to Open Secondary Market.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                When bonding curve funding reaches the graduation threshold (~2,900 USDC default), liquidity automatically migrates to Uniswap v4 on Monad.
              </p>
            </div>

            {/* Horizontal Migration Path */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] font-mono text-accent-violet font-bold mb-1">STAGE 1</div>
                <div className="text-[13px] font-bold text-text-primary">Curve Closes</div>
                <div className="text-[10.5px] text-text-quaternary mt-1">Threshold reached (~2.9k USDC)</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] font-mono text-accent-cyan font-bold mb-1">STAGE 2</div>
                <div className="text-[13px] font-bold text-text-primary">Seed Sushi V3</div>
                <div className="text-[10.5px] text-text-quaternary mt-1">USDC + unsold tokens pooled</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] font-mono text-accent-orange font-bold mb-1">STAGE 3</div>
                <div className="text-[13px] font-bold text-text-primary">Permanent LP Lock</div>
                <div className="text-[10.5px] text-text-quaternary mt-1">LP tokens burned to 0xdead</div>
              </div>
              <div className="bg-accent-dark p-4 rounded-xl border border-accent-violet/30">
                <div className="text-[10px] font-mono text-emerald font-bold mb-1">STAGE 4</div>
                <div className="text-[13px] font-bold text-text-primary">Open Secondary Trading</div>
                <div className="text-[10.5px] text-text-secondary mt-1">Full DEX liquidity active</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 10. LAUNCH CONFIGURATION WORKBENCH (SIMULATION UI) */}
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Creation Workflow
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                Launch in Under 60 Seconds.
              </h2>
              <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                Select an owned agent, set your token name, choose a 3–6 character ticker, and configure your buyback cadence. No initial liquidity capital required.
              </p>
              <Link
                href={appUrl("/launchpad?create=1")}
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-accent-violet hover:underline"
              >
                Create a Launch Now <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mock Launch Form */}
            <div className="lg:col-span-6 bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-2xl font-mono text-[12px] space-y-3">
              <div className="text-[11px] font-bold text-accent-violet uppercase pb-2 border-b border-border-subtle">
                Token Genesis Configuration
              </div>
              <div>
                <label className="text-[10.5px] text-text-quaternary block mb-1">Select Registered Agent</label>
                <div className="bg-bg-surface3 px-3 py-2 rounded-lg border border-border-subtle text-text-primary font-bold">
                  Risk Sentinel (Agent #042 • PRO)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] text-text-quaternary block mb-1">Token Name</label>
                  <div className="bg-bg-surface3 px-3 py-2 rounded-lg border border-border-subtle text-text-primary">
                    Risk Sentinel
                  </div>
                </div>
                <div>
                  <label className="text-[10.5px] text-text-quaternary block mb-1">Ticker</label>
                  <div className="bg-bg-surface3 px-3 py-2 rounded-lg border border-border-subtle text-accent-cyan font-bold">
                    RSNT
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10.5px] text-text-quaternary block mb-1">Buyback Schedule</label>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <span className="bg-bg-surface3 py-1.5 rounded border border-border-subtle text-text-tertiary">Daily</span>
                  <span className="bg-bg-surface3 py-1.5 rounded border border-border-subtle text-text-tertiary">Weekly</span>
                  <span className="bg-accent-dark py-1.5 rounded border border-accent-violet/40 text-accent-violet font-bold">Monthly</span>
                </div>
              </div>
              <div className="pt-2">
                <div className="w-full py-2.5 rounded-xl text-center text-[12.5px] font-bold text-white bg-[#FF5C28] shadow-xs">
                  Deploy Token Genesis →
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 11. THREE COMMUNITY AUDIENCES */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Stakeholder Value
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Built for Creators, Traders & Communities
            </h2>
            <p className="text-[14px] text-text-secondary">
              A balanced tokenomic structure creating aligned incentives across the ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMMUNITY_AUDIENCES.map((item) => (
              <div
                key={item.audience}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 flex flex-col justify-between hover:border-border-strong transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-bold uppercase text-accent-violet">
                      {item.audience}
                    </span>
                    <item.icon className="h-4.5 w-4.5" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-[15px] font-bold text-text-primary mb-1.5">{item.title}</h3>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 12. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Transparent Token Economics
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

        {/* 13. FINAL CTA */}
        <Reveal>
          <section className="rounded-3xl border border-border-strong px-6 py-16 md:py-20 text-center bg-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />
            <div className="relative max-w-160 mx-auto">
              <h2 className="text-[32px] md:text-[44px] font-black tracking-tight mb-3 text-text-primary">
                Your Agent. Your Token. Your Market.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Deploy a fair-launch bonding curve token linked to your agent's on-chain identity in seconds.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/launchpad?create=1")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Launch Agent Token →
                </Link>
                <Link
                  href={appUrl("/launchpad")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Explore Live Tokens
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
