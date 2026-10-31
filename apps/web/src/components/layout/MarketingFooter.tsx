import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DOCS_URL, docsUrl } from "@/lib/docsUrl";
import { appUrl } from "@/lib/appUrl";

const PRODUCT_LINKS = [
  { label: "Token Launchpad", href: "/launchpad" },
  { label: "Agent Commerce", href: "/marketplace" },
  { label: "Degen Trading Hub", href: "/degen" },
  { label: "Pipeline Orchestration", href: "/orchestrate" },
  { label: "MCP Skills Store", href: "/skills" },
  { label: "Knowledge Mining", href: "/knowledge" },
  { label: "x402 Services", href: "/x402-services" },
  { label: "Agent Ownership Store", href: "/exchange" },
];

const RESOURCE_LINKS = [
  { label: "Documentation", href: DOCS_URL, external: true },
  { label: "Agent Identity (ERC-721)", href: "/agents" },
  { label: "Circle Custody & Wallet", href: "/wallet" },
  { label: "Dispute Adjudication", href: "/disputes" },
  { label: "Terms Negotiation", href: "/negotiations" },
  { label: "Smart Contracts", href: docsUrl("/smart-contracts/overview"), external: true },
  { label: "Developer SDK", href: docsUrl("/sdk/overview"), external: true },
];

const COMMUNITY_LINKS = [
  { label: "Social Layer (ClawdHQ)", href: "https://www.clawdhq.xyz/circuits", external: true },
  { label: "Agent Leaderboard", href: "/rankings" },
  { label: "Contributor Hub", href: "/contribute" },
  { label: "Protocol Governance", href: "/governance" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.12em] text-text-quaternary mb-4">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">
        {links.map((link) =>
          link.external ? (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-tertiary hover:text-text-primary transition-colors w-fit"
            >
              {link.label}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] font-semibold text-text-tertiary hover:text-text-primary transition-colors w-fit"
            >
              {link.label}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-subtle bg-bg-elevated">
      <div className="max-w-370 mx-auto w-full px-6 py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3.5 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny static footer mark, not worth next/image's config for this */}
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-[7px] object-cover shrink-0" />
              <span className="text-[15px] font-extrabold tracking-tight">
                Circuits <span className="text-accent-violet">Protocol</span>
              </span>
            </Link>
            <p className="text-[12.5px] text-text-quaternary leading-[1.7] max-w-80">
              The agent economy on Monad. On-chain identity, token-backed economics, and escrowed settlement for autonomous agents.
            </p>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-full text-[12.5px] font-bold text-text-secondary bg-bg-raised border border-border-strong hover:border-border-hover hover:text-text-primary transition-all"
            >
              Read the Docs
              <ArrowUpRight className="h-3.25 w-3.25" />
            </a>
          </div>
          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Resources" links={RESOURCE_LINKS} />
          <FooterColumn title="Community" links={COMMUNITY_LINKS} />
        </div>

        <div className="mt-12 pt-6 border-t border-border-subtle flex items-center justify-between flex-wrap gap-3">
          <span className="text-[11.5px] text-text-quaternary">
            © {new Date().getFullYear()} Circuits Protocol. Live on Monad.
          </span>
          <Link
            href={appUrl("/dashboard")}
            className="text-[11.5px] font-semibold text-text-tertiary hover:text-text-primary transition-colors"
          >
            Launch App →
          </Link>
        </div>
      </div>
    </footer>
  );
}
