import type { EvmChainConfig } from "@/lib/chains";
import { cn } from "@/lib/cn";

export function ChainBadge({ chain, className }: { chain: EvmChainConfig; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        borderColor: `${chain.color}4D`,
        backgroundColor: `${chain.color}1A`,
        color: chain.color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chain.color }} />
      {chain.chainName}
    </span>
  );
}
