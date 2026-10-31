import {
  Account,
  JsonRpcProvider,
  KeyPair,
  actions,
  type Action,
} from "near-api-js";
import { accountId, nearConfig, RUNTIME_METHODS } from "./config.js";

export class NearClient {
  readonly provider: JsonRpcProvider;
  constructor(readonly rpcUrl = nearConfig().rpcUrl) {
    this.provider = new JsonRpcProvider({ url: rpcUrl });
  }
  async view<T>(
    contract: string,
    method: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const value = await this.provider.callFunction({
      contractId: accountId(contract),
      method,
      args,
    });
    if (value === undefined)
      throw new Error(`Empty response from ${contract}.${method}`);
    return value as T;
  }
  async call<T>(
    account: Account,
    receiver: string,
    method: string,
    args: Record<string, unknown>,
    gas = 100_000_000_000_000n,
    deposit = 0n,
  ): Promise<{ value: T; transactionHash: string }> {
    const outcome = await account.signAndSendTransaction({
      receiverId: accountId(receiver),
      actions: [actions.functionCall(method, args, gas, deposit)],
      waitUntil: "FINAL",
      throwOnFailure: true,
    });
    if (
      typeof outcome.status !== "object" ||
      !("SuccessValue" in outcome.status)
    )
      throw new Error(`NEAR ${method} did not return success`);
    const encoded = outcome.status.SuccessValue;
    const value = encoded
      ? (JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as T)
      : (undefined as T);
    return { value, transactionHash: outcome.transaction.hash };
  }
  account(id: string, secret: string): Account {
    // Full-access credentials are accepted only by the separate owner-side provisioning CLI.
    return new Account(
      accountId(id),
      this.provider,
      KeyPair.fromString(secret as `ed25519:${string}`).toString(),
    );
  }
  async runtime(id: string, secret: string): Promise<Account> {
    const key = KeyPair.fromString(secret as `ed25519:${string}`);
    const access = await this.provider.viewAccessKey({
      accountId: accountId(id),
      publicKey: key.getPublicKey(),
    });
    const permission = access.permission;
    if (permission === "FullAccess" || !("FunctionCall" in permission))
      throw new Error("Runtime requires a function-call key");
    const scope = permission.FunctionCall;
    if (
      scope.receiver_id !== id ||
      !scope.allowance ||
      BigInt(scope.allowance) <= 0n ||
      scope.method_names.length === 0 ||
      scope.method_names.some(
        (m) => !RUNTIME_METHODS.includes(m as (typeof RUNTIME_METHODS)[number]),
      )
    )
      throw new Error("Runtime key is not safely scoped");
    return this.account(id, secret);
  }
}

export { provisionPlan, type AgentProvisionPlan } from "./wallet-plan.js";
