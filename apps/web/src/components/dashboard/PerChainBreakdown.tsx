import type { PerChainStats } from "@/hooks";
import { Card, CardHeader, CardTitle, CardDescription, ChainBadge, Badge, Skeleton } from "@/components/ui";
import { formatCount, formatUsdc } from "@/lib/format";

export function PerChainBreakdown({ perChain, loading }: { perChain: PerChainStats[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Per-Chain Breakdown</CardTitle>
        <CardDescription>Agent and job activity on each deployed network.</CardDescription>
      </CardHeader>

      <div className="flex flex-col divide-y divide-border-subtle/60 px-1">
        {perChain.map(({ chain, stats, deployed }) => (
          <div
            key={chain.chainId}
            className="group relative flex items-center justify-between gap-4 px-4 py-4 transition-colors duration-150 hover:bg-white/[0.02]"
          >
            {/* Chain color left accent */}
            <div
              className="absolute left-0 top-1/4 bottom-1/4 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ backgroundColor: chain.color, boxShadow: `0 0 8px ${chain.color}` }}
            />

            <ChainBadge chain={chain} />

            {loading ? (
              <Skeleton className="h-5 w-44" />
            ) : !deployed ? (
              <Badge variant="default">Not deployed yet</Badge>
            ) : (
              <div className="flex items-center gap-5 text-sm text-text-secondary">
                <span>
                  <span className="font-semibold text-text-primary">{formatCount(stats!.totalAgents)}</span>
                  <span className="ml-1 text-xs">agents</span>
                </span>
                <span>
                  <span className="font-semibold text-text-primary">{formatCount(stats!.totalJobs)}</span>
                  <span className="ml-1 text-xs">jobs</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
