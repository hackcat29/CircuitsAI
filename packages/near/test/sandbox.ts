import { Sandbox, GenesisAccount } from "near-sandbox";
import { KeyPair, actions } from "near-api-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { NearClient, provisionPlan } from "../src/client.js";
import { NearCommerce } from "../src/commerce.js";
import type { CommerceAgent } from "../src/commerce.js";

const wasmRoot = new URL(
  "../../contracts-near/target/wasm32-unknown-unknown/release/",
  import.meta.url,
);
const code = async (name: string) =>
  new Uint8Array(await readFile(new URL(`circuits_${name}.wasm`, wasmRoot)));
const rootKey = KeyPair.fromRandom("ed25519");
const root = { accountId: "circuits" };
const sandbox = await Sandbox.start({
  version: "2.13.4",
  config: {
    additionalAccounts: [
      new GenesisAccount(
        root.accountId,
        rootKey.getPublicKey().toString(),
        rootKey.toString(),
        10_000n * 10n ** 24n,
      ),
    ],
  },
});
const report: Array<{ step: string; result: string }> = [];
const pass = (step: string, result: string) => {
  report.push({ step, result });
  process.stdout.write(`PASS ${step} → ${result}\n`);
};
try {
  const client = new NearClient(sandbox.rpcUrl);
  const owner = client.account(root.accountId, rootKey.toString());
  const publicKey = KeyPair.fromString(
    rootKey.toString() as `ed25519:${string}`,
  ).getPublicKey();
  const commerce = `market.${root.accountId}`,
    token = `usdc.${root.accountId}`;
  async function deploy(
    id: string,
    wasm: Uint8Array,
    args: Record<string, unknown>,
  ) {
    await owner.signAndSendTransaction({
      receiverId: id,
      actions: [
        actions.createAccount(),
        actions.transfer(15n * 10n ** 24n),
        actions.deployContract(wasm),
        actions.addFullAccessKey(publicKey),
        actions.functionCall("new", args, 40_000_000_000_000n, 0n),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
    });
  }
  await deploy(token, await code("mock_ft"), { owner: root.accountId });
  await deploy(commerce, await code("commerce"), {
    admin: root.accountId,
    token,
    arbiter: root.accountId,
  });
  const buyerId = `alpha.${root.accountId}`,
    providerId = `beta.${root.accountId}`;
  const buyerKey = KeyPair.fromRandom("ed25519"),
    providerKey = KeyPair.fromRandom("ed25519");
  for (const [id, key] of [
    [buyerId, buyerKey],
    [providerId, providerKey],
  ] as const) {
    const plan = provisionPlan({
      accountId: id,
      parentId: root.accountId,
      ownerPublicKey: publicKey.toString(),
      runtimePublicKey: key.getPublicKey().toString(),
      gasAllowanceYocto: "1000000000000000000000000",
      initialBalanceYocto: "15000000000000000000000000",
      walletWasm: await code("agent_wallet"),
      owner: root.accountId,
      commerce,
      mpc: `mpc.${root.accountId}`,
      signatureDepositYocto: "1",
    });
    await owner.signAndSendTransaction({
      receiverId: id,
      actions: plan.actions,
      waitUntil: "FINAL",
      throwOnFailure: true,
    });
    await client.call(owner, commerce, "register_agent", {
      agent_id: id,
      owner: root.accountId,
    });
  }
  const buyer = await client.runtime(buyerId, buyerKey.toString()),
    provider = await client.runtime(providerId, providerKey.toString());
  const market = new NearCommerce(client, commerce);
  pass(
    "Create agents",
    "owner full-access keys and finite function-call runtime keys installed",
  );
  await assert.rejects(() =>
    client.call(buyer, buyerId, "set_paused", { paused: true }),
  );
  await assert.rejects(() =>
    client.call(buyer, commerce, "register_agent", {
      agent_id: buyerId,
      owner: root.accountId,
    }),
  );
  pass(
    "Attack admin methods and another receiver",
    "NEAR access-key permissions reject both calls",
  );
  await client.call(owner, commerce, "set_policy", {
    agent_id: buyerId,
    max_per_job: "100000",
    daily_limit: "150000",
    providers: [providerId],
    paused: false,
  });
  await client.call(owner, token, "mint", {
    account_id: root.accountId,
    amount: "1000000",
  });
  const deposit = market.depositTransaction(buyerId, token, "1000000");
  await client.call(
    owner,
    deposit.receiverId,
    deposit.method,
    deposit.args,
    150_000_000_000_000n,
    1n,
  );
  assert.equal((await market.agent(buyerId))!.balance, "1000000");
  pass(
    "Deposit mock USDC via ft_transfer_call",
    "1.000000 USDC escrow balance credited by the configured token only",
  );
  const posted = await market.postJob(buyer, {
    provider: providerId,
    amountMicros: "100000",
    task: "Review an API integration",
    deadline: new Date(Date.now() + 86_400_000),
  });
  assert.equal((await market.job(posted.value))!.status, "Funded");
  await assert.rejects(() =>
    market.postJob(buyer, {
      provider: providerId,
      amountMicros: "100000",
      task: "Exceed daily cap",
      deadline: new Date(Date.now() + 86_400_000),
    }),
  );
  await assert.rejects(() =>
    market.postJob(buyer, {
      provider: root.accountId,
      amountMicros: "1",
      task: "Wrong provider",
      deadline: new Date(Date.now() + 86_400_000),
    }),
  );
  pass(
    "Try overspending and an unapproved provider",
    "contract rejects both while keeping the first escrow funded",
  );
  await assert.rejects(() => market.release(buyer, posted.value));
  await market.deliver(
    provider,
    posted.value,
    "Checked endpoints and documented the integration",
  );
  await market.release(buyer, posted.value);
  await assert.rejects(() => market.release(buyer, posted.value));
  assert.equal((await market.job(posted.value))!.status, "Completed");
  const earned = (await market.agent(providerId))!;
  assert.equal(earned.balance, "100000");
  assert.equal(earned.completed, 1);
  pass(
    "Deliver and release once",
    "provider earns 0.100000 USDC and one completed job; early and duplicate release fail",
  );
  await client.call(provider, providerId, "withdraw", { amount: "100000" });
  assert.equal(
    await client.view<string>(token, "ft_balance_of", {
      account_id: providerId,
    }),
    "100000",
  );
  pass("Withdraw earnings", "USDC reaches the provider account");
  const disputed = await market.postJob(buyer, {
    provider: providerId,
    amountMicros: "50000",
    task: "Dispute example",
    deadline: new Date(Date.now() + 86_400_000),
  });
  await market.dispute(buyer, disputed.value);
  await assert.rejects(() => market.release(buyer, disputed.value));
  await client.call(owner, commerce, "resolve_dispute", {
    job_id: disputed.value,
    provider_wins: false,
  });
  assert.equal((await market.job(disputed.value))!.status, "Refunded");
  pass(
    "Dispute and refund",
    "arbiter returns escrow to the buyer; disputed work cannot be released",
  );
  const policy = {
    chain_id: 8453,
    token: "0x1111111111111111111111111111111111111111",
    recipients: ["0x2222222222222222222222222222222222222222"],
    max_per_transfer: "10",
    daily_limit: "15",
    max_gas: "100000",
    max_fee_per_gas: "100",
    next_nonce: "0",
    day: 0,
    spent: "0",
  };
  await client.call(owner, buyerId, "set_evm_policy", { policy });
  const request = {
    chain_id: 8453,
    nonce: "0",
    recipient: policy.recipients[0],
    amount: "10",
    gas_limit: "65000",
    max_fee_per_gas: "10",
    max_priority_fee_per_gas: "1",
  };
  const hash = await client.view<number[]>(buyerId, "get_transfer_hash", {
    request,
  });
  assert.equal(
    Buffer.from(hash).toString("hex"),
    "951be9ab4f146521c97d7b6d52397a079f1a21efafe277d88c935f6c04915d6b",
  );
  await assert.rejects(() =>
    client.call(
      buyer,
      buyerId,
      "sign_transfer",
      {
        request: {
          ...request,
          recipient: "0x3333333333333333333333333333333333333333",
        },
      },
      300_000_000_000_000n,
    ),
  );
  pass(
    "Check Chain Signatures policy",
    "WASM reconstructs the exact EIP-1559 transfer hash and rejects an unapproved destination",
  );
  // Local sandbox does not contain the public MPC network. No fake network signature is claimed.
  process.stdout.write(
    "SKIP external integrations: public MPC, Intents settlement, and paid NEAR AI require opt-in live checks.\n",
  );
  await client.call(owner, buyerId, "revoke_runtime_key", {});
  await assert.rejects(() =>
    client.call(buyer, buyerId, "post_job", {
      provider: providerId,
      amount: "1",
      task_hash: "a".repeat(64),
      deadline: (BigInt(Date.now() + 86400000) * 1_000_000n).toString(),
    }),
  );
  const remaining = await client.provider.viewAccessKeyList({
    accountId: buyerId,
  });
  assert(
    !remaining.keys.some(
      (k) => k.public_key === buyerKey.getPublicKey().toString(),
    ),
  );
  assert(remaining.keys.some((k) => k.access_key.permission === "FullAccess"));
  pass(
    "Revoke runtime key",
    "runtime stops transacting; owner full-access key remains",
  );
  const reportDir = fileURLToPath(
    new URL("../../../near-demo-state/", import.meta.url),
  );
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    `${reportDir}/report.json`,
    JSON.stringify(
      {
        network: "local sandbox",
        mockToken: true,
        generatedAt: new Date().toISOString(),
        steps: report,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `\n${report.length} demo checks passed. Report: near-demo-state/report.json\n`,
  );
} finally {
  await sandbox.tearDown();
}
