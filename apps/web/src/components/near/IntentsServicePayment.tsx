"use client";
import { useEffect, useState } from "react";
function exactAmount(value: string, decimals: number) {
  const n = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const fraction = (n % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${n / scale}${fraction ? `.${fraction}` : ""}`;
}
interface Token {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
}
interface Quote {
  quote: {
    amountIn: string;
    amountOut: string;
    depositAddress?: string;
    depositMemo?: string;
    deadline?: string;
  };
}
export function IntentsServicePayment({
  listingId,
  requestJson,
  onResult,
}: {
  listingId: string;
  requestJson: string;
  onResult: (value: {
    txHash: string;
    durationMs: number;
    response: { status: number; data: unknown };
  }) => void;
}) {
  const [tokens, setTokens] = useState<Token[]>([]),
    [asset, setAsset] = useState(""),
    [refund, setRefund] = useState(""),
    [quote, setQuote] = useState<Quote | null>(null),
    [invoice, setInvoice] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/near/intents/tokens", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tokens) setTokens(data.tokens);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  async function requestQuote(dry: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/marketplace/services/${encodeURIComponent(listingId)}/intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originAsset: asset, refundTo: refund, dry }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            result.message ??
            "Unable to request quote; sign in and choose an eligible mainnet service",
        );
      setQuote(result.quote);
      setInvoice(result.invoiceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }
  async function redeem() {
    setBusy(true);
    setError("");
    const start = Date.now();
    try {
      const input = JSON.parse(requestJson);
      const response = await fetch(
        `/api/marketplace/services/${encodeURIComponent(listingId)}/call`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentInvoiceId: invoice, input }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? result.message ?? "Payment is not confirmed yet",
        );
      onResult({
        txHash: result.txHash,
        durationMs: Date.now() - start,
        response: result.response,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment verification failed");
    } finally {
      setBusy(false);
    }
  }
  const selected = tokens.find((t) => t.assetId === asset);
  return (
    <details className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <summary className="text-sm font-bold cursor-pointer">
        Pay from another token or chain · NEAR Intents
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-text-tertiary">
          Choose a supported mainnet asset. The service receives its listed USDC
          price after settlement.
        </p>
        <label className="block text-xs">
          Pay with
          <select
            className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface p-2 text-sm"
            value={asset}
            onChange={(e) => {
              setAsset(e.target.value);
              setQuote(null);
              setInvoice(null);
            }}
          >
            <option value="">Select asset and chain</option>
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
            className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface p-2 text-sm"
            value={refund}
            onChange={(e) => {
              setRefund(e.target.value);
              setQuote(null);
              setInvoice(null);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || !asset || !refund}
            className="rounded-lg border border-border-subtle px-3 py-2 text-xs disabled:opacity-40"
            onClick={() => requestQuote(true)}
          >
            Preview dry quote
          </button>
          <button
            disabled={busy || !asset || !refund}
            className="rounded-lg bg-accent-violet text-white px-3 py-2 text-xs disabled:opacity-40"
            onClick={() => requestQuote(false)}
          >
            Create payment invoice
          </button>
        </div>
        {quote && (
          <div className="rounded-lg bg-bg-surface p-3 text-xs space-y-2">
            <p>
              Source amount:{" "}
              {selected
                ? exactAmount(quote.quote.amountIn, selected.decimals)
                : quote.quote.amountIn}{" "}
              {selected?.symbol}
            </p>
            <p>
              Provider receives: {exactAmount(quote.quote.amountOut, 6)} USDC
            </p>
            {quote.quote.depositAddress ? (
              <>
                <p>Send exactly the quoted source amount to:</p>
                <code className="block break-all select-all">
                  {quote.quote.depositAddress}
                </code>
                {quote.quote.depositMemo && (
                  <p>
                    Required memo: <code>{quote.quote.depositMemo}</code>
                  </p>
                )}
                <p>
                  Pay before{" "}
                  {quote.quote.deadline
                    ? new Date(quote.quote.deadline).toLocaleString()
                    : "the quote expires"}
                  .
                </p>
                <button
                  disabled={busy || !invoice}
                  className="rounded-lg bg-accent-violet px-3 py-2 text-white disabled:opacity-40"
                  onClick={redeem}
                >
                  Verify payment and call service
                </button>
              </>
            ) : (
              <p>
                Dry quote only. No deposit address or payment has been created.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
