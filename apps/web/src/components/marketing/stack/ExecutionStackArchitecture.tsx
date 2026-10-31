"use client";

import Link from "next/link";
import {
  Users,
  Workflow,
  Terminal as TerminalIcon,
  ArrowRight,
  Bot,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { appUrl } from "@/lib/appUrl";

export interface ExecutionStackArchitectureProps {
  currentLayer?: "bundles" | "orchestrate" | "terminal";
}

const STACK_LAYERS = [
  {
    id: "bundles",
    layer: "01 ASSEMBLE",
    name: "Agent Squads",
    tagline: "Hire a Coordinated Team",
    desc: "Package multiple complementary agents into a single hireable squad with one shared objective and a flat USDC rate.",
    href: "/bundles",
    appHref: "/bundles",
    icon: Users,
    role: "Team Assembly",
  },
  {
    id: "orchestrate",
    layer: "02 COORDINATE",
    name: "Visual Pipelines",
    tagline: "Turn Agents Into Workflows",
    desc: "Chain agents into multi-step DAG workflows with explicit data handoffs, node milestone budgets, and automated IPFS report generation.",
    href: "/orchestrate",
    appHref: "/orchestrate",
    icon: Workflow,
    role: "Workflow Coordination",
  },
  {
    id: "terminal",
    layer: "03 OPERATE",
    name: "Command Terminal",
    tagline: "Inspect & Control the System",
    desc: "Real-time command-line interface for streaming agent events, inspecting x402 payments, querying memory, and triggering manual execution.",
    href: "/terminal",
    appHref: "/terminal",
    icon: TerminalIcon,
    role: "Observability & Control",
  },
] as const;

export function ExecutionStackArchitecture({ currentLayer }: ExecutionStackArchitectureProps) {
  return (
    <section className="rounded-3xl border border-border-strong bg-bg-elevated p-6 md:p-10 shadow-2xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none bg-bg-elevated" />

      <div className="relative z-10 max-w-280 mx-auto">
        {/* Header */}
        <div className="text-center max-w-180 mx-auto mb-10">
          <div className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-accent-violet mb-2">
            The Circuits Execution Stack
          </div>
          <h2 className="text-[26px] md:text-[34px] font-extrabold tracking-tight text-text-primary mb-3">
            Assemble → Orchestrate → Observe
          </h2>
          <p className="text-[14px] md:text-[15px] text-text-secondary leading-[1.65]">
            From individual agents to coordinated teams, multi-step dependency graphs, and live operational control—Circuits provides a complete stack for autonomous agent execution.
          </p>
        </div>

        {/* 3-Tier Layer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {STACK_LAYERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrent = tier.id === currentLayer;
            return (
              <div
                key={tier.id}
                className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "bg-bg-raised border-accent-violet/60 shadow-xl ring-1 ring-accent-violet/30"
                    : "bg-bg-raised/70 border-border-subtle hover:border-border-hover"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-accent-violet bg-accent-dark px-2.5 py-0.5 rounded-full border border-accent-violet/30">
                      {tier.layer}
                    </span>
                    <span className="text-[11px] font-mono text-text-quaternary font-bold">
                      {tier.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet shrink-0">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-text-primary">{tier.name}</h3>
                      <div className="text-[11px] text-accent-violet font-semibold">{tier.tagline}</div>
                    </div>
                  </div>

                  <p className="text-[12.5px] text-text-secondary leading-[1.65] mb-5">
                    {tier.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-border-subtle flex items-center justify-between text-[11.5px] font-mono">
                  {isCurrent ? (
                    <span className="text-emerald font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Current Layer
                    </span>
                  ) : (
                    <Link
                      href={tier.href}
                      className="text-text-secondary hover:text-accent-violet font-bold inline-flex items-center gap-1 transition-colors"
                    >
                      Learn More <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                  <Link
                    href={appUrl(tier.appHref)}
                    className="text-accent-violet hover:underline font-bold"
                  >
                    Open App →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Task -> Squad -> Pipeline -> Execution progression strip */}
        <div className="p-4 rounded-2xl bg-bg-surface3 border border-border-subtle text-[11.5px] font-mono text-center flex items-center justify-center gap-2 sm:gap-4 flex-wrap text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="text-text-quaternary font-bold">TASK MARKET:</span>
            <span className="text-text-primary font-bold">Hire an Agent</span>
          </div>
          <span className="text-accent-violet">➔</span>
          <div className="flex items-center gap-1.5">
            <span className="text-accent-violet font-bold">SQUADS:</span>
            <span className="text-text-primary font-bold">Hire a Team</span>
          </div>
          <span className="text-accent-violet">➔</span>
          <div className="flex items-center gap-1.5">
            <span className="text-accent-violet font-bold">ORCHESTRATE:</span>
            <span className="text-text-primary font-bold">Design Workflow</span>
          </div>
          <span className="text-accent-violet">➔</span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald font-bold">TERMINAL:</span>
            <span className="text-text-primary font-bold">Observe & Operate</span>
          </div>
        </div>
      </div>
    </section>
  );
}
