"use client";

import Link from "next/link";
import { Flame, ArrowRight, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton } from "@/components/ui";
import { useLaunchpadList, useWallet } from "@/hooks";
import { formatUsdc, formatTokenPrice, formatPriceChangeBps } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

export function TrendingLaunchesDashboardCard() {
  const { launches, loading } = useLaunchpadList("trending", 5);
  const { chain } = useWallet();

  const top5 = launches.slice(0, 5);

  return (
    <Card className="border-border-subtle bg-bg-elevated shadow-xs flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#FF5C28]/15 text-[#FF5C28]">
              <Flame className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-[14px] font-extrabold text-text-primary tracking-tight">
              Trending Launches
            </CardTitle>
          </div>

          <Link
            href="/launchpad"
            className="text-[11.5px] font-bold text-accent-violet hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : top5.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center flex flex-col items-center justify-center gap-2 my-auto">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-surface3 text-text-tertiary">
              <Flame className="h-4 w-4 text-[#FF5C28]" />
            </div>
            <div className="text-[13px] font-bold text-text-primary">No active launches yet</div>
            <p className="text-[11.5px] text-text-tertiary max-w-xs">
              Be the first to launch an autonomous agent token on {chain.chainName}.
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/launchpad?create=1">Launch Token</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {top5.map((launch, idx) => {
              const usdcRaisedBigInt = BigInt(launch.usdcRaised || "0");
              const thresholdBigInt = BigInt(launch.graduationThreshold || "1");
              const progressPct =
                thresholdBigInt > 0n
                  ? Math.min(100, Math.round(Number((usdcRaisedBigInt * 10000n) / thresholdBigInt) / 100))
                  : 0;

              return (
                <div
                  key={launch.launchChainId}
                  className="group p-2.5 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-raised hover:border-border-strong transition-all flex items-center justify-between gap-3 shadow-2xs"
                >
                  {/* Left: Rank, Symbol & Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-mono text-[11px] font-bold text-text-quaternary w-3.5 text-center shrink-0">
                      #{idx + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={robotAvatarUrl(launch.token || launch.name || launch.symbol)}
                      alt={launch.name}
                      className="h-8 w-8 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/app/launchpad/${launch.launchChainId}`}
                          className="font-bold text-text-primary text-[12.5px] truncate hover:text-accent-violet transition-colors"
                        >
                          {launch.name}
                        </Link>
                        <span className="text-[10px] font-mono text-text-quaternary font-bold">
                          ${launch.symbol}
                        </span>
                        {launch.graduated && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald/10 text-emerald border border-emerald/20 font-bold shrink-0">
                            DEX
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-text-quaternary flex items-center gap-2 mt-0.5">
                        <span>Raised: {formatUsdc(usdcRaisedBigInt)}</span>
                        <span>•</span>
                        <span className="text-accent-cyan font-mono">{progressPct}% Bonded</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Quick Buy Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-[12px] text-text-primary">
                        {formatTokenPrice(launch.priceUsdc)}
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          launch.priceChangeBps7d !== null && launch.priceChangeBps7d >= 0
                            ? "text-emerald"
                            : launch.priceChangeBps7d !== null
                            ? "text-red-400"
                            : "text-text-quaternary",
                        )}
                      >
                        {formatPriceChangeBps(launch.priceChangeBps7d)}
                      </div>
                    </div>

                    <Link
                      href={`/app/launchpad/${launch.launchChainId}`}
                      className="px-2.5 py-1 rounded-[7px] bg-[#FF5C28] text-white text-[11px] font-extrabold hover:brightness-110 active:scale-98 transition-all flex items-center gap-1 shadow-xs"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      <span>Buy</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-border-subtle/60 flex items-center justify-end text-xs">
          <Link
            href="/launchpad"
            className="text-[11.5px] font-bold text-accent-violet hover:underline flex items-center gap-1"
          >
            <span>Explore All Markets</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
