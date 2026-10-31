"use client";

import {
  X,
  Scale,
  ShieldCheck,
  Layers,
  Gauge,
  Cpu,
  Bot,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import type { RankedAgent } from "@/hooks/useRankings";
import type { CognitiveLayer } from "@/hooks/useCognitiveLayer";

interface AgentComparisonModalProps {
  agents: RankedAgent[];
  layerMap: Record<string, CognitiveLayer>;
  isOpen: boolean;
  onClose: () => void;
  onRemoveAgent: (id: string) => void;
}

import { computeEnhancedSla, formatReputationBps } from "@/lib/reputation";

function fmtRep(bps: number): string {
  return formatReputationBps(bps);
}

function computeSla(reputationBps: number, jobsCompleted: number) {
  return computeEnhancedSla(reputationBps, jobsCompleted);
}

function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentComparisonModal({
  agents,
  layerMap,
  isOpen,
  onClose,
  onRemoveAgent,
}: AgentComparisonModalProps) {
  if (!isOpen || agents.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-text-primary">Agent Head-to-Head Comparison Matrix</h3>
              <p className="text-[11px] text-text-tertiary">Comparing {agents.length} fleet agents across on-chain reputation and SLA metrics.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body: Comparison Table */}
        <div className="p-6 overflow-x-auto overflow-y-auto max-h-[70vh]">
          <div className={cn("grid gap-4", agents.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
            {agents.map((a) => {
              const layer = layerMap[String(a.id)];
              const sla = computeSla(a.reputationBps, a.jobsCompleted);
              const avatar = layer?.avatarUrl || robotAvatarUrl(String(a.id));

              return (
                <div
                  key={a.id}
                  className="rounded-[16px] bg-bg-surface border border-border-subtle p-4.5 space-y-4 flex flex-col justify-between"
                >
                  {/* Agent Header */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-11 w-11 rounded-[12px] overflow-hidden border border-border-subtle shrink-0">
                          <Image src={avatar} alt={a.name} fill className="object-cover" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-extrabold text-text-primary leading-tight">{a.name}</h4>
                          <span className="text-[11px] font-mono text-text-quaternary">Agent #{a.id}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveAgent(a.id)}
                        className="p-1 rounded text-text-quaternary hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from comparison"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Metric 1: On-Chain Reputation */}
                    <div className="p-3 rounded-[10px] bg-bg-raised border border-border-subtle space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-quaternary flex items-center gap-1 font-bold">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#1FD487]" />
                          <span>Reputation</span>
                        </span>
                        <span className="font-mono font-extrabold text-[14px] text-[#1FD487]">{fmtRep(a.reputationBps)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-bg-surface3 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1FD487]"
                          style={{ width: `${Math.min(100, a.reputationBps / 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metric 2: Completed Jobs */}
                    <div className="p-3 rounded-[10px] bg-bg-raised border border-border-subtle flex items-center justify-between text-xs font-mono">
                      <span className="text-text-quaternary flex items-center gap-1 font-sans font-bold">
                        <Layers className="h-3.5 w-3.5 text-accent-violet" />
                        <span>Tasks Completed</span>
                      </span>
                      <span className="font-extrabold text-text-primary text-[13px]">{a.jobsCompleted.toLocaleString()}</span>
                    </div>

                    {/* Metric 3: SLA Performance */}
                    <div className="p-3 rounded-[10px] bg-bg-raised border border-border-subtle space-y-2 text-xs">
                      <span className="text-[10px] uppercase font-bold text-text-quaternary block flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5 text-accent-violet" />
                        <span>SLA Execution Telemetry</span>
                      </span>

                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Success Rate:</span>
                          <span className="text-[#1FD487] font-bold">{sla.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">On-Time Delivery:</span>
                          <span className="text-text-secondary font-bold">{sla.onTimeRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Dispute Incidence:</span>
                          <span className="text-red-400 font-bold">{sla.disputeRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Avg Response:</span>
                          <span className="text-text-secondary">{formatMs(sla.responseMs)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Protocol Capabilities */}
                    <div className="p-3 rounded-[10px] bg-bg-raised border border-border-subtle space-y-1.5 text-xs">
                      <span className="text-[10px] uppercase font-bold text-text-quaternary block">
                        Verified Protocol Badges
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {a.supportsX402 && (
                          <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-accent-dark text-accent-violet font-bold border border-accent-violet/30">
                            x402 Micro-Pay
                          </span>
                        )}
                        {a.supportsA2A && (
                          <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#0c2a1d] text-[#1FD487] font-bold border border-[#1FD487]/30">
                            A2A Negotiation
                          </span>
                        )}
                        {a.supportsMcp && (
                          <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#0c1a2e] text-[#60A5FA] font-bold border border-[#60A5FA]/30">
                            MCP Protocol
                          </span>
                        )}
                        {!a.supportsX402 && !a.supportsA2A && !a.supportsMcp && (
                          <span className="text-[10px] text-text-quaternary">Standard ERC-721 Agent</span>
                        )}
                      </div>
                    </div>

                    {/* Cognitive Layer Specs */}
                    {layer && (
                      <div className="p-3 rounded-[10px] bg-bg-raised border border-border-subtle space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-text-quaternary block">
                          Foundation Model &amp; Domains
                        </span>
                        <div className="font-mono text-[11px] text-text-secondary">{layer.foundationModel || "Default LLM Core"}</div>
                        {layer.knowledgeDomains && layer.knowledgeDomains.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {layer.knowledgeDomains.map((d) => (
                              <span key={d} className="text-[9px] px-1.5 py-0.25 rounded bg-bg-surface3 text-text-tertiary">
                                #{d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* View Full Profile Link */}
                  <Link
                    href={`/agents/${agentUrlId(a.name, a.id)}`}
                    className="w-full py-2 rounded-[9px] bg-bg-surface3 hover:bg-accent-violet hover:text-white border border-border-strong text-xs font-bold text-text-primary transition-all flex items-center justify-center gap-1.5 mt-2"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            Select up to 3 agents from the leaderboard to inspect side-by-side.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-[9px] bg-accent-violet text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-xs"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
