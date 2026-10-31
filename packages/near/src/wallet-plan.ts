import { actions, type Action } from "near-api-js";
import { accountId, RUNTIME_METHODS } from "./config.js";
export interface AgentProvisionPlan {
  accountId: string;
  parentId: string;
  ownerPublicKey: string;
  runtimePublicKey: string;
  gasAllowanceYocto: string;
  initialBalanceYocto: string;
  actions: Action[];
}

/** Constructs an owner-signed atomic creation batch. Never creates or receives an owner's private key. */
export function provisionPlan(input: {
  accountId: string;
  parentId: string;
  ownerPublicKey: string;
  runtimePublicKey: string;
  gasAllowanceYocto: string;
  initialBalanceYocto: string;
  walletWasm: Uint8Array;
  owner: string;
  commerce: string;
  mpc: string;
  signatureDepositYocto: string;
}): AgentProvisionPlan {
  const id = accountId(input.accountId),
    parent = accountId(input.parentId);
  if (
    !id.endsWith(`.${parent}`) ||
    id.slice(0, -parent.length - 1).includes(".")
  )
    throw new Error("Must create an immediate sub-account");
  if (input.ownerPublicKey === input.runtimePublicKey)
    throw new Error("Owner and runtime keys must differ");
  const allowance = BigInt(input.gasAllowanceYocto),
    balance = BigInt(input.initialBalanceYocto);
  if (balance <= 0n) throw new Error("Positive account balance required");
  if (allowance < 400_000_000_000_000_000_000_000n)
    throw new Error(
      "A finite gas allowance of at least 0.4 NEAR is required for MPC requests",
    );
  const ownerKey = KeyPairPublic(input.ownerPublicKey),
    runtimeKey = KeyPairPublic(input.runtimePublicKey);
  return {
    accountId: id,
    parentId: parent,
    ownerPublicKey: input.ownerPublicKey,
    runtimePublicKey: input.runtimePublicKey,
    gasAllowanceYocto: allowance.toString(),
    initialBalanceYocto: balance.toString(),
    actions: [
      actions.createAccount(),
      actions.transfer(balance),
      actions.deployContract(input.walletWasm),
      actions.addFullAccessKey(ownerKey),
      actions.addFunctionCallAccessKey(
        runtimeKey,
        id,
        [...RUNTIME_METHODS],
        allowance,
      ),
      actions.functionCall(
        "new",
        {
          owner: accountId(input.owner),
          commerce: accountId(input.commerce),
          mpc: accountId(input.mpc),
          signature_deposit: input.signatureDepositYocto,
          runtime_public_key: input.runtimePublicKey,
        },
        30_000_000_000_000n,
        0n,
      ),
    ],
  };
}
import { PublicKey } from "near-api-js";
function KeyPairPublic(value: string) {
  return PublicKey.fromString(value);
}

export { KeyPair } from "near-api-js";
