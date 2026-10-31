"use client";

import toast from "react-hot-toast";
import { BSC_TESTNET, MONAD_MAINNET, type ChainId } from "./chains";
import { useActiveChainStore } from "@/hooks/useActiveChain";

/**
 * Checks if the current active chain matches the target chain for an on-chain action.
 * If there is a mismatch, displays a warning toast asking the user to switch chain
 * to Monad, complete with a direct switch button.
 *
 * @param targetChain The origin chain of the item (slug e.g. "MONAD_MAINNET" | "BSC_TESTNET", or chainId)
 * @param actionDesc Descriptive label for the action (e.g. "trade this token", "buy this token")
 * @returns true if the active chain matches; false if mismatched and warning was shown
 */
export function checkOperationChain(
  targetChain: string | number | undefined,
  actionDesc: string = "continue"
): boolean {
  const activeChainId = useActiveChainStore.getState().activeChainId;
  const setActiveChainId = useActiveChainStore.getState().setActiveChainId;

  // Normalize target chain
  let targetChainId: ChainId = MONAD_MAINNET.chainId;
  let targetName = "Monad";

  if (typeof targetChain === "number") {
    if (targetChain === BSC_TESTNET.chainId) {
      targetChainId = BSC_TESTNET.chainId;
      targetName = "BNB";
    }
  } else if (typeof targetChain === "string") {
    const clean = targetChain.trim().toUpperCase();
    if (clean.includes("BSC") || clean.includes("BNB") || clean === "97") {
      targetChainId = BSC_TESTNET.chainId;
      targetName = "BNB";
    }
  }

  if (activeChainId !== targetChainId) {
    const itemNoun = actionDesc.includes("token") ? "token" : actionDesc.includes("launch") ? "launch" : "item";
    toast(
      (t) => (
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="text-base leading-none">⚠️</span>
            <span>
              This {itemNoun} is deployed on <strong>{targetName}</strong>. Please switch chain to{" "}
              <strong>{targetName}</strong> to {actionDesc}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveChainId(targetChainId);
              toast.dismiss(t.id);
              toast.success(`Switched to ${targetName}`, { duration: 2500 });
            }}
            className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 shrink-0 transition-colors cursor-pointer"
          >
            Switch to {targetName}
          </button>
        </div>
      ),
      {
        duration: 5000,
        style: {
          background: "#12141a",
          color: "#ffffff",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          padding: "12px 16px",
          borderRadius: "10px",
          boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
        },
      }
    );
    return false;
  }

  return true;
}
