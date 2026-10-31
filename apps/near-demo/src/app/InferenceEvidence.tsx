"use client";
import { useEffect, useState } from "react";
interface Evidence {
  verified: boolean;
  completionId: string;
  model: string;
  signatureKind: string;
  verifiedAt: string;
  inputTokens: number;
  outputTokens: number;
  content: string;
  attestation: {
    tcbStatus: string;
    gpuEvidence: string;
    deploymentProvenance: string;
  };
}
export function InferenceEvidence() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_NEAR_DEMO_BASE_PATH ?? ""}/inference-verification.json`,
      { signal: c.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(setEvidence)
      .catch(() => {});
    return () => c.abort();
  }, []);
  if (!evidence) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 pb-10">
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="font-bold">
            Verified private inference · demo receipt
          </h2>
          <span className="text-xs text-emerald">
            {evidence.signatureKind} signature verified
          </span>
        </div>
        <p className="text-sm text-text-tertiary">
          A capped request through NEAR AI Cloud returned{" "}
          <code className="text-text-primary">{evidence.content}</code>. The
          official SDK verified the encrypted response against the model’s TEE
          evidence.
        </p>
        <dl className="grid sm:grid-cols-2 gap-2 text-xs text-text-tertiary">
          <div>Model: {evidence.model}</div>
          <div>
            Verified at: {new Date(evidence.verifiedAt).toLocaleString()}
          </div>
          <div>
            Hardware status: {evidence.attestation.tcbStatus} · GPU:{" "}
            {evidence.attestation.gpuEvidence}
          </div>
          <div>
            Tokens: {evidence.inputTokens} input / {evidence.outputTokens}{" "}
            output
          </div>
          <div className="break-all sm:col-span-2">
            Completion: {evidence.completionId}
          </div>
        </dl>
        <p className="text-xs text-text-tertiary">
          Deployment code provenance:{" "}
          {evidence.attestation.deploymentProvenance}. This receipt does not
          represent an independent code audit.
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer text-accent-violet">
            Inspect attestation and response-signature evidence
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto bg-bg-surface rounded-lg p-3 whitespace-pre-wrap break-all">
            {JSON.stringify(evidence, null, 2)}
          </pre>
        </details>
      </div>
    </section>
  );
}
