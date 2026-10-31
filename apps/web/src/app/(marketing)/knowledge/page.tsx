import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  Database,
  Lock,
  Layers,
  Workflow,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Coins,
  Radio,
  Eye,
  Download,
  Upload,
  FileCode,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const metadata = constructMetadata({
  title: "Knowledge Gateway: Proprietary Context & Memory Marketplace for AI Agents",
  description:
    "Monetize datasets, prompt packs, ClawMem memory snapshots, and tool definitions. Autonomous agents resolve context with x402 USDC micropayments on Monad.",
  path: "/knowledge",
  keywords: [
    "AI agent knowledge base",
    "ClawMem memory snapshots",
    "monetize AI datasets",
    "prompt packs marketplace",
    "x402 knowledge gateway",
    "cryptographic provenance AI",
  ],
});

const KNOWLEDGE_ASSETS = [
  {
    type: "Curated Dataset",
    title: "Monad DeFi Research Corpus",
    records: "3.2M records",
    update: "Updated Daily",
    price: "0.08 USDC / query",
    provenance: "IPFS Verified • Creator Signed",
    desc: "Comprehensive liquidity, DEX volume, and lending rates on Monad with structured JSON schemas.",
  },
  {
    type: "Memory Snapshot",
    title: "DeFi Arbitrageur Episodic Graph",
    records: "1.4 GB • 12,800 episodes",
    update: "ClawMem Native",
    price: "0.15 USDC / unlock",
    provenance: "Signature Verified • Hash Committed",
    desc: "Associative vector memories capturing 6 months of multi-venue perpetual arbitrage executions.",
  },
  {
    type: "Prompt Pack",
    title: "Solidity Auditor Reasoning Scaffolds",
    records: "48 task decomposition trees",
    update: "DeepSeek & Claude 3.7",
    price: "0.05 USDC / query",
    provenance: "Author Signed • Verified AST",
    desc: "Multi-step vulnerability triage, reentrancy heuristics, and automated Foundry test generators.",
  },
  {
    type: "Tool Capability Pack",
    title: "Multi-Chain Oracle & Subgraph Bundle",
    records: "14 Pre-built MCP Tools",
    update: "v2.4 Schema",
    price: "0.10 USDC / call",
    provenance: "IPFS Pinned • Tested Endpoints",
    desc: "Turnkey MCP configuration bundle connecting agents to oracles, block explorers, and RPC nodes.",
  },
];

const ASSET_CLASSES = [
  {
    name: "Curated Datasets",
    desc: "Financial market histories, domain research corpora, and on-chain protocol event records.",
    icon: Database,
    color: "#00D9C6",
  },
  {
    name: "Prompt Packs",
    desc: "System personas, specialized cognitive heuristics, and task decomposition pipelines.",
    icon: FileCode,
    color: "#B784FF",
  },
  {
    name: "Memory Snapshots",
    desc: "Episodic agent memories, semantic context, and ClawMem associative vector graphs.",
    icon: Brain,
    color: "#FF5C28",
  },
  {
    name: "Tool Definitions",
    desc: "Pre-configured MCP tool definitions and specialized API capability integration packs.",
    icon: Cpu,
    color: "#1FD487",
  },
];

const FAQS = [
  {
    question: "What is the difference between Skills and Knowledge?",
    answer:
      "Skills define what an agent can DO (execution tools like DEX routers, search APIs, and security analyzers). Knowledge defines what an agent KNOWS (domain datasets, prompt systems, memory graphs, and research corpora).",
  },
  {
    question: "How is knowledge cryptographically verified?",
    answer:
      "Contributions must pass automated reachability checks, IPFS content-addressed hash validation, and cryptographic creator signature verification before appearing in the Knowledge Gateway.",
  },
  {
    question: "How do creators earn USDC?",
    answer:
      "Whenever an agent queries or unlocks your knowledge asset, the protocol routes 50% of the x402 query fee directly to your Circle wallet, 30% to the agent treasury/buybacks, and 20% to protocol infrastructure.",
  },
  {
    question: "How does an agent load a ClawMem snapshot?",
    answer:
      "When an agent unlocks a Memory Snapshot, the associative vector graph is loaded directly into its ClawMem runtime context, enabling immediate semantic memory recall.",
  },
];

export default function KnowledgeMarketingPage() {
  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: "Knowledge Gateway", url: "https://circuitsprotocol.com/knowledge" },
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
              <Database className="h-3.5 w-3.5" /> CONTEXT & MEMORY MARKETPLACE
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-black tracking-[-0.03em] leading-[1.05] mb-5 text-balance text-text-primary">
            Give AI Agents Access to <br className="hidden sm:inline" />
            <span className="text-accent-violet">Better Knowledge.</span>
          </h1>
          <p className="text-[15px] md:text-[17.5px] text-text-secondary max-w-165 mx-auto leading-[1.7] mb-8">
            Buy and sell datasets, prompt systems, memory snapshots, and agent-ready context — with cryptographic provenance and pay-per-use USDC access.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <Link
              href={appUrl("/knowledge")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              Explore Knowledge →
            </Link>
            <Link
              href={appUrl("/knowledge?publish=1")}
              className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
            >
              Publish Knowledge
            </Link>
          </div>

          {/* Proof Strip */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono font-bold text-text-quaternary">
            <span>4 ASSET CLASSES</span>
            <span>•</span>
            <span>IPFS PROVENANCE</span>
            <span>•</span>
            <span>x402 DIRECT USDC</span>
            <span>•</span>
            <span>ZERO SUBSCRIPTIONS</span>
            <span>•</span>
            <span className="text-accent-violet">BUILT ON MONAD</span>
          </div>
        </div>

        {/* Top Stats Strip */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/60 backdrop-blur-xs">
          {[
            { val: "4", lbl: "Specialized Knowledge Classes" },
            { val: "IPFS", lbl: "Cryptographic Provenance" },
            { val: "x402", lbl: "Pay-Per-Query Direct USDC" },
            { val: "Monad", lbl: "Zero Subscription Lock-In" },
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

        {/* 2. MENTAL MODEL: MODEL + TOOLS + MEMORY + KNOWLEDGE */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Specialized Intelligence Formula
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Context is an Asset.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                What turns a generic language model into a specialized economic actor? The combination of execution tools, persistent memory, and proprietary domain context.
              </p>
            </div>

            {/* Visual Formula Bar */}
            <div className="max-w-240 mx-auto grid grid-cols-1 sm:grid-cols-4 gap-3 text-center font-mono text-[12px]">
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-text-quaternary uppercase mb-1">FOUNDATION</div>
                <div className="font-bold text-text-primary">19 Models</div>
                <div className="text-[10px] text-text-tertiary mt-1">DeepSeek, Claude, GPT</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-accent-violet uppercase mb-1">SKILLS</div>
                <div className="font-bold text-accent-violet">MCP Tools</div>
                <div className="text-[10px] text-text-tertiary mt-1">What an agent can DO</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-[10px] text-accent-violet uppercase mb-1">MEMORY</div>
                <div className="font-bold text-accent-violet">ClawMem Graphs</div>
                <div className="text-[10px] text-text-tertiary mt-1">What an agent REMEMBERS</div>
              </div>
              <div className="bg-accent-dark p-4 rounded-xl border border-accent-violet/40">
                <div className="text-[10px] text-accent-violet uppercase mb-1 font-bold">KNOWLEDGE</div>
                <div className="font-bold text-text-primary">Domain Context</div>
                <div className="text-[10px] text-accent-violet mt-1 font-bold">What an agent KNOWS</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3. 4 SPECIALIZED ASSET CLASSES */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-10">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Asset Catalog
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Four Monetizable Knowledge Classes
            </h2>
            <p className="text-[14px] text-text-secondary">
              Everything required to equip autonomous agents with deep domain expertise.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ASSET_CLASSES.map((cls) => (
              <div
                key={cls.name}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 flex flex-col justify-between hover:border-border-strong transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <cls.icon className="h-5 w-5 text-accent-violet" />
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-raised text-text-tertiary">
                      Verified
                    </span>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-text-primary mb-1.5">{cls.name}</h3>
                  <p className="text-[12.5px] text-text-secondary leading-[1.6]">{cls.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4. LIVE KNOWLEDGE MARKET SHOWCASE */}
        <Reveal>
          <div className="text-center max-w-180 mx-auto mb-8">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
              Knowledge Gateway
            </div>
            <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2.5">
              Featured Verified Context Packs
            </h2>
            <p className="text-[14px] text-text-secondary">
              Curated assets ready for instant resolution and query by autonomous agents via x402.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {KNOWLEDGE_ASSETS.map((item) => (
              <div
                key={item.title}
                className="bg-bg-elevated border border-border-strong rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle font-mono text-[11px]">
                    <span className="text-accent-violet font-bold bg-accent-dark px-2 py-0.5 rounded border border-accent-violet/30">
                      {item.type}
                    </span>
                    <span className="text-emerald font-bold">{item.price}</span>
                  </div>

                  <h3 className="text-[17px] font-bold text-text-primary mb-2">{item.title}</h3>
                  <p className="text-[13px] text-text-secondary leading-[1.65] mb-4">{item.desc}</p>

                  <div className="space-y-1.5 text-[11.5px] font-mono bg-bg-raised p-3 rounded-xl border border-border-subtle mb-4">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Scope:</span>
                      <span className="text-text-primary">{item.records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Cadence:</span>
                      <span className="text-accent-violet">{item.update}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Integrity:</span>
                      <span className="text-emerald">{item.provenance}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={appUrl("/knowledge")}
                  className="w-full py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 text-center transition-all shadow-xs"
                >
                  Unlock via x402 →
                </Link>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 5. CRYPTOGRAPHIC PROVENANCE & INTEGRITY */}
        <Reveal>
          <div className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-8 shadow-2xl">
            <div className="text-center max-w-180 mx-auto mb-8">
              <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
                Verifiable Data Pipeline
              </div>
              <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-2">
                Know Where the Knowledge Came From.
              </h2>
              <p className="text-[14px] text-text-secondary leading-[1.65]">
                Content is content-addressed, reachability-verified, and creator-authenticated with on-chain cryptographic signatures before being listed in the gateway.
              </p>
            </div>

            {/* Horizontal Provenance Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-center font-mono text-[11.5px]">
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-text-quaternary text-[9.5px] mb-1">STAGE 1</div>
                <div className="font-bold text-text-primary">CONTENT CREATION</div>
                <div className="text-[10px] text-text-tertiary mt-1">Author curates corpus</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-text-quaternary text-[9.5px] mb-1">STAGE 2</div>
                <div className="font-bold text-accent-violet">HASH COMMITMENT</div>
                <div className="text-[10px] text-text-tertiary mt-1">SHA-256 state anchor</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-text-quaternary text-[9.5px] mb-1">STAGE 3</div>
                <div className="font-bold text-accent-violet">IPFS PINNING</div>
                <div className="text-[10px] text-text-tertiary mt-1">Immutable storage</div>
              </div>
              <div className="bg-bg-raised p-4 rounded-xl border border-border-subtle">
                <div className="text-text-quaternary text-[9.5px] mb-1">STAGE 4</div>
                <div className="font-bold text-accent-violet">AUTHOR SIGNATURE</div>
                <div className="text-[10px] text-text-tertiary mt-1">EIP-712 auth proof</div>
              </div>
              <div className="bg-accent-dark p-4 rounded-xl border border-accent-violet/30">
                <div className="text-accent-violet text-[9.5px] font-bold mb-1">STAGE 5</div>
                <div className="font-bold text-text-primary">GATEWAY RESOLUTION</div>
                <div className="text-[10px] text-text-secondary mt-1">Verified on-chain</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 6. FAQS */}
        <Reveal>
          <div className="max-w-200 mx-auto">
            <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2 text-center">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[30px] font-extrabold tracking-tight text-text-primary mb-6 text-center">
              Built for Verifiable Agent Context
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
                Your Agent Has the Context. <br />Now Equip It With Tools.
              </h2>
              <p className="text-[15px] md:text-[16.5px] text-text-secondary leading-[1.65] mb-8">
                Combine proprietary domain datasets with production-ready MCP skills to deploy industry-grade autonomous agents.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href={appUrl("/skills")}
                  className="flex items-center gap-1.5 px-7 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
                >
                  Browse MCP Skills →
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
