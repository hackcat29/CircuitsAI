import {
  custom,
  createPublicClient,
  http,
  serializeTransaction,
  keccak256,
  encodeFunctionData,
  parseAbi,
  recoverAddress,
  hexToBytes,
  type Address,
  type Hex,
  type TransactionSerializableEIP1559,
  type EIP1193RequestFn,
} from "viem";
import bs58 from "bs58";
import type { Account } from "near-api-js";
import { NearClient } from "./client.js";

export interface EvmPolicy {
  chain_id: number;
  token: string;
  recipients: string[];
  max_per_transfer: string;
  daily_limit: string;
  max_gas: string;
  max_fee_per_gas: string;
  next_nonce: string;
  day: number;
  spent: string;
}
export interface MpcSignature {
  big_r: { affine_point: string };
  s: { scalar: string };
  recovery_id: number;
}
const ORDER =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const TRANSFER_ABI = parseAbi([
  "function transfer(address,uint256) returns (bool)",
]);
export const derivationPath = (chainId: number) => {
  if (!Number.isSafeInteger(chainId) || chainId <= 0)
    throw new Error("Invalid EVM chain ID");
  return `circuits/evm/${chainId}`;
};
export function publicKeyToEvm(publicKey: string): Address {
  if (!publicKey.startsWith("secp256k1:"))
    throw new Error("Expected secp256k1 key");
  const decoded = bs58.decode(publicKey.slice(10));
  if (decoded.length !== 64)
    throw new Error("Expected uncompressed NEAR secp256k1 key");
  return `0x${keccak256(decoded).slice(-40)}`;
}
export function normalizeMpcSignature(signature: MpcSignature) {
  const point = signature.big_r.affine_point.replace(/^0x/, "");
  const scalar = signature.s.scalar.replace(/^0x/, "");
  if (
    !/^(02|03)[0-9a-fA-F]{64}$/.test(point) ||
    !/^[0-9a-fA-F]{64}$/.test(scalar) ||
    ![0, 1].includes(signature.recovery_id)
  )
    throw new Error("Invalid MPC signature");
  let s = BigInt(`0x${scalar}`),
    yParity = signature.recovery_id;
  if (s === 0n || s >= ORDER) throw new Error("Invalid signature scalar");
  if (s > ORDER / 2n) {
    s = ORDER - s;
    yParity ^= 1;
  }
  return {
    r: `0x${point.slice(2)}` as Hex,
    s: `0x${s.toString(16).padStart(64, "0")}` as Hex,
    yParity,
  };
}
export async function derivedEvmAddress(
  client: NearClient,
  mpc: string,
  agentId: string,
  chainId: number,
) {
  const publicKey = await client.view<string>(mpc, "derived_public_key", {
    path: derivationPath(chainId),
    predecessor: agentId,
    domain_id: 0,
  });
  return publicKeyToEvm(publicKey);
}

/** Every signature request is an ERC-20 transfer reconstructed and limited by the agent's NEAR contract. */
export async function signEvmUsdcTransfer(input: {
  client: NearClient;
  runtime: Account;
  address: Address;
  token: Address;
  chainId: number;
  recipient: Address;
  amount: bigint;
  nonce: number;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}) {
  const tx: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: input.chainId,
    nonce: input.nonce,
    gas: input.gas,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
    to: input.token,
    value: 0n,
    accessList: [],
    data: encodeFunctionData({
      abi: TRANSFER_ABI,
      functionName: "transfer",
      args: [input.recipient, input.amount],
    }),
  };
  const hash = keccak256(serializeTransaction(tx));
  const args = {
    request: {
      chain_id: input.chainId,
      nonce: String(input.nonce),
      recipient: input.recipient,
      amount: input.amount.toString(),
      gas_limit: input.gas.toString(),
      max_fee_per_gas: input.maxFeePerGas.toString(),
      max_priority_fee_per_gas: input.maxPriorityFeePerGas.toString(),
    },
  };
  const onchainHash = await input.client.view<number[]>(
    input.runtime.accountId,
    "get_transfer_hash",
    args,
  );
  if (keccak256(Uint8Array.from(onchainHash)) !== keccak256(hexToBytes(hash)))
    throw new Error("Contract and client transaction hashes disagree");
  const result = await input.client.call<MpcSignature>(
    input.runtime,
    input.runtime.accountId,
    "sign_transfer",
    args,
    300_000_000_000_000n,
  );
  const signature = normalizeMpcSignature(result.value);
  const recovered = await recoverAddress({ hash, signature });
  if (recovered.toLowerCase() !== input.address.toLowerCase())
    throw new Error("MPC signature does not match agent address");
  return {
    serializedTransaction: serializeTransaction(tx, signature),
    nearTransactionHash: result.transactionHash,
  };
}

/** viem transport for existing Circuits payment paths. No foreign-chain private key or arbitrary hash API. */
export async function createNearEvmSigner(input: {
  client: NearClient;
  runtime: Account;
  mpc: string;
  chainId: number;
  evmRpcUrl: string;
}) {
  const address = await derivedEvmAddress(
    input.client,
    input.mpc,
    input.runtime.accountId,
    input.chainId,
  );
  const publicClient = createPublicClient({ transport: http(input.evmRpcUrl) });
  const request = async ({
    method,
    params,
  }: {
    method: string;
    params?: readonly unknown[];
  }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [address];
    if (method === "eth_chainId") return `0x${input.chainId.toString(16)}`;
    if (method !== "eth_sendTransaction")
      throw new Error(`NEAR wallet does not permit ${method}`);
    const tx = (
      params as [
        {
          from?: string;
          to: string;
          data?: string;
          value?: string;
          chainId?: string;
          gas?: string;
        },
      ]
    )[0];
    if (tx.from && tx.from.toLowerCase() !== address.toLowerCase())
      throw new Error("Wrong sender");
    if (tx.chainId && Number(BigInt(tx.chainId)) !== input.chainId)
      throw new Error("Wrong chain");
    if (tx.value && BigInt(tx.value) !== 0n)
      throw new Error("Native transfers are not enabled");
    const policy = await input.client.view<EvmPolicy | null>(
      input.runtime.accountId,
      "get_evm_policy",
      { chain_id: input.chainId },
    );
    if (!policy || tx.to.toLowerCase() !== policy.token.toLowerCase())
      throw new Error("Only the configured USDC contract is permitted");
    if (!/^0xa9059cbb0{24}[0-9a-fA-F]{40}[0-9a-fA-F]{64}$/.test(tx.data ?? ""))
      throw new Error("Only exact ERC-20 transfer calldata is permitted");
    const data = tx.data!;
    const recipient = `0x${data.slice(34, 74)}` as Address;
    const amount = BigInt(`0x${data.slice(74)}`);
    const nonce = await publicClient.getTransactionCount({
      address,
      blockTag: "pending",
    });
    const fees = await publicClient.estimateFeesPerGas();
    const gas = tx.gas
      ? BigInt(tx.gas)
      : await publicClient.estimateGas({
          account: address,
          to: tx.to as Address,
          data: data as Hex,
        });
    const signed = await signEvmUsdcTransfer({
      ...input,
      address,
      token: policy.token as Address,
      recipient,
      amount,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    return publicClient.sendRawTransaction({
      serializedTransaction: signed.serializedTransaction,
    });
  };
  return {
    address,
    account: address,
    transport: custom({ request: request as EIP1193RequestFn }),
  };
}
