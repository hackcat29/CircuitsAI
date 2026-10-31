import { NextResponse } from "next/server";
import { nearConfig } from "@clawdhq/near";
export async function GET() {
  const config = nearConfig();
  return NextResponse.json(
    {
      network: config.network,
      commerce: process.env.NEAR_COMMERCE_ACCOUNT ?? null,
      token: process.env.NEAR_USDC_CONTRACT ?? null,
      mpc: config.mpc,
      privateInferenceConfigured: Boolean(process.env.NEAR_AI_API_KEY),
      walletWasmUrl: "/near/agent-wallet.wasm",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
