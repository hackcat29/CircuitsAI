"use client";

import { useEffect, useState, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { ArrowRight, Settings2, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardHeader, CardTitle, CardContent, Button, Spinner } from "@/components/ui";
import {
  useLaunchpadActions,
  useEvmXeroRouterAdapter,
  useWallet,
  useSocialSession,
  useUserTokenBalances,
  type LaunchDetail,
} from "@/hooks";
import {
  currentPrice,
  quoteBuy,
  quoteSell,
  applySlippage,
  EVM_TOKEN_DECIMALS_FACTOR,
} from "@/lib/bondingCurve";
import type { BondingCurveLaunch } from "@/lib/bondingCurve";
import { describeActionError } from "@/lib/errors";
import { formatTokenPrice, formatUsdc, formatCount } from "@/lib/format";
import { fromIndexerChainSlug, isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { checkOperationChain } from "@/lib/chainGuard";
import { LaunchCountdown } from "./LaunchCountdown";

const SLIPPAGE_OPTIONS = [
  { label: "0.5%", bps: 50n },
  { label: "1.0%", bps: 100n },
  { label: "2.5%", bps: 250n },
];

const BUY_PRESETS = ["10", "50", "100", "250"];
const PERCENT_PRESETS = [25, 50, 75, 100];
const DEADLINE_SECONDS = 600; // 10 minutes

function toBondingCurveLaunch(launch: LaunchDetail): BondingCurveLaunch {
  return {
    tokensSold: BigInt(launch.tokensSold),
    usdcRaised: BigInt(launch.usdcRaised),
    initialVirtualUsdcReserve: BigInt(launch.initialVirtualUsdcReserve),
  };
}

export function SwapWidget({ launch, onChanged }: { launch: LaunchDetail; onChanged: () => void }) {
  const { chain, address, isConnected } = useWallet();
  const { signIn, signingIn } = useSocialSession();
  const { buyTokens, sellTokens } = useLaunchpadActions();

  // Scope the router to the launch token's home chain (e.g. Monad or BNB Chain)
  const targetChain = useMemo(
    () => fromIndexerChainSlug(launch.chain ?? "") ?? (isEvmChain(chain) ? chain : MONAD_MAINNET),
    [launch.chain, chain]
  );
  const publicClient = usePublicClient({ chainId: targetChain.viemChain.id });
  const xero = useEvmXeroRouterAdapter(targetChain);

  const { usdcBalance, tokenBalance, rawUsdcBalance, rawTokenBalance, refetch: refetchBalances } =
    useUserTokenBalances(launch.token);

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<bigint>(100n);
  const [showSlippage, setShowSlippage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Real-time quote for graduated DEX swaps
  const [dexEstimatedOut, setDexEstimatedOut] = useState<bigint | null>(null);
  const [dexQuoting, setDexQuoting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch real-time DEX output quote when graduated
  useEffect(() => {
    if (!launch.graduated || !xero || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setDexEstimatedOut(null);
      setDexQuoting(false);
      return;
    }

    let cancelled = false;
    setDexQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const usdcAddress = targetChain.usdcAddress as `0x${string}`;
        const tokenAddress = launch.token as `0x${string}`;
        if (!usdcAddress || !tokenAddress) return;

        if (mode === "buy") {
          const usdcIn = parseUnits(amount, 6);
          const amounts = await xero.getAmountsOut(usdcIn, [usdcAddress, tokenAddress]);
          if (!cancelled && amounts.length > 1) {
            // AgentToken charges a 1% fee on transfers post-graduation when delivered to recipient
            const netTokens = (amounts[amounts.length - 1] * 9900n) / 10000n;
            setDexEstimatedOut(netTokens);
          }
        } else {
          const tokensIn = parseUnits(amount, 18);
          // AgentToken charges a 1% fee on transfer to the pair
          const netIn = (tokensIn * 9900n) / 10000n;
          const amounts = await xero.getAmountsOut(netIn, [tokenAddress, usdcAddress]);
          if (!cancelled && amounts.length > 1) {
            setDexEstimatedOut(amounts[amounts.length - 1]);
          }
        }
      } catch {
        if (!cancelled) setDexEstimatedOut(null);
      } finally {
        if (!cancelled) setDexQuoting(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [launch.graduated, xero, amount, mode, targetChain.usdcAddress, launch.token]);

  const curveLaunch = useMemo(() => toBondingCurveLaunch(launch), [launch]);
  const tokenPrice = useMemo(() => {
    if (launch.graduated && launch.priceUsdc && Number(launch.priceUsdc) > 0) {
      try {
        return BigInt(launch.priceUsdc);
      } catch {
        // fallback to curve
      }
    }
    return currentPrice(curveLaunch, EVM_TOKEN_DECIMALS_FACTOR);
  }, [launch.graduated, launch.priceUsdc, curveLaunch]);

  const notStartedYet = !launch.graduated && new Date(launch.tradingStartsAt).getTime() > now;

  // Real-time estimated output
  const estimation = useMemo(() => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return { outputRaw: 0n, outputFormatted: "0", minReceived: "0" };
    }
    try {
      if (!launch.graduated) {
        if (mode === "buy") {
          const usdcIn = parseUnits(amount, 6);
          const estimatedOut = quoteBuy(curveLaunch, usdcIn);
          const minOut = applySlippage(estimatedOut, slippageBps);
          return {
            outputRaw: estimatedOut,
            outputFormatted: formatCount(estimatedOut / EVM_TOKEN_DECIMALS_FACTOR),
            minReceived: formatCount(minOut / EVM_TOKEN_DECIMALS_FACTOR),
          };
        } else {
          const tokensIn = parseUnits(amount, 18);
          const { net } = quoteSell(curveLaunch, tokensIn);
          const minOut = applySlippage(net, slippageBps);
          return {
            outputRaw: net,
            outputFormatted: formatUsdc(net),
            minReceived: formatUsdc(minOut),
          };
        }
      } else {
        if (dexEstimatedOut !== null && dexEstimatedOut > 0n) {
          const minOut = (dexEstimatedOut * (10_000n - slippageBps)) / 10_000n;
          if (mode === "buy") {
            return {
              outputRaw: dexEstimatedOut,
              outputFormatted: formatCount(dexEstimatedOut / EVM_TOKEN_DECIMALS_FACTOR),
              minReceived: formatCount(minOut / EVM_TOKEN_DECIMALS_FACTOR),
            };
          } else {
            return {
              outputRaw: dexEstimatedOut,
              outputFormatted: formatUsdc(dexEstimatedOut),
              minReceived: formatUsdc(minOut),
            };
          }
        }
        return {
          outputRaw: 0n,
          outputFormatted: dexQuoting ? "Calculating..." : "—",
          minReceived: dexQuoting ? "Calculating..." : "—",
        };
      }
    } catch {
      return { outputRaw: 0n, outputFormatted: "0", minReceived: "0" };
    }
  }, [amount, mode, launch.graduated, curveLaunch, slippageBps, dexEstimatedOut, dexQuoting]);

  const handlePercentageFill = (pct: number) => {
    if (mode === "buy") {
      const num = Number(usdcBalance);
      if (num <= 0) return;
      const filled = ((num * pct) / 100).toFixed(2);
      setAmount(filled);
    } else {
      const num = Number(tokenBalance);
      if (num <= 0) return;
      const filled = ((num * pct) / 100).toFixed(2);
      setAmount(filled);
    }
  };

  async function handleExecute() {
    if (!amount || Number(amount) <= 0) return;

    if (!isConnected || !address) {
      signIn();
      return;
    }

    if (!checkOperationChain(launch.chain, mode === "buy" ? "buy this token" : "sell this token")) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      let finalTxHash: string | null = null;

      if (!launch.graduated) {
        if (mode === "buy") {
          const usdcIn = parseUnits(amount, 6);
          const estimatedOut = quoteBuy(curveLaunch, usdcIn);
          const minTokensOut = applySlippage(estimatedOut, slippageBps);
          finalTxHash = await buyTokens(launch.launchChainId, usdcIn, minTokensOut);
          toast.success(`Successfully bought $${launch.symbol}!`);
        } else {
          const tokensIn = parseUnits(amount, 18);
          const { net } = quoteSell(curveLaunch, tokensIn);
          const minUsdcOut = applySlippage(net, slippageBps);
          finalTxHash = await sellTokens(launch.launchChainId, tokensIn, minUsdcOut, launch.token);
          toast.success(`Successfully sold $${launch.symbol}!`);
        }
      } else {
        // Graduated: execute through XeroRouter (Uniswap V2)
        if (!targetChain.xeroRouterAddress) {
          throw new Error(`DEX Router address is not configured for ${targetChain.chainName}.`);
        }
        if (!xero) {
          throw new Error("Unable to connect to DEX Router. Please check your network or wallet connection.");
        }
        const usdcAddress = targetChain.usdcAddress as `0x${string}`;
        const tokenAddress = launch.token as `0x${string}`;

        if (!usdcAddress) {
          throw new Error(`USDC address not found on ${targetChain.chainName}.`);
        }

        if (mode === "buy") {
          const usdcIn = parseUnits(amount, 6);
          const amounts = await xero.getAmountsOut(usdcIn, [usdcAddress, tokenAddress]);
          const quotedOut = amounts[amounts.length - 1];
          const minOut = (quotedOut * (10_000n - slippageBps)) / 10_000n;
          const txHash = await xero.swapExactTokensForTokens({
            amountIn: usdcIn,
            amountOutMin: minOut,
            path: [usdcAddress, tokenAddress],
            deadline: BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS),
          });
          finalTxHash = txHash;
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          }
          toast.success(`Successfully bought $${launch.symbol}!`);
        } else {
          const tokensIn = parseUnits(amount, 18);
          // AgentToken charges 1% on transfer into the pair
          const netIn = (tokensIn * 9900n) / 10000n;
          const amounts = await xero.getAmountsOut(netIn, [tokenAddress, usdcAddress]);
          const quotedOut = amounts[amounts.length - 1];
          const minOut = (quotedOut * (10_000n - slippageBps)) / 10_000n;
          const txHash = await xero.swapExactTokensForTokensSupportingFeeOnTransferTokens({
            amountIn: tokensIn,
            amountOutMin: minOut,
            path: [tokenAddress, usdcAddress],
            deadline: BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS),
          });
          finalTxHash = txHash;
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          }
          toast.success(`Successfully sold $${launch.symbol}!`);
        }
      }

      if (finalTxHash) {
        try {
          await fetch("/api/launchpad/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chain: launch.chain,
              launchChainId: launch.launchChainId,
              txHash: finalTxHash,
            }),
          });
        } catch {
          // Best-effort; background indexer will also pick it up
        }
      }

      setAmount("");
      refetchBalances();
      onChanged();
    } catch (err) {
      setError(describeActionError(err, `${mode === "buy" ? "Buy" : "Sell"} failed.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 backdrop-blur-sm shadow-xs overflow-hidden">
      <CardHeader className="pb-2.5 pt-3.5 px-4 border-b border-border-subtle/50 flex flex-row items-center justify-between">
        <CardTitle className="text-[13px] font-extrabold text-text-primary">
          {launch.graduated ? "DEX Swap" : "Bonding Curve Swap"}
        </CardTitle>
        <button
          type="button"
          onClick={() => setShowSlippage(!showSlippage)}
          className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
          title="Slippage Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {notStartedYet ? (
          <div className="flex flex-col items-center gap-1 rounded-[12px] border border-border-subtle bg-white/5 py-6 text-center">
            <LaunchCountdown
              scheduledAt={launch.tradingStartsAt}
              className="text-sm font-bold text-amber"
            />
            <p className="text-xs text-text-tertiary mt-1">
              Trading opens automatically at the scheduled time.
            </p>
          </div>
        ) : (
          <>
            {/* Buy / Sell Dual Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg-surface3/60 rounded-[10px] border border-border-subtle/50">
              <button
                type="button"
                onClick={() => {
                  setMode("buy");
                  setAmount("");
                  setError(null);
                }}
                className={`py-2 rounded-[8px] text-[12.5px] font-extrabold transition-all cursor-pointer ${
                  mode === "buy"
                    ? "bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 shadow-2xs"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("sell");
                  setAmount("");
                  setError(null);
                }}
                className={`py-2 rounded-[8px] text-[12.5px] font-extrabold transition-all cursor-pointer ${
                  mode === "sell"
                    ? "bg-red/15 text-red border border-red/30 shadow-2xs"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Sell
              </button>
            </div>

            {/* Slippage Toolbar (Toggleable) */}
            {showSlippage && (
              <div className="p-2.5 bg-bg-surface3/40 rounded-[10px] border border-border-subtle/50 space-y-1.5 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                  <span className="font-semibold">Max Slippage Tolerance</span>
                  <span className="font-mono font-bold text-accent-violet">
                    {(Number(slippageBps) / 100).toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SLIPPAGE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.label}
                      onClick={() => setSlippageBps(opt.bps)}
                      className={`py-1 rounded-[6px] text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                        slippageBps === opt.bps
                          ? "bg-accent-violet text-white border-accent-violet"
                          : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Box with Balance & Currency Badge */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary font-medium">
                  {mode === "buy" ? "You Pay" : `You Sell ($${launch.symbol})`}
                </span>
                <button
                  type="button"
                  onClick={() => handlePercentageFill(100)}
                  className="text-text-quaternary hover:text-accent-violet transition-colors flex items-center gap-1 font-mono text-[10.5px] cursor-pointer"
                >
                  <Wallet className="h-3 w-3" />
                  <span>
                    Balance:{" "}
                    <strong className="text-text-secondary">
                      {mode === "buy"
                        ? `${Number(usdcBalance).toFixed(2)} USDC`
                        : `${formatCount(BigInt(Math.floor(Number(tokenBalance))))} ${launch.symbol}`}
                    </strong>
                  </span>
                </button>
              </div>

              <div className="bg-bg-raised border border-border-strong focus-within:border-accent-violet/50 rounded-[12px] p-3 flex items-center gap-3 transition-colors">
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent text-xl font-bold font-mono text-text-primary outline-none"
                />
                <span className="text-[11px] font-bold text-text-secondary bg-bg-surface3 px-2 py-1 rounded-[6px] border border-border-subtle shrink-0">
                  {mode === "buy" ? "USDC" : `$${launch.symbol}`}
                </span>
              </div>
            </div>

            {/* Quick Percentage Buttons */}
            <div className="flex items-center gap-1.5">
              {PERCENT_PRESETS.map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => handlePercentageFill(pct)}
                  className="flex-1 py-1 rounded-[6px] bg-bg-surface3 hover:bg-white/10 text-text-tertiary hover:text-text-primary border border-border-subtle/60 text-[10.5px] font-mono font-bold transition-all cursor-pointer"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Quick Buy Presets (Buy Mode only) */}
            {mode === "buy" && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-text-quaternary uppercase tracking-wider shrink-0">
                  Quick:
                </span>
                <div className="grid grid-cols-4 gap-1.5 flex-1">
                  {BUY_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className={`py-1 rounded-[6px] text-[10.5px] font-mono font-bold border transition-all cursor-pointer ${
                        amount === preset
                          ? "bg-accent-violet text-white border-accent-violet shadow-2xs"
                          : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Output Estimation Summary */}
            <div className="bg-bg-surface3/40 rounded-[10px] border border-border-subtle/50 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">You Receive (Est.)</span>
                <span className="font-mono font-extrabold text-emerald">
                  {mode === "buy"
                    ? `≈ ${estimation.outputFormatted} $${launch.symbol}`
                    : `≈ ${estimation.outputFormatted}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-text-quaternary font-mono">
                <span>Min. Received after Slippage</span>
                <span>
                  {mode === "buy"
                    ? `${estimation.minReceived} $${launch.symbol}`
                    : `${estimation.minReceived}`}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red/10 border border-red/20 rounded-[8px] text-xs text-red">
                {error}
              </div>
            )}

            {/* Execute Button */}
            {!isConnected || !address ? (
              <Button
                type="button"
                disabled={signingIn}
                onClick={signIn}
                className="w-full py-2.5 rounded-[10px] font-extrabold text-[13px] bg-accent-violet hover:bg-accent-violet/90 text-white border border-accent-violet/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {signingIn && <Spinner className="h-4 w-4" />}
                <span>{signingIn ? "Signing In..." : "Connect Wallet to Trade"}</span>
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={handleExecute}
                className={`w-full py-2.5 rounded-[10px] font-extrabold text-[13px] transition-all flex items-center justify-center gap-1.5 ${
                  mode === "buy"
                    ? "bg-[#1FD487] hover:bg-[#1FD487]/90 text-black border border-[#1FD487]/50"
                    : "bg-red hover:bg-red/90 text-white border border-red/50"
                }`}
              >
                {busy && <Spinner className="h-4 w-4" />}
                <span>
                  {busy
                    ? mode === "sell"
                      ? "Approving / Selling..."
                      : "Confirming On-Chain..."
                    : mode === "buy"
                      ? `Buy $${launch.symbol}`
                      : `Sell $${launch.symbol}`}
                </span>
              </Button>
            )}

            {/* Token Price Reference */}
            <div className="text-center pt-1 text-[11px] font-mono text-text-quaternary">
              Price: <span className="text-text-secondary">{formatTokenPrice(tokenPrice)}</span> / whole token
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

