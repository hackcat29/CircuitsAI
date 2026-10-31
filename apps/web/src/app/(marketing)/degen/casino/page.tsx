import Link from "next/link";
import {
  Dices,
  TrendingUp,
  Activity,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Scale,
  DollarSign,
  AlertTriangle,
  FileCode,
  Terminal,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { DegenControlLayer, DegenHubArchitecture } from "@/components/marketing/degen";

export const metadata = constructMetadata({
  title: "Casino: Provably Fair On-Chain Gaming with Agent Automation",
  description:
    "Let agents interact with verifiable on-chain casino games where outcomes can be independently checked on-chain using SHA-256 cryptographic seeds and commitment proofs.",
  path: "/degen/casino",
  keywords: [
    "provably fair casino AI",
    "on-chain crypto casino",
    "Crash multiplier crypto",
    "provably fair random number generator",
    "autonomous casino bot",
    "SportyStake casino",
    "Monad crypto casino",
    "USDC casino gaming",
  ],
});

const CASINO_GAMES = [
  {
    name: "Crash",
    desc: "Watch the multiplier climb and execute programmatic auto-cashouts before the curve busts.",
    metric: "Up to 10,000x",
    provable: "SHA-256 Chain",
    type: "Curve Multiplier",
  },
  {
    name: "Dice",
    desc: "Predict whether the random roll will land over or under your target range with custom odds.",
    metric: "99.0% RTP",
    provable: "Client + Server Seed",
    type: "Range Forecasting",
  },
  {
    name: "Roulette",
    desc: "European single-zero wheel with verifiable physics and deterministic on-chain ball landing.",
    metric: "36:1 Payout",
    provable: "Random Nonce Hash",
    type: "Classic Table",
  },
  {
    name: "Blackjack",
    desc: "Standard card play against the dealer with provably fair deck shuffling and deterministic draws.",
    metric: "3:2 Blackjack",
    provable: "Hashed Deck Shuffle",
    type: "Card Strategy",
  },
];

const FAQS = [
  {
    question: "What does 'Provably Fair' mean?",
    answer:
      "Provably Fair means that game outcomes are determined mathematically using a combination of the server's pre-committed secret seed, your client seed, and a sequential nonce. You can independently verify with SHA-256 cryptography that the house did not alter the result after your wager was placed.",
  },
  {
    question: "Can autonomous agents play casino games?",
    answer:
      "Yes. Agents can connect programmatically via API or SDK to execute automated bankroll management strategies, setting session stop-losses, take-profit limits, and auto-cashout parameters.",
  },
  {
    question: "How are game seeds verified on-chain?",
    answer:
      "Before a game begins, the server publishes a cryptographic hash of its secret seed. After the game concludes, the unhashed seed is revealed. Anyone can hash the revealed seed alongside their client seed to mathematically prove outcome authenticity on Monad.",
  },
  {
    question: "What risk limits exist for casino play?",
    answer:
      "Casino automation enforces hard boundaries: maximum stake per round (e.g. 5 USDC), maximum session bankroll caps, strict daily loss limits, and instant emergency halts.",
  },
  {
    question: "Can I test games in Paper Mode first?",
    answer:
      "Yes. Paper Mode allows agents to simulate gaming sessions with $100,000 virtual USDC and test auto-cashout logic against the live provably-fair engine with zero financial risk.",
  },
];

export default function CasinoMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Degen Hub", url: "https://circuitsprotocol.com/degen" },
    { name: "Casino", url: "https://circuitsprotocol.com/degen/casino" },
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
              <Dices className="h-3.5 w-3.5" /> PROVABLY FAIR GAMING
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Provably Fair. <br className="hidden sm:inline" />
            <span className="text-accent-violet">Fully On-Chain.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Let agents interact with verifiable casino games where outcomes can be independently checked on-chain.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/degen/casino")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Enter Casino →
            </Link>
            <Link
              href={appUrl("/degen/casino")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Inspect Fairness
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>CRASH, DICE & BLACKJACK</span>
            <span>•</span>
            <span>SHA-256 SEED VERIFICATION</span>
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
            { val: "SHA-256", lbl: "Cryptographic Seed Commitments" },
            { val: "100% Verifiable", lbl: "Independent Client Verification" },
            { val: "Sub-Second", lbl: "Instant Round Settlement" },
            { val: "Isolated Vault", lbl: "Strict Session Bankroll Caps" },
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

        {/* 2. PROVABLY-FAIR VERIFIER CENTERPIECE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Independent Cryptographic Verification
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Don't Trust the House. Verify the Result.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Every multiplier and dice roll is locked before the round begins. Verify the outcome independently using SHA-256 mathematics.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Verifier Terminal */}
              <div className="lg:col-span-7 bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
                    <span className="font-bold text-text-primary">CRASH MULTIPLIER VERIFIER</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded border border-emerald/30">
                    ✔ VERIFIED ON-CHAIN
                  </span>
                </div>

                <div className="bg-bg-surface3 p-4 rounded-xl border border-border-subtle space-y-2.5 text-[11.5px]">
                  <div className="flex justify-between items-center">
                    <span className="text-text-tertiary">ROUND OUTCOME:</span>
                    <span className="text-[18px] font-black text-emerald">3.82x Multiplier</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-tertiary">SERVER SEED (HASH):</span>
                    <span className="text-text-primary text-[11px] truncate max-w-60">a91f94d072be9841c8e...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-tertiary">CLIENT SEED (USER):</span>
                    <span className="text-accent-violet text-[11px]">93fa28c18c12a7</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-tertiary">SEQUENTIAL NONCE:</span>
                    <span className="text-text-primary">#18,427</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border-subtle">
                    <span className="text-emerald font-bold">SHA-256 HASH MATCH:</span>
                    <span className="text-emerald font-bold">100% MATHEMATICAL VALIDITY</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-text-tertiary">Monad Block #984,102</span>
                  <Link
                    href={appUrl("/degen/casino")}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                  >
                    Launch Crash →
                  </Link>
                </div>
              </div>

              {/* Step-by-Step Mechanism */}
              <div className="lg:col-span-5 space-y-3 font-mono text-[12px]">
                <div className="text-[11px] font-bold text-text-quaternary uppercase mb-2">
                  VERIFICATION PIPELINE
                </div>
                {[
                  { step: "01 COMMITMENT", text: "House generates seed and publishes immutable SHA-256 hash before wagers are placed" },
                  { step: "02 GAMEPLAY", text: "Player provides custom client seed and sequential nonce to randomize outcome" },
                  { step: "03 RESULT", text: "Game finishes and outcome multiplier is settled immediately on Monad" },
                  { step: "04 REVEAL", text: "Plaintext server seed is published to the public blockchain ledger" },
                  { step: "05 AUDIT", text: "Anyone re-computes the hash to prove no tampering occurred" },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="p-3 rounded-xl bg-bg-raised border border-border-subtle flex items-start gap-3"
                  >
                    <span className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30 shrink-0">
                      {item.step}
                    </span>
                    <span className="text-text-secondary text-[11.5px] leading-relaxed">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. EVERY GAME HAS A VERIFIABLE OUTCOME */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Game Suite
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Every Game Has a Verifiable Outcome
            </h2>
            <p className="text-[14px] text-text-secondary">
              Classic and arcade casino mechanics running on deterministic on-chain randomness.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CASINO_GAMES.map((game) => (
              <div
                key={game.name}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30">
                      {game.type}
                    </span>
                    <span className="text-[10px] font-mono text-emerald font-bold">{game.metric}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-text-primary mb-2">{game.name}</h3>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6] mb-4">{game.desc}</p>
                </div>

                <div className="pt-3 border-t border-border-subtle flex justify-between items-center text-[11px] font-mono">
                  <span className="text-text-quaternary">{game.provable}</span>
                  <Link
                    href={appUrl("/degen/casino")}
                    className="text-accent-violet font-bold hover:underline"
                  >
                    Play →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4. AUTONOMOUS AGENT STRATEGY MODE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Programmatic Automation
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Automate Bankroll & Cashout Rules.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  Let your agent execute rule-based sessions with deterministic auto-cashout multipliers, strict bankroll boundaries, and trailing take-profits.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Deterministic auto-cashout thresholds (e.g. 2.10x)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Hard session stop-loss limits (e.g. 50 USDC max loss)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Take-profit triggers that automatically return funds to treasury</span>
                  </div>
                </div>
              </div>

              {/* Policy Card Mock */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-3 shadow-xl">
                <div className="text-[11px] font-bold text-accent-violet uppercase pb-2 border-b border-border-subtle flex justify-between">
                  <span>AGENT CRASH STRATEGY POLICY</span>
                  <span className="text-accent-violet">● PAPER MODE</span>
                </div>
                <div className="space-y-2.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Session Bankroll:</span>
                    <span className="text-text-primary font-bold">500 USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Max Wager Per Round:</span>
                    <span className="text-text-primary font-bold">5 USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Target Auto-Cashout:</span>
                    <span className="text-accent-violet font-bold">2.10x Multiplier</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Session Stop-Loss:</span>
                    <span className="text-accent-orange font-bold">-50 USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Session Take-Profit:</span>
                    <span className="text-emerald font-bold">+100 USDC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 5. HOUSE EDGE TRANSPARENCY */}
        <Reveal>
          <div className="rounded-3xl border border-border-subtle bg-bg-raised/60 p-6 font-mono text-[11.5px] text-text-secondary space-y-2">
            <div className="text-[11px] font-bold text-text-quaternary uppercase flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-accent-orange" />
              <span>HOUSE EDGE TRANSPARENCY & MATHEMATICAL REALITY</span>
            </div>
            <p className="leading-relaxed">
              Casino games incorporate a built-in mathematical house edge. Individual round outcomes are uncertain and long-term expected returns are negative. Circuits Protocol guarantees the cryptographic fairness and verifiable randomness of outcomes, but does not provide an exploitable or guaranteed edge.
            </p>
          </div>
        </Reveal>

        {/* 6. CROSS-MARKET RISK CONTROL LAYER */}
        <Reveal>
          <DegenControlLayer venueType="casino" />
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
              Built for Cryptographic Verifiability
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
                Play Games You Can Verify.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Inspect every seed, verify every multiplier, and test automated session bankrolls with $100,000 virtual USDC in Paper Mode.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/degen/casino")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Enter Casino →
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
