"use client";

import { useRouter } from "next/navigation";
import { Brain, ShieldCheck, ChevronRight, Check, Plus, Cpu, Globe, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Skill } from "@/hooks";

interface MobileSkillCardProps {
  skill: Skill;
  isInstalled?: boolean;
  onToggleInstall?: () => void;
  canEquip?: boolean;
}

export function MobileSkillCard({
  skill,
  isInstalled = false,
  onToggleInstall,
  canEquip = true,
}: MobileSkillCardProps) {
  const router = useRouter();

  function handleCardClick() {
    router.push(`/skills/${skill.id}`);
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-bg-elevated border border-border-subtle active:border-accent-violet/60 rounded-[14px] p-4 flex flex-col gap-3 shadow-xs cursor-pointer select-none transition-colors"
    >
      {/* Top row: Emoji, Name, Publisher & Status */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-[10px] bg-bg-surface border border-border-strong flex items-center justify-center text-[20px] shrink-0 overflow-hidden">
            {skill.emoji?.startsWith("http") || skill.emoji?.startsWith("data:") || skill.emoji?.startsWith("/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={skill.emoji} alt="" className="h-full w-full object-cover" />
            ) : (
              skill.emoji || "🔧"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-text-primary truncate">
              {skill.name}
            </div>
            <div className="text-[10.5px] font-mono text-text-quaternary truncate">
              by {skill.publisher}
            </div>
          </div>
        </div>

        <span
          className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0",
            !skill.isCustom || skill.isLive
              ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
              : "bg-bg-surface3 text-text-quaternary border-border-strong",
          )}
        >
          {skill.isLive ? "Live" : "Spec"}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11.5px] text-text-tertiary line-clamp-2 leading-relaxed">
        {skill.desc}
      </p>

      {/* Category & Pricing Strip */}
      <div className="flex items-center justify-between p-2 rounded-[8px] bg-bg-surface border border-border-subtle text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
          <span className="px-1.5 py-0.5 rounded bg-accent-violet/15 text-accent-violet font-bold text-[9px]">
            {skill.cat}
          </span>
          <span className="text-text-quaternary font-mono truncate max-w-36">
            ID: {skill.id}
          </span>
        </div>
        <div className="font-mono font-extrabold text-accent-violet text-[12px]">
          {skill.price}
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-xs">
        <div className="text-accent-violet font-semibold text-[11.5px] flex items-center gap-1">
          <span>Inspect Tool &amp; SDK</span>
          <ChevronRight className="h-3 w-3" />
        </div>

        {onToggleInstall && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleInstall();
            }}
            disabled={!canEquip}
            className={cn(
              "px-3 py-1.5 rounded-[7px] text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-40",
              isInstalled
                ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                : "bg-accent-dark border-accent-violet/40 text-accent-violet hover:bg-accent-violet hover:text-white",
            )}
          >
            {isInstalled ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> Equipped
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Plus className="h-3 w-3" /> Equip
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
