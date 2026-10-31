"use client";

import { useState } from "react";
import { X, QrCode, Copy, Check, ExternalLink, ShieldCheck, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/format";

interface DepositQrModalProps {
  address: string;
  chainName: string;
  explorerUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Deterministic visual QR pattern generator based on the address string */
function QrMatrix({ text }: { text: string }) {
  // Simple deterministic hash to create a crisp 17x17 visual grid
  const cells: boolean[][] = [];
  const size = 19;

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      // Corner position detection patterns
      const isTopLeft = r < 5 && c < 5;
      const isTopRight = r < 5 && c >= size - 5;
      const isBottomLeft = r >= size - 5 && c < 5;

      if (isTopLeft || isTopRight || isBottomLeft) {
        const borderR = (isTopLeft && (r === 0 || r === 4)) || (isTopRight && (r === 0 || r === 4)) || (isBottomLeft && (r === size - 5 || r === size - 1));
        const borderC = (isTopLeft && (c === 0 || c === 4)) || (isTopRight && (c === size - 5 || c === size - 1)) || (isBottomLeft && (c === 0 || c === 4));
        const center = (isTopLeft && r === 2 && c === 2) || (isTopRight && r === 2 && c === size - 3) || (isBottomLeft && r === size - 3 && c === 2);
        row.push(borderR || borderC || center);
      } else {
        const charCode = text.charCodeAt((r * size + c) % text.length) || 0;
        const seed = (r * 31 + c * 17 + charCode) % 100;
        row.push(seed < 48);
      }
    }
    cells.push(row);
  }

  return (
    <div className="p-4 rounded-[16px] bg-white border border-border-strong shadow-lg inline-block">
      <div className="grid grid-cols-19 gap-0.75 w-44 h-44">
        {cells.map((row, r) =>
          row.map((active, c) => (
            <div
              key={`${r}-${c}`}
              className={cn("rounded-[1px]", active ? "bg-black" : "bg-white")}
            />
          )),
        )}
      </div>
    </div>
  );
}

export function DepositQrModal({
  address,
  chainName,
  explorerUrl,
  isOpen,
  onClose,
}: DepositQrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  function handleCopy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-bg-elevated border border-border-strong rounded-[20px] max-w-sm w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface3/30">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-accent-dark border border-accent-violet/30 flex items-center justify-center text-accent-violet">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-extrabold text-text-primary">Receive &amp; Deposit</h3>
              <p className="text-[10.5px] text-text-tertiary">Deposit USDC on {chainName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-text-quaternary hover:text-text-primary hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <QrMatrix text={address} />

          <div className="w-full space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary block">
              Your Wallet Address ({chainName})
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-bg-surface border border-border-strong text-xs font-mono break-all text-text-secondary">
              <span className="flex-1 select-all">{address}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-[6px] bg-accent-dark hover:bg-accent-violet text-accent-violet hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Address"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Only send testnet USDC or native tokens on supported EVM networks ({chainName}, Base Sepolia, Ethereum Sepolia).
          </p>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-border-subtle bg-bg-surface3/20 flex items-center justify-between text-xs">
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold text-accent-violet hover:underline flex items-center gap-1"
          >
            <span>View on Explorer</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[8px] bg-accent-violet text-white font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
