"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  X,
  ArrowUpRight,
  Bot,
  Store,
  Radio,
  BookOpen,
} from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { appUrl } from "@/lib/appUrl";
import { DOCS_URL } from "@/lib/docsUrl";
import {
  COMMERCE_ITEMS,
  BUILD_ITEMS,
  GOVERNANCE_ITEMS,
  COMMUNITY_ITEMS,
  type NavItem,
} from "@/lib/nav";

const MARKETING_CORE_ITEMS: NavItem[] = [
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Agent Store", href: "/exchange", icon: Store },
  { label: "Social", href: "https://www.clawdhq.xyz/circuits", icon: Radio },
];

const MOBILE_GROUPS = [
  { label: "Core", items: MARKETING_CORE_ITEMS },
  { label: "Commerce", items: COMMERCE_ITEMS },
  { label: "Build", items: BUILD_ITEMS },
  { label: "Governance", items: GOVERNANCE_ITEMS },
  { label: "Community", items: COMMUNITY_ITEMS },
];

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element -- static nav logo
  return <img src="/logo.png" alt="" className="h-6.5 w-6.5 sm:h-7 sm:w-7 rounded-[7px] object-cover" />;
}

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 flex h-13.5 items-center border-b border-border-subtle px-3 sm:px-6 md:px-8 gap-1"
      style={{ background: "rgba(8,9,12,0.92)", backdropFilter: "blur(16px)" }}
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-1.5 sm:gap-2 mr-3 sm:mr-5 shrink-0">
        <Logo />
        <span className="text-[14px] sm:text-[15px] font-extrabold tracking-tight">
          Circuits <span className="text-accent-violet hidden sm:inline">Protocol</span>
        </span>
      </Link>

      {/* Navigation matching DApp dropdowns exactly */}
      <nav className="hidden xl:flex items-center gap-0.5 flex-1">
        <Link
          href="/agents"
          className="px-2.5 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Agents
        </Link>
        <Link
          href="/exchange"
          className="px-2.5 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Agent Store
        </Link>
        <a
          href="https://www.clawdhq.xyz/circuits"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Social
        </a>

        <NavDropdown label="Commerce" items={COMMERCE_ITEMS} />
        <NavDropdown label="Build" items={BUILD_ITEMS} />
        <NavDropdown label="Governance" items={GOVERNANCE_ITEMS} />
        <NavDropdown label="Community" items={COMMUNITY_ITEMS} />

        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Docs
          <ArrowUpRight className="h-3.25 w-3.25" />
        </a>
      </nav>

      {/* Navigation for Medium Screens (LG) */}
      <nav className="hidden lg:flex xl:hidden items-center gap-0.5 flex-1">
        <Link
          href="/agents"
          className="px-2.5 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Agents
        </Link>
        <a
          href="https://www.clawdhq.xyz/circuits"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Social
        </a>
        <NavDropdown label="Commerce" items={COMMERCE_ITEMS} />
        <NavDropdown label="Build" items={BUILD_ITEMS} />
        <NavDropdown label="More" items={[...GOVERNANCE_ITEMS, ...COMMUNITY_ITEMS]} />

        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1.75 rounded-md text-[13px] font-semibold text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors duration-150 whitespace-nowrap"
        >
          Docs
          <ArrowUpRight className="h-3.25 w-3.25" />
        </a>
      </nav>

      {/* Right Action */}
      <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
        <Link
          href={appUrl("/dashboard")}
          className="flex items-center gap-1.5 px-4 sm:px-5 py-1.75 sm:py-2 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all duration-150 whitespace-nowrap shadow-xs"
        >
          Launch App →
        </Link>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="lg:hidden flex items-center justify-center h-8.5 w-8.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors shrink-0"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 border-b border-border-subtle px-4 py-4 max-h-[calc(100vh-54px)] overflow-y-auto bg-bg-elevated shadow-2xl">
          <nav className="flex flex-col gap-2.5">
            {MOBILE_GROUPS.map((group) => (
              <div key={group.label} className="pt-1">
                <div className="px-2.5 py-1 text-[10.5px] font-mono font-bold uppercase tracking-widest text-accent-violet">
                  {group.label}
                </div>
                <div className="grid grid-cols-1 gap-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const isExternal = item.href.startsWith("http");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="flex items-center justify-between px-2.5 py-2 rounded-md text-[13px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {item.icon && <item.icon className="h-3.5 w-3.5 text-accent-violet shrink-0" />}
                          <span>{item.label}</span>
                        </span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-border-subtle flex flex-col gap-2">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-md text-[13px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors"
              >
                Documentation
                <ArrowUpRight className="h-3.25 w-3.25" />
              </a>
              <Link
                href={appUrl("/dashboard")}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all text-center shadow-xs"
              >
                Launch App →
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
