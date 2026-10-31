"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { ChainSelector } from "./ChainSelector";
import { WalletButton } from "./WalletButton";
import { NavDropdown } from "./NavDropdown";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "@/components/notifications";
import { APP_NAV_ITEMS, COMMERCE_ITEMS, BUILD_ITEMS, GOVERNANCE_ITEMS, COMMUNITY_ITEMS, } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { DOCS_URL } from "@/lib/docsUrl";

const CREATE_ITEMS = [
  { label: "Register Agent", href: "/register" },
];

export function Topbar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 flex h-13 items-center border-b border-border-subtle px-3 sm:px-4.5 gap-0"
      style={{ background: "rgba(8,9,12,0.92)", backdropFilter: "blur(16px)" }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-3.5 xl:mr-5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static nav mark, not worth next/image's config for this */}
        <img src="/logo.png" alt="" className="h-6 w-6 sm:h-6.5 sm:w-6.5 rounded-[7px] object-cover" />
        <span className="text-[13.5px] sm:text-[14.5px] font-extrabold tracking-tight">
          Circuits <span className="text-accent-violet hidden sm:inline">Protocol</span>
        </span>
      </Link>

      {/* Nav links */}
      <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 shrink-0">
        {APP_NAV_ITEMS.map((item) => {
          const isExternal = item.href.startsWith("http");
          const active =
            !isExternal &&
            (pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href)));
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={cn(
                "flex items-center gap-1 px-1.5 py-1 xl:px-2.5 xl:py-1.5 rounded-md text-[11.5px] xl:text-[12.5px] font-semibold transition-all duration-150 whitespace-nowrap shrink-0",
                active
                  ? "text-accent-violet bg-accent-dark"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-bg-raised",
              )}
            >
              {item.label}
              {item.badge && (
                <span
                  className={cn(
                    "text-[9.5px] font-bold px-1.25 py-px rounded-full",
                    active ? "bg-accent-violet text-white" : "bg-bg-surface3 text-text-tertiary",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <NavDropdown label="Commerce" items={COMMERCE_ITEMS} />
        <NavDropdown label="Build" items={BUILD_ITEMS} />
        <NavDropdown label="Governance" items={GOVERNANCE_ITEMS} />
        <NavDropdown label="Community" items={COMMUNITY_ITEMS} />
      </nav>

      {/* Right */}
      <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2.5 shrink-0 ml-auto pl-2.5 sm:pl-3.5 xl:pl-6">
        <div className="flex items-center shrink-0">
          <ChainSelector />
        </div>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Documentation"
          title="Documentation"
          className="hidden xl:flex items-center justify-center h-8 w-8 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors shrink-0"
        >
          <BookOpen className="h-3.5 w-3.5" />
        </a>
        <div className="hidden sm:block">
          <NavDropdown
            label={
              <span className="flex items-center gap-1">
                <Plus className="h-3 w-3" />
                <span>Create</span>
              </span>
            }
            items={CREATE_ITEMS}
            align="right"
            variant="cta"
          />
        </div>
        <NotificationBell />
        <WalletButton />
        <MobileNav />
      </div>
    </header>
  );
}
