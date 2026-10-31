import { NearWalletDashboard } from "@clawdhq/near-ui";
import { DryQuote } from "./DryQuote";
import { InferenceEvidence } from "./InferenceEvidence";
export default function Home() {
  return (
    <>
      <NearWalletDashboard />
      <DryQuote />
      <InferenceEvidence />
    </>
  );
}
