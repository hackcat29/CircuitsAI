import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
const require = createRequire(
  new URL("../../packages/near/package.json", import.meta.url),
);
const { KeyPair, actions } = require("near-api-js");
const {
  NearClient,
  NearCommerce,
  provisionPlan,
  derivedEvmAddress,
  signEvmUsdcTransfer,
  RUNTIME_METHODS,
} = await import("../../packages/near/dist/index.js");
const ownerId = process.argv[2];
if (!ownerId?.endsWith(".testnet"))
  throw new Error(
    "This deployment script only supports a named .testnet account",
  );
const credentialsDir = join(homedir(), ".near-credentials", "testnet");
const credential = JSON.parse(
  await readFile(join(credentialsDir, `${ownerId}.json`), "utf8"),
);
const client = new NearClient("https://rpc.testnet.near.org");
const owner = client.account(ownerId, credential.private_key);
const token = `usdc.${ownerId}`,
  buyerId = `alpha.${ownerId}`,
  mpc = "v1.signer-prod.testnet";
const publicKey = KeyPair.fromString(credential.private_key).getPublicKey();
const root = new URL("../../", import.meta.url);
const code = async (name) =>
  new Uint8Array(
    await readFile(
      new URL(
        `packages/contracts-near/target/wasm32-unknown-unknown/release/circuits_${name}.wasm`,
        root,
      ),
    ),
  );
const reportFile = new URL("near-demo-state/testnet-deployment.json", root);
let report;
try {
  report = JSON.parse(await readFile(reportFile, "utf8"));
} catch {}
if (report?.completed && report.chainSignature?.verified) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
const transactions = report?.transactions ?? [];
async function record(label, operation) {
  const result = await operation();
  const hash = result.transactionHash ?? result.transaction?.hash;
  transactions.push({ label, hash });
  await save(false);
  console.log(`${label}: ${hash}`);
  return result;
}
async function save(completed) {
  await mkdir(new URL("near-demo-state/", root), { recursive: true });
  await writeFile(
    reportFile,
    JSON.stringify(
      {
        network: "testnet",
        owner: ownerId,
        commerce: ownerId,
        token,
        buyer: buyerId,
        provider: ownerId,
        mockUsdc: true,
        mpc,
        completed,
        transactions,
      },
      null,
      2,
    ),
  );
}
async function runtimeFile(id, role) {
  const file = join(credentialsDir, `${id}.${role}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const key = KeyPair.fromRandom("ed25519");
    const value = {
      account_id: id,
      public_key: key.getPublicKey().toString(),
      private_key: key.toString(),
    };
    await writeFile(file, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    return value;
  }
}
const buyerKey = await runtimeFile(buyerId, "runtime"),
  providerKey = await runtimeFile(ownerId, "provider-runtime");
async function hasCode(id) {
  try {
    return (
      (await client.provider.viewAccount({ accountId: id })).code_hash !==
      "11111111111111111111111111111111"
    );
  } catch {
    return false;
  }
}
if (!(await hasCode(ownerId))) {
  const commerceCode = await code("commerce");
  await record("Deploy commerce", () =>
    owner.signAndSendTransaction({
      receiverId: ownerId,
      actions: [
        actions.deployContract(commerceCode),
        actions.functionCall(
          "new",
          { admin: ownerId, token, arbiter: ownerId },
          40_000_000_000_000n,
          0n,
        ),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
    }),
  );
}
if (!(await hasCode(token))) {
  const tokenCode = await code("mock_ft");
  await record("Deploy mock USDC", () =>
    owner.signAndSendTransaction({
      receiverId: token,
      actions: [
        actions.createAccount(),
        actions.transfer(2_500_000_000_000_000_000_000_000n),
        actions.deployContract(tokenCode),
        actions.addFullAccessKey(publicKey),
        actions.functionCall(
          "new",
          { owner: ownerId },
          40_000_000_000_000n,
          0n,
        ),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
    }),
  );
}
if (!(await hasCode(buyerId))) {
  const plan = provisionPlan({
    accountId: buyerId,
    parentId: ownerId,
    ownerPublicKey: publicKey.toString(),
    runtimePublicKey: buyerKey.public_key,
    gasAllowanceYocto: "1000000000000000000000000",
    initialBalanceYocto: "3600000000000000000000000",
    walletWasm: await code("agent_wallet"),
    owner: ownerId,
    commerce: ownerId,
    mpc,
    signatureDepositYocto: "1",
  });
  await record("Create scoped agent wallet", () =>
    owner.signAndSendTransaction({
      receiverId: buyerId,
      actions: plan.actions,
      waitUntil: "FINAL",
      throwOnFailure: true,
    }),
  );
}
try {
  await client.provider.viewAccessKey({
    accountId: ownerId,
    publicKey: providerKey.public_key,
  });
} catch {
  await record("Install provider runtime key", () =>
    owner.signAndSendTransaction({
      receiverId: ownerId,
      actions: [
        actions.addFunctionCallAccessKey(
          KeyPair.fromString(providerKey.private_key).getPublicKey(),
          ownerId,
          ["deliver", "open_dispute", "withdraw"],
          250_000_000_000_000_000_000_000n,
        ),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
    }),
  );
}
const market = new NearCommerce(client, ownerId);
for (const id of [ownerId, buyerId])
  if (!(await market.agent(id)))
    await record(`Register ${id}`, () =>
      client.call(owner, ownerId, "register_agent", {
        agent_id: id,
        owner: ownerId,
      }),
    );
await record("Set on-chain USDC policy", () =>
  client.call(owner, ownerId, "set_policy", {
    agent_id: buyerId,
    max_per_job: "100000",
    daily_limit: "1000000",
    providers: [ownerId],
    paused: false,
  }),
);
const balance = (await market.agent(buyerId)).balance;
if (BigInt(balance) < 200_000n) {
  await record("Mint test-only USDC", () =>
    client.call(owner, token, "mint", {
      account_id: ownerId,
      amount: "1000000",
    }),
  );
  const deposit = market.depositTransaction(buyerId, token, "1000000");
  await record("Fund agent escrow", () =>
    client.call(
      owner,
      token,
      deposit.method,
      deposit.args,
      150_000_000_000_000n,
      1n,
    ),
  );
}
const buyerAccess = await client.provider.viewAccessKey({
  accountId: buyerId,
  publicKey: buyerKey.public_key,
});
if (
  buyerAccess.permission !== "FullAccess" &&
  BigInt(buyerAccess.permission.FunctionCall.allowance) <
    400_000_000_000_000_000_000_000n
) {
  const humanAgentOwner = client.account(buyerId, credential.private_key);
  const runtimePublicKey = KeyPair.fromString(
    buyerKey.private_key,
  ).getPublicKey();
  await record("Increase finite runtime gas allowance", () =>
    humanAgentOwner.signAndSendTransaction({
      receiverId: buyerId,
      actions: [
        actions.deleteKey(runtimePublicKey),
        actions.addFunctionCallAccessKey(
          runtimePublicKey,
          buyerId,
          [...RUNTIME_METHODS],
          1_000_000_000_000_000_000_000_000n,
        ),
      ],
      waitUntil: "FINAL",
      throwOnFailure: true,
    }),
  );
}
const buyer = await client.runtime(buyerId, buyerKey.private_key),
  provider = await client.runtime(ownerId, providerKey.private_key);
if (!transactions.some((t) => t.label === "Release completed work")) {
  const posted = await record("Fund agent job", () =>
    market.postJob(buyer, {
      provider: ownerId,
      amountMicros: "100000",
      task: "Review a scoped agent API integration",
      deadline: new Date(Date.now() + 86400000),
    }),
  );
  await record("Deliver with provider's scoped key", () =>
    client.call(provider, ownerId, "deliver", {
      job_id: posted.value,
      deliverable_hash: "b".repeat(64),
    }),
  );
  await record("Release completed work", () =>
    market.release(buyer, posted.value),
  );
}
if (!transactions.some((t) => t.label === "Resolve disputed work")) {
  const posted = await record("Fund dispute example", () =>
    market.postJob(buyer, {
      provider: ownerId,
      amountMicros: "50000",
      task: "Demonstrate escrow dispute resolution",
      deadline: new Date(Date.now() + 86400000),
    }),
  );
  await record("Open escrow dispute", () =>
    market.dispute(buyer, posted.value),
  );
  await record("Resolve disputed work", () =>
    client.call(owner, ownerId, "resolve_dispute", {
      job_id: posted.value,
      provider_wins: false,
    }),
  );
}
const chainId = 84532;
const address = await derivedEvmAddress(client, mpc, buyerId, chainId);
let chainSignature;
try {
  if (!transactions.some((t) => t.label === "Verify live MPC signature")) {
    await record("Set foreign-transfer policy", () =>
      client.call(owner, buyerId, "set_evm_policy", {
        policy: {
          chain_id: chainId,
          token: "0x1111111111111111111111111111111111111111",
          recipients: ["0x2222222222222222222222222222222222222222"],
          max_per_transfer: "1",
          daily_limit: "1",
          max_gas: "100000",
          max_fee_per_gas: "1000000000",
          next_nonce: "0",
          day: 0,
          spent: "0",
        },
      }),
    );
    const signed = await signEvmUsdcTransfer({
      client,
      runtime: buyer,
      address,
      token: "0x1111111111111111111111111111111111111111",
      chainId,
      recipient: "0x2222222222222222222222222222222222222222",
      amount: 1n,
      nonce: 0,
      gas: 65000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 1n,
    });
    transactions.push({
      label: "Verify live MPC signature",
      hash: signed.nearTransactionHash,
    });
    chainSignature = {
      verified: true,
      address,
      chainId,
      broadcast: false,
      syntheticTestTransfer: true,
    };
  }
} catch (error) {
  chainSignature = {
    verified: false,
    address,
    chainId,
    error: error.message,
    broadcast: false,
  };
}
await save(true);
const final = {
  ...JSON.parse(await readFile(reportFile, "utf8")),
  chainSignature,
  buyerState: await market.agent(buyerId),
  providerState: await market.agent(ownerId),
  explorerUrl: `https://testnet.nearblocks.io/address/${ownerId}`,
};
await writeFile(reportFile, JSON.stringify(final, null, 2));
console.log(JSON.stringify(final, null, 2));
