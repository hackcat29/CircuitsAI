"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "./useWallet";
import { useEvmAdapter } from "./useEvmAdapter";
import { useEvmExchangeAdapter } from "./useEvmExchangeAdapter";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

export interface CreateListingInput {
  /** The numeric agent id. */
  agentId: string;
  /** 0 = Open, 1 = Auction */
  mode: number;
  fairValueSnapshotUsdc: bigint;
  reservePriceUsdc: bigint;
  /** Unix seconds; 0 for Open listings, required (future) for Auction listings. */
  endTime: bigint;
}

/** Wraps the agent ownership exchange's write methods behind one signature, mirroring
 * `useMarketplaceActions`/`useLaunchpadActions`. */
export function useAgentExchangeActions() {
  const { chain, address } = useWallet();
  const evmAdapter = useEvmAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const evmExchangeAdapter = useEvmExchangeAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
      const result = await fn();
      return result;
    } finally {
      setBusy(false);
    }
  }

  function unsupported(): never {
    throw new Error(`The agent exchange isn't available on ${chain.chainName} yet.`);
  }

  /** Approves the exchange on Core (if not already approved for this agent) and creates the
   * listing — two on-chain transactions from the user's perspective, run back to back. */
  async function createListing(input: CreateListingInput): Promise<void> {
    await run(async () => {
      if (!isEvmChain(chain) || !evmAdapter || !evmExchangeAdapter) unsupported();

      const agentIdBigInt = BigInt(input.agentId);
      const exchangeAddress = chain.exchangeAddress as `0x${string}`;

      const currentApproval = await evmAdapter.getAgentExchangeApproval(agentIdBigInt);
      if (currentApproval.toLowerCase() !== exchangeAddress.toLowerCase()) {
        await evmAdapter.approveAgentExchange(agentIdBigInt, exchangeAddress);
      }

      await evmExchangeAdapter.createListing({
        agentId: agentIdBigInt,
        mode: input.mode,
        fairValueSnapshotUsdc: input.fairValueSnapshotUsdc,
        reservePriceUsdc: input.reservePriceUsdc,
        endTime: input.endTime,
      });
      toast.success(input.mode === 1 ? "Auction created." : "Listing created.");
    });
  }

  async function cancelListing(listingId: string): Promise<void> {
    await run(async () => {
      if (!evmExchangeAdapter) unsupported();
      await evmExchangeAdapter.cancelListing(BigInt(listingId));
      toast.success("Listing cancelled.");
    });
  }

  async function placeBid(listingId: string, amountUsdc: bigint): Promise<void> {
    await run(async () => {
      if (!evmExchangeAdapter) unsupported();
      await evmExchangeAdapter.placeBid(BigInt(listingId), amountUsdc);
      toast.success("Bid placed.");
    });
  }

  async function withdrawBid(bidId: string): Promise<void> {
    await run(async () => {
      if (!evmExchangeAdapter) unsupported();
      await evmExchangeAdapter.withdrawBid(BigInt(bidId));
      toast.success("Bid withdrawn.");
    });
  }

  async function acceptBid(listingId: string, bidId: string): Promise<void> {
    await run(async () => {
      if (!evmExchangeAdapter) unsupported();
      await evmExchangeAdapter.acceptBid(BigInt(listingId), BigInt(bidId));
      toast.success("Bid accepted, ownership transferred.");
    });
  }

  async function settleAuction(listingId: string): Promise<void> {
    await run(async () => {
      if (!evmExchangeAdapter) unsupported();
      await evmExchangeAdapter.settleAuction(BigInt(listingId));
      toast.success("Auction settled.");
    });
  }

  return {
    busy,
    address,
    createListing,
    cancelListing,
    placeBid,
    withdrawBid,
    acceptBid,
    settleAuction,
  };
}
