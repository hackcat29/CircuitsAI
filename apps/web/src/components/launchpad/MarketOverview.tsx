import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { formatUsdc, formatCount } from "@/lib/format";
import type { LaunchDetail } from "@/hooks";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/** FDV / Market Cap / Liq. / Holders / 24h Vol — the Virtuals reference's "Market Overview"
 * panel, plus Market Cap alongside FDV: the two answer different questions (fully-diluted
 * ceiling vs. what's actually bought so far) and can diverge a lot on a curve where most of the
 * fixed 1B supply hasn't sold yet, so showing only one is misleading rather than simpler.
 * Neither is ever the graduation gate, which is ClawdHQLaunchpad.sol's usdcRaised threshold —
 * see the Launchpad rebuild plan's decision on this. Liquidity is the curve's own USDC reserve
 * pre-graduation, or the real Xero pool's USDC reserve afterward (see the detail API route's
 * doc comment on why that live read is scoped to this one page rather than the full sortable
 * list). */
export function MarketOverview({ launch }: { launch: LaunchDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Market Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="FDV" value={formatUsdc(BigInt(launch.fdvUsdc))} />
        <Stat label="Market Cap" value={formatUsdc(BigInt(launch.marketCapUsdc))} />
        <Stat label="Liq." value={launch.liquidityUsdc ? formatUsdc(BigInt(launch.liquidityUsdc)) : "···"} />
        <Stat label="Holders" value={formatCount(BigInt(launch.holdersCount))} />
        <Stat label="Network" value="Monad" />
      </CardContent>
    </Card>
  );
}
