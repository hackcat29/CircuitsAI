import Link from "next/link";
import { UserPlus, Store, Rocket, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

const ACTIONS = [
  {
    label: "Register an Agent",
    description: "List a new AI agent on the protocol.",
    href: "/register",
    icon: UserPlus,
    iconBg: "bg-accent-violet/12 group-hover:bg-accent-violet/22",
    iconColor: "text-accent-violet",
    accentFrom: "from-accent-violet/30",
    accentTo: "to-accent-violet/0",
  },
  {
    label: "Browse Marketplace",
    description: "Hire an agent or post a job.",
    href: "/marketplace",
    icon: Store,
    iconBg: "bg-accent-cyan/12 group-hover:bg-accent-cyan/22",
    iconColor: "text-accent-cyan",
    accentFrom: "from-accent-cyan/30",
    accentTo: "to-accent-cyan/0",
  },
  {
    label: "Launch a Token",
    description: "Start a bonding-curve launch for your agent.",
    href: "/launchpad",
    icon: Rocket,
    iconBg: "bg-amber/12 group-hover:bg-amber/22",
    iconColor: "text-amber",
    accentFrom: "from-amber/30",
    accentTo: "to-amber/0",
  },
];

export function QuickActions() {
  return (
    <>
      {/* Compact strip on mobile — three full description cards is a lot of vertical scroll
          before anything with real data shows up; icon + label only down here. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border-subtle p-3 text-center transition-colors duration-150 hover:border-border-strong hover:bg-white/2.5"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200", action.iconBg)}>
              <action.icon className={cn("h-4.5 w-4.5", action.iconColor)} />
            </div>
            <p className="text-[11px] font-semibold leading-tight text-text-primary">{action.label}</p>
          </Link>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
      {ACTIONS.map((action) => (
        <Link key={action.href} href={action.href} className="group">
          <Card className={cn(
            "relative flex h-full flex-col gap-4 p-6 overflow-hidden",
            "transition-all duration-200",
            "hover:border-border-strong hover:-translate-y-0.5",
            "hover:shadow-md",
          )}>
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
              action.iconBg,
            )}>
              <action.icon className={cn("h-5 w-5", action.iconColor)} />
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors duration-150">
                {action.label}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                {action.description}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-tertiary group-hover:text-text-secondary transition-colors duration-150">
              <span>Open</span>
              <ArrowRight className="h-3 w-3 -translate-x-0.5 group-hover:translate-x-0.5 transition-transform duration-150" />
            </div>
          </Card>
        </Link>
      ))}
      </div>
    </>
  );
}
