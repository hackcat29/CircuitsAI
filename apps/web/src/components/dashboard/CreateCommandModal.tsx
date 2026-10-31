"use client";

import Link from "next/link";
import {
  Bot,
  Rocket,
  Briefcase,
  Workflow,
  Activity,
  LineChart,
  X,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

interface CreateOption {
  title: string;
  category: string;
  description: string;
  href: string;
  icon: typeof Bot;
  iconBg: string;
  iconColor: string;
  tag?: string;
}

const CREATE_OPTIONS: CreateOption[] = [
  {
    title: "New Autonomous Agent",
    category: "Autonomous Workforce",
    description: "Register a standalone AI agent with smart wallet, cognitive brain, and spend policy.",
    href: "/register",
    icon: Bot,
    iconBg: "rgba(31, 212, 135, 0.15)",
    iconColor: "#1FD487",
    tag: "Core",
  },
  {
    title: "Post a Bounty / Job",
    category: "Task Marketplace",
    description: "Lock USDC in escrow and hire an autonomous agent to complete specialized deliverables.",
    href: "/marketplace",
    icon: Briefcase,
    iconBg: "rgba(255, 177, 61, 0.15)",
    iconColor: "#FFB13D",
  },
  {
    title: "Multi-Agent Pipeline",
    category: "Orchestration",
    description: "Chain multiple AI agents into sequential or parallel workflows with automated escrow handoffs.",
    href: "/orchestrate",
    icon: Workflow,
    iconBg: "rgba(167, 139, 250, 0.15)",
    iconColor: "#A78BFA",
  },
  {
    title: "Register x402 Service",
    category: "Micropayments",
    description: "Monetize an agent's API endpoint with metered, pay-per-call HTTP 402 micro-settlements.",
    href: "/x402-services",
    icon: Activity,
    iconBg: "rgba(61, 139, 255, 0.15)",
    iconColor: "#3D8BFF",
  },
];

interface CreateCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCommandModal({ open, onOpenChange }: CreateCommandModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-bg-elevated border-border-strong p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle bg-bg-surface/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-accent-dark flex items-center justify-center border border-accent-violet/30">
                <Plus className="h-4 w-4 text-accent-violet" />
              </div>
              <DialogTitle className="text-lg font-black text-text-primary tracking-tight">
                Create &amp; Deploy
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-text-tertiary mt-1.5">
            Launch autonomous agents, bonding curves, jobs, pipelines, and monetized services across Circuits.
          </DialogDescription>
        </div>

        {/* Options Grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {CREATE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <Link
                key={opt.title}
                href={opt.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "group relative p-4 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised",
                  "hover:border-border-strong transition-all duration-150 flex flex-col justify-between cursor-pointer",
                  "hover:shadow-md hover:-translate-y-0.5",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-white/5"
                      style={{ background: opt.iconBg }}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ color: opt.iconColor }} />
                    </div>
                    {opt.tag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/20">
                        {opt.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-text-quaternary uppercase tracking-wider mb-0.5">
                    {opt.category}
                  </div>
                  <div className="text-[13.5px] font-bold text-text-primary group-hover:text-accent-violet transition-colors">
                    {opt.title}
                  </div>
                  <p className="text-[11.5px] text-text-tertiary mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center justify-between text-[11px] font-semibold text-text-quaternary group-hover:text-text-primary transition-colors">
                  <span>Start deployment</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
