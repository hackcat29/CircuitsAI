"use client";

import Link from "next/link";
import {
  UserPlus,
  Briefcase,
  Rocket,
  Workflow,
  Wallet,
  Activity,
  Sliders,
  Terminal,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { cn } from "@/lib/cn";

const CORE_ACTIONS = [
  {
    label: "Create Agent",
    tag: "Deploy",
    href: "/register",
    icon: UserPlus,
    iconBg: "rgba(31, 212, 135, 0.15)",
    iconColor: "#1FD487",
  },
  {
    label: "Post Job",
    tag: "Escrow",
    href: "/marketplace?create=1",
    icon: Briefcase,
    iconBg: "rgba(255, 177, 61, 0.15)",
    iconColor: "#FFB13D",
  },
  {
    label: "Deposit",
    tag: "Treasury",
    href: "/wallet",
    icon: Wallet,
    iconBg: "rgba(61, 139, 255, 0.15)",
    iconColor: "#3D8BFF",
  },
  {
    label: "Pipeline",
    tag: "Orchestrate",
    href: "/marketplace/pipelines?create=1",
    icon: Workflow,
    iconBg: "rgba(167, 139, 250, 0.15)",
    iconColor: "#A78BFA",
  },
  {
    label: "x402 Service",
    tag: "Micropay",
    href: "/marketplace/services?create=1",
    icon: Activity,
    iconBg: "rgba(31, 212, 135, 0.15)",
    iconColor: "#1FD487",
  },
  {
    label: "Trading Desk",
    tag: "Degen",
    href: "/degen/perpetuals",
    icon: TrendingUp,
    iconBg: "rgba(255, 92, 40, 0.15)",
    iconColor: "#FF5C28",
  },
];

export function AdaptiveQuickActions() {
  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col">
      <CardHeader className="pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent-violet/15 text-accent-violet">
              <Sliders className="h-3 w-3" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary">
              Quick Actions
            </CardTitle>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.75 py-0.5 rounded-[4px] bg-bg-surface3 text-text-tertiary">
            Operations
          </span>
        </div>
        <CardDescription className="text-xs text-text-tertiary">
          One-tap workflows to manage and expand your autonomous agent fleet.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {CORE_ACTIONS.map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.label}
                href={act.href}
                className="group p-2.5 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:border-border-strong active:scale-[0.98] transition-all flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                    style={{ background: act.iconBg }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: act.iconColor }} />
                  </div>
                  <span className="text-[9.5px] font-mono text-text-quaternary font-bold">
                    {act.tag}
                  </span>
                </div>
                <div className="text-[12px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                  {act.label}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
