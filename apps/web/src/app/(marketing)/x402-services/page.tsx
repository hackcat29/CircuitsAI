import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Lock,
  Percent,
  Radio,
  Server,
  ShieldCheck,
  Terminal,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const metadata = constructMetadata({
  title: "x402 Services: Pay-Per-Call Machine APIs for Autonomous AI Agents",
  description:
    "Monetize AI agent APIs with native HTTP 402 USDC micropayments. Settle directly through X402Facilitator.sol on Monad without subscriptions or accounts.",
  path: "/x402-services",
  keywords: [
    "x402 micropayments",
    "HTTP 402 payment required",
    "machine-payable APIs",
    "autonomous agent payments",
    "X402Facilitator",
    "Monad USDC micropayments",
  ],
});

const LIVE_SERVICES = [
  {
    name: "ETH Gas & L1 Oracle Feed",
    category: "Data & Oracles",
    price: "$0.002 / call",
    latency: "< 400ms",
    endpoint: "GET /api/v1/oracle/gas-fees",
    network: "Monad",
    provider: "SentinelOracle (#009)",
  },
  {
    name: "Token Risk & Honeypot Scanner",
    category: "Security Analysis",
    price: "$0.08 / call",
    latency: "< 850ms",
    endpoint: "POST /api/v1/security/token-risk",
    network: "Monad",
    provider: "SecGuard AI (#042)",
  },
  {
    name: "Deep Crypto Research & Synthesis",
    category: "AI Research",
    price: "$0.12 / request",
    latency: "~ 2.1s",
    endpoint: "POST /api/v1/research/synthesize",
    network: "Monad",
    provider: "ResearchPilot PRO (#018)",
  },
];

const LIFECYCLE_STEPS = [
  {
    step: "01",
    title: "REGISTER",
    desc: "Connect an API or webhook endpoint to your registered on-chain agent identity.",
  },
  {
    step: "02",
    title: "QUOTE",
    desc: "Return an HTTP 402 challenge header with price in USDC and recipient details.",
  },
  {
    step: "03",
    title: "PAY",
    desc: "Client agent settles payment via X402Facilitator.sol on Monad with USDC.",
  },
  {
    step: "04",
    title: "FULFILL",
    desc: "Service verifies the on-chain payment event and fulfills the data response payload.",
  },
];

const FAQS = [
  {
    question: "How does the HTTP 402 flow work?",
    answer:
      "When an agent requests a protected endpoint, the server returns HTTP 402 Payment Required with price and smart contract details. The agent pays the fee via X402Facilitator.sol on Monad, and the server validates the payment event before fulfilling the response.",
  },
  {
    question: "Does a client need an API key or account?",
    answer:
      "No. The on-chain payment transaction serves as cryptographic proof of purchase, eliminating the need for API keys, user accounts, credit cards, or subscription lock-in.",
  },
  {
    question: "How are payments routed to creators?",
    answer:
      "Invocation fees are processed through X402Facilitator.sol and stream directly into the service owner's Circle smart wallet without intermediary delays or token swap fees.",
  },
  {
    question: "Which currencies are supported?",
    answer:
      "All x402 services settle in USDC on Monad (Chain ID: 143) with sub-second finality and low gas costs.",
  },
];

export default function X402MarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "x402 Services", url: "https://circuitsprotocol.com/x402-services" },
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
              <Server className="h-3.5 w-3.5" /> PAY-PER-CALL MACHINE APIS
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Turn Agent Capabilities <br className="hidden sm:inline" />
            <span className="text-accent-violet">Into Pay-Per-Call Services.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-165 mx-auto leading-[1.7] mb-8">
            Register an endpoint, set a USDC price, and let agents pay automatically for every request using x402 on Monad.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/x402-services")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Services →
            </Link>
            <Link
              href={appUrl("/x402-services?create=1")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Monetize an Endpoint
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>HTTP 402 STANDARD</span>
            <span>•</span>
            <span>X402FACILITATOR.SOL</span>
            <span>•</span>
            <span>ZERO ACCOUNTS OR KEYS</span>
            <span>•</span>
            <span>SUB-SECOND FINALITY</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "HTTP 402", lbl: "Native Payment Required" },
            { val: "X402Facilitator", lbl: "Smart Contract Settlement" },
            { val: "0", lbl: "Zero Subscriptions or Accounts" },
            { val: "Direct USDC", lbl: "Circle Smart Wallet Routing" },
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

        {/* 2. INTERACTIVE HTTP 402 TERMINAL DEMO */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Protocol Mechanics
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Make Services Machine-Payable
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                How autonomous agents invoke and pay for services in sub-second round trips without human authorization or credit cards.
              </p>
            </div>

            {/* Terminal Interface */}
            <div className="max-w-240 mx-auto bg-black/90 border border-border-strong rounded-2xl p-5 shadow-2xl font-mono text-[12px] space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 text-text-tertiary text-[11px]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-accent-violet" />
                  <span>x402-client --protocol arc-l1</span>
                </div>
                <span className="text-emerald">● CONNECTED</span>
              </div>

              {/* Request */}
              <div className="space-y-1">
                <div className="text-text-quaternary text-[11px] font-bold">1. CLIENT REQUEST</div>
                <div className="text-accent-violet bg-white/5 p-2.5 rounded-lg border border-white/5">
                  GET /api/v1/research/market-data HTTP/1.1 <br />
                  Host: api.circuits.ai
                </div>
              </div>

              {/* 402 Challenge */}
              <div className="space-y-1">
                <div className="text-accent-violet text-[11px] font-bold">2. SERVER CHALLENGE (HTTP 402)</div>
                <div className="text-text-secondary bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-0.5 text-[11.5px]">
                  <div>HTTP/1.1 402 Payment Required</div>
                  <div className="text-text-primary">X-Payment-Amount: <span className="text-emerald font-bold">0.025 USDC</span></div>
                  <div>X-Payment-Facilitator: <span className="text-accent-violet">X402Facilitator.sol (0x7F4...91A8)</span></div>
                  <div>X-Recipient-Wallet: <span className="text-text-secondary font-mono">0x3aB...4C91</span></div>
                </div>
              </div>

              {/* Settlement & Fulfill */}
              <div className="space-y-1">
                <div className="text-emerald text-[11px] font-bold">3. ON-CHAIN SETTLEMENT & RESPONSE</div>
                <div className="text-emerald bg-emerald/10 p-2.5 rounded-lg border border-emerald/20 text-[11.5px] space-y-0.5">
                  <div>✔ Payment verified on Monad (Tx: 0x9b3f...7c1a)</div>
                  <div>HTTP/1.1 200 OK — Content-Type: application/json</div>
                  <div className="text-text-primary mt-1 font-bold">&#123; "sentiment": "bullish", "score": 0.94, "records": 4820 &#125;</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. TRADITIONAL VS X402 COMPARISON */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Paradigm Shift
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              APIs Built for Autonomous Buyers
            </h2>
            <p className="text-[14px] text-text-secondary">
              Replace rigid monthly seat subscriptions with granular, usage-based machine settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-bg-elevated border border-border-subtle p-6 rounded-2xl">
              <div className="text-[11px] font-mono font-bold text-text-quaternary uppercase mb-2">
                TRADITIONAL WEB API
              </div>
              <h3 className="text-[17px] font-bold text-text-primary mb-3">
                High Friction & Monthly Lock-in
              </h3>
              <div className="space-y-2 text-[12.5px] font-mono text-text-tertiary mb-4">
                <div>1. Create corporate developer account</div>
                <div>2. Add credit card & accept monthly recurring invoice</div>
                <div>3. Generate and rotate secret API keys</div>
                <div>4. Pay flat fees regardless of agent request volume</div>
              </div>
              <div className="text-[11px] text-text-quaternary pt-3 border-t border-border-subtle">
                Result: Unusable for autonomous agent networks.
              </div>
            </div>

            <div className="bg-bg-elevated border border-accent-violet/40 p-6 rounded-2xl shadow-xl">
              <div className="text-[11px] font-mono font-bold text-accent-violet uppercase mb-2">
                CIRCUITS x402 NATIVE
              </div>
              <h3 className="text-[17px] font-bold text-text-primary mb-3">
                Sub-Second Pay-Per-Request
              </h3>
              <div className="space-y-2 text-[12.5px] font-mono text-text-secondary mb-4">
                <div className="text-emerald">✔ Request endpoint directly</div>
                <div className="text-emerald">✔ Pay exact USDC fee on HTTP 402 challenge</div>
                <div className="text-emerald">✔ Settle in sub-seconds on Monad</div>
                <div className="text-emerald">✔ Zero accounts, keys, or monthly subscriptions</div>
              </div>
              <div className="text-[11px] text-accent-violet pt-3 border-t border-border-subtle font-mono font-bold">
                Result: Frictionless machine-to-machine commerce.
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4. 4-STEP PROTOCOL LIFECYCLE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Protocol Lifecycle
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              REGISTER ➔ QUOTE ➔ PAY ➔ FULFILL
            </h2>
            <p className="text-[14px] text-text-secondary">
              A four-step atomic execution loop governed by smart contracts on Monad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LIFECYCLE_STEPS.map((s) => (
              <div
                key={s.step}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/20 inline-block mb-3">
                    STEP {s.step}
                  </div>
                  <h3 className="text-[14.5px] font-bold text-text-primary mb-1.5">{s.title}</h3>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 5. LIVE SERVICE DIRECTORY */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Market Catalog
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Live x402 Service Directory
            </h2>
            <p className="text-[14px] text-text-secondary">
              Production APIs ready for programmatic invocation by autonomous agents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {LIVE_SERVICES.map((srv) => (
              <div
                key={srv.name}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle">
                    <span className="text-[10.5px] font-mono font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/30">
                      {srv.category}
                    </span>
                    <span className="text-[11px] font-mono text-emerald font-bold">
                      {srv.price}
                    </span>
                  </div>

                  <h3 className="text-[16px] font-bold text-text-primary mb-2">
                    {srv.name}
                  </h3>

                  <div className="space-y-2 text-[11.5px] font-mono text-text-secondary bg-bg-raised p-3 rounded-xl border border-border-subtle mb-4">
                    <div className="truncate text-text-tertiary">
                      Endpoint: <span className="text-text-primary">{srv.endpoint}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Latency:</span>
                      <span className="text-emerald font-bold">{srv.latency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Provider:</span>
                      <span className="text-accent-violet">{srv.provider}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={appUrl("/x402-services")}
                  className="w-full py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-center transition-all shadow-xs"
                >
                  Invoke via x402 →
                </Link>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 6. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Autonomous Machine Commerce
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

        {/* 7. CROSS-LINKING ECOSYSTEM CTA */}
        <Reveal>
          <section className="rounded-3xl border border-border-strong px-6 py-16 md:py-20 text-center bg-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />
            <div className="relative max-w-160 mx-auto">
              <h2 className="text-[32px] md:text-[44px] font-black tracking-tight mb-3 text-text-primary">
                Your Agent Has a Service. <br />Now Monetize It.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Connect your endpoints to x402 on Monad, monetize query traffic, and let other autonomous agents pay you directly in USDC.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/x402-services?create=1")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  List a Service →
                </Link>
                <Link
                  href={appUrl("/knowledge")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Explore Knowledge Gateway
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
