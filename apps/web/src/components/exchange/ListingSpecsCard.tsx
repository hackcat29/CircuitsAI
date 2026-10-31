"use client";

import { Cpu, ShieldCheck, Zap, Terminal as TerminalIcon, CheckCircle2, Globe, Layers, Activity } from "lucide-react";
import type { ExchangeListingAgent } from "@/hooks/useExchangeListing";
import { formatBps } from "@/lib/format";

export function ListingSpecsCard({
  agent,
  agentChainId,
}: {
  agent: ExchangeListingAgent | null;
  agentChainId: string;
}) {
  const mcpTools = [
    { name: "Block Explorer", desc: "Query transactions, token balances, and contract events" },
    { name: "DexScreener API", desc: "Live price feeds, liquidity pools, and volume feeds" },
    { name: "Social Broadcaster", desc: "Autonomous announcements and ecosystem updates" },
    { name: "Task Escrow Engine", desc: "Autonomous job verification and milestone execution" },
  ];

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent-violet/15 text-accent-violet border border-accent-violet/30">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">
              Agent Specifications &amp; Tools
            </h3>
            <p className="text-[11px] text-text-quaternary">
              Runtime environment, model specs, and tool integrations
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-secondary border border-border-subtle">
          Agent #{agentChainId}
        </span>
      </div>

      {/* Hardware / Runtime Spec Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Foundation LLM</p>
          <p className="text-xs font-bold text-text-primary mt-1">Llama 3.3 70B Instruct</p>
          <p className="text-[10px] text-text-quaternary mt-0.5">Inference Model</p>
        </div>

        <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Context Window</p>
          <p className="text-xs font-mono font-bold text-accent-violet mt-1">128k Tokens</p>
          <p className="text-[10px] text-text-quaternary mt-0.5">Active Context</p>
        </div>

        <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Tasks Settled</p>
          <p className="text-xs font-mono font-bold text-[#1FD487] mt-1">{agent?.jobsCompleted ?? 0} Completed</p>
          <p className="text-[10px] text-text-quaternary mt-0.5">Task Escrows</p>
        </div>

        <div className="rounded-[12px] bg-bg-surface3/60 border border-border-subtle p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Reputation</p>
          <p className="text-xs font-mono font-bold text-text-primary mt-1">
            {agent ? formatBps(agent.reputationBps) : "100.0%"}
          </p>
          <p className="text-[10px] text-text-quaternary mt-0.5">On-Chain Verified</p>
        </div>
      </div>

      {/* Connected MCP Tools & APIs */}
      <div>
        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-accent-violet" />
          <span>Connected Tools &amp; APIs</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {mcpTools.map((tool) => (
            <div
              key={tool.name}
              className="rounded-[10px] bg-bg-surface3/40 border border-border-subtle p-2.5 flex items-start gap-2.5"
            >
              <div className="h-2 w-2 rounded-full bg-[#1FD487] mt-1 shrink-0" />
              <div>
                <p className="text-xs font-bold text-text-primary">{tool.name}</p>
                <p className="text-[11px] text-text-quaternary mt-0.5">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
