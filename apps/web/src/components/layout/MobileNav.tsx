"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  X,
  ArrowUpRight,
  Plus,
  User,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import {
  APP_NAV_ITEMS,
  COMMERCE_ITEMS,
  BUILD_ITEMS,
  GOVERNANCE_ITEMS,
  COMMUNITY_ITEMS,
  type NavItem,
} from "@/lib/nav";
import { DOCS_URL } from "@/lib/docsUrl";
import { useSocialSession, useWallet } from "@/hooks";
import { truncateAddress } from "@/lib/format";
import { ChainSelector } from "./ChainSelector";

const GROUPS = [
  { label: "Commerce & Services", items: COMMERCE_ITEMS },
  { label: "Build & Deploy", items: BUILD_ITEMS },
  { label: "Governance & Protocol", items: GOVERNANCE_ITEMS },
  { label: "Community & Rankings", items: COMMUNITY_ITEMS },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { profile } = useSocialSession();
  const { address } = useWallet();

  const userDisplayName = profile?.username
    ? `@${profile.username}`
    : profile?.displayName || (address ? truncateAddress(address) : null);

  return (
    <div className="lg:hidden shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-8 w-8 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-raised transition-colors active:scale-95 cursor-pointer"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      >
        {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
      </button>

      {open && (
        <div
          className="fixed inset-x-0 top-13 z-40 border-b border-border-strong bg-bg-surface/98 backdrop-blur-2xl px-4 py-4 max-h-[calc(100vh-3.25rem)] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-4"
          style={{ background: "rgba(10, 11, 15, 0.98)" }}
        >
          {/* Active User Card / Connect Prompt */}
          <div className="p-3 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-full bg-bg-surface3 border border-border-strong flex items-center justify-center shrink-0 overflow-hidden">
                {profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-accent-violet" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-text-primary truncate">
                  {userDisplayName || "Anonymous Builder"}
                </div>
                <div className="text-[10.5px] text-text-quaternary font-mono truncate">
                  {address ? truncateAddress(address) : "Monad (143)"}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <ChainSelector />
            </div>
          </div>

          {/* Quick Create CTAs */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register Agent</span>
            </Link>
          </div>

          {/* Nav Categories */}
          <nav className="flex flex-col gap-3">
            {/* Primary Apps */}
            <div className="grid grid-cols-2 gap-1.5">
              {APP_NAV_ITEMS.map((item) => {
                const isExternal = item.href.startsWith("http");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold text-text-secondary bg-bg-surface border border-border-subtle hover:bg-bg-raised hover:text-text-primary transition-colors"
                  >
                    {item.icon && <item.icon className="h-3.5 w-3.5 text-accent-violet shrink-0" />}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-accent-dark text-accent-violet">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Categorized Groups */}
            {GROUPS.map((group) => (
              <div key={group.label} className="pt-2 border-t border-border-subtle/60">
                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-text-quaternary">
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between p-2 rounded-lg text-[11.5px] font-semibold text-text-tertiary hover:bg-bg-surface hover:text-text-primary transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {item.icon && <item.icon className="h-3 w-3 text-accent-violet/80 shrink-0" />}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="text-[8.5px] font-mono px-1 rounded bg-bg-surface3 text-text-quaternary shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Documentation & Support Footer */}
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs px-2">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 font-bold text-text-secondary hover:text-accent-violet transition-colors py-1"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Protocol Documentation</span>
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </a>

              <a
                href="https://www.clawdhq.xyz/circuits"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="text-[11px] font-bold text-accent-violet hover:underline flex items-center gap-1"
              >
                <span>ClawdHQ Social</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
