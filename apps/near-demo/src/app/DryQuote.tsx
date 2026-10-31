"use client";
import { useState } from "react";
interface Token {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
}
export function DryQuote() {
  const [tokens, setTokens] = useState<Token[]>([]),
    [asset, setAsset] = useState(""),
    [refund, setRefund] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      amountIn: string;
      amountOut: string;
      source: Token;
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("https://1click.chaindefuser.com/v0/tokens");
      if (!response.ok) throw new Error("Token list unavailable");
      const list = (await response.json()) as Token[];
      setTokens(list);
      setAsset(
        list.find((t) => t.symbol === "USDC" && t.blockchain === "base")
          ?.assetId ?? "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Token discovery failed");
    } finally {
      setBusy(false);
    }
  }
  async function quote() {
    setBusy(true);
    setError("");
    try {
      const source = tokens.find((t) => t.assetId === asset),
        destination = tokens.find(
          (t) => t.symbol === "USDC" && t.blockchain === "near",
        );
      if (!source || !destination) throw new Error("Choose a supported asset");
      const response = await fetch("https://1click.chaindefuser.com/v0/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry: true,
          swapType: "EXACT_OUTPUT",
          slippageTolerance: 100,
          originAsset: source.assetId,
          depositType: "ORIGIN_CHAIN",
          destinationAsset: destination.assetId,
          amount: "1000000",
          refundTo: refund,
          refundType: "ORIGIN_CHAIN",
          recipient: "hackcat.near",
          recipientType: "DESTINATION_CHAIN",
          deadline: new Date(Date.now() + 600000).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message ?? "Quote unavailable for these parameters",
        );
      if (data.quote?.depositAddress)
        throw new Error("Expected a dry quote without a deposit address");
      setResult({
        amountIn: data.quote.amountIn,
        amountOut: data.quote.amountOut,
        source,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }
  function amount(value: string, decimals: number) {
    const n = BigInt(value),
      s = 10n ** BigInt(decimals),
      fraction = (n % s).toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${n / s}${fraction ? `.${fraction}` : ""}`;
  }
  return (
    <section className="max-w-6xl mx-auto px-4 pb-12">
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
        <h2 className="font-bold">Preview an Intents payment</h2>
        <p className="text-sm text-text-tertiary">
          Request a live mainnet quote to receive 1 USDC on NEAR. This preview
          never creates a deposit address or sends funds.
        </p>
        {tokens.length === 0 ? (
          <button
            disabled={busy}
            onClick={load}
            className="rounded-lg bg-accent-violet px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Load supported tokens
          </button>
        ) : (
          <>
            <label className="block text-xs">
              Source token and chain
              <select
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-bg-surface p-2 text-sm"
                value={asset}
                onChange={(e) => {
                  setAsset(e.target.value);
                  setResult(null);
                }}
              >
                {tokens.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol} · {t.blockchain}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Refund address on the source chain
              <input
                className="mt-1 block w-full rounded-lg border border-border-subtle bg-bg-surface p-2 text-sm"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !refund || !asset}
              onClick={quote}
              className="rounded-lg bg-accent-violet px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Preview dry quote
            </button>
          </>
        )}
        {result && (
          <p role="status" className="rounded-lg bg-bg-surface p-3 text-sm">
            {amount(result.amountIn, result.source.decimals)}{" "}
            {result.source.symbol} on {result.source.blockchain} →{" "}
            {amount(result.amountOut, 6)} USDC on NEAR. No payment or deposit
            address was created.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
