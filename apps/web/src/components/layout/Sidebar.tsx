"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r border-border-subtle bg-bg-surface/50 backdrop-blur-2xl md:flex">
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-border-subtle/50 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static nav mark, not worth next/image's config for this */}
        <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover" />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-white">
            Circuits Protocol
          </span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
            Agent Economy
          </span>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
          Protocol
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-1">
        {APP_NAV_ITEMS.map((item) => {
          const isExternal = item.href.startsWith("http");
          const active = !isExternal && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-accent-violet/12 text-white"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
              )}
            >
              {active && (
                <span className="absolute left-0 top-[20%] bottom-[20%] w-0.5 rounded-r-full bg-accent-violet shadow-[0_0_8px_2px_rgba(124,58,237,0.65)]" />
              )}
              {Icon && (
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-accent-violet" : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Protocol status footer ──────────────────────────── */}
      <div className="px-4 py-4 border-t border-border-subtle/50">
        <div className="flex items-center gap-2 rounded-lg bg-white/3 border border-border-subtle/50 px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald animate-glow-pulse" />
          <span className="text-xs text-text-tertiary">5 chains live</span>
        </div>
      </div>
    </aside>
  );
}
