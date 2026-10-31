"use client";

import toast from "react-hot-toast";
import { useActiveChain } from "@/hooks";
import { SELECTABLE_CHAINS, type EvmChainId } from "@/lib/chains";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";

export function ChainSelector() {
  const { activeChainId, setActiveChainId } = useActiveChain();
  const currentChain = SELECTABLE_CHAINS.find((c) => c.chainId === activeChainId) ?? SELECTABLE_CHAINS[0];

  if (SELECTABLE_CHAINS.length <= 1) {
    return (
      <div className="h-8 w-auto flex items-center rounded-full border border-border-strong bg-bg-raised px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] font-bold gap-1.5 shrink-0 shadow-2xs select-none">
        {currentChain && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              backgroundColor: currentChain.color,
              boxShadow: `0 0 6px ${currentChain.color}`,
            }}
          />
        )}
        <span className="text-text-primary tracking-tight">{currentChain?.shortName ?? currentChain?.chainName}</span>
      </div>
    );
  }

  const handleChainChange = (value: string) => {
    const nextChainId = Number(value) as EvmChainId;
    if (nextChainId !== activeChainId) {
      setActiveChainId(nextChainId);
      const target = SELECTABLE_CHAINS.find((c) => c.chainId === nextChainId);
      if (target) {
        toast.success(`Switched to ${target.shortName ?? target.chainName}`, { duration: 2500 });
      }
    }
  };

  return (
    <Select value={String(activeChainId)} onValueChange={handleChainChange}>
      <SelectTrigger className="h-8 w-auto rounded-full border-border-strong bg-bg-raised px-2 sm:px-2.5 text-[11.5px] sm:text-[12px] font-bold gap-1.5 shrink-0 hover:border-border-hover transition-colors cursor-pointer shadow-2xs">
        <span className="flex items-center gap-1.5">
          {currentChain && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor: currentChain.color,
                boxShadow: `0 0 6px ${currentChain.color}`,
              }}
            />
          )}
          <span>{currentChain ? (currentChain.shortName ?? currentChain.chainName) : <SelectValue />}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {SELECTABLE_CHAINS.map((chain) => (
          <SelectItem key={chain.chainId} value={String(chain.chainId)} className="cursor-pointer">
            <span className="flex items-center gap-2 w-full">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: chain.color,
                  boxShadow: `0 0 5px ${chain.color}`,
                }}
              />
              <span className="font-semibold text-xs text-text-primary">{chain.chainName}</span>
              <span className="text-[10px] font-mono text-text-tertiary ml-2">({chain.shortName})</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
