"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Plus, MessageSquare, ExternalLink, Bot } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Skeleton, Button } from "@/components/ui";
import { useLaunchDetail, useWallet } from "@/hooks";
import { formatTokenPrice, formatPriceChangeBps, truncateAddress } from "@/lib/format";
import { robotAvatarUrl } from "@/lib/avatar";
import { PriceChart } from "@/components/launchpad/PriceChart";
import { RecentTrades } from "@/components/launchpad/RecentTrades";
import { MarketOverview } from "@/components/launchpad/MarketOverview";
import { SwapWidget } from "@/components/launchpad/SwapWidget";
import { HoldersList } from "@/components/launchpad/HoldersList";
import { TokenomicsDonut } from "@/components/launchpad/TokenomicsDonut";
import { TeamPanel } from "@/components/launchpad/TeamPanel";
import { LaunchActionsBar } from "@/components/launchpad/LaunchActionsBar";
import { LaunchForum } from "@/components/launchpad/LaunchForum";
import { ShareButton } from "@/components/launchpad/ShareButton";
import { toIndexerChainSlug, isEvmChain } from "@/lib/chains";
import { launchSlug, parseLaunchSlug } from "@/lib/launchSlug";
import { UserAddressLink } from "@/components/profile";
import { cn } from "@/lib/cn";

export default function LaunchDetailPage() {
  const { launchChainId: idOrSlug } = useParams<{ launchChainId: string }>();
  const launchChainId = parseLaunchSlug(idOrSlug);
  const router = useRouter();
  const { chain } = useWallet();
  const { loading, launch, error, refetch } = useLaunchDetail(launchChainId);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<"trade" | "overview" | "intel">("trade");

  const pendingRefetchTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refetchAfterAction = useCallback(() => {
    refetch();
    pendingRefetchTimeouts.current.forEach(clearTimeout);
    pendingRefetchTimeouts.current = [2_000, 5_000, 9_000, 15_000].map((delay) => setTimeout(refetch, delay));
  }, [refetch]);
  useEffect(() => () => pendingRefetchTimeouts.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!launch) return;
    const canonical = launchSlug(launch.symbol, launch.launchChainId);
    if (idOrSlug !== canonical) router.replace(`/app/launchpad/${canonical}`);
  }, [launch, idOrSlug, router]);

  const copyContractAddress = () => {
    if (!launch?.token) return;
    navigator.clipboard.writeText(launch.token);
    setCopied(true);
    toast.success("Contract address copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const addTokenToWallet = async () => {
    if (!launch?.token || typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Web3 wallet not detected.");
      return;
    }
    try {
      await (window as any).ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: launch.token,
            symbol: launch.symbol,
            decimals: 18,
            image: robotAvatarUrl(launch.token),
          },
        },
      });
      toast.success(`$${launch.symbol} added to wallet!`);
    } catch {
      toast.error("Failed to add token to wallet.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
        <Skeleton className="h-80 rounded-[14px]" />
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5 text-center">
        <p className="text-sm text-text-secondary">{error ?? "Launch not found."}</p>
        <Link href="/app/launchpad" className="mt-2 inline-block text-[12px] text-accent-violet">
          ← Back to Launchpad
        </Link>
      </div>
    );
  }

  const priceChangeClass = launch.priceChangeBps7d !== null && launch.priceChangeBps7d < 0 ? "text-red" : "text-emerald";
  const explorerUrl = isEvmChain(chain) ? chain.explorerUrl : null;
  const creatorExplorerHref = explorerUrl ? `${explorerUrl}/address/${launch.creator}` : undefined;

  return (
    <div className="max-w-370 mx-auto px-6 pt-5.5 pb-17.5">
      <Link href="/app/launchpad" className="mb-4 inline-block text-[12px] text-text-tertiary hover:text-text-primary">
        ← Back to Launchpad
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- deterministic per-token DiceBear URL */}
          <img src={robotAvatarUrl(launch.token)} alt="" className="h-14 w-14 shrink-0 rounded-[12px] border border-border-strong object-cover bg-bg-surface3 shadow-2xs" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-extrabold text-text-primary">{launch.name}</h1>
              <span className="font-mono text-sm text-text-tertiary font-bold">${launch.symbol}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[11.5px]">
              {/* Agent */}
              {launch.agentName && (
                <span className="text-text-quaternary flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Agent: <Link href={`/agents/${launch.agentChainId}`} className="text-accent-violet hover:underline font-bold">@{launch.agentName}</Link></span>
                </span>
              )}

              {/* Creator */}
              <span className="text-text-quaternary flex items-center gap-1.5">
                <span>Creator:</span>
                <UserAddressLink
                  address={launch.creator}
                  className="font-semibold text-text-secondary hover:text-accent-violet transition-colors"
                />
              </span>

              {/* Click-to-copy Contract Address */}
              <button
                type="button"
                onClick={copyContractAddress}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle font-mono text-[10.5px] transition-colors cursor-pointer"
                title="Click to copy token contract address"
              >
                {copied ? <Check className="h-2.5 w-2.5 text-emerald" /> : <Copy className="h-2.5 w-2.5" />}
                <span>{truncateAddress(launch.token)}</span>
              </button>

              {/* Add to Wallet button */}
              <button
                type="button"
                onClick={addTokenToWallet}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[10.5px] font-semibold transition-colors cursor-pointer"
                title="Add token to MetaMask"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Add to Wallet</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {launch.agentChainId && (
            <Link
              href={`/app/terminal?agent=${launch.agentChainId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-accent-dark text-accent-violet border border-accent-violet/30 text-xs font-bold hover:bg-accent-violet hover:text-white transition-all shadow-2xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat in Terminal</span>
            </Link>
          )}
          {launch.graduated ? (
            <Badge variant="emerald">Graduated</Badge>
          ) : new Date(launch.tradingStartsAt).getTime() > Date.now() ? (
            <Badge variant="amber">Scheduled</Badge>
          ) : (
            <Badge variant="cyan">Bonding</Badge>
          )}
          <ShareButton name={launch.name} symbol={launch.symbol} token={launch.token} />
        </div>
      </div>

      <div className="mb-4 flex items-baseline gap-2.5">
        <span className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary">{formatTokenPrice(launch.priceUsdc)}</span>
        <div className="flex items-center gap-1">
          <span className={`font-mono text-sm font-bold ${priceChangeClass}`}>{formatPriceChangeBps(launch.priceChangeBps7d)}</span>
          <span className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider">7D</span>
        </div>
      </div>

      {/* Mobile Tab Switcher (Visible on < lg) */}
      <div className="flex lg:hidden items-center p-1 rounded-xl bg-bg-surface border border-border-strong mb-4 gap-1">
        {[
          { id: "trade", label: "Chart & Trade" },
          { id: "overview", label: "Tokenomics" },
          { id: "intel", label: "Team & Forum" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id as any)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
              mobileTab === t.id
                ? "bg-accent-violet text-white shadow-xs"
                : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile Layout (< lg) */}
      <div className="flex lg:hidden flex-col gap-4">
        {mobileTab === "trade" && (
          <>
            <SwapWidget launch={launch} onChanged={refetchAfterAction} />
            <PriceChart launchChainId={launch.launchChainId} chainSlug={toIndexerChainSlug(chain)} priceUsdc={launch.priceUsdc} graduated={launch.graduated} />
            <RecentTrades launchChainId={launch.launchChainId} symbol={launch.symbol} />
          </>
        )}

        {mobileTab === "overview" && (
          <>
            <MarketOverview launch={launch} />
            <TokenomicsDonut totalSupply={BigInt(launch.totalSupply)} tokensSold={BigInt(launch.tokensSold)} graduated={launch.graduated} />
            <HoldersList launch={launch} />
          </>
        )}

        {mobileTab === "intel" && (
          <>
            <LaunchActionsBar launch={launch} onChanged={refetchAfterAction} />
            <TeamPanel launch={launch} />
            <LaunchForum launch={launch} />
          </>
        )}
      </div>

      {/* Desktop Layout (>= lg) */}
      <div className="hidden lg:grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr] xl:grid-cols-[1.75fr_1fr] items-start">
        {/* Left Column: Price Chart, Trades, Milestones, Team & Intelligence, Forum */}
        <div className="flex flex-col gap-5">
          <PriceChart launchChainId={launch.launchChainId} chainSlug={toIndexerChainSlug(chain)} priceUsdc={launch.priceUsdc} graduated={launch.graduated} />
          <RecentTrades launchChainId={launch.launchChainId} symbol={launch.symbol} />
          <LaunchActionsBar launch={launch} onChanged={refetchAfterAction} />
          <TeamPanel launch={launch} />
          <LaunchForum launch={launch} />
        </div>

        {/* Right Column: Market Overview, Swap Widget, Top Holders, Tokenomics */}
        <div className="flex flex-col gap-5">
          <MarketOverview launch={launch} />
          <SwapWidget launch={launch} onChanged={refetchAfterAction} />
          <HoldersList launch={launch} />
          <TokenomicsDonut totalSupply={BigInt(launch.totalSupply)} tokensSold={BigInt(launch.tokensSold)} graduated={launch.graduated} />
        </div>
      </div>

      {/* Mobile Sticky Trade Button (< lg) */}
      {mobileTab !== "trade" && (
        <div className="fixed bottom-16 inset-x-0 p-3 z-30 lg:hidden flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setMobileTab("trade")}
            className="pointer-events-auto flex items-center justify-center gap-2 w-full max-w-sm py-3 px-6 rounded-2xl bg-[#FF5C28] text-white font-extrabold text-sm shadow-[0_4px_20px_rgba(255,92,40,0.5)] active:scale-95 transition-all cursor-pointer"
          >
            <span>Trade ${launch.symbol}</span>
            <span className="text-xs opacity-90">({formatTokenPrice(launch.priceUsdc)})</span>
          </button>
        </div>
      )}
    </div>
  );
}
