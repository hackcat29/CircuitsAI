export type NearNetwork = "testnet" | "mainnet" | "sandbox";
export const RUNTIME_METHODS = [
  "post_job",
  "deliver",
  "release",
  "open_dispute",
  "cancel_expired",
  "withdraw",
  "sign_transfer",
] as const;
export const NEAR_AI_MODEL = "z-ai/glm-5.3-flash";
export const NEAR_AI_BASE_URL = "https://cloud-api.near.ai/v1";
export const INTENTS_BASE_URL = "https://1click.chaindefuser.com/v0";

export function accountId(value: string): string {
  if (
    value.length < 2 ||
    value.length > 64 ||
    !/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value)
  )
    throw new Error("Invalid NEAR account ID");
  return value;
}
export function agentAccount(label: string, parent: string): string {
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(label))
    throw new Error("Invalid agent name");
  return accountId(`${label}.${accountId(parent)}`);
}
export function nearConfig() {
  const network = process.env.NEAR_NETWORK ?? "testnet";
  if (!["mainnet", "testnet", "sandbox"].includes(network))
    throw new Error("Invalid NEAR_NETWORK");
  const rpcUrl =
    process.env.NEAR_RPC_URL ??
    (network === "mainnet"
      ? "https://rpc.mainnet.near.org"
      : "https://rpc.testnet.near.org");
  if (network === "sandbox" && !process.env.NEAR_RPC_URL)
    throw new Error("Sandbox RPC URL required");
  const commerce = accountId(
    process.env.NEAR_COMMERCE_ACCOUNT ?? "commerce.circuits.testnet",
  );
  const mpc = accountId(
    process.env.NEAR_MPC_CONTRACT ??
      (network === "mainnet" ? "v1.signer" : "v1.signer-prod.testnet"),
  );
  return { network: network as NearNetwork, rpcUrl, commerce, mpc };
}
