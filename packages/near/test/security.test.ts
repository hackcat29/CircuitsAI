import { describe, it, expect, vi } from "vitest";
import { KeyPair, Account } from "near-api-js";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  keccak256,
  serializeTransaction,
  encodeFunctionData,
  parseAbi,
  type Hex,
} from "viem";
import { NearClient, provisionPlan } from "../src/client.js";
import { RUNTIME_METHODS, agentAccount } from "../src/config.js";
import {
  normalizeMpcSignature,
  derivationPath,
  signEvmUsdcTransfer,
} from "../src/evm.js";
import {
  NearIntents,
  quoteUsdcPayment,
  assertSettledPayment,
} from "../src/intents.js";

const token = "0x1111111111111111111111111111111111111111" as const;
const recipient = "0x2222222222222222222222222222222222222222" as const;

describe("agent authority", () => {
  it("builds two distinct keys and a finite, named-method scope", () => {
    const owner = KeyPair.fromRandom("ed25519"),
      runtime = KeyPair.fromRandom("ed25519");
    const plan = provisionPlan({
      accountId: "alpha.circuits.testnet",
      parentId: "circuits.testnet",
      ownerPublicKey: owner.getPublicKey().toString(),
      runtimePublicKey: runtime.getPublicKey().toString(),
      gasAllowanceYocto: "1000000000000000000000000",
      initialBalanceYocto: "10000",
      walletWasm: new Uint8Array([0, 97, 115, 109]),
      owner: "owner.testnet",
      commerce: "market.testnet",
      mpc: "v1.signer-prod.testnet",
      signatureDepositYocto: "1",
    });
    expect(plan.actions).toHaveLength(6);
    expect(
      JSON.stringify(plan.actions, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ).not.toContain("secretKey");
    expect(RUNTIME_METHODS).not.toContain("set_evm_policy");
    expect(RUNTIME_METHODS).not.toContain("set_paused");
  });
  it("rejects invalid labels and chain replay paths", () => {
    expect(() => agentAccount("alpha.other", "circuits.testnet")).toThrow();
    expect(derivationPath(143)).not.toBe(derivationPath(8453));
    expect(() => derivationPath(0)).toThrow();
  });
  it("refuses a full-access runtime key", async () => {
    const client = new NearClient("http://localhost:3030");
    vi.spyOn(client.provider, "viewAccessKey").mockResolvedValue({
      nonce: 0n,
      block_hash: "block",
      block_height: 1,
      permission: "FullAccess",
    });
    await expect(
      client.runtime(
        "alpha.circuits.testnet",
        KeyPair.fromRandom("ed25519").toString(),
      ),
    ).rejects.toThrow("function-call");
  });
  it("refuses wildcard or unlimited function-call keys", async () => {
    const client = new NearClient("http://localhost:3030");
    vi.spyOn(client.provider, "viewAccessKey").mockResolvedValue({
      nonce: 0n,
      block_hash: "block",
      block_height: 1,
      permission: {
        FunctionCall: {
          receiver_id: "alpha.circuits.testnet",
          allowance: null,
          method_names: [],
        },
      },
    });
    await expect(
      client.runtime(
        "alpha.circuits.testnet",
        KeyPair.fromRandom("ed25519").toString(),
      ),
    ).rejects.toThrow("safely scoped");
  });
});

describe("MPC transaction integrity", () => {
  it("matches the on-chain RLP reference", () => {
    const data = encodeFunctionData({
      abi: parseAbi(["function transfer(address,uint256) returns(bool)"]),
      functionName: "transfer",
      args: [recipient, 10n],
    });
    expect(
      keccak256(
        serializeTransaction({
          type: "eip1559",
          chainId: 8453,
          nonce: 0,
          maxPriorityFeePerGas: 1n,
          maxFeePerGas: 10n,
          gas: 65000n,
          to: token,
          value: 0n,
          data,
          accessList: [],
        }),
      ),
    ).toBe(
      "0x951be9ab4f146521c97d7b6d52397a079f1a21efafe277d88c935f6c04915d6b",
    );
  });
  it("rejects malformed signatures", () =>
    expect(() =>
      normalizeMpcSignature({
        big_r: { affine_point: "00" },
        s: { scalar: "00" },
        recovery_id: 7,
      }),
    ).toThrow());
  it("rejects a gateway signing a different transaction before requesting an MPC signature", async () => {
    const client = new NearClient("http://localhost:3030");
    vi.spyOn(client, "view").mockResolvedValue(Array(32).fill(0));
    const call = vi.spyOn(client, "call");
    await expect(
      signEvmUsdcTransfer({
        client,
        runtime: new Account("alpha.testnet", client.provider),
        address: privateKeyToAccount(generatePrivateKey()).address,
        token,
        chainId: 8453,
        recipient,
        amount: 10n,
        nonce: 0,
        gas: 65000n,
        maxFeePerGas: 10n,
        maxPriorityFeePerGas: 1n,
      }),
    ).rejects.toThrow("hashes disagree");
    expect(call).not.toHaveBeenCalled();
  });
});

const tokens = [
  {
    assetId: "nep141:usdc.near",
    symbol: "USDC",
    decimals: 6,
    blockchain: "near",
  },
  {
    assetId: "nep141:eth.omft.near",
    symbol: "ETH",
    decimals: 18,
    blockchain: "eth",
  },
];
function mockIntents() {
  const requests: Record<string, unknown>[] = [];
  const fetcher = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/tokens")) return Response.json(tokens);
      const request = JSON.parse(String(init?.body));
      requests.push(request);
      return Response.json({
        quote: {
          amountIn: "10000000000000",
          amountOut: "1000000",
          ...(request.dry ? {} : { depositAddress: "0xdeposit" }),
        },
        quoteRequest: request,
      });
    },
  );
  return {
    client: new NearIntents({ fetch: fetcher as typeof fetch }),
    requests,
  };
}

describe("mainnet Intents invoices", () => {
  it("defaults to dry-run and pins provider USDC and exact output", async () => {
    const { client, requests } = mockIntents();
    const result = await quoteUsdcPayment(client, {
      originAsset: tokens[1].assetId,
      destinationAsset: tokens[0].assetId,
      recipient: "provider.near",
      refundTo: "0xrefund",
      amountUsdcMicros: "1000000",
    });
    expect(requests[0]).toMatchObject({
      dry: true,
      swapType: "EXACT_OUTPUT",
      recipient: "provider.near",
      amount: "1000000",
      destinationAsset: tokens[0].assetId,
    });
    expect(result.quote.depositAddress).toBeUndefined();
  });
  it("rejects unsupported testnet assets and zero amounts", async () => {
    const { client } = mockIntents();
    await expect(
      client.quote({
        originAsset: "testnet:ETH",
        destinationAsset: tokens[0].assetId,
        amount: "1",
        recipient: "p.near",
        refundTo: "0xrefund",
      }),
    ).rejects.toThrow("Unsupported");
    await expect(
      client.quote({
        originAsset: tokens[1].assetId,
        destinationAsset: tokens[0].assetId,
        amount: "0",
        recipient: "p.near",
        refundTo: "0xrefund",
      }),
    ).rejects.toThrow("positive");
  });
  it("refuses non-USDC invoice destinations", async () => {
    const { client } = mockIntents();
    await expect(
      quoteUsdcPayment(client, {
        originAsset: tokens[0].assetId,
        destinationAsset: tokens[1].assetId,
        recipient: "p.near",
        refundTo: "0xrefund",
        amountUsdcMicros: "1",
      }),
    ).rejects.toThrow("USDC");
  });
  it("does not accept a completed swap for a different recipient", () => {
    expect(() =>
      assertSettledPayment(
        {
          status: "SUCCESS",
          quoteResponse: {
            quote: { amountIn: "1", amountOut: "1000000" },
            quoteRequest: {
              recipient: "attacker.near",
              destinationAsset: tokens[0].assetId,
            },
          },
        },
        {
          recipient: "provider.near",
          destinationAsset: tokens[0].assetId,
          amountUsdcMicros: "1000000",
        },
      ),
    ).toThrow("not settled");
  });
  it("does not accept a quote before settlement", () => {
    expect(() =>
      assertSettledPayment(
        {
          status: "PENDING_DEPOSIT",
          quoteResponse: {
            quote: { amountIn: "1", amountOut: "1000000" },
            quoteRequest: {
              recipient: "provider.near",
              destinationAsset: tokens[0].assetId,
            },
          },
        },
        {
          recipient: "provider.near",
          destinationAsset: tokens[0].assetId,
          amountUsdcMicros: "1000000",
        },
      ),
    ).toThrow("not settled");
  });
});
