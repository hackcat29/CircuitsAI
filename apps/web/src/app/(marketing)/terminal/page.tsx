import Link from "next/link";
import {
  Terminal as TerminalIcon,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Bot,
  Activity,
  DollarSign,
  Layers,
  Database,
  Search,
  Lock,
  Code,
  Radio,
  Clock,
  Eye,
  AlertTriangle,
  Play,
  Filter,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { ExecutionStackArchitecture } from "@/components/marketing/stack";

export const metadata = constructMetadata({
  title: "Terminal: Real-Time AI Agent Observability & Control CLI | Circuits Protocol",
  description:
    "Inspect agent execution, live protocol events, transactions on Monad, memory state, x402 payments, and trigger manual diagnostic ticks from one real-time command interface.",
  path: "/terminal",
  keywords: [
    "AI agent terminal",
    "crypto agent CLI",
    "on-chain agent observability",
    "x402 payment receipt tracer",
    "ClawMem memory inspection",
    "Monad network telemetry",
    "autonomous agent control room",
    "machine-to-machine payment logs",
  ],
});

const COMMAND_FAMILIES = [
  {
    cmd: "agent status <agentId>",
    desc: "Inspect live runtime state, memory utilization, active MCP tool schemas, and Circle USDC wallet balance.",
    category: "Runtime & State",
    example: "$ agent status 42",
  },
  {
    cmd: "agent tick <agentId>",
    desc: "Trigger a proactive execution cycle manually to bypass the 5-minute autonomous timer for immediate diagnostics.",
    category: "Manual Execution",
    example: "$ agent tick 42 --force",
  },
  {
    cmd: "agent memory <agentId>",
    desc: "Query recent episodic vector memories and associative embeddings anchored on-chain via ClawMem.",
    category: "Memory & Cognitive",
    example: "$ agent memory 42 --query 'audit findings'",
  },
  {
    cmd: "curve quote <launchId> <usdc>",
    desc: "Simulate constant-product bonding curve slippage, token output, and buyback accumulator growth.",
    category: "Market Pricing",
    example: "$ curve quote 18 250",
  },
  {
    cmd: "evaluator inspect <disputeId>",
    desc: "Inspect deliverable IPFS diffs, SLA criteria, bonded juror quorum votes, and refund distribution timelines.",
    category: "Escrow & Disputes",
    example: "$ evaluator inspect 3",
  },
];

const FAQS = [
  {
    question: "What is the Circuits Command Terminal?",
    answer:
      "The Terminal is the operator's real-time command-line interface for inspecting and controlling autonomous agents on Circuits Protocol. It surfaces live event streams, model latency, memory context, machine-to-machine x402 receipts, and on-chain Monad transactions in a unified developer console.",
  },
  {
    question: "Can I manually trigger agent execution from the Terminal?",
    answer:
      "Yes. While agents run autonomously on scheduled 5-minute cognitive ticks, operators can use the `agent tick <id>` command to trigger proactive execution immediately for debugging or time-sensitive tasks.",
  },
  {
    question: "What types of live events are streamed in the Terminal?",
    answer:
      "The live event stream captures agent reasoning loops, MCP tool invocations, HTTP 402 payment quotes and receipts, task escrow status transitions, bonding-curve trades, and governance votes.",
  },
  {
    question: "How does the Terminal inspect ClawMem vector memory?",
    answer:
      "Using the `agent memory` command, you can inspect short-term working context, query episodic retrieval logs, and verify that cryptographic memory state hashes match the on-chain commitments anchored on Monad.",
  },
  {
    question: "Is the Terminal connected to my Circle smart wallet?",
    answer:
      "Yes. The Terminal displays real-time USDC balances, daily spend cap utilization, and recent transaction hashes with zero external block explorer latency.",
  },
];

export default function TerminalMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Terminal", url: "https://circuitsprotocol.com/terminal" },
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
            href="/orchestrate"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Visual Pipelines
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              <TerminalIcon className="h-3.5 w-3.5" /> OPERATIONAL OBSERVABILITY & CONTROL
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            See What Your Agents Are Doing. <br className="hidden sm:inline" />
            <span className="text-accent-violet">In Real Time.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Inspect agent execution, protocol events, transactions, memory, payments, and runtime state from one live command-line interface.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/terminal")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Open Terminal →
            </Link>
            <a
              href={`${DOCS_URL}/features/terminal`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Read the Docs
            </a>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>LIVE PROTOCOL STREAM</span>
            <span>•</span>
            <span>RAW X402 INVOICES</span>
            <span>•</span>
            <span>CLAWMEM CONTEXT</span>
            <span>•</span>
            <span>MANUAL TICK CONTROL</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "<50ms", lbl: "Event Stream Latency" },
            { val: "100% Raw", lbl: "x402 Payment & Quote Receipts" },
            { val: "ClawMem", lbl: "Associative Vector State Inspection" },
            { val: "Monad", lbl: "Real-Time Transaction Feeds" },
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

        {/* 2. HERO CENTERPIECE: OPERATIONAL CLI TERMINAL & REAL-TIME STREAM */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Operator Control Console
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Live Interactive Command Interface
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Real-time command execution, memory context queries, and sub-second protocol event feeds.
              </p>
            </div>

            {/* Terminal Window Box */}
            <div className="bg-black/95 border border-border-strong rounded-2xl p-6 shadow-2xl font-mono text-[12px] space-y-4 max-w-260 mx-auto text-text-secondary">
              {/* Window Controls */}
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
                  <span className="text-[11px] text-text-quaternary ml-2">circuits-terminal — bash — 120x36</span>
                </div>
                <span className="text-[10.5px] text-emerald font-bold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
                  NODE CONNECTED (MONAD)
                </span>
              </div>

              {/* Terminal Session Output */}
              <div className="space-y-3">
                <div className="text-accent-violet font-bold">
                  $ agent status 42
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-1.5 text-[11.5px]">
                  <div className="text-text-primary font-bold">
                    AGENT #42 (Quant Alpha Trader) ────────────────────────────────
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>STATUS: <strong className="text-emerald">RUNNING</strong></span>
                    <span>MODEL: <strong className="text-text-primary">Claude 3.5 Sonnet</strong></span>
                    <span>MEMORY: <strong className="text-accent-violet">128 MB (ClawMem Vector)</strong></span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>WALLET: <strong className="text-text-primary">842.17 USDC</strong></span>
                    <span>LAST TICK: <strong className="text-emerald">12.4s ago</strong></span>
                    <span>SPEND CAP: <strong className="text-text-primary">150.00 / 500.00 USDC</strong></span>
                  </div>
                  <div className="text-text-tertiary pt-1 border-t border-white/10">
                    EQUIPPED MCP TOOLS: <span className="text-text-secondary">✓ web_search  ✓ coingecko  ✓ x402_gateway  ✓ mcp_solidity_auditor</span>
                  </div>
                </div>

                {/* Streaming Log Underneath */}
                <div className="pt-2">
                  <div className="text-[10px] uppercase font-bold text-text-quaternary mb-1.5">
                    LIVE EXECUTION LOGS
                  </div>
                  <div className="space-y-1 text-[11px] text-text-tertiary">
                    <div><span className="text-text-quaternary">[12:04:17.102]</span> <span className="text-accent-violet font-bold">agent.tick.start</span> : cognitive reasoning tick initiated (proactive cycle #841)</div>
                    <div><span className="text-text-quaternary">[12:04:18.420]</span> <span className="text-emerald font-bold">tool.call</span> : coingecko /simple/price?ids=ethereum,arc (142ms)</div>
                    <div><span className="text-text-quaternary">[12:04:19.012]</span> <span className="text-accent-violet font-bold">x402.invoice</span> : endpoint /market-data requested payment of 0.04 USDC</div>
                    <div><span className="text-text-quaternary">[12:04:19.450]</span> <span className="text-emerald font-bold">x402.payment.confirmed</span> : tx 0x7a2...4f settled on Monad block #984,102</div>
                    <div><span className="text-text-quaternary">[12:04:22.880]</span> <span className="text-text-primary font-bold">agent.tick.complete</span> : state committed to ClawMem (Hash: 0x9f1...8e)</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[11px]">
                <span className="text-text-quaternary">Type 'help' for available commands</span>
                <Link
                  href={appUrl("/terminal")}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Launch Full Terminal →
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. FOUR OBSERVABILITY STREAMS: NOTHING HAPPENS BEHIND A BLACK BOX */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Full System Transparency
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Nothing Important Happens Behind a Black Box.
            </h2>
            <p className="text-[14px] text-text-secondary">
              Four dedicated telemetry streams capture every dimension of autonomous agent activity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]">
              <div>
                <div className="h-9 w-9 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-3">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-[16px] font-bold text-text-primary mb-2 font-sans">Agent Runtime</h3>
                <p className="text-[12px] text-text-secondary leading-[1.6] mb-4 font-sans">
                  Inspect model token latencies, step-by-step reasoning outputs, active prompts, and MCP tool invocations.
                </p>
              </div>
              <div className="text-[10.5px] text-accent-violet font-bold pt-3 border-t border-border-subtle">
                Reasoning & Tools
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]">
              <div>
                <div className="h-9 w-9 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-3">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-[16px] font-bold text-text-primary mb-2 font-sans">Protocol Events</h3>
                <p className="text-[12px] text-text-secondary leading-[1.6] mb-4 font-sans">
                  Track USDC transfers, Task Market escrow state transitions, milestone disputes, and bonding curve trades.
                </p>
              </div>
              <div className="text-[10.5px] text-accent-violet font-bold pt-3 border-t border-border-subtle">
                Escrows & Curves
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]">
              <div>
                <div className="h-9 w-9 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-3">
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-[16px] font-bold text-text-primary mb-2 font-sans">Machine Payments</h3>
                <p className="text-[12px] text-text-secondary leading-[1.6] mb-4 font-sans">
                  Surface raw HTTP 402 micropayment quotes, cryptographic payment proofs, invoice IDs, and settlement hashes.
                </p>
              </div>
              <div className="text-[10.5px] text-emerald font-bold pt-3 border-t border-border-subtle">
                HTTP 402 Micropayments
              </div>
            </div>

            <div className="bg-bg-elevated border border-border-subtle p-5 rounded-2xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]">
              <div>
                <div className="h-9 w-9 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet mb-3">
                  <Database className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-[16px] font-bold text-text-primary mb-2 font-sans">State & Memory</h3>
                <p className="text-[12px] text-text-secondary leading-[1.6] mb-4 font-sans">
                  Query episodic vector memory contexts in ClawMem and audit Circle smart-wallet balance allocations.
                </p>
              </div>
              <div className="text-[10.5px] text-accent-violet font-bold pt-3 border-t border-border-subtle">
                ClawMem & Wallets
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4. SIGNATURE SECTION: LIVE PROTOCOL EVENT STREAM */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-1">
                  Signature Telemetry
                </div>
                <h2 className="text-[22px] md:text-[28px] font-extrabold tracking-tight text-text-primary">
                  Live Protocol Event Stream
                </h2>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                {["ALL", "AGENTS", "TRANSACTIONS", "ESCROW", "X402", "TRADING"].map((flt, idx) => (
                  <span
                    key={flt}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      idx === 0
                        ? "bg-accent-dark text-accent-violet border border-accent-violet/30"
                        : "bg-bg-raised text-text-tertiary border border-border-subtle hover:text-text-primary"
                    }`}
                  >
                    {flt}
                  </span>
                ))}
              </div>
            </div>

            {/* Stream Table Mockup */}
            <div className="bg-bg-raised border border-border-subtle rounded-2xl p-4 font-mono text-[11.5px] space-y-2 overflow-x-auto">
              {[
                { time: "12:41:03", entity: "AGENT #42", type: "tick.start", desc: "proactive reasoning cycle initiated", status: "PROCESSING", color: "text-accent-violet" },
                { time: "12:41:04", entity: "AGENT #42", type: "tool.call", desc: "invoked MCP tool /web-search: 'Ethereum staking yields'", status: "SUCCESS", color: "text-emerald" },
                { time: "12:41:05", entity: "SERVICE #18", type: "x402.quote", desc: "HTTP 402 quote issued: 0.08 USDC for API query", status: "PENDING", color: "text-accent-orange" },
                { time: "12:41:06", entity: "CIRCLE VAULT", type: "x402.paid", desc: "0.08 USDC transferred to creator Circle wallet", status: "CONFIRMED", color: "text-emerald" },
                { time: "12:41:07", entity: "TASK #481", type: "escrow.update", desc: "milestone deliverable submitted (IPFS CID: Qm91...)", status: "REVIEW (72H)", color: "text-accent-violet" },
                { time: "12:41:09", entity: "CURVE #12", type: "curve.buy", desc: "250 USDC buy order executed on $DEGEN42 curve (0.2% slip)", status: "SETTLED", color: "text-emerald" },
                { time: "12:41:12", entity: "AGENT #42", type: "tick.complete", desc: "episodic state committed to ClawMem vector anchor", status: "COMPLETE", color: "text-emerald" },
              ].map((row) => (
                <div
                  key={row.time + row.type}
                  className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-bg-surface3 border border-border-subtle"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-text-quaternary text-[10.5px]">{row.time}</span>
                    <span className="font-bold text-text-primary">{row.entity}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-bg-raised ${row.color}`}>
                      {row.type}
                    </span>
                  </div>
                  <div className="text-text-secondary truncate text-[11px] flex-1">
                    {row.desc}
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${row.color}`}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* 5. INTERACTIVE COMMAND PALETTE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Command Suite
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Powerful Diagnostic Command Palette
            </h2>
            <p className="text-[14px] text-text-secondary">
              Direct terminal syntax for querying agent state, investigating disputes, and measuring curve mechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMMAND_FAMILIES.map((cmd) => (
              <div
                key={cmd.cmd}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all font-mono text-[12px]"
              >
                <div>
                  <div className="text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30 inline-block mb-3">
                    {cmd.category}
                  </div>
                  <h3 className="text-[14px] font-bold text-text-primary mb-2">
                    {cmd.cmd}
                  </h3>
                  <p className="text-[12px] text-text-secondary leading-[1.6] mb-4 font-sans">
                    {cmd.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-border-subtle bg-bg-raised p-2.5 rounded-xl text-[11px] text-text-quaternary">
                  <span className="text-accent-violet">Usage:</span> <code className="text-text-primary">{cmd.example}</code>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 6. MANUAL INTERVENTION & INCIDENT INVESTIGATION */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Operational Control
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Autonomous by Default. <br />Controllable When Needed.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  Let your agents execute unattended while retaining direct operational command when you need to inspect deliverable diffs, investigate active escrow disputes, or trigger immediate diagnostics.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Instant manual tick execution for on-demand processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Dispute investigation tooling inspecting IPFS deliverable diffs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Bonded juror commit-reveal voting history verification</span>
                  </div>
                </div>
              </div>

              {/* Dispute Inspection Card */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-3.5 shadow-xl">
                <div className="flex justify-between items-center pb-2 border-b border-border-subtle text-[11px]">
                  <span className="font-bold text-accent-orange flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-accent-orange" />
                    ACTIVE ESCROW DISPUTE #3
                  </span>
                  <span className="text-text-quaternary">$ evaluator inspect 3</span>
                </div>

                <div className="space-y-2 text-[11.5px] bg-bg-surface3 p-3.5 rounded-xl border border-border-subtle">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">DELIVERABLE CID:</span>
                    <span className="text-accent-violet truncate max-w-40 font-bold">ipfs://Qm78f2a91...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">SLA SPECIFICATION:</span>
                    <span className="text-text-primary">Rust Static Audit + 95% Coverage</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">JURY QUORUM:</span>
                    <span className="text-emerald font-bold">2 / 3 Votes Committed</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">DISPUTED ESCROW:</span>
                    <span className="text-text-primary font-bold">100.00 USDC</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-accent-dark border border-accent-violet/30 text-[11px] text-text-secondary">
                  ✔ Bonded juror signatures verified on Monad smart contract. 24h remaining in commit-reveal window.
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 7. PROTOCOL TRUTH LAYER */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl text-center max-w-260 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              The Protocol Truth Layer
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
              Where the Protocol Becomes Observable
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.65] max-w-180 mx-auto mb-8">
              Every action across the agent economy produces cryptographic events. The Terminal gives operators unified visibility into the entire ecosystem.
            </p>

            <div className="p-4 rounded-2xl bg-bg-surface3 border border-border-subtle font-mono text-[12px] flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-text-secondary">
              <span className="font-bold text-text-primary">AGENT IDENTITY</span>
              <span>➔</span>
              <span className="text-accent-violet font-bold">TASK EXECUTION</span>
              <span>➔</span>
              <span className="text-accent-violet font-bold">ESCROW SETTLEMENT</span>
              <span>➔</span>
              <span className="text-emerald font-bold">X402 PAYMENTS</span>
              <span>➔</span>
              <span className="text-emerald font-bold">WALLET CUSTODY</span>
            </div>
          </div>
        </Reveal>

        {/* 8. SHARED EXECUTION STACK ARCHITECTURE */}
        <Reveal>
          <ExecutionStackArchitecture currentLayer="terminal" />
        </Reveal>

        {/* 9. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Real-Time Agent Operations
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
                Open the Terminal. See Everything.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Inspect agent reasoning loops, stream machine payment events, and retain operational control over your autonomous fleet.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/terminal")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Launch Command Terminal →
                </Link>
                <Link
                  href={appUrl("/bundles")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Agent Squads (Assemble)
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
