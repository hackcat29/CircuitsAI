"use client";

import { useEffect, useRef, memo } from "react";

interface TradingViewPerpChartProps {
  symbol?: string; // e.g. "BTC-USDC", "ETH-USDC", "SOL-USDC"
  baseAsset?: string; // e.g. "BTC", "ETH", "SOL"
  height?: number | string;
  interval?: string;
  theme?: "dark" | "light";
}

function resolveTradingViewSymbol(baseAsset?: string, symbol?: string): string {
  const asset = (baseAsset || symbol?.split("-")[0] || "BTC").toUpperCase();
  const symbolMap: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    SUI: "BINANCE:SUIUSDT",
    AVAX: "BINANCE:AVAXUSDT",
    DOGE: "BINANCE:DOGEUSDT",
    ARB: "BINANCE:ARBUSDT",
    LINK: "BINANCE:LINKUSDT",
    OP: "BINANCE:OPUSDT",
    NEAR: "BINANCE:NEARUSDT",
    PEPE: "BINANCE:PEPEUSDT",
    BNB: "BINANCE:BNBUSDT",
  };

  return symbolMap[asset] || `BINANCE:${asset}USDT`;
}

export const TradingViewPerpChart = memo(function TradingViewPerpChart({
  symbol = "BTC-USDC",
  baseAsset = "BTC",
  height = 420,
  interval = "15",
  theme = "dark",
}: TradingViewPerpChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = resolveTradingViewSymbol(baseAsset, symbol);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "rgba(8, 9, 12, 1)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol, interval, theme]);

  return (
    <div
      ref={containerRef}
      id="tradingview_perp_chart_container"
      className="tradingview-widget-container w-full rounded-[12px] overflow-hidden border border-border-subtle bg-bg-surface"
      style={{ height: typeof height === "number" ? `${height}px` : height, minHeight: "360px" }}
    />
  );
});
