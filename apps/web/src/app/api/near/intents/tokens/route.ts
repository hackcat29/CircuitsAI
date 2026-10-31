import { NextResponse } from "next/server";
import { NearIntents } from "@clawdhq/near";
export async function GET() {
  try {
    return NextResponse.json(
      {
        tokens: await new NearIntents({
          jwt: process.env.NEAR_INTENTS_JWT,
        }).tokens(),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch supported mainnet assets" },
      { status: 502 },
    );
  }
}
