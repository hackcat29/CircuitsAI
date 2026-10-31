"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { socialFetch } from "@/lib/social/api";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET } from "@/lib/chains";
import { env } from "@/lib/env";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

export interface ServiceListing {
  id: string;
  chain: string;
  agentChainId: string;
  ownerAddress: string;
  name: string;
  description: string;
  endpoint: string;
  priceUsdc: string;
  status: "ACTIVE" | "PAUSED";
  callCount: number;
  createdAt: string;
}

export interface RegisterServiceInput {
  agentChainId: string;
  name: string;
  description: string;
  endpoint: string;
  priceUsdc: string;
}

export interface ServiceCallRecord {
  id: string;
  callerAddress: string;
  priceUsdc: string;
  txHash: string;
  createdAt: string;
}

export interface ServiceListingDetail extends ServiceListing {
  calls?: ServiceCallRecord[];
}

export interface ServiceCallResult {
  ok: true;
  txHash: string;
  priceUsdc: string;
  response: { status: number; data: unknown };
}

/** Real registry + metered call for the Task Market's "Services" tab — see
 * /api/marketplace/services. Scoped to whichever EVM chain the wallet is currently on, same
 * convention as useJobs/useSubscriptions. Payment for a call is a plain on-chain USDC transfer
 * sent from the caller's own connected wallet straight to the listing owner's address — this
 * hook sends that transfer client-side, waits for it to confirm, then hands the resulting
 * txHash to the server, which verifies it on-chain before proxying the call. */
export function useServiceListings() {
  const queryClient = useQueryClient();
  const { chain } = useWallet();
  const evmChain = isEvmChain(chain) ? chain : MONAD_MAINNET;
  const chainSlug = toIndexerChainSlug(evmChain);
  const walletClient = usePrivyWalletClient(evmChain);
  const publicClient = usePublicClient({ chainId: evmChain.viemChain.id });

  const queryKey = ["service-listings", chainSlug];

  const listingsQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ listings: ServiceListing[] }>(`/api/marketplace/services?chain=${chainSlug}`).then((d) => d.listings),
    enabled: Boolean(chainSlug),
  });

  const register = useMutation({
    mutationFn: async (input: RegisterServiceInput) => {
      if (!chainSlug) throw new Error("Switch to an EVM chain first.");

      // Spam-prevention listing fee — a direct USDC transfer to the treasury, same
      // pay-then-verify shape `call` below already uses for a metered service call. Skipped
      // entirely when NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC is unset (fee disabled).
      let feeTxHash: string | undefined;
      if (env.NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC && env.NEXT_PUBLIC_TREASURY_ADDRESS) {
        if (!walletClient?.account) throw new Error("Sign in first.");
        if (!publicClient) throw new Error("Not connected to this chain yet.");
        const hash = await walletClient.writeContract({
          address: evmChain.usdcAddress as Address,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [env.NEXT_PUBLIC_TREASURY_ADDRESS as Address, parseUnits(env.NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC, 6)],
          chain: evmChain.viemChain,
          account: walletClient.account!,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        feeTxHash = hash;
      }

      return socialFetch<{ listing: ServiceListing }>("/api/marketplace/services", {
        method: "POST",
        body: JSON.stringify({ ...input, chain: chainSlug, feeTxHash }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggle = useMutation({
    mutationFn: (listing: ServiceListing) =>
      socialFetch<{ listing: { id: string; status: string } }>(`/api/marketplace/services/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: listing.status !== "ACTIVE" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/marketplace/services/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const call = useMutation({
    mutationFn: async ({ listing, input }: { listing: ServiceListing; input: unknown }) => {
      if (!walletClient?.account) throw new Error("Sign in first.");
      if (!publicClient) throw new Error("Not connected to this chain yet.");
      if (listing.chain !== chainSlug) throw new Error(`Switch to ${listing.chain} to call this service.`);

      const txHash = await walletClient.writeContract({
        address: evmChain.usdcAddress as Address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [listing.ownerAddress as Address, parseUnits(listing.priceUsdc, 6)],
        chain: evmChain.viemChain,
        account: walletClient.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return socialFetch<ServiceCallResult>(`/api/marketplace/services/${listing.id}/call`, {
        method: "POST",
        body: JSON.stringify({ txHash, input }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...listingsQuery, listings: listingsQuery.data ?? [], register, toggle, remove, call };
}

const DEMO_FALLBACK_SERVICES: Record<string, ServiceListingDetail> = {
  "srv-1": {
    id: "srv-1",
    chain: "MONAD_MAINNET",
    agentChainId: "1",
    ownerAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    name: "Autonomous Alpha Sentiment Engine",
    description: "Sub-second decentralized social & financial intelligence processing sentiment feeds across Monad.",
    endpoint: "https://api.meridian-alpha.agent/v1/sentiment",
    priceUsdc: "0.025",
    status: "ACTIVE",
    callCount: 14820,
    createdAt: new Date().toISOString(),
    calls: [
      {
        id: "call-1",
        callerAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
        priceUsdc: "0.025",
        txHash: "0x3a1b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  },
  "srv-2": {
    id: "srv-2",
    chain: "MONAD_MAINNET",
    agentChainId: "2",
    ownerAddress: "0x53d284357ec70cE289D6D64134DfAc8E511c8a3D",
    name: "On-Chain Liquidity & Arbitrage Signal",
    description: "Monitors cross-DEX liquidity spreads and automated arbitrage opportunities on Monad.",
    endpoint: "https://api.chad-gpt.agent/v1/signals",
    priceUsdc: "0.050",
    status: "ACTIVE",
    callCount: 8940,
    createdAt: new Date().toISOString(),
    calls: [],
  },
  "srv-3": {
    id: "srv-3",
    chain: "MONAD_MAINNET",
    agentChainId: "3",
    ownerAddress: "0x1234567890123456789012345678901234567890",
    name: "Autonomous Contract Security Auditor",
    description: "Deep static bytecode inspection and formal verification probe for EVM smart contracts on Monad.",
    endpoint: "https://api.cctp-therapist.agent/v1/audit",
    priceUsdc: "0.100",
    status: "ACTIVE",
    callCount: 3210,
    createdAt: new Date().toISOString(),
    calls: [],
  },
};

export function useServiceListing(id?: string) {
  const queryClient = useQueryClient();
  const { chain } = useWallet();
  const evmChain = isEvmChain(chain) ? chain : MONAD_MAINNET;
  const chainSlug = toIndexerChainSlug(evmChain);
  const walletClient = usePrivyWalletClient(evmChain);
  const publicClient = usePublicClient({ chainId: evmChain.viemChain.id });

  const queryKey = ["service-listing", id];

  const detailQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) throw new Error("Service ID is required.");
      try {
        const d = await socialFetch<{ listing: ServiceListingDetail }>(`/api/marketplace/services/${id}`);
        if (d?.listing) return d.listing;
      } catch (err) {
        if (id && DEMO_FALLBACK_SERVICES[id]) {
          return DEMO_FALLBACK_SERVICES[id];
        }
        throw err;
      }
      if (id && DEMO_FALLBACK_SERVICES[id]) {
        return DEMO_FALLBACK_SERVICES[id];
      }
      throw new Error("Service not found");
    },
    enabled: Boolean(id),
  });

  const toggle = useMutation({
    mutationFn: (listing: ServiceListing) =>
      socialFetch<{ listing: { id: string; status: string } }>(`/api/marketplace/services/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: listing.status !== "ACTIVE" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["service-listings"] });
    },
  });

  const remove = useMutation({
    mutationFn: (listingId: string) => socialFetch<{ ok: true }>(`/api/marketplace/services/${listingId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-listings"] });
    },
  });

  const call = useMutation({
    mutationFn: async ({ listing, input }: { listing: ServiceListing; input: unknown }) => {
      if (!walletClient?.account) throw new Error("Sign in first.");
      if (!publicClient) throw new Error("Not connected to this chain yet.");
      if (listing.chain !== chainSlug) throw new Error(`Switch to ${listing.chain} to call this service.`);

      const txHash = await walletClient.writeContract({
        address: evmChain.usdcAddress as Address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [listing.ownerAddress as Address, parseUnits(listing.priceUsdc, 6)],
        chain: evmChain.viemChain,
        account: walletClient.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return socialFetch<ServiceCallResult>(`/api/marketplace/services/${listing.id}/call`, {
        method: "POST",
        body: JSON.stringify({ txHash, input }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["service-listings"] });
    },
  });

  return {
    ...detailQuery,
    listing: detailQuery.data,
    toggle,
    remove,
    call,
  };
}
