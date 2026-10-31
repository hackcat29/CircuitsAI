import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { parse } = require("dotenv");
const values = parse(
  await readFile(new URL("../../apps/web/.env.local", import.meta.url), "utf8"),
);
if (!values.NEAR_AI_API_KEY)
  throw new Error("NEAR_AI_API_KEY has not been set in apps/web/.env.local");
process.env.NEAR_AI_PCCS_URL =
  values.NEAR_AI_PCCS_URL || "https://cloud.near.ai/api/proxy/pccs";
const { privateInference } = await import("../../packages/near/dist/index.js");
const result = await privateInference({
  apiKey: values.NEAR_AI_API_KEY,
  model: values.NEAR_AI_MODEL || undefined,
  prompt: "Reply with only the word ok.",
  maxOutputTokens: 256,
});
const directory = new URL("../../near-demo-state/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("inference.json", directory),
  JSON.stringify(
    result,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      verified: result.evidence.verified,
      model: result.evidence.model,
      signatureKind: result.evidence.signatureKind,
      completionId: result.evidence.completionId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      content: result.content,
      evidenceFile: "near-demo-state/inference.json",
    },
    null,
    2,
  ),
);
