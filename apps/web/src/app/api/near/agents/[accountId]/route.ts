import { NextResponse } from "next/server";
import { NearClient, NearCommerce, accountId, nearConfig } from "@clawdhq/near";
export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const id = accountId((await context.params).accountId);
    const config = nearConfig();
    if (!process.env.NEAR_COMMERCE_ACCOUNT)
      return NextResponse.json(
        { configured: false, network: config.network },
        { status: 503 },
      );
    const client = new NearClient(config.rpcUrl);
    const [agent, wallet, keys] = await Promise.all([
      new NearCommerce(client, config.commerce).agent(id),
      client.view(id, "get_config"),
      client.provider.viewAccessKeyList({ accountId: id }),
    ]);
    if (!agent)
      return NextResponse.json(
        { error: "Agent not registered" },
        { status: 404 },
      );
    return NextResponse.json(
      {
        configured: true,
        accountId: id,
        network: config.network,
        commerce: config.commerce,
        agent,
        wallet,
        keys: keys.keys,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to read NEAR agent" },
      { status: 400 },
    );
  }
}
