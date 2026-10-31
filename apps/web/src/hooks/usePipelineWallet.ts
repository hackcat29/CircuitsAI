"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAbi, parseUnits, type Address } from "viem";
import { socialFetch } from "@/lib/social/api";
import { useWallet } from "./useWallet";
import { usePrivyWalletClient } from "./usePrivyWalletClient";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";

const ERC20_TRANSFER_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

export interface PipelineWallet {
  address: string;
  status: "ACTIVE" | "WITHDRAWN" | "REVOKED";
  balanceUsdc: string;
}

export interface PipelineWithdrawResult {
  txHashOrRef: string;
  amount: string;
  asset: string;
}

/** The custodied wallet for one pipeline — address, live balance, deposit (a plain client-side
 * ERC20 transfer from the connected wallet, no server/custody involvement, same shape as
 * useSubscriptionWallet), and withdraw (server-side, sweeps back to the verified session
 * owner). Every step's job — including the first — is posted from this wallet, not the
 * connected browser wallet, so it must be funded with at least the pipeline's total budget
 * before Run will do anything. */
export function usePipelineWallet(pipelineId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["pipeline-wallet", pipelineId];
  const { chain } = useWallet();
  const evmWalletClient = usePrivyWalletClient(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const [evmDepositing, setEvmDepositing] = useState(false);

  const walletQuery = useQuery({
    queryKey,
    queryFn: () => socialFetch<{ wallet: PipelineWallet }>(`/api/orchestration/pipelines/${pipelineId}/wallet`).then((d) => d.wallet),
    enabled: Boolean(pipelineId),
    // Balance can change from an externally-sent deposit at any time — poll rather than
    // relying solely on invalidation, same as useSubscriptionWallet.
    refetchInterval: 15_000,
  });

  const withdraw = useMutation({
    mutationFn: () => socialFetch<PipelineWithdrawResult>(`/api/orchestration/pipelines/${pipelineId}/wallet/withdraw`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function depositFromConnectedWallet(amountUsdc: string): Promise<void> {
    if (!walletQuery.data) throw new Error("No pipeline wallet to deposit to yet");
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
