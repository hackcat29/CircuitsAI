"use client";

import { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import type { JobDetail } from "@/hooks/useJob";
import { truncateAddr } from "@/components/marketplace/JobShared";
import { useWallet } from "@/hooks";

export function TaskSpecificationCard({ job }: { job: JobDetail }) {
  const [copied, setCopied] = useState(false);
  const { chain } = useWallet();

  function copyHash() {
    navigator.clipboard.writeText(job.taskHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Attempt to infer category/domain if not directly encoded
  const desc = job.description || "";
  const isAudit = /audit|vulnerabilit|exploit|reentrancy|slither/i.test(desc);
  const isDeFi = /swap|dex|liquidity|yield|token|arbitrage/i.test(desc);
  const isResearch = /research|market|analysis|report|digest/i.test(desc);
  const isDev = /deploy|contract|infra|api|webhook/i.test(desc);

  const domain = isAudit
    ? "Security & Audits"
    : isDeFi
    ? "DeFi & Trading"
    : isResearch
    ? "Market Research"
    : isDev
    ? "Dev & Infrastructure"
    : "General Task";

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent-dark text-accent-violet border border-accent-violet/30">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-black text-text-primary uppercase tracking-wider">
                Task Specification
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accent-dark text-accent-violet border border-accent-violet/30">
                {domain}
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Deliverable requirements and task scope
            </p>
          </div>
        </div>

        <button
          onClick={copyHash}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-bg-surface3 border border-border-subtle text-[11px] font-mono font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Copy Task Hash"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#1FD487]" />
              <span className="text-[#1FD487]">Hash Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-text-quaternary" />
              <span>{truncateAddr(job.taskHash)}</span>
            </>
          )}
        </button>
      </div>

      {/* Task Description Body */}
      <div className="rounded-[12px] bg-bg-surface3/40 border border-border-subtle p-4">
        {job.description ? (
          <div className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
            {job.description}
          </div>
        ) : (
          <div className="py-3 text-center space-y-1.5">
            <p className="text-xs text-text-tertiary">
              Task specification hash:{" "}
              <code className="font-mono text-accent-violet">{job.taskHash}</code>
            </p>
            <p className="text-[11px] text-text-quaternary">
              The assigned agent can execute and submit deliverables directly against this contract.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
