"use client";

import { useRouter } from "next/navigation";
import {
  Database,
  MessageSquareCode,
  BrainCircuit,
  Cpu,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { KnowledgeContribution, ContributionType } from "@/hooks";

const TYPE_CONFIG: Record<
  ContributionType,
  { label: string; icon: typeof Database; desc: string; bg: string; color: string; tag: string }
> = {
  DATASET: { label: "Dataset", icon: Database, desc: "Data", bg: "#0c1a2e", color: "#60A5FA", tag: "Data" },
  PROMPT: { label: "Prompt", icon: MessageSquareCode, desc: "Prompt", bg: "#1a1a2e", color: "#A78BFA", tag: "Prompt" },
  MEMORY: { label: "Memory", icon: BrainCircuit, desc: "Memory", bg: "#0c2a1d", color: "#1FD487", tag: "Memory" },
  MODEL: { label: "Model", icon: Cpu, desc: "Weights", bg: "#2e2210", color: "#FFB13D", tag: "Weights" },
};

interface MobileKnowledgeCardProps {
  item: KnowledgeContribution;
}

export function MobileKnowledgeCard({ item }: MobileKnowledgeCardProps) {
  const router = useRouter();
  const tc = TYPE_CONFIG[item.type];
  const Icon = tc.icon;

  function handleCardClick() {
    router.push(`/knowledge/${item.id}`);
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-bg-elevated border border-border-subtle active:border-accent-violet/60 rounded-[14px] p-4 flex flex-col gap-3 shadow-xs cursor-pointer select-none transition-colors"
    >
      {/* Top row: Type icon, title, contributor & verified badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0 border border-border-strong"
            style={{ background: tc.bg }}
          >
            <Icon className="h-5 w-5" style={{ color: tc.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-text-primary truncate">
              {item.title}
            </div>
            <div className="text-[10.5px] font-mono text-text-quaternary truncate">
              by {item.contributor}
            </div>
          </div>
        </div>

        <span
          className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0"
          style={{ background: tc.bg, color: tc.color, borderColor: `${tc.color}40` }}
        >
          {tc.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11.5px] text-text-tertiary line-clamp-2 leading-relaxed">
        {item.description}
      </p>

      {/* Tags strip */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-text-quaternary"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="text-[9.5px] font-mono text-text-quaternary self-center">
              +{item.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Pricing & Usage Strip */}
      <div className="flex items-center justify-between p-2 rounded-[8px] bg-bg-surface border border-border-subtle text-xs font-mono">
        <div className="text-[11px] text-text-secondary">
          <span className="text-text-quaternary">Uses:</span>{" "}
          <strong className="text-text-primary">{item.usageCount.toLocaleString()}</strong>
        </div>
        <div className="font-extrabold text-accent-violet text-[12px]">
          ${item.priceUsdc} USDC <span className="text-[10px] text-text-quaternary">/ resolve</span>
        </div>
      </div>

      {/* Bottom Affordance */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-xs">
        <div className="flex items-center gap-1">
          {item.verifiedAt ? (
            <span className="text-[10px] font-bold text-[#1FD487] flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Verified On-Chain</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-text-quaternary">Draft / Unverified</span>
          )}
        </div>

        <div className="text-accent-violet font-semibold text-[11.5px] flex items-center gap-1">
          <span>Inspect Knowledge</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
