import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(
  new URL("../../packages/near/package.json", import.meta.url),
);
const { KeyPair, JsonRpcProvider } = require("near-api-js");
const accountId = process.argv[2];
if (!accountId || !/^circuitsai[-a-z0-9]*\.testnet$/.test(accountId))
  throw new Error("Supply the new CircuitsAI testnet owner account ID");
const directory = join(homedir(), ".near-credentials", "testnet");
const file = join(directory, `${accountId}.json`);
const provider = new JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
let credential;
try {
  credential = JSON.parse(await readFile(file, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!credential) {
  try {
    await provider.viewAccount({ accountId });
    throw new Error("Account already exists; choose a fresh name");
  } catch (error) {
    if (!/does not exist|UNKNOWN_ACCOUNT|UnknownAccount/i.test(String(error)))
      throw error;
  }
  const key = KeyPair.fromRandom("ed25519");
  credential = {
    account_id: accountId,
    public_key: key.getPublicKey().toString(),
    private_key: key.toString(),
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(credential, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
}
let exists = false;
try {
  await provider.viewAccessKey({ accountId, publicKey: credential.public_key });
  exists = true;
} catch {}
if (!exists) {
  // This command receives only the public key. The owner secret never enters process arguments or logs.
  try {
    execFileSync(
      "near",
      [
        "account",
        "create-account",
        "sponsor-by-faucet-service",
        accountId,
        "use-manually-provided-public-key",
        credential.public_key,
        "network-config",
        "testnet",
        "create",
      ],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 90000 },
    );
  } catch (error) {
    throw new Error(
      `Faucet could not create ${accountId}; credentials are safely retained at ${file}. ${error.stderr?.toString().slice(0, 400) ?? ""}`,
    );
  }
}
const account = await provider.viewAccount({ accountId });
const access = await provider.viewAccessKey({
  accountId,
  publicKey: credential.public_key,
});
if (access.permission !== "FullAccess")
  throw new Error("Owner full-access key was not installed");
console.log(
  JSON.stringify(
    {
      accountId,
      network: "testnet",
      publicKey: credential.public_key,
      balanceYocto: account.amount.toString(),
      credentialsFile: file,
      explorerUrl: `https://testnet.nearblocks.io/address/${accountId}`,
    },
    null,
    2,
  ),
);
