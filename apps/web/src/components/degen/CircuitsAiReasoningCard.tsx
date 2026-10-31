"use client";

import { useMemo } from "react";
import { Activity, Cpu } from "lucide-react";
import { useCognitiveLayer } from "@/hooks/useCognitiveLayer";
import {
  FOUNDATION_MODELS,
  tierForFoundationModel,
  tierMetaFor,
  TIER_CREDIT_HINT,
} from "@/lib/foundationModels";
import type { IndexerChainSlug } from "@/lib/chains";
import { cn } from "@/lib/cn";

export interface CircuitsAiReasoningCardProps {
  chain: IndexerChainSlug;
  agentChainId: string | undefined;
  agentName?: string;
  scanDescription?: string;
  className?: string;
}

export function CircuitsAiReasoningCard({
  chain,
  agentChainId,
  agentName,
  scanDescription = "Autonomous sub-second market scanning & probability reasoning on Monad",
  className,
}: CircuitsAiReasoningCardProps) {
  const { layer: cognitiveLayer, isLoading } = useCognitiveLayer(chain, agentChainId);

  const modelData = useMemo(() => {
    const modelId = cognitiveLayer?.foundationModel || "llama-3.3-70b";
    const meta = FOUNDATION_MODELS.find((m) => m.id === modelId) || FOUNDATION_MODELS[0]!;
    const tier = tierForFoundationModel(modelId);
    const tierMeta = tierMetaFor(tier);
    const tickCost = TIER_CREDIT_HINT[tier]?.tick ?? 0.5;
    return {
      modelId,
      label: meta.label,
      vendor: meta.vendor,
      tier,
      tierMeta,
      tickCost,
    };
  }, [cognitiveLayer?.foundationModel]);

  return (
    <div
      className={cn(
        "p-3.5 rounded-[12px] bg-cyan/5 border border-cyan/20 space-y-2.5 text-[11px] relative overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-cyan flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          <span>CircuitsAI Reasoning Engine</span>
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs font-mono"
          style={{
            backgroundColor: modelData.tierMeta.badgeBg,
            color: modelData.tierMeta.badgeColor,
            borderColor: `${modelData.tierMeta.badgeColor}50`,
          }}
        >
          {modelData.tickCost} Credit{modelData.tickCost === 1 ? "" : "s"} / Tick ({modelData.tierMeta.label})
        </span>
      </div>

      <div className="flex items-center justify-between text-text-secondary text-[11px] bg-bg-surface2/60 px-2.5 py-1.5 rounded-[8px] border border-border-subtle/70">
        <span className="flex items-center gap-1 text-text-tertiary">
          <Cpu className="h-3 w-3 text-accent-violet" />
          <span>Agent Model Tier:</span>
        </span>
        <span className="font-mono font-bold text-text-primary">
          {isLoading ? "…" : `${modelData.label} (${modelData.vendor})`}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-quaternary pt-1 border-t border-cyan/15 gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-cyan/90">
          <Activity className="h-3 w-3 text-cyan animate-spin shrink-0" />
          <span>CircuitsAI Runtime Active</span>
        </span>
        <span className="font-mono text-text-tertiary">
          Billed at {modelData.tierMeta.label} rate
        </span>
      </div>

      <div className="text-[10px] text-text-quaternary leading-relaxed">
        {scanDescription}
      </div>
    </div>
  );
}
