import { z } from "zod";
import { INTENTS_BASE_URL } from "./config.js";

const TokenSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(36),
  blockchain: z.string(),
  contractAddress: z.string().optional(),
  price: z.number().optional(),
});
export type IntentsToken = z.infer<typeof TokenSchema>;
export interface QuoteInput {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipient: string;
  refundTo: string;
  swapType?: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance?: number;
  dry?: boolean;
}
export interface IntentsQuote {
  quote: {
    amountIn: string;
    amountOut: string;
    minAmountOut?: string;
    depositAddress?: string;
    depositMemo?: string;
    deadline?: string;
  };
  quoteRequest: Record<string, unknown>;
  timestamp?: string;
  correlationId?: string;
}
export interface SwapStatus {
  status:
    | "PENDING_DEPOSIT"
    | "KNOWN_DEPOSIT_TX"
    | "PROCESSING"
    | "SUCCESS"
    | "REFUNDED"
    | "FAILED"
    | "INCOMPLETE_DEPOSIT";
  quoteResponse: IntentsQuote;
  swapDetails?: {
    destinationChainTxHashes?: Array<{ hash: string; explorerUrl: string }>;
  };
}

export class NearIntents {
  constructor(
    private readonly options: { jwt?: string; fetch?: typeof fetch } = {},
  ) {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await (this.options.fetch ?? fetch)(
      `${INTENTS_BASE_URL}${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(this.options.jwt
            ? { Authorization: `Bearer ${this.options.jwt}` }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok)
      throw new Error(`NEAR Intents request failed (${response.status})`);
    return (await response.json()) as T;
  }
  async tokens(): Promise<IntentsToken[]> {
    return z.array(TokenSchema).parse(await this.request("/tokens"));
  }
  async quote(input: QuoteInput): Promise<IntentsQuote> {
    if (!/^[1-9]\d*$/.test(input.amount))
      throw new Error("Use positive integer base units");
    if (!input.recipient || !input.refundTo)
      throw new Error("Recipient and refund address required");
    const slippage = input.slippageTolerance ?? 100;
    if (!Number.isSafeInteger(slippage) || slippage < 0 || slippage > 300)
      throw new Error("Slippage must be 0–300 basis points");
    const tokens = await this.tokens();
    for (const id of [input.originAsset, input.destinationAsset])
      if (!tokens.some((t) => t.assetId === id))
        throw new Error("Unsupported mainnet asset");
    const request = {
      dry: input.dry ?? true,
      swapType: input.swapType ?? "EXACT_INPUT",
      slippageTolerance: slippage,
      originAsset: input.originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: input.destinationAsset,
      amount: input.amount,
      refundTo: input.refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: input.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    const result = await this.request<IntentsQuote>("/quote", request);
    if (
      !result.quote ||
      !/^[1-9]\d*$/.test(result.quote.amountIn) ||
      !/^[1-9]\d*$/.test(result.quote.amountOut)
    )
      throw new Error("Invalid quote response");
    if (!request.dry && !result.quote.depositAddress)
      throw new Error("Missing deposit address");
    return { ...result, quoteRequest: request };
  }
  status(depositAddress: string, depositMemo?: string) {
    const query = new URLSearchParams({
      depositAddress,
      ...(depositMemo ? { depositMemo } : {}),
    });
    return this.request<SwapStatus>(`/status?${query}`);
  }
  notifyDeposit(depositAddress: string, txHash: string, depositMemo?: string) {
    return this.request("/deposit/submit", {
      depositAddress,
      txHash,
      ...(depositMemo ? { depositMemo } : {}),
    });
  }
}

/** Both marketplace invoices and API invoices pin the provider's receive asset and address server-side. */
export async function quoteUsdcPayment(
  client: NearIntents,
  input: {
    originAsset: string;
    destinationAsset: string;
    recipient: string;
    refundTo: string;
    amountUsdcMicros: string;
    dry?: boolean;
  },
) {
  const token = (await client.tokens()).find(
    (t) => t.assetId === input.destinationAsset,
  );
  if (!token || token.symbol !== "USDC" || token.decimals !== 6)
    throw new Error("Provider must receive supported 6-decimal USDC");
  return client.quote({
    ...input,
    amount: input.amountUsdcMicros,
    swapType: "EXACT_OUTPUT",
  });
}

/** Status is a routing signal. A service must also verify the destination-chain receipt before granting access. */
export function assertSettledPayment(
  status: SwapStatus,
  expected: {
    recipient: string;
    destinationAsset: string;
    amountUsdcMicros: string;
  },
) {
  const request = status.quoteResponse?.quoteRequest;
  const output = status.quoteResponse?.quote?.amountOut;
  if (
    status.status !== "SUCCESS" ||
    request?.recipient !== expected.recipient ||
    request?.destinationAsset !== expected.destinationAsset ||
    !output ||
    BigInt(output) < BigInt(expected.amountUsdcMicros)
  )
    throw new Error("Payment is not settled for this invoice");
  return status.swapDetails?.destinationChainTxHashes ?? [];
}
