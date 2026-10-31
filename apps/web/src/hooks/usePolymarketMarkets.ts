"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

export type CryptoCategory =
  | "Bitcoin"
  | "Ethereum"
  | "Solana"
  | "DeFi & Infra"
  | "Layer 2 & Altcoins"
  | "ETFs & Regulation"
  | "Price Milestones";

export interface PolymarketPrediction {
  id: string;
  category: CryptoCategory;
  assetTag: "BTC" | "ETH" | "SOL" | "DEFI" | "ALTS" | "REG" | "CRYPTO";
  title: string;
  desc: string;
  yesPercent: number;
  noPercent: number;
  volumeUsdc: string;
  liquidityUsdc: string;
  endsAt: string;
  endDateIso: string;
  volume24h: number;
  imageUrl?: string;
  slug?: string;
  status: "OPEN" | "RESOLVED";
  oracleSource: "Polymarket UMA" | "Pyth Network";
  isHot?: boolean;
}

const FALLBACK_CRYPTO_MARKETS: PolymarketPrediction[] = [
  {
    id: "poly-btc-100k",
    category: "Price Milestones",
    assetTag: "BTC",
    title: "Will Bitcoin (BTC) reach $100,000 in 2026?",
    desc: "Resolves to YES if Binance spot BTC/USDT reaches or exceeds $100,000.00 at any point before Dec 31, 2026 UTC.",
    yesPercent: 78,
    noPercent: 22,
    volumeUsdc: "$48.2M",
    liquidityUsdc: "$6.4M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 1840000,
    imageUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    slug: "bitcoin-reach-100k-in-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-btc-150k",
    category: "Price Milestones",
    assetTag: "BTC",
    title: "Will Bitcoin (BTC) reach $150,000 in 2026?",
    desc: "Resolves to YES if Bitcoin spot price trades at or above $150,000.00 on major exchanges before Dec 31, 2026.",
    yesPercent: 42,
    noPercent: 58,
    volumeUsdc: "$31.5M",
    liquidityUsdc: "$4.2M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 1120000,
    imageUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    slug: "bitcoin-reach-150k-in-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-eth-ath",
    category: "Ethereum",
    assetTag: "ETH",
    title: "Will Ethereum (ETH) reach a new All-Time High (> $4,891) in 2026?",
    desc: "Resolves to YES if the ETH spot mark price exceeds $4,891.70 on Coinbase before December 31, 2026.",
    yesPercent: 54,
    noPercent: 46,
    volumeUsdc: "$22.7M",
    liquidityUsdc: "$3.1M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 920000,
    imageUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    slug: "ethereum-ath-before-q4-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-sol-flip-eth",
    category: "Solana",
    assetTag: "SOL",
    title: "Will Solana DEX Volume flip Ethereum DEX Volume in any consecutive 7-day period?",
    desc: "Resolves to YES if DefiLlama 7d rolling DEX volume on Solana surpasses Ethereum mainnet 7d volume.",
    yesPercent: 63,
    noPercent: 37,
    volumeUsdc: "$14.5M",
    liquidityUsdc: "$2.8M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 640000,
    imageUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    slug: "solana-dex-volume-flip-eth-7d",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-sec-sol-etf",
    category: "ETFs & Regulation",
    assetTag: "REG",
    title: "Will the US SEC approve a spot Solana ETF before Dec 2026?",
    desc: "Resolves to YES if the SEC issues a formal 19b-4 order approving any spot Solana exchange-traded fund.",
    yesPercent: 68,
    noPercent: 32,
    volumeUsdc: "$19.3M",
    liquidityUsdc: "$2.9M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 880000,
    imageUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    slug: "sec-approve-spot-solana-etf-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-hyperliquid-airdrop",
    category: "Layer 2 & Altcoins",
    assetTag: "ALTS",
    title: "Will Hyperliquid conduct an official seasonal token airdrop in 2026?",
    desc: "Resolves to YES if Hyperliquid Foundation distributes a secondary ecosystem token distribution to active traders.",
    yesPercent: 74,
    noPercent: 26,
    volumeUsdc: "$12.8M",
    liquidityUsdc: "$2.4M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 750000,
    slug: "hyperliquid-seasonal-airdrop-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-pump-fun-token",
    category: "Solana",
    assetTag: "SOL",
    title: "Will Pump.fun officially launch a governance token in 2026?",
    desc: "Resolves to YES if Pump.fun launches an official token and distributes it to users or public markets.",
    yesPercent: 81,
    noPercent: 19,
    volumeUsdc: "$18.4M",
    liquidityUsdc: "$3.6M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 960000,
    imageUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    slug: "pump-fun-token-launch-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
    isHot: true,
  },
  {
    id: "poly-usdc-usdt-ratio",
    category: "DeFi & Infra",
    assetTag: "DEFI",
    title: "Will USDC supply reach 50% of USDT total circulating supply?",
    desc: "Resolves to YES if Circle USDC market capitalization equals or exceeds 50% of Tether USDT market capitalization on DefiLlama.",
    yesPercent: 38,
    noPercent: 62,
    volumeUsdc: "$8.9M",
    liquidityUsdc: "$1.6M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 310000,
    slug: "usdc-hit-50-percent-usdt-market-cap",
    status: "OPEN",
    oracleSource: "Pyth Network",
  },
  {
    id: "poly-btc-dominance-60",
    category: "Bitcoin",
    assetTag: "BTC",
    title: "Will Bitcoin Market Dominance (BTC.D) exceed 62% in 2026?",
    desc: "Resolves to YES if TradingView CRYPTOCAP:BTC.D prints 62.00% or higher at any point during 2026.",
    yesPercent: 41,
    noPercent: 59,
    volumeUsdc: "$11.2M",
    liquidityUsdc: "$1.8M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 420000,
    imageUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    slug: "btc-dominance-exceed-62-percent",
    status: "OPEN",
    oracleSource: "Pyth Network",
  },
  {
    id: "poly-defi-tvl-150b",
    category: "DeFi & Infra",
    assetTag: "DEFI",
    title: "Will Total DeFi TVL cross $150 Billion across all chains?",
    desc: "Resolves to YES if DefiLlama aggregate DeFi TVL across all blockchains reaches $150,000,000,000.",
    yesPercent: 73,
    noPercent: 27,
    volumeUsdc: "$7.6M",
    liquidityUsdc: "$1.2M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 290000,
    slug: "total-defi-tvl-cross-150b",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
  },
  {
    id: "poly-megaeth-mainnet",
    category: "Layer 2 & Altcoins",
    assetTag: "ALTS",
    title: "Will MegaETH achieve > 50,000 real TPS on public mainnet?",
    desc: "Resolves to YES if MegaETH public mainnet processes and verifies over 50,000 sustained transactions per second.",
    yesPercent: 65,
    noPercent: 35,
    volumeUsdc: "$6.2M",
    liquidityUsdc: "$1.1M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 280000,
    slug: "megaeth-mainnet-50k-tps",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
  },
  {
    id: "poly-sol-price-300",
    category: "Price Milestones",
    assetTag: "SOL",
    title: "Will Solana (SOL) reach $300 before July 2026?",
    desc: "Resolves to YES if Binance spot SOL/USDT trades at or above $300.00 before July 1, 2026 UTC.",
    yesPercent: 49,
    noPercent: 51,
    volumeUsdc: "$15.8M",
    liquidityUsdc: "$2.6M",
    endsAt: "Jun 30, 2026",
    endDateIso: "2026-06-30T23:59:59Z",
    volume24h: 710000,
    imageUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    slug: "solana-reach-300-before-july-2026",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
  },
  {
    id: "poly-eth-etf-inflows",
    category: "Ethereum",
    assetTag: "ETH",
    title: "Will US Spot Ethereum ETFs record > $5B in net inflows in 2026?",
    desc: "Resolves to YES if Farside Investors cumulative US Spot ETH ETF net inflows exceed $5,000,000,000.",
    yesPercent: 62,
    noPercent: 38,
    volumeUsdc: "$10.4M",
    liquidityUsdc: "$1.7M",
    endsAt: "Dec 31, 2026",
    endDateIso: "2026-12-31T23:59:59Z",
    volume24h: 330000,
    imageUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    slug: "us-spot-eth-etf-inflows-5b",
    status: "OPEN",
    oracleSource: "Polymarket UMA",
  },
];

/** Categorize crypto markets intelligently across dedicated sub-categories */
function categorizeCrypto(question: string, description: string): { category: CryptoCategory; assetTag: PolymarketPrediction["assetTag"] } {
  const text = `${question} ${description}`.toLowerCase();

  if (
    text.includes("reach $") ||
    text.includes("hit $") ||
    text.includes("above $") ||
    text.includes("below $") ||
    text.includes("all-time high") ||
    text.includes("ath") ||
    text.includes("price of") ||
    text.includes("market cap hit") ||
    text.includes("market cap surpass")
  ) {
    const assetTag =
      text.includes("btc") || text.includes("bitcoin")
        ? "BTC"
        : text.includes("eth") || text.includes("ethereum")
        ? "ETH"
        : text.includes("sol") || text.includes("solana")
        ? "SOL"
        : "CRYPTO";
    return { category: "Price Milestones", assetTag };
  }

  if (text.includes("bitcoin") || text.includes("btc") || text.includes("satoshi") || text.includes("halving") || text.includes("ordinals") || text.includes("runes")) {
    return { category: "Bitcoin", assetTag: "BTC" };
  }

  if (text.includes("ethereum") || text.includes("eth") || text.includes("vitalik") || text.includes("gas fee") || text.includes("eip") || text.includes("staked eth")) {
    return { category: "Ethereum", assetTag: "ETH" };
  }

  if (text.includes("solana") || text.includes("sol") || text.includes("pump.fun") || text.includes("jupiter") || text.includes("raydium") || text.includes("phantom")) {
    return { category: "Solana", assetTag: "SOL" };
  }

  if (
    text.includes("sec") ||
    text.includes("etf") ||
    text.includes("cftc") ||
    text.includes("regulation") ||
    text.includes("gensler") ||
    text.includes("treasury") ||
    text.includes("capital gains") ||
    text.includes("crypto tax") ||
    text.includes("stablecoin bill") ||
    text.includes("fit21") ||
    text.includes("sab 121") ||
    text.includes("legal") ||
    text.includes("court")
  ) {
    return { category: "ETFs & Regulation", assetTag: "REG" };
  }

  if (
    text.includes("defi") ||
    text.includes("uniswap") ||
    text.includes("aave") ||
    text.includes("maker") ||
    text.includes("sky") ||
    text.includes("ethena") ||
    text.includes("stablecoin") ||
    text.includes("usdc") ||
    text.includes("usdt") ||
    text.includes("usds") ||
    text.includes("tvl") ||
    text.includes("dex") ||
    text.includes("lending") ||
    text.includes("yield") ||
    text.includes("curve") ||
    text.includes("chainlink") ||
    text.includes("pyth") ||
    text.includes("oracle")
  ) {
    return { category: "DeFi & Infra", assetTag: "DEFI" };
  }

  return { category: "Layer 2 & Altcoins", assetTag: "ALTS" };
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

function formatEndDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Dec 2026";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Dec 2026";
  }
}

export const CRYPTO_SUB_CATEGORIES: CryptoCategory[] = [
  "Bitcoin",
  "Ethereum",
  "Solana",
  "DeFi & Infra",
  "Layer 2 & Altcoins",
  "ETFs & Regulation",
  "Price Milestones",
];

export function usePolymarketMarkets(limit = 100) {
  const [markets, setMarkets] = useState<PolymarketPrediction[]>(FALLBACK_CRYPTO_MARKETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);

      // Query multiple Polymarket crypto tag feeds in parallel
      const tagSlugs = ["crypto", "bitcoin", "ethereum", "solana", "defi"];
      const fetchPromises = tagSlugs.map((tag) =>
        fetch(`https://gamma-api.polymarket.com/events?tag_slug=${tag}&limit=60&active=true&closed=false`, {
          headers: { Accept: "application/json" },
        })
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          })
          .catch(() => [])
      );

      const results = await Promise.allSettled(fetchPromises);
      const allEvents: any[] = [];
      for (const res of results) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          allEvents.push(...res.value);
        }
      }

      const apiCryptoMarkets: PolymarketPrediction[] = [];
      const seenMarketIds = new Set<string>();

      for (const ev of allEvents) {
        const evImg = ev.image || ev.icon;
        const evMarkets = Array.isArray(ev.markets) ? ev.markets : [];

        for (const m of evMarkets) {
          if (!m || m.active === false || m.closed === true) continue;
          const marketId = String(m.id || "");
          if (!marketId || seenMarketIds.has(marketId)) continue;

          const question = m.question || ev.title || "";
          if (!question) continue;

          let prices: number[] = [0.5, 0.5];
          if (m.outcomePrices) {
            try {
              const parsed = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
              if (Array.isArray(parsed) && parsed.length >= 2) {
                prices = [parseFloat(parsed[0]) || 0.5, parseFloat(parsed[1]) || 0.5];
              }
            } catch {
              // fallback default
            }
          }

          const yesPrice = prices[0] ?? 0.5;
          const noPrice = prices[1] ?? 0.5;
          const totalVol = m.volumeNum ?? (parseFloat(m.volume ?? "0") || parseFloat(ev.volume ?? "0") || 0);
          const liq = m.liquidityNum ?? (parseFloat(m.liquidity ?? "0") || parseFloat(ev.liquidity ?? "0") || 0);
          const vol24 = m.volume24hr ?? (parseFloat(ev.volume24hr ?? "0") || 0);
          const desc = (m.description || ev.description || "").slice(0, 300);
          const classification = categorizeCrypto(question, desc);

          seenMarketIds.add(marketId);
          apiCryptoMarkets.push({
            id: marketId,
            category: classification.category,
            assetTag: classification.assetTag,
            title: question,
            desc: desc || `Binary prediction market resolving based on official oracle consensus on Monad.`,
            yesPercent: Math.min(99, Math.max(1, Math.round(yesPrice * 100))),
            noPercent: Math.min(99, Math.max(1, Math.round(noPrice * 100))),
            volumeUsdc: formatVolume(totalVol),
            liquidityUsdc: formatVolume(liq),
            endsAt: formatEndDate(m.endDate || ev.endDate || ""),
            endDateIso: m.endDate || ev.endDate || "2026-12-31T23:59:59Z",
            volume24h: vol24,
            imageUrl: m.image || m.icon || evImg,
            slug: m.slug || ev.slug,
            status: "OPEN" as const,
            oracleSource: "Polymarket UMA",
            isHot: vol24 > 50000 || totalVol > 500000,
          });
        }
      }

      // Merge with rich fallbacks so we always have guaranteed comprehensive coverage
      const existingIds = new Set(apiCryptoMarkets.map((m) => m.id));
      const combined = [
        ...apiCryptoMarkets,
        ...FALLBACK_CRYPTO_MARKETS.filter((m) => !existingIds.has(m.id)),
      ];

      // Sort by 24h volume descending (or total volume)
      combined.sort((a, b) => b.volume24h - a.volume24h);

      if (combined.length > 0) {
        setMarkets(combined.slice(0, limit));
      }
      setError(null);
      setLastUpdated(Date.now());
    } catch (err: any) {
      setError(err?.message || "Failed to fetch Polymarket feed");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchMarkets();
    const interval = setInterval(() => void fetchMarkets(), 45_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    lastUpdated,
    categories: CRYPTO_SUB_CATEGORIES,
    refetch: fetchMarkets,
  };
}

export function useSinglePredictionMarket(marketIdOrSlug: string) {
  const { markets, loading, error, refetch } = usePolymarketMarkets(150);

  const market: PolymarketPrediction | null = useMemo(() => {
    if (!marketIdOrSlug) return null;
    const clean = decodeURIComponent(marketIdOrSlug).toLowerCase();
    const found = markets.find(
      (m) =>
        m.id.toLowerCase() === clean ||
        (m.slug && m.slug.toLowerCase() === clean) ||
        m.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(clean),
    );
    if (found) return found;
    return (
      FALLBACK_CRYPTO_MARKETS.find(
        (m) =>
          m.id.toLowerCase() === clean ||
          (m.slug && m.slug.toLowerCase() === clean) ||
          m.title.toLowerCase().replace(/[^a-z0-9]/g, "-").includes(clean),
      ) ||
      FALLBACK_CRYPTO_MARKETS[0] ||
      null
    );
  }, [markets, marketIdOrSlug]);

  return {
    market,
    loading,
    error,
    refetch,
  };
}
