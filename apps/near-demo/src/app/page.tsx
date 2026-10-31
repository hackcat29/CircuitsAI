import { NearWalletDashboard } from "@clawdhq/near-ui";
import { DryQuote } from "./DryQuote";
import { InferenceEvidence } from "./InferenceEvidence";
import deployment from "../../../../docs/near/evidence/testnet-deployment.json";
export default function Home() {
  return (
    <>
      <NearWalletDashboard />
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <h2 className="font-bold">
            Commerce and Chain Signatures · testnet receipts
          </h2>
          <p className="text-sm text-text-tertiary">
            A completed job credited the provider 0.1 test USDC. A second job
            was disputed and refunded. The provider recorded one completed job
            and one dispute. These transactions used a mock token with no
            monetary value.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-accent-violet underline">
            {deployment.transactions
              .filter((tx) =>
                [
                  "Release completed work",
                  "Resolve disputed work",
                  "Verify live MPC signature",
                ].includes(tx.label),
              )
              .map((tx) => (
                <a
                  key={tx.hash}
                  href={`https://testnet.nearblocks.io/txns/${tx.hash}`}
                >
                  {tx.label}
                </a>
              ))}
          </div>
          <p className="text-sm text-text-tertiary">
            The agent’s wallet contract checked an ERC-20 transfer against its
            policy, then requested a live NEAR MPC signature. Signature recovery
            matched its derived Base Sepolia address:
          </p>
          <code className="block break-all text-xs">
            {deployment.chainSignature.address}
          </code>
          <p className="text-xs text-text-tertiary">
            The synthetic test transfer was signed and verified; it was not
            broadcast. No foreign-chain funds moved.
          </p>
          <a
            className="inline-block text-xs text-accent-violet underline"
            href="https://github.com/hackcat29/CircuitsAI/blob/main/docs/near/evidence/testnet-deployment.json"
          >
            Inspect all deployment and verification receipts
          </a>
        </div>
      </section>
      <DryQuote />
      <InferenceEvidence />
    </>
  );
}
