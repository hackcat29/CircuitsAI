"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, parseUnits, type Address } from "viem";
import { socialFetch } from "@/lib/social/api";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

export interface SubscriptionWallet {
  address: string;
  status: "ACTIVE" | "WITHDRAWN" | "REVOKED";
  balanceUsdc: string;
}

export interface SubscriptionWithdrawResult {
  txHashOrRef: string;
  amount: string;
  asset: string;
}

/** The custodied wallet for one subscription — address, live balance, deposit (a plain
 * client-side ERC20 transfer from the connected wallet, no server/custody involvement at all),
 * and withdraw (server-side, sweeps back to the verified session owner — see
 * lib/server/subscriptions/withdraw.ts). */
export function useSubscriptionWallet(subscriptionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["subscription-wallet", subscriptionId];
  const { chain } = useWallet();
  // Rules-of-hooks requires calling this unconditionally even when `chain` isn't EVM right
  // now — same "fall back to a fixed EVM chain, the result just goes unused" pattern
  // useAgentRegistration.ts etc. already use for their own per-chain-family adapter hooks.
  const evmWalletClient = usePrivyWalletClient(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [evmDepositing, setEvmDepositing] = useState(false);

  const walletQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ wallet: SubscriptionWallet }>(`/api/subscriptions/${subscriptionId}/wallet`).then((d) => d.wallet),
    enabled: Boolean(subscriptionId),
    // Balance can change from an externally-sent deposit at any time, not just through this
    // hook's own deposit mutation — poll rather than relying solely on invalidation.
    refetchInterval: 15_000,
  });

  const withdraw = useMutation({
    mutationFn: () => socialFetch<SubscriptionWithdrawResult>(`/api/subscriptions/${subscriptionId}/wallet/withdraw`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function depositFromConnectedWallet(amountUsdc: string): Promise<void> {
    if (!walletQuery.data) throw new Error("No subscription wallet to deposit to yet");
    if (!isEvmChain(chain)) throw new Error("Deposits for this chain aren't wired up yet");
    if (!evmWalletClient) throw new Error("Sign in first");

    setEvmDepositing(true);
    try {
      await evmWalletClient.writeContract({
        address: chain.usdcAddress as Address,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [walletQuery.data.address as Address, parseUnits(amountUsdc, 6)],
        chain: chain.viemChain,
        account: evmWalletClient.account!,
      });
    } finally {
      setEvmDepositing(false);
    }
    await queryClient.invalidateQueries({ queryKey });
  }

  return {
    ...walletQuery,
    wallet: walletQuery.data ?? null,
    withdraw,
    depositFromConnectedWallet,
    depositing: evmDepositing,
  };
}
