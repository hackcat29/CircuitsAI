"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { formatCount } from "@/lib/format";

const COLOR_LOCKED = "#1fd487";
const COLOR_CIRCULATING = "#80858f";

interface Segment {
  name: string;
  value: number;
  color: string;
}

/** Fixed 100%-fair-launch tokenomics (no creator pre-allocation — see
 * ClawdHQLaunchpad.sol's contract-level doc comment), so this is mostly a presentational split
 * rather than a data-heavy chart: pre-graduation, whatever's still on the bonding curve vs.
 * already sold to holders; post-graduation, the permanently-locked Xero liquidity vs.
 * circulating supply (tokensSold/totalSupply are frozen at their graduation-time values —
 * bonding-curve trading itself stops the moment a launch graduates). */
export function TokenomicsDonut({ totalSupply, tokensSold, graduated }: { totalSupply: bigint; tokensSold: bigint; graduated: boolean }) {
  const sold = Number(tokensSold / 1_000_000_000_000_000_000n);
  const total = Number(totalSupply / 1_000_000_000_000_000_000n);
  const remaining = total - sold;

  const segments: Segment[] = graduated
    ? [
        { name: "DEX Liquidity (Locked)", value: remaining, color: COLOR_LOCKED },
        { name: "Circulating", value: sold, color: COLOR_CIRCULATING },
      ]
    : [
        { name: "Bonding Curve", value: remaining, color: COLOR_LOCKED },
        { name: "Circulating", value: sold, color: COLOR_CIRCULATING },
      ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tokenomics</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={segments} dataKey="value" nameKey="name" innerRadius={38} outerRadius={56} paddingAngle={2} stroke="none">
                {segments.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCount(BigInt(Math.round(Number(value))))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {segments.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-text-secondary">{s.name}</span>
              <span className="font-medium text-text-primary">
                {total > 0 ? (s.value / total) * 100 < 0.1 && s.value > 0 ? "<0.1%" : `${((s.value / total) * 100).toFixed(1)}%` : "···"}
              </span>
            </div>
          ))}
          <span className="text-xs text-text-tertiary">Total supply: {formatCount(totalSupply / 1_000_000_000_000_000_000n)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
