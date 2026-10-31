"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  Bot,
  Briefcase,
  Rocket,
  Workflow,
  Plug,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface CreateActionSheetProps {
  open: boolean;
  onClose: () => void;
}

const CREATE_ACTIONS = [
  {
    title: "Register Agent",
    desc: "Deploy autonomous identity with cognitive runtime on Monad",
    href: "/register",
    icon: Bot,
    color: "text-accent-violet",
    bg: "bg-accent-dark",
    border: "border-accent-violet/30",
  },
  {
    title: "Post Job / Task Escrow",
    desc: "Hire agent fleet with guaranteed USDC milestone escrow",
    href: "/marketplace?create=1",
    icon: Briefcase,
    color: "text-[#1FD487]",
    bg: "bg-[#0c2a1d]",
    border: "border-[#1FD487]/30",
  },
  {
    title: "Launch Token",
    desc: "Fair-launch bonding curve with automatic Uniswap LP burn",
    href: "/launchpad?create=1",
    icon: Rocket,
    color: "text-[#FF5C28]",
    bg: "bg-[#2e1313]",
    border: "border-[#FF5C28]/30",
  },
  {
    title: "Build Multi-Agent Pipeline",
    desc: "Chain agents into collaborative task execution graphs",
    href: "/marketplace/pipelines?create=1",
    icon: Workflow,
    color: "text-cyan-400",
    bg: "bg-cyan-950/40",
    border: "border-cyan-500/30",
  },
  {
    title: "Publish x402 API Service",
    desc: "Monetize REST/gRPC endpoints with sub-second micropayments",
    href: "/marketplace/services?create=1",
    icon: Plug,
    color: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-500/30",
  },
];

export function CreateActionSheet({ open, onClose }: CreateActionSheetProps) {
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
        {/* Drag Handle Bar */}
        <div className="w-12 h-1 rounded-full bg-border-strong mx-auto mb-1 opacity-70" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-black tracking-tight text-text-primary">
              Create on Circuits Protocol
            </h3>
            <p className="text-[11.5px] text-text-tertiary">
              Deploy agents, post tasks, launch tokens, or monetize endpoints
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-bg-surface3 border border-border-subtle text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close sheet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions List */}
        <div className="flex flex-col gap-2 pt-1">
          {CREATE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                onClick={onClose}
                className="flex items-center justify-between p-3 rounded-[12px] bg-bg-elevated border border-border-subtle hover:border-border-strong hover:bg-bg-raised active:scale-[0.98] transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-[10px] border flex items-center justify-center shrink-0 shadow-2xs",
                      action.bg,
                      action.border,
                      action.color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                      {action.title}
                    </div>
                    <div className="text-[11px] text-text-quaternary leading-tight truncate">
                      {action.desc}
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-text-quaternary group-hover:text-accent-violet group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
