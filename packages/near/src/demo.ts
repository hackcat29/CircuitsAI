import { readFile } from "node:fs/promises";
import { KeyPair, actions, PublicKey } from "near-api-js";
import { NearClient, provisionPlan } from "./client.js";
import { NearCommerce } from "./commerce.js";
import { nearConfig } from "./config.js";
import { derivedEvmAddress } from "./evm.js";
import { NearIntents, quoteUsdcPayment } from "./intents.js";
import { privateInference } from "./ai.js";

const [command, ...argv] = process.argv.slice(2);
const args = new Map<string, string>();
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i]?.startsWith("--") || !argv[i + 1])
    throw new Error("Use --name value arguments");
  args.set(argv[i].slice(2), argv[i + 1]);
}
const required = (name: string) => {
  const value = args.get(name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
};
const config = nearConfig();
const client = new NearClient(config.rpcUrl);
function allowTransactions() {
  if (args.get("broadcast") !== "yes")
    throw new Error(
      "This command signs transactions. Inspect your arguments, then pass --broadcast yes to execute.",
    );
}
async function owner() {
  const id = required("owner");
  const file = required("owner-credentials");
  const credentials = JSON.parse(await readFile(file, "utf8")) as {
    account_id?: string;
    private_key?: string;
    secretKey?: string;
  };
  if (credentials.account_id && credentials.account_id !== id)
    throw new Error("Owner credential account differs");
  const secret = credentials.private_key ?? credentials.secretKey;
  if (!secret) throw new Error("No key in owner credential file");
  return client.account(id, secret);
}
try {
  if (command === "derive") {
    const address = await derivedEvmAddress(
      client,
      config.mpc,
      required("agent"),
      Number(required("chain-id")),
    );
    console.log(
      JSON.stringify(
        {
          network: config.network,
          agent: required("agent"),
          chainId: Number(required("chain-id")),
          address,
        },
        null,
        2,
      ),
    );
  } else if (command === "quote") {
    const result = await quoteUsdcPayment(
      new NearIntents({ jwt: process.env.NEAR_INTENTS_JWT }),
      {
        originAsset: required("origin"),
        destinationAsset: required("destination"),
        recipient: required("recipient"),
        refundTo: required("refund-to"),
        amountUsdcMicros: required("amount-micros"),
        dry: true,
      },
    );
    console.log(JSON.stringify({ dry: true, quote: result }, null, 2));
  } else if (command === "tokens") {
    console.log(JSON.stringify(await new NearIntents().tokens(), null, 2));
  } else if (command === "infer") {
    if (args.get("use-credits") !== "yes")
      throw new Error(
        "Private inference consumes NEAR AI credits; pass --use-credits yes after reviewing the model and prompt",
      );
    const result = await privateInference({
      prompt: required("prompt"),
      apiKey: process.env.NEAR_AI_API_KEY ?? "",
      model: process.env.NEAR_AI_MODEL,
      maxOutputTokens: 256,
    });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "provision") {
    const account = required("agent"),
      parent = required("owner");
    const credentials = await readFile(required("runtime-credentials"), "utf8");
    const runtime = JSON.parse(credentials) as {
      publicKey: string;
      accountId: string;
    };
    if (runtime.accountId !== account)
      throw new Error("Runtime credential account differs");
    const plan = provisionPlan({
      accountId: account,
      parentId: parent,
      ownerPublicKey: required("owner-public-key"),
      runtimePublicKey: runtime.publicKey,
      gasAllowanceYocto:
        args.get("gas-allowance-yocto") ?? "1000000000000000000000000",
      initialBalanceYocto:
        args.get("initial-balance-yocto") ?? "4000000000000000000000000",
      walletWasm: new Uint8Array(
        await readFile(
          new URL(
            "../../contracts-near/target/wasm32-unknown-unknown/release/circuits_agent_wallet.wasm",
            import.meta.url,
          ),
        ),
      ),
      owner: parent,
      commerce: config.commerce,
      mpc: config.mpc,
      signatureDepositYocto: args.get("signature-deposit-yocto") ?? "1",
    });
    console.log(
      JSON.stringify(
        {
          network: config.network,
          accountId: plan.accountId,
          parentId: plan.parentId,
          ownerPublicKey: plan.ownerPublicKey,
          runtimePublicKey: plan.runtimePublicKey,
          gasAllowanceYocto: plan.gasAllowanceYocto,
          initialBalanceYocto: plan.initialBalanceYocto,
          actions: [
            "CreateAccount",
            "Transfer",
            "DeployContract",
            "AddFullAccessKey",
            "AddFunctionCallKey",
            "Initialize",
          ],
        },
        null,
        2,
      ),
    );
    if (args.get("broadcast") === "yes") {
      const signer = await owner();
      await signer.signAndSendTransaction({
        receiverId: account,
        actions: plan.actions,
        waitUntil: "FINAL",
        throwOnFailure: true,
      });
      console.log(
        "Agent created; register it with the commerce administrator.",
      );
    }
  } else if (command === "revoke") {
    allowTransactions();
    const signer = await owner();
    const result = await client.call(
      signer,
      required("agent"),
      "revoke_runtime_key",
      {},
    );
    console.log(JSON.stringify({ transactionHash: result.transactionHash }));
  } else if (command === "inspect") {
    console.log(
      JSON.stringify(
        await new NearCommerce(client, config.commerce).agent(
          required("agent"),
        ),
        null,
        2,
      ),
    );
  } else {
    console.log(
      "Commands: tokens | quote --origin ASSET --destination USDC_ASSET --recipient ACCOUNT --refund-to ADDRESS --amount-micros N | derive --agent ACCOUNT --chain-id N | inspect --agent ACCOUNT | infer --prompt TEXT --use-credits yes | provision (prints reviewable plan; --broadcast yes executes) | revoke (requires --broadcast yes)",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "NEAR command failed");
  process.exitCode = 1;
}
