"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
interface Evidence {
  completionId: string;
  model: string;
  signatureKind: string;
  verified: boolean;
  verifiedAt: string;
  evidenceJson?: string | null;
}
export function AttestationCard({
  chain,
  agentChainId,
}: {
  chain: string;
  agentChainId: string;
}) {
  const [data, setData] = useState<{
    evidence: Evidence | null;
    configured: boolean;
  } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(
      `/api/agents/${encodeURIComponent(chain)}/${encodeURIComponent(agentChainId)}/attestation`,
      { signal: c.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
    return () => c.abort();
  }, [chain, agentChainId]);
  const evidence = data?.evidence;
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2">
        {evidence?.verified ? (
          <ShieldCheck className="h-4 w-4 text-emerald" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-text-tertiary" />
        )}
        NEAR AI inference evidence
      </h3>
      {evidence ? (
        <>
          <p className="text-xs text-text-secondary">
            {evidence.verified
              ? "Response signature verified against model TEE evidence"
              : "Evidence has not been verified"}
          </p>
          <dl className="text-xs text-text-tertiary space-y-1">
            <div>Model: {evidence.model}</div>
            <div>Signature: {evidence.signatureKind}</div>
            <div>
              Verified: {new Date(evidence.verifiedAt).toLocaleString()}
            </div>
            <div className="break-all">Completion: {evidence.completionId}</div>
          </dl>
          {evidence.evidenceJson && (
            <details className="text-xs text-text-tertiary">
              <summary className="cursor-pointer text-accent-violet">
                Inspect model attestation and response signature
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-bg-surface p-3 whitespace-pre-wrap break-all">
                {evidence.evidenceJson}
              </pre>
            </details>
          )}
        </>
      ) : (
        <p className="text-xs text-text-tertiary">
          {data?.configured
            ? "No verified NEAR AI response recorded for this agent yet."
            : "NEAR AI private inference is not configured for this runtime."}
        </p>
      )}
      <a
        href="https://docs.near.ai/cloud/verification"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-accent-violet underline"
      >
        How model attestation and response verification work
      </a>
    </section>
  );
}
