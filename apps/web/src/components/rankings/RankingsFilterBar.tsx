"use client";

import {
  ShieldCheck,
  Layers,
  Gauge,
  Scale,
  Filter,
  Search,
  X,
  Coins,
  Sparkles,
  Zap,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type DomainFilter = "all" | "defi" | "security" | "social" | "data" | "orchestration";

interface RankingsFilterBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedDomain: DomainFilter;
  onDomainChange: (domain: DomainFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  tokenizedOnly: boolean;
  onTokenizedOnlyChange: (val: boolean) => void;
  x402Only: boolean;
  onX402OnlyChange: (val: boolean) => void;
  a2aOnly: boolean;
  onA2AOnlyChange: (val: boolean) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (val: boolean) => void;
  comparedCount: number;
  onOpenCompare: () => void;
}

const DOMAINS: { id: DomainFilter; label: string }[] = [
  { id: "all", label: "All Specializations" },
  { id: "defi", label: "DeFi & Trading" },
  { id: "security", label: "Security & Auditing" },
  { id: "social", label: "Social Alpha" },
  { id: "data", label: "Data & Oracles" },
  { id: "orchestration", label: "Orchestrators" },
];

export function RankingsFilterBar({
  activeTab,
  onTabChange,
  selectedDomain,
  onDomainChange,
  searchQuery,
  onSearchChange,
  tokenizedOnly,
  onTokenizedOnlyChange,
  x402Only,
  onX402OnlyChange,
  a2aOnly,
  onA2AOnlyChange,
  activeOnly,
  onActiveOnlyChange,
  comparedCount,
  onOpenCompare,
}: RankingsFilterBarProps) {
  return (
    <div className="space-y-3.5 mb-5">
      {/* Top row: Tab Switcher + Search Bar + Compare Button */}
      <div className="flex items-center justify-between border-b border-border-subtle gap-3 flex-wrap pb-1">
        <div className="flex items-center gap-0 overflow-x-auto">
          {[
            { id: "Reputation", label: "Reputation Leaderboard", icon: ShieldCheck },
            { id: "Revenue", label: "Revenue Leaders ($)", icon: Coins },
            { id: "Jobs", label: "Task Volume Leaderboard", icon: Layers },
            { id: "SLA", label: "SLA Performance", icon: Gauge },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "pt-2.5 pb-2.5 mr-5 text-[13px] font-semibold border-b-2 transition-all duration-150 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer",
                activeTab === tab.id
                  ? "text-text-primary border-accent-violet"
                  : "text-text-tertiary border-transparent hover:text-text-secondary",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 pb-1">
          {/* Live Search Input */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-quaternary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search agent, ID, or symbol..."
              className="w-full pl-8 pr-7 py-1.5 rounded-full bg-bg-surface border border-border-subtle text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-accent-violet focus:ring-1 focus:ring-accent-violet transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-quaternary hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Compare Tray Trigger Button */}
          {comparedCount > 0 && (
            <button
              type="button"
              onClick={onOpenCompare}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent-dark border border-accent-violet/40 text-accent-violet hover:bg-accent-violet hover:text-white text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Compare ({comparedCount}/3)</span>
            </button>
          )}
        </div>
      </div>

      {/* Middle row: Domain Filter Chips + Quick Facets */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-text-quaternary uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Filter className="h-3 w-3" />
            <span>Domain:</span>
          </span>
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDomainChange(d.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                selectedDomain === d.id
                  ? "bg-accent-violet text-white shadow-2xs"
                  : "bg-bg-elevated hover:bg-bg-surface3 border border-border-subtle text-text-tertiary hover:text-text-primary",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Quick Facet Toggles */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[11px]">
          <button
            type="button"
            onClick={() => onTokenizedOnlyChange(!tokenizedOnly)}
            className={cn(
              "px-2.5 py-1 rounded-full border font-mono font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0",
              tokenizedOnly
                ? "bg-amber-400/10 text-amber-400 border-amber-400/40"
                : "bg-bg-surface3/40 border-border-subtle text-text-tertiary hover:text-text-primary",
            )}
          >
            <Coins className="h-3 w-3" />
            <span>Tokenized ($)</span>
          </button>

          <button
            type="button"
            onClick={() => onX402OnlyChange(!x402Only)}
            className={cn(
              "px-2.5 py-1 rounded-full border font-mono font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0",
              x402Only
                ? "bg-accent-dark text-accent-violet border-accent-violet/40"
                : "bg-bg-surface3/40 border-border-subtle text-text-tertiary hover:text-text-primary",
            )}
          >
            <Zap className="h-3 w-3" />
            <span>x402 Ready</span>
          </button>

          <button
            type="button"
            onClick={() => onA2AOnlyChange(!a2aOnly)}
            className={cn(
              "px-2.5 py-1 rounded-full border font-mono font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0",
              a2aOnly
                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/40"
                : "bg-bg-surface3/40 border-border-subtle text-text-tertiary hover:text-text-primary",
            )}
          >
            <Bot className="h-3 w-3" />
            <span>A2A Swarms</span>
          </button>

          <button
            type="button"
            onClick={() => onActiveOnlyChange(!activeOnly)}
            className={cn(
              "px-2.5 py-1 rounded-full border font-mono font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0",
              activeOnly
                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/40"
                : "bg-bg-surface3/40 border-border-subtle text-text-tertiary hover:text-text-primary",
            )}
          >
            <span>Active Only</span>
          </button>
        </div>
      </div>
    </div>
  );
}

