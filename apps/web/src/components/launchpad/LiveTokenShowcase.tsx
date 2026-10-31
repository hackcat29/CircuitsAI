"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLaunchpadList, type LaunchpadListItem } from "@/hooks/useLaunchpadList";
import { formatUsdc, formatPriceChangeBps, formatTokenPrice } from "@/lib/format";
import { launchSlug } from "@/lib/launchSlug";
import { robotAvatarUrl } from "@/lib/avatar";
import { appUrl } from "@/lib/appUrl";

function computeProgress(launch: LaunchpadListItem): number {
  if (launch.graduated) return 100;
  try {
    const raised = BigInt(launch.usdcRaised || "0");
    const threshold = BigInt(launch.graduationThreshold || "1");
    if (threshold <= 0n) return 0;
    return Math.min(99.9, Number((raised * 10000n) / threshold) / 100);
  } catch {
    return 0;
  }
}

const FALLBACK_TOP_TOKENS = [
  {
    id: "fb-1",
    launchChainId: "1",
    agentChainId: "42",
    agentName: "Risk Sentinel",
    token: "0x1111111111111111111111111111111111111111",
    name: "Risk Sentinel",
    symbol: "RSNT",
    creator: "0x7a3F...c91D",
    totalSupply: "1000000000000000000000000000",
    usdcRaised: "1850000000",
    tokensSold: "720000000000000000000000000",
    graduationThreshold: "2900000000",
    graduated: false,
    active: true,
    tradingStartsAt: "2026-01-01T00:00:00Z",
    createdAtChain: "2026-01-01T00:00:00Z",
    graduatedAtChain: null,
    priceUsdc: "0.000084",
    fdvUsdc: "84000000000",
    marketCapUsdc: "84000000000",
    volume24hUsdc: "8240000000",
    priceChangeBps24h: 540,
    priceChangeBps7d: 540,
    holdersCount: 48,
  },
  {
    id: "fb-2",
    launchChainId: "2",
    agentChainId: "18",
    agentName: "Alpha Research",
    token: "0x2222222222222222222222222222222222222222",
    name: "Alpha Research",
    symbol: "ALPHA",
    creator: "0x8b2A...19E2",
    totalSupply: "1000000000000000000000000000",
    usdcRaised: "2450000000",
    tokensSold: "910000000000000000000000000",
    graduationThreshold: "2900000000",
    graduated: false,
    active: true,
    tradingStartsAt: "2026-01-01T00:00:00Z",
    createdAtChain: "2026-01-01T00:00:00Z",
    graduatedAtChain: null,
    priceUsdc: "0.000142",
    fdvUsdc: "142000000000",
    marketCapUsdc: "142000000000",
    volume24hUsdc: "24800000000",
    priceChangeBps24h: 1280,
    priceChangeBps7d: 1280,
    holdersCount: 112,
  },
  {
    id: "fb-3",
    launchChainId: "3",
    agentChainId: "9",
    agentName: "Sentinel Shield",
    token: "0x3333333333333333333333333333333333333333",
    name: "Sentinel Shield",
    symbol: "AUDIT",
    creator: "0x4C91...88F4",
    totalSupply: "1000000000000000000000000000",
    usdcRaised: "2900000000",
    tokensSold: "1000000000000000000000000000",
    graduationThreshold: "2900000000",
    graduated: true,
    active: true,
    tradingStartsAt: "2026-01-01T00:00:00Z",
    createdAtChain: "2026-01-01T00:00:00Z",
    graduatedAtChain: "2026-01-02T00:00:00Z",
    priceUsdc: "0.000318",
    fdvUsdc: "318000000000",
    marketCapUsdc: "318000000000",
    volume24hUsdc: "62100000000",
    priceChangeBps24h: 2450,
    priceChangeBps7d: 2450,
    holdersCount: 384,
  },
];

export function LiveTokenShowcase() {
  const { launches, loading } = useLaunchpadList("top", 10);

  const topThreeTokens = useMemo(() => {
    if (launches && launches.length >= 3) {
      // Sort by FDV descending, take top 3
      return [...launches]
        .sort((a, b) => (Number(b.fdvUsdc || 0) - Number(a.fdvUsdc || 0)))
        .slice(0, 3);
    }
    if (launches && launches.length > 0) {
      return [...launches, ...FALLBACK_TOP_TOKENS].slice(0, 3);
    }
    return FALLBACK_TOP_TOKENS;
  }, [launches]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {topThreeTokens.map((token, idx) => {
        const progress = computeProgress(token);
        const isGraduated = token.graduated;
        const targetUrl = appUrl(
          `/launchpad/${launchSlug(token.symbol, token.launchChainId || token.id)}`
        );

        return (
          <div
            key={token.id || token.symbol}
            className="bg-bg-elevated border border-border-strong rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-border-hover transition-all group"
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={robotAvatarUrl(token.token)}
                    alt=""
                    className="h-8 w-8 rounded-lg border border-border-strong object-cover bg-bg-surface3 shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[17px] font-black text-text-primary group-hover:text-accent-violet transition-colors truncate">
                        ${token.symbol}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                        TOP {idx + 1} FDV
                      </span>
                    </div>
                    <div className="text-[11px] text-text-quaternary truncate">
                      {token.name}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                    isGraduated
                      ? "bg-emerald/10 text-emerald border-emerald/30"
                      : "bg-accent-dark text-accent-violet border-accent-violet/30"
                  }`}
                >
                  {isGraduated ? "DEX Live" : "Bonding"}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                {/* Curve Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-text-tertiary">Curve Funding:</span>
                    <span className="font-bold text-text-primary">
                      {progress.toFixed(1)}% ({formatUsdc(BigInt(token.usdcRaised || "0"))} / {formatUsdc(BigInt(token.graduationThreshold || "0"))})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-bg-surface3 rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-[#1FD487] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(4, progress)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11.5px] font-mono bg-bg-raised p-3 rounded-xl border border-border-subtle">
                  <div>
                    <div className="text-[9.5px] text-text-quaternary uppercase">Spot Price</div>
                    <div className="font-bold text-text-primary mt-0.5">
                      {formatTokenPrice(token.priceUsdc)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] text-text-quaternary uppercase">FDV / Market Cap</div>
                    <div className="font-bold text-text-primary mt-0.5">
                      {formatUsdc(BigInt(token.fdvUsdc || token.marketCapUsdc || "0"))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] text-text-quaternary uppercase">Curve Status</div>
                    <div className="font-bold text-emerald mt-0.5">
                      {token.graduated ? "DEX Graduated" : "Bonding Active"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] text-text-quaternary uppercase">Holders</div>
                    <div className="font-bold text-accent-cyan mt-0.5">
                      {token.holdersCount || 1} Addresses
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-text-quaternary truncate">
                  Linked Agent:{" "}
                  <span className="text-text-secondary font-bold">
                    {token.agentName || `Agent #${token.agentChainId || "0"}`}
                  </span>
                </div>
              </div>
            </div>

            <Link
              href={targetUrl}
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all shadow-xs text-center"
            >
              {isGraduated ? "Trade on Uniswap →" : "Trade on Curve →"}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
