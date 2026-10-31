import {
  NearIntents,
  quoteUsdcPayment,
  assertSettledPayment,
} from "@clawdhq/near";
import { prisma as custody } from "@clawdhq/custody-db";
import {
  isEvmPrismaChain,
  viemChainFor,
  usdcAddressFor,
} from "@clawdhq/custody-core";
import type { ServiceListing } from "@clawdhq/marketplace-db";
import { verifyUsdcTransfer } from "@/lib/server/serviceCallVerify";
import { ApiError } from "@/lib/server/socialErrors";
const intents = () => new NearIntents({ jwt: process.env.NEAR_INTENTS_JWT });

export async function createServicePayment(
  listing: ServiceListing,
  callerAddress: string,
  input: { originAsset: string; refundTo: string; dry: boolean },
) {
  if (!isEvmPrismaChain(listing.chain) || viemChainFor(listing.chain).testnet)
    throw new ApiError(
      400,
      "Intents settles on mainnet only; this listing uses a testnet.",
    );
  const id = process.env[`NEAR_INTENTS_SERVICE_ASSET_${listing.chain}`];
  if (!id)
    throw new ApiError(
      503,
      "The service's receive asset is not configured for Intents.",
    );
  const client = intents();
  const destination = (await client.tokens()).find((t) => t.assetId === id);
  const chainName = (
    { 143: "monad", 8453: "base", 1: "eth" } as Record<number, string>
  )[viemChainFor(listing.chain).id];
  if (
    !chainName ||
    destination?.blockchain !== chainName ||
    !destination?.contractAddress ||
    destination.contractAddress.toLowerCase() !==
      usdcAddressFor(listing.chain).toLowerCase()
  )
    throw new ApiError(
      503,
      "Intents receive asset does not match the service's USDC contract.",
    );
  const quote = await quoteUsdcPayment(client, {
    originAsset: input.originAsset,
    destinationAsset: id,
    recipient: listing.ownerAddress,
    refundTo: input.refundTo,
    amountUsdcMicros: listing.priceUsdcMicros.toString(),
    dry: input.dry,
  });
  if (input.dry) return { dry: true, quote, invoiceId: null };
  const address = quote.quote.depositAddress;
  if (!address || !quote.quote.deadline)
    throw new Error("Incomplete executable quote");
  const invoice = await custody.nearPaymentIntent.create({
    data: {
      listingId: listing.id,
      callerAddress: callerAddress.toLowerCase(),
      recipient: listing.ownerAddress,
      destinationAsset: id,
      amountMicros: listing.priceUsdcMicros.toString(),
      depositAddress: address,
      depositMemo: quote.quote.depositMemo,
      quoteJson: JSON.stringify(quote),
      expiresAt: new Date(quote.quote.deadline),
    },
  });
  return { dry: false, quote, invoiceId: invoice.id };
}

/** A quote, submitted source hash, or solver status alone cannot redeem an API call. */
export async function verifyServicePayment(
  listing: ServiceListing,
  callerAddress: string,
  invoiceId: string,
) {
  const invoice = await custody.nearPaymentIntent.findUnique({
    where: { id: invoiceId },
  });
  if (
    !invoice ||
    invoice.listingId !== listing.id ||
    invoice.callerAddress !== callerAddress.toLowerCase()
  )
    throw new ApiError(403, "Invoice is not bound to this caller and service.");
  if (invoice.redeemedAt) throw new ApiError(409, "Invoice already redeemed.");
  if (
    invoice.recipient.toLowerCase() !== listing.ownerAddress.toLowerCase() ||
    BigInt(invoice.amountMicros) < listing.priceUsdcMicros
  )
    throw new ApiError(409, "The listing changed; create a new invoice.");
  const status = await intents().status(
    invoice.depositAddress,
    invoice.depositMemo ?? undefined,
  );
  const transfers = assertSettledPayment(status, {
    recipient: invoice.recipient,
    destinationAsset: invoice.destinationAsset,
    amountUsdcMicros: invoice.amountMicros,
  });
  for (const transfer of transfers) {
    if (
      await verifyUsdcTransfer(
        listing.chain,
        transfer.hash,
        null,
        invoice.recipient,
        BigInt(invoice.amountMicros),
      )
    ) {
      return transfer.hash;
    }
  }
  throw new ApiError(
    402,
    "Waiting for a confirmed destination-chain USDC payment.",
  );
}
