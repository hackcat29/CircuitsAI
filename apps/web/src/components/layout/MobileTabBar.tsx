"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Rocket,
  Store,
  Wallet,
  Plus,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CreateActionSheet } from "./CreateActionSheet";

export function MobileTabBar() {
  const pathname = usePathname();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border-subtle bg-bg-surface/95 backdrop-blur-xl px-1 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
        style={{ background: "rgba(10, 11, 15, 0.96)" }}
      >
        <div className="flex items-center justify-between relative max-w-md mx-auto">
          {/* 1. Dashboard */}
          <Link
            href="/dashboard"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname === "/dashboard"
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {pathname === "/dashboard" && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname === "/dashboard" ? "bg-accent-dark text-accent-violet" : "text-text-tertiary",
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Dashboard</span>
          </Link>

          {/* 2. Agents */}
          <Link
            href="/agents"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname.startsWith("/agents")
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {pathname.startsWith("/agents") && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname.startsWith("/agents") ? "bg-accent-dark text-accent-violet" : "text-text-tertiary",
              )}
            >
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Agents</span>
          </Link>

          {/* 3. Launchpad */}
          <Link
            href="/launchpad"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname.startsWith("/launchpad")
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {pathname.startsWith("/launchpad") && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname.startsWith("/launchpad") ? "bg-accent-dark text-accent-violet" : "text-text-tertiary",
              )}
            >
              <Rocket className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Launch</span>
          </Link>

          {/* 4. Floating Center + CTA */}
          <div className="flex items-center justify-center px-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCreateSheetOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-[#FF5C28] text-white shadow-[0_4px_16px_rgba(255,92,40,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer -mt-3.5 border-2 border-bg-surface"
              aria-label="Create agent, post task, or launch token"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
            </button>
          </div>

          {/* 5. Commerce */}
          <Link
            href="/marketplace"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname.startsWith("/marketplace")
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {pathname.startsWith("/marketplace") && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname.startsWith("/marketplace") ? "bg-accent-dark text-accent-violet" : "text-text-tertiary",
              )}
            >
              <Store className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Commerce</span>
          </Link>

          {/* 6. Build */}
          <Link
            href="/build"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname.startsWith("/build") || pathname.startsWith("/orchestrate") || pathname.startsWith("/bundles") || pathname.startsWith("/terminal")
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {(pathname.startsWith("/build") || pathname.startsWith("/orchestrate") || pathname.startsWith("/bundles") || pathname.startsWith("/terminal")) && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname.startsWith("/build") || pathname.startsWith("/orchestrate") || pathname.startsWith("/bundles") || pathname.startsWith("/terminal")
                  ? "bg-accent-dark text-accent-violet"
                  : "text-text-tertiary",
              )}
            >
              <Workflow className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Build</span>
          </Link>

          {/* 7. Wallets */}
          <Link
            href="/wallet"
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-bold transition-all relative flex-1 min-w-0",
              pathname.startsWith("/wallet")
                ? "text-accent-violet"
                : "text-text-quaternary hover:text-text-secondary active:scale-95",
            )}
          >
            {pathname.startsWith("/wallet") && (
              <span className="absolute -top-1 h-1 w-3.5 rounded-full bg-accent-violet shadow-[0_0_8px_rgba(255,92,40,0.8)]" />
            )}
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                pathname.startsWith("/wallet") ? "bg-accent-dark text-accent-violet" : "text-text-tertiary",
              )}
            >
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <span className="truncate max-w-full font-mono tracking-tight text-[9px]">Wallets</span>
          </Link>
        </div>
      </nav>

      {/* Center + Action Sheet */}
      <CreateActionSheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
      />
    </>
  );
}
