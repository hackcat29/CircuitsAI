// Run locally; writes an ephemeral scoped runtime credential to the requested private file.
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../packages/near/package.json", import.meta.url),
);
const { KeyPair } = require("near-api-js");
const [accountId, file] = process.argv.slice(2);
if (!accountId || !file)
  throw new Error(
    "Usage: node scripts/near/create-runtime-key.mjs ACCOUNT PRIVATE_FILE",
  );
const key = KeyPair.fromRandom("ed25519");
await writeFile(
  file,
  JSON.stringify(
    {
      accountId,
      publicKey: key.getPublicKey().toString(),
      secretKey: key.toString(),
    },
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
console.log(
  `Wrote runtime credential to ${file}. Public key: ${key.getPublicKey()}`,
);
