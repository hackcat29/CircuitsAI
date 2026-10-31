"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Candle {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
}

const TIMEFRAMES: { label: string; intervalMinutes: number }[] = [
  { label: "15m", intervalMinutes: 15 },
  { label: "1H", intervalMinutes: 60 },
  { label: "4H", intervalMinutes: 240 },
  { label: "1D", intervalMinutes: 1440 },
];

const REFRESH_MS = 15_000; // matches RecentTrades' own "semi-live" polling cadence
const LIVE_TICK_MS = 5_000; // just re-derives the synthetic "now" bar's bucket, no network call

/** PRICE_PRECISION-scaled (1e6 USDC decimals * 1e12, see lib/bondingCurve.ts) — same convention
 * as LaunchDetail.priceUsdc / lib/format.ts's formatTokenPrice — converted here to the same
 * plain-dollars-per-token domain the candle series already renders in (candles/route.ts's raw
 * value is only USDC-6dec-per-token, a different, smaller scale — see that route's doc comment). */
function priceUsdcToChartValue(priceUsdc: string): number {
  return Number(priceUsdc) / 1_000_000 / 1_000_000_000_000;
}

/** Area price chart, powered by TradingView's lightweight-charts — fed by
 * GET /api/launchpad/[launchChainId]/candles, which buckets the raw LaunchTrade ledger on read
 * (see that route's doc comment). A launch with few trades renders a sparse chart rather than
 * fabricated OHLC precision — that's an honest reflection of how little has actually traded.
 * Deliberately an area/line series through each bucket's close price, not a candlestick series:
 * with only a handful of trades ever (the norm for an early-stage bonding curve, not an edge
 * case), most buckets hold exactly one trade — a candlestick degenerates to a doji (a thin,
 * near-invisible dash) for those, and a bucket spanning a wide gap since the last trade (see the
 * synthetic "now" point below) renders as one oversized, alarming-looking box. A connected line
 * has no such degenerate cases — it reads correctly whether there's 1 trade or 1,000.
 * Once at least one real trade exists, a synthetic point is appended at the current bucket using
 * the live curve price (`priceUsdc`) — without it, the line would just stop dead at the last
 * trade's timestamp, which reads as "price stopped existing" rather than "nobody's traded
 * since." The synthetic point never overwrites a real trade's own bucket. */
export function PriceChart({
  launchChainId,
  chainSlug,
  priceUsdc,
  graduated = false,
}: {
  launchChainId: string;
  chainSlug: string;
  priceUsdc: string;
  graduated?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [chartSource, setChartSource] = useState<"dex" | "curve">(graduated ? "dex" : "curve");
  const [liveTick, setLiveTick] = useState(0);

  // Keep chartSource aligned if graduated status changes
  useEffect(() => {
    if (graduated) {
      setChartSource("dex");
    }
  }, [graduated]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    function load() {
      fetch(`/api/launchpad/${launchChainId}/candles?chain=${chainSlug}&intervalMinutes=${intervalMinutes}&source=${chartSource}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
        .then((data: { candles: Candle[]; graduated?: boolean }) => {
          if (!cancelled) setCandles(data.candles);
        })
        .catch(() => {
          if (!cancelled) setCandles([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [launchChainId, chainSlug, intervalMinutes, chartSource]);

  // Purely local ticking so the synthetic "now" bar's bucket keeps advancing between the
  // REFRESH_MS server refetches above — no network call, just a re-render.
  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => t + 1), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Chart + series are created once and reused — recreating them on every data refresh would
  // discard the user's own zoom/scroll position on each refetch.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#80858f" },
      grid: { vertLines: { color: "#23262e" }, horzLines: { color: "#23262e" } },
      width: containerRef.current.clientWidth,
      height: 360,
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "#23262e" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: "#1fd487",
      lineWidth: 2,
      topColor: "rgba(31, 212, 135, 0.28)",
      bottomColor: "rgba(31, 212, 135, 0)",
      // lightweight-charts' own default price format is 2 decimal places — fine for a fiat-like
      // price, useless for an early-stage bonding-curve token that routinely trades at a small
      // fraction of a cent (e.g. $0.000004). Every value would round to "0.00", the series would
      // read as flat, and the chart falls back to an arbitrary autoscaled range instead of one
      // that fits the real (tiny) data — exactly what a low-precision price format produces.
      // precision: 10 matches lib/format.ts's formatTokenPrice, this app's own established
      // ceiling for how small a price this UI ever needs to show.
      priceFormat: { type: "price", precision: 10, minMove: 0.0000000001 },
    });

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    // One point per bucket, at its close price — see this component's own doc comment for why
    // that (not a candlestick per bucket) is what actually reads correctly for a sparsely-traded
    // launch. candles/route.ts returns PRICE_PRECISION-scaled values (same convention as
    // `priceUsdc` below) — same conversion via priceUsdcToChartValue, not a bare /1e6.
    const points = candles.map((c) => ({ time: c.time as UTCTimestamp, value: priceUsdcToChartValue(c.close) }));

    const livePrice = priceUsdcToChartValue(priceUsdc);
    if (points.length > 0 && livePrice > 0 && (!graduated || chartSource === "dex")) {
      const intervalSeconds = intervalMinutes * 60;
      const nowBucket = Math.floor(Date.now() / 1000 / intervalSeconds) * intervalSeconds;
      const lastPoint = points[points.length - 1];
      if (nowBucket > lastPoint.time) {
        points.push({ time: nowBucket as UTCTimestamp, value: livePrice });
      } else if (nowBucket === lastPoint.time) {
        lastPoint.value = livePrice;
      }
    }

    seriesRef.current.setData(points);
    chartRef.current?.timeScale().fitContent();
    // liveTick isn't read directly — it just re-triggers this effect so the synthetic point's
    // bucket (computed from Date.now() above) advances between server refetches.
  }, [candles, priceUsdc, intervalMinutes, liveTick, graduated, chartSource]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              type="button"
              onClick={() => setIntervalMinutes(tf.intervalMinutes)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                tf.intervalMinutes === intervalMinutes ? "bg-white/10 text-text-primary" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {graduated && (
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => setChartSource("dex")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                chartSource === "dex"
                  ? "bg-emerald-500/20 text-emerald-400 font-semibold shadow-xs"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              DEX Pool
            </button>
            <button
              type="button"
              onClick={() => setChartSource("curve")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                chartSource === "curve"
                  ? "bg-white/10 text-text-primary font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              Curve History
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        {loading && <Skeleton className="absolute inset-0 h-90 w-full" />}
        <div ref={containerRef} className="h-90 w-full" />
        {!loading && candles.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-text-tertiary">No trades yet. Chart fills in once trading starts.</p>
        )}
      </div>
    </div>
  );
}
