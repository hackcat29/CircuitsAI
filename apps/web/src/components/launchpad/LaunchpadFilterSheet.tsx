"use client";

import { useEffect } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface LaunchpadFilterState {
  status: "all" | "bonding" | "graduated";
  sortBy: "trending" | "gainers" | "graduated" | "mcap" | "volume" | "newest";
}

interface LaunchpadFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: LaunchpadFilterState;
  onApply: (f: LaunchpadFilterState) => void;
}

const STATUS_OPTIONS = [
  { id: "all" as const, label: "All Tokens" },
  { id: "bonding" as const, label: "Active Bonding Curves" },
  { id: "graduated" as const, label: "Graduated to Uniswap" },
];

const SORT_OPTIONS = [
  { id: "trending" as const, label: "Trending Alpha" },
  { id: "gainers" as const, label: "Top Gainers (24h)" },
  { id: "mcap" as const, label: "Market Cap (FDV)" },
  { id: "volume" as const, label: "Most Active" },
  { id: "newest" as const, label: "Newest Launches" },
];

export function LaunchpadFilterSheet({
  open,
  onClose,
  filters,
  onApply,
}: LaunchpadFilterSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border-t border-border-strong bg-bg-surface/98 backdrop-blur-2xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-full duration-250 flex flex-col gap-4"
        style={{ background: "rgba(12, 14, 18, 0.98)" }}
      >
        <div className="w-12 h-1 rounded-full bg-border-strong mx-auto mb-1 opacity-70" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <div>
            <h3 className="text-[15px] font-black tracking-tight text-text-primary">
              Filter &amp; Sort Launches
            </h3>
            <p className="text-[11px] text-text-tertiary">
              Configure token state and sorting criteria
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-bg-surface3 border border-border-subtle text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Group */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase font-mono font-bold text-text-quaternary tracking-wider">
            Curve Status
          </span>
          <div className="flex flex-col gap-1">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = filters.status === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onApply({ ...filters, status: opt.id })}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-accent-dark text-accent-violet border-accent-violet/40"
                      : "bg-bg-elevated text-text-secondary border-border-subtle hover:text-text-primary",
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-accent-violet" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Group */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[10.5px] uppercase font-mono font-bold text-text-quaternary tracking-wider">
            Sort Order
          </span>
          <div className="flex flex-col gap-1">
            {SORT_OPTIONS.map((opt) => {
              const isSelected = filters.sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onApply({ ...filters, sortBy: opt.id })}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-accent-dark text-accent-violet border-accent-violet/40"
                      : "bg-bg-elevated text-text-secondary border-border-subtle hover:text-text-primary",
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-accent-violet" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply CTA */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#FF5C28] text-white font-bold text-xs shadow-xs cursor-pointer mt-2"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
