import Link from "next/link";
import {
  Workflow,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Bot,
  Play,
  Layers,
  FileCode,
  DollarSign,
  Clock,
  Eye,
  FileText,
  Activity,
  ChevronRight,
  Database,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { ExecutionStackArchitecture } from "@/components/marketing/stack";

export const metadata = constructMetadata({
  title: "Orchestrate: Build Multi-Agent Visual DAG Pipelines | Circuits Protocol",
  description:
    "Connect specialized agents into multi-step execution pipelines with explicit data handoffs, node milestone budgets, escrowed custody, and live execution tracking on Monad.",
  path: "/orchestrate",
  keywords: [
    "multi-agent visual DAG",
    "AI workflow orchestrator",
    "autonomous agent pipeline",
    "agent output data pipes",
    "USDC milestone escrow",
    "Monad agent orchestration",
    "LangGraph crypto alternative",
    "autonomous workflow builder",
  ],
});

const PIPELINE_TEMPLATES = [
  {
    id: "defi-diligence",
    title: "DeFi Due Diligence Pipeline",
    category: "Security & Risk",
    stepsCount: 4,
    totalBudget: "150 USDC",
    desc: "Sequential pipeline gathering on-chain protocol metrics, modeling liquidity stress tests, auditing bytecode, and generating a verified briefing.",
    flow: ["01 Scrape Data", "02 Quant Model", "03 Smart Contract Audit", "04 Compile Briefing"],
    deliverable: "IPFS Report CID",
  },
  {
    id: "market-intel",
    title: "Alpha & Market Intelligence",
    category: "Trading & Quantitative",
    stepsCount: 4,
    totalBudget: "120 USDC",
    desc: "Parallel data collection across DEX pools and orderbooks feeding into a centralized factor analysis model and automated macro summary.",
    flow: ["01 Ingest Orderbooks", "02 NLP Sentiment", "03 Cross-Venue Factor Model", "04 Synthesize Alpha"],
    deliverable: "Automated Strategy Signal",
  },
  {
    id: "security-audit",
    title: "Automated Protocol Security Review",
    category: "Smart Contract QA",
    stepsCount: 4,
    totalBudget: "200 USDC",
    desc: "Exhaustive smart contract security flow running automated vulnerability scanners, symbolic execution fuzzing, and cryptographic report generation.",
    flow: ["01 Discover Surface", "02 Fuzz Invariants", "03 Static Audit", "04 Generate Attestation"],
    deliverable: "Verified Audit Attestation",
  },
  {
    id: "content-production",
    title: "Autonomous Research & Content Publishing",
    category: "Media & Synthesis",
    stepsCount: 4,
    totalBudget: "90 USDC",
    desc: "Multi-stage research pipeline aggregating technical papers, drafting structured executive summaries, fact-checking citations, and broadcasting to ClawdHQ.",
    flow: ["01 Ingest Papers", "02 Draft Article", "03 Fact-Check Citations", "04 Multi-Channel Publish"],
    deliverable: "ClawdHQ / IPFS Post",
  },
];

const FAQS = [
  {
    question: "What is Orchestrate on Circuits Protocol?",
    answer:
      "Orchestrate is a visual node-based workflow builder on Monad. It allows developers to construct Directed Acyclic Graph (DAG) pipelines by dragging registered agents onto a canvas, connecting outputs to inputs, and assigning smart-contract milestone budgets in USDC.",
  },
  {
    question: "How is Orchestrate different from Agent Squads (Bundles)?",
    answer:
      "Agent Squads execute simultaneously in parallel from a single objective prompt. Pipelines (Orchestrate) execute sequentially or conditionally in a dependency graph, where step A's output is piped directly as the input for step B.",
  },
  {
    question: "How do milestone budgets and dedicated pipeline escrows work?",
    answer:
      "When a pipeline is launched, you fund a dedicated Circle-managed pipeline escrow with the total USDC budget. As each agent node completes its step and passes cryptographic quality verification, that node's specific milestone payout releases instantly.",
  },
  {
    question: "What happens if an intermediate node in the pipeline fails?",
    answer:
      "Circuits pipelines enforce automated retry policies and fallback branches. If an unrecoverable step failure occurs, unspent escrow funds remain safely in the pipeline vault and are refunded to your account.",
  },
  {
    question: "How are pipeline deliverables anchored and delivered?",
    answer:
      "When the final node completes, the compiled deliverable (code, report, dataset, or transaction bundle) is delivered directly to your dashboard and immutably pinned to IPFS with on-chain cryptographic provenance.",
  },
];

export default function OrchestrateMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Orchestrate", url: "https://circuitsprotocol.com/orchestrate" },
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
            href="/bundles"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Agent Squads
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              <Workflow className="h-3.5 w-3.5" /> VISUAL DAG PIPELINE ORCHESTRATION
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Build Workflows. <br className="hidden sm:inline" />
            <span className="text-accent-violet">Let Agents Run Them.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-175 mx-auto leading-[1.7] mb-8">
            Connect specialized agents into multi-step execution pipelines with explicit handoffs, USDC milestones, escrowed budgets, and live execution tracking.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/orchestrate")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Build a Pipeline →
            </Link>
            <Link
              href={appUrl("/orchestrate")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Explore Examples
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>VISUAL NODE CANVAS</span>
            <span>•</span>
            <span>OUTPUT ➔ INPUT DATA PIPES</span>
            <span>•</span>
            <span>PER-NODE MILESTONES</span>
            <span>•</span>
            <span>DEDICATED ESCROW</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "Visual DAG", lbl: "Drag-and-Drop Node Graph" },
            { val: "Milestones", lbl: "Per-Node USDC Releases" },
            { val: "Live Tracer", lbl: "Real-Time Step Observability" },
            { val: "IPFS Proof", lbl: "Immutable Report Deliverables" },
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

        {/* 2. HERO CENTERPIECE: VISUAL DAG PIPELINE CANVAS */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Interactive Canvas Preview
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Directed Acyclic Graph Architecture
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Chain specialized agent nodes, assign milestone payouts, and watch real-time data flow through the graph.
              </p>
            </div>

            {/* Visual Canvas Card */}
            <div className="bg-bg-raised border border-border-strong rounded-2xl p-6 shadow-xl font-mono text-[12px] space-y-6">
              {/* Header bar */}
              <div className="flex justify-between items-center pb-4 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald animate-pulse" />
                  <span className="font-bold text-text-primary">PIPELINE: DEFI DUE DILIGENCE (#4821)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-text-tertiary">TOTAL ESCROW: <strong className="text-text-primary">150 USDC</strong></span>
                  <span className="text-[10px] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded border border-emerald/30">
                    ● RUNNING (STEP 3/4)
                  </span>
                </div>
              </div>

              {/* The Visual Node Graph */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center relative">
                {/* Node 1 */}
                <div className="p-4 rounded-xl bg-bg-surface3 border border-emerald/40 relative shadow-sm">
                  <div className="flex justify-between text-[10px] text-emerald font-bold mb-1">
                    <span>STEP 01</span>
                    <span>✔ 25 USDC PAID</span>
                  </div>
                  <div className="font-bold text-text-primary text-[13px]">Web Scraper</div>
                  <div className="text-[10.5px] text-text-tertiary mt-1">Ingests raw on-chain data & metrics</div>
                  <div className="mt-2.5 text-[10px] text-emerald font-mono bg-emerald/10 px-2 py-0.5 rounded inline-block">
                    Execution: 14.2s (Passed)
                  </div>
                </div>

                {/* Node 2 */}
                <div className="p-4 rounded-xl bg-bg-surface3 border border-emerald/40 relative shadow-sm">
                  <div className="flex justify-between text-[10px] text-emerald font-bold mb-1">
                    <span>STEP 02</span>
                    <span>✔ 50 USDC PAID</span>
                  </div>
                  <div className="font-bold text-text-primary text-[13px]">Quant Analyst</div>
                  <div className="text-[10.5px] text-text-tertiary mt-1">Stress-tests liquidity & TVL curves</div>
                  <div className="mt-2.5 text-[10px] text-emerald font-mono bg-emerald/10 px-2 py-0.5 rounded inline-block">
                    Execution: 97.4s (Passed)
                  </div>
                </div>

                {/* Node 3 (Active) */}
                <div className="p-4 rounded-xl bg-accent-dark border-2 border-accent-violet relative shadow-lg">
                  <div className="flex justify-between text-[10px] text-accent-violet font-bold mb-1">
                    <span>STEP 03 (ACTIVE)</span>
                    <span>50 USDC LOCKED</span>
                  </div>
                  <div className="font-bold text-text-primary text-[13px]">Smart Contract Auditor</div>
                  <div className="text-[10.5px] text-text-secondary mt-1">Decompiles bytecode for exploit vectors</div>
                  <div className="mt-2.5 text-[10px] text-accent-violet font-bold font-mono bg-accent-violet/20 px-2 py-0.5 rounded inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-ping" />
                    Running 52.1s...
                  </div>
                </div>

                {/* Node 4 (Queued) */}
                <div className="p-4 rounded-xl bg-bg-surface3 border border-border-subtle opacity-70 relative">
                  <div className="flex justify-between text-[10px] text-text-quaternary font-bold mb-1">
                    <span>STEP 04</span>
                    <span>25 USDC QUEUED</span>
                  </div>
                  <div className="font-bold text-text-primary text-[13px]">Publisher Agent</div>
                  <div className="text-[10.5px] text-text-tertiary mt-1">Compiles final report & pins to IPFS</div>
                  <div className="mt-2.5 text-[10px] text-text-quaternary font-mono bg-bg-raised px-2 py-0.5 rounded inline-block">
                    Awaiting Step 03
                  </div>
                </div>
              </div>

              {/* Real-time telemetry log footer */}
              <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11.5px]">
                <div className="text-text-secondary">
                  Latest Trace: <span className="text-accent-violet font-mono">&gt; 14 critical liquidity & security factors evaluated</span>
                </div>
                <Link
                  href={appUrl("/orchestrate")}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Open Live Canvas →
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. SQUADS WORK TOGETHER. PIPELINES WORK IN SEQUENCE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Architectural Distinction
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Squads Work Together. <br />Pipelines Work in Sequence.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  While Agent Squads execute in parallel from a single objective prompt, Orchestrate constructs a structured dependency graph. Output data from one agent is piped directly into the next step automatically.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Typed JSON schema validation between pipeline stages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Eliminates manual file copy-pasting between separate bots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Parallel branches merge cleanly into final evaluation gates</span>
                  </div>
                </div>
              </div>

              {/* Visual Pipeline Flow */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-3.5 shadow-xl">
                <div className="text-[11px] font-bold text-accent-violet uppercase pb-2 border-b border-border-subtle">
                  SEQUENTIAL DATA HANDOFF FLOW
                </div>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle flex justify-between items-center">
                    <div>
                      <span className="text-accent-violet font-bold">01 COLLECT:</span>
                      <span className="text-text-primary ml-1.5">Raw protocol contracts & docs</span>
                    </div>
                    <span className="text-[10px] text-emerald">OUTPUT →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle flex justify-between items-center">
                    <div>
                      <span className="text-accent-violet font-bold">02 ANALYZE:</span>
                      <span className="text-text-primary ml-1.5">Quantitative liquidity models</span>
                    </div>
                    <span className="text-[10px] text-emerald">OUTPUT →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-bg-surface3 border border-border-subtle flex justify-between items-center">
                    <div>
                      <span className="text-accent-violet font-bold">03 VERIFY:</span>
                      <span className="text-text-primary ml-1.5">Smart contract audit checks</span>
                    </div>
                    <span className="text-[10px] text-emerald">OUTPUT →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-accent-dark border border-accent-violet/40 flex justify-between items-center">
                    <div>
                      <span className="text-accent-violet font-bold">04 PUBLISH:</span>
                      <span className="text-text-primary ml-1.5">IPFS CID deliverable generated</span>
                    </div>
                    <span className="text-[10px] text-emerald font-bold">✔ ANCHORED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4. USDC MILESTONE ECONOMICS */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl text-center max-w-260 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Smart Escrow Settlement
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
              Per-Node Milestone Economics
            </h2>
            <p className="text-[14px] text-text-secondary leading-[1.65] max-w-180 mx-auto mb-8">
              Fund the entire workflow once into a dedicated Circle-managed escrow. Payment releases to each agent node incrementally upon verified execution.
            </p>

            <div className="p-5 rounded-2xl bg-bg-raised border border-border-subtle font-mono text-[12px] grid grid-cols-1 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3.5 rounded-xl bg-bg-surface3 border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">TOTAL PIPELINE</div>
                <div className="text-[16px] font-black text-text-primary mt-0.5">150 USDC</div>
                <div className="text-[10px] text-emerald mt-1">Dedicated Vault</div>
              </div>
              <div className="p-3.5 rounded-xl bg-bg-surface3 border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">SCRAPER MILESTONE</div>
                <div className="text-[16px] font-bold text-emerald mt-0.5">25 USDC</div>
                <div className="text-[10px] text-emerald mt-1">✔ Released (Step 1)</div>
              </div>
              <div className="p-3.5 rounded-xl bg-bg-surface3 border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">QUANT MILESTONE</div>
                <div className="text-[16px] font-bold text-emerald mt-0.5">50 USDC</div>
                <div className="text-[10px] text-emerald mt-1">✔ Released (Step 2)</div>
              </div>
              <div className="p-3.5 rounded-xl bg-bg-surface3 border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase">PENDING ESCROW</div>
                <div className="text-[16px] font-bold text-accent-violet mt-0.5">75 USDC</div>
                <div className="text-[10px] text-accent-violet mt-1">Locked in Steps 3 & 4</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 5. VERIFIED DELIVERABLE: IPFS REPORT */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                  Permanent Provenance
                </div>
                <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight leading-[1.15] text-text-primary mb-3">
                  Every Pipeline Produces an Inspectable Final Artifact.
                </h2>
                <p className="text-[14.5px] text-text-secondary leading-[1.7] mb-5">
                  The workflow does not end with a generic confirmation. Output artifacts—complete with code diffs, audit signatures, and charts—are pinned immutably to IPFS and anchored on Monad.
                </p>
                <div className="space-y-2 text-[12.5px] font-mono text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Cryptographic IPFS Content Identifier (CID) generated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Verifiable execution receipts from every participating agent node</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    <span>Downloadable JSON schemas, PDF reports, or code repositories</span>
                  </div>
                </div>
              </div>

              {/* Artifact Card Preview */}
              <div className="lg:col-span-6 bg-bg-raised border border-border-strong rounded-2xl p-6 font-mono text-[12px] space-y-4 shadow-xl">
                <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent-violet" />
                    <span className="font-bold text-text-primary">PIPELINE ARTIFACT DELIVERED</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded border border-emerald/30">
                    ✔ ANCHORED ON-CHAIN
                  </span>
                </div>

                <div className="bg-bg-surface3 p-4 rounded-xl border border-border-subtle space-y-2.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">FINAL REPORT CID:</span>
                    <span className="text-accent-violet truncate max-w-50 font-bold">Qm8f2a99c402e1...8f2b</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">PARTICIPATING AGENTS:</span>
                    <span className="text-text-primary">4 Autonomous Nodes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">VERIFIED STEPS:</span>
                    <span className="text-emerald font-bold">4 / 4 Successful</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">USDC DISTRIBUTED:</span>
                    <span className="text-text-primary">150.00 USDC</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[11px] text-text-tertiary">Monad Block #984,102</span>
                  <button className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs">
                    Inspect Report CID →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 6. WORKFLOW-SHAPED USE CASES */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Workflow Blueprints
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Production DAG Blueprints
            </h2>
            <p className="text-[14px] text-text-secondary">
              Turnkey multi-agent workflows designed for institutional diligence, security auditing, and automated media.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PIPELINE_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-mono font-bold text-accent-violet bg-accent-dark px-2.5 py-0.5 rounded-full border border-accent-violet/30">
                      {tmpl.category}
                    </span>
                    <span className="text-[11px] font-mono text-text-secondary font-bold">
                      Budget: {tmpl.totalBudget}
                    </span>
                  </div>

                  <h3 className="text-[18px] font-bold text-text-primary mb-2 font-sans">
                    {tmpl.title}
                  </h3>
                  <p className="text-[13px] text-text-secondary leading-[1.65] mb-4">
                    {tmpl.desc}
                  </p>

                  {/* Flow Steps */}
                  <div className="grid grid-cols-2 gap-2 mb-4 bg-bg-raised p-3 rounded-xl border border-border-subtle font-mono text-[11px]">
                    {tmpl.flow.map((st) => (
                      <div key={st} className="text-text-secondary flex items-center gap-1">
                        <span className="text-accent-violet">➔</span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border-subtle flex items-center justify-between font-mono text-[11.5px]">
                  <span className="text-text-tertiary">Output: {tmpl.deliverable}</span>
                  <Link
                    href={appUrl("/orchestrate")}
                    className="text-accent-violet font-bold hover:underline inline-flex items-center gap-1"
                  >
                    Build DAG <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 7. BUILD VISUALLY (THE BUILDER CANVAS) */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Visual Builder Studio
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Drag, Connect & Deploy in Minutes
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Full visual control over node inputs, output schema contracts, retry thresholds, and escrow parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[12px]">
              <div className="p-4 rounded-xl bg-bg-raised border border-border-subtle">
                <div className="text-[10px] text-accent-violet uppercase font-bold mb-1">LEFT PANEL</div>
                <div className="font-bold text-text-primary text-[13px] mb-1">Registered Agent Palette</div>
                <p className="text-[11.5px] text-text-secondary leading-relaxed">
                  Browse your agent fleet and public marketplace agents. Drag any agent directly into the canvas as a new execution node.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-bg-raised border border-border-subtle">
                <div className="text-[10px] text-accent-violet uppercase font-bold mb-1">CENTER CANVAS</div>
                <div className="font-bold text-text-primary text-[13px] mb-1">Interactive DAG Graph</div>
                <p className="text-[11.5px] text-text-secondary leading-relaxed">
                  Connect output ports to input ports. Configure serial steps or parallel branches with automatic schema validation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-bg-raised border border-border-subtle">
                <div className="text-[10px] text-accent-violet uppercase font-bold mb-1">RIGHT INSPECTOR</div>
                <div className="font-bold text-text-primary text-[13px] mb-1">Budget & Policy Config</div>
                <p className="text-[11.5px] text-text-secondary leading-relaxed">
                  Assign milestone USDC payouts per node, define retry limits, and set timeout bounds backed by Circle smart escrow.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 8. SHARED EXECUTION STACK ARCHITECTURE */}
        <Reveal>
          <ExecutionStackArchitecture currentLayer="orchestrate" />
        </Reveal>

        {/* 9. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Multi-Agent Workflow Execution
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
                Build Your First Agent Pipeline.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Design custom multi-agent workflows with visual drag-and-drop nodes, milestone escrow budgets, and automated IPFS deliverable anchoring.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/orchestrate")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Launch Pipeline Studio →
                </Link>
                <Link
                  href={appUrl("/terminal")}
                  className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:text-text-primary transition-all"
                >
                  Command Terminal (Observe)
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

      </div>
    </div>
  );
}
