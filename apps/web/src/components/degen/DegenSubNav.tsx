"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  LineChart,
  TrendingUp,
  Coins,
  Trophy,
  Dices,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface TabItem {
  label: string;
  href: string;
  icon: typeof Flame;
  badge?: string;
  activePattern: (path: string) => boolean;
}

const TABS: TabItem[] = [
  {
    label: "Fleet Command",
    href: "/degen",
    icon: Flame,
    activePattern: (p) => p === "/degen" || p === "/app/degen",
  },
  {
    label: "Perpetual Markets",
    href: "/degen/perpetuals",
    icon: LineChart,
    badge: "50x",
    activePattern: (p) => p.includes("/degen/perpetuals"),
  },
  {
    label: "Prediction Markets",
    href: "/degen/predictions",
    icon: TrendingUp,
    activePattern: (p) => p.includes("/degen/predictions"),
  },
  {
    label: "Memecoin Markets",
    href: "/degen/memecoins",
    icon: Coins,
    badge: "Bonding",
    activePattern: (p) => p.includes("/degen/memecoins"),
  },
  {
    label: "Sportsbook",
    href: "/degen/sportsbook",
    icon: Trophy,
    badge: "Soon",
    activePattern: (p) => p.includes("/degen/sportsbook"),
  },
  {
    label: "Casino Arcade",
    href: "/degen/casino",
    icon: Dices,
    badge: "Soon",
    activePattern: (p) => p.includes("/degen/casino"),
  },
];

export function DegenSubNav() {
  const pathname = usePathname() || "";

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.activePattern(pathname);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[12.5px] font-bold border transition-all whitespace-nowrap cursor-pointer",
              isActive
                ? "bg-bg-raised border-accent-violet/50 text-text-primary shadow-xs ring-1 ring-accent-violet/30"
                : "border-border-subtle bg-bg-surface text-text-tertiary hover:border-border-strong hover:text-text-secondary hover:bg-bg-elevated",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-accent-violet" : "text-text-quaternary")} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  "text-[9.5px] font-mono font-bold px-1.5 py-0.25 rounded-full border",
                  isActive
                    ? "bg-accent-dark text-accent-violet border-accent-violet/30"
                    : "bg-bg-surface3 text-text-quaternary border-border-subtle",
                )}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
