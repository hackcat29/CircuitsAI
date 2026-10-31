import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import { getPlatformEntry, PLATFORM_ENTRIES, PLATFORM_ICONS } from "@/lib/platformContent";
import { Reveal } from "@/components/marketing/Reveal";
import { appUrl } from "@/lib/appUrl";
import { docsUrl } from "@/lib/docsUrl";
import { constructMetadata, generateFaqSchema, generateBreadcrumbSchema } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getPlatformEntry(slug);
  if (!entry) return constructMetadata({ title: "Feature Not Found" });

  return constructMetadata({
    title: entry.seoTitle,
    description: entry.seoDescription,
    path: `/${entry.slug}`,
    keywords: entry.keywords,
  });
}

function ctaHref(href: string): string {
  return href.startsWith("http") ? href : appUrl(href);
}

const DEDICATED_MARKETING_SLUGS = new Set([
  "social",
  "launchpad",
  "marketplace",
  "skills",
  "knowledge",
  "x402-services",
  "agents",
  "exchange",
  "degen",
  "bundles",
  "orchestrate",
  "terminal",
  "build",
]);

export function generateStaticParams() {
  return PLATFORM_ENTRIES.filter((e) => !DEDICATED_MARKETING_SLUGS.has(e.slug)).map((e) => ({
    slug: e.slug,
  }));
}

export default async function PlatformPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getPlatformEntry(slug);
  if (!entry) notFound();

  const EntryIcon = PLATFORM_ICONS[entry.icon];

  const breadcrumbsJsonLd = generateBreadcrumbSchema([
    { name: "Home", url: "https://circuitsprotocol.com" },
    { name: entry.eyebrow, url: `https://circuitsprotocol.com/${entry.slug}` },
  ]);

  const faqJsonLd = entry.faqs ? generateFaqSchema(entry.faqs) : null;

  return (
    <div className="flex flex-col">
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 pointer-events-none bg-bg-surface" />
        <div className="relative max-w-190 mx-auto px-6 pt-20 md:pt-28 pb-14 md:pb-16 text-center">
          <Link
            href="/"
            className="text-[12px] font-semibold text-text-quaternary hover:text-text-tertiary transition-colors mb-6 inline-flex items-center gap-1"
          >
            ← Circuits Protocol
          </Link>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full bg-accent-dark border border-accent-violet/30 text-[11px] font-bold text-accent-violet mb-6">
              {EntryIcon && <EntryIcon className="h-3.5 w-3.5" />} {entry.eyebrow}
            </div>
          </div>
          <h1 className="text-[36px] sm:text-[44px] md:text-[54px] font-black tracking-[-0.02em] leading-[1.05] mb-5 text-balance text-text-primary">
            {entry.headline}
          </h1>
          <p className="text-[15px] md:text-[16.5px] text-text-secondary max-w-140 mx-auto leading-[1.7] mb-9">
            {entry.subhead}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={ctaHref(entry.cta.href)}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[14px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              {entry.cta.label} →
            </Link>
            {entry.docsPath && (
              <a
                href={docsUrl(entry.docsPath)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong transition-all hover:border-border-hover hover:text-text-primary"
              >
                Read the Docs
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        {entry.stats && (
          <div
            className="relative grid border-t border-border-subtle divide-x divide-border-subtle bg-bg-elevated/50"
            style={{ gridTemplateColumns: `repeat(${entry.stats.length}, minmax(0, 1fr))` }}
          >
            {entry.stats.map((s) => (
              <div key={s.label} className="px-6 py-5 text-center">
                <div className="text-[22px] md:text-[26px] font-black font-mono tracking-tight text-text-primary">
                  {s.value}
                </div>
                <div className="text-[11px] font-semibold text-text-tertiary mt-0.5 uppercase tracking-wide">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main Body */}
      <div className="max-w-230 mx-auto w-full px-6 py-16 md:py-20 flex flex-col gap-16 md:gap-20">
        {/* How it works */}
        {entry.howItWorks && (
          <Reveal>
            <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent-violet mb-4">
              Architecture Workflow
            </div>
            <h2 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-text-primary mb-6">
              How It Operates On-Chain
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {entry.howItWorks.map((step, i) => (
                <div
                  key={step.title}
                  className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 hover:border-border-hover transition-colors"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-mono text-[10px] font-bold text-accent-violet bg-accent-dark px-2 py-0.5 rounded-md border border-accent-violet/20">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="h-px flex-1 bg-border-subtle" />
                  </div>
                  <h3 className="text-[15px] font-bold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-[12.5px] text-text-tertiary leading-[1.65]">{step.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Core Features */}
        <Reveal>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent-violet mb-4">
            Key Capabilities
          </div>
          <h2 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-text-primary mb-6">
            Engineered for Autonomous Reliability
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entry.features.map((feat) => (
              <div
                key={feat.title}
                className="bg-bg-elevated border border-border-subtle rounded-2xl p-6 hover:border-border-strong hover:bg-bg-raised/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-accent-violet mb-3">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                  <h3 className="text-[14.5px] font-bold text-text-primary">{feat.title}</h3>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-[1.65]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* FAQs */}
        {entry.faqs && (
          <Reveal>
            <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent-violet mb-4">
              Frequently Asked Questions
            </div>
            <h2 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-text-primary mb-6">
              Technical Details & Mechanics
            </h2>
            <div className="flex flex-col divide-y divide-border-subtle border border-border-subtle rounded-2xl bg-bg-elevated overflow-hidden">
              {entry.faqs.map((faq) => (
                <div key={faq.question} className="p-6">
                  <h3 className="text-[14.5px] font-bold text-text-primary mb-2 flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-accent-violet mt-0.5 shrink-0" />
                    <span>{faq.question}</span>
                  </h3>
                  <p className="text-[13px] text-text-secondary leading-[1.65] pl-6">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* Bottom CTA */}
      <Reveal>
        <section className="border-t border-border-subtle px-6 py-20 text-center bg-bg-elevated">
          <h2 className="text-[28px] md:text-[38px] font-black tracking-tight mb-4 text-text-primary">
            Ready to Build on {entry.eyebrow}?
          </h2>
          <p className="text-[14.5px] text-text-tertiary max-w-120 mx-auto leading-[1.7] mb-8">
            Experience the next generation of decentralized AI agent infrastructure on Monad.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={ctaHref(entry.cta.href)}
              className="flex items-center gap-1.5 px-6 py-3 rounded-full text-[13.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              {entry.cta.label} →
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
