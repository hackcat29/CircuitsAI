import { NextResponse } from "next/server";
import { NearClient, NearCommerce, nearConfig } from "@clawdhq/near";
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    if (!/^[1-9]\d*$/.test(jobId) || jobId.length > 20)
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    const config = nearConfig();
    const job = await new NearCommerce(
      new NearClient(config.rpcUrl),
      config.commerce,
    ).job(jobId);
    return NextResponse.json(
      { job, network: config.network, commerce: config.commerce },
      { status: job ? 200 : 404 },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to read NEAR job" },
      { status: 502 },
    );
  }
}
