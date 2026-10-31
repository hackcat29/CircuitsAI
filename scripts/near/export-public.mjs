import { execFileSync } from "node:child_process";
import {
  readFile,
  writeFile,
  copyFile,
  mkdir,
  stat,
  readdir,
  unlink,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const source = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const destination = path.resolve(
  source,
  process.argv[2] ?? "circuits-protocol-near",
);
if (destination === source || !destination.startsWith(source + path.sep))
  throw new Error(
    "Export must be an isolated subdirectory, never the original repository",
  );
const paths = new Set(
  execFileSync("git", ["-c", "core.fsmonitor=false", "ls-files", "-z"], {
    cwd: source,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean),
);
async function walk(relative) {
  for (const entry of await readdir(path.join(source, relative), {
    withFileTypes: true,
  })) {
    const child = path.posix.join(relative, entry.name);
    if (
      [
        "node_modules",
        "target",
        "dist",
        "generated",
        ".next",
        ".git",
        "out",
        "build",
        ".turbo",
        "coverage",
      ].includes(entry.name)
    )
      continue;
    if (entry.isDirectory()) await walk(child);
    else if (entry.isFile()) paths.add(child);
  }
}
for (const directory of [
  "packages/near",
  "packages/near-ui",
  "apps/near-demo",
  "packages/contracts-near",
  "packages/custody-db/prisma/migrations/20261031150000_near_agent_economy",
  "scripts/near",
  "docs/near",
  "apps/web/src/components/near",
  "apps/web/src/lib/server/near",
  "apps/web/src/app/api/near",
  "apps/web/src/app/app/near",
  "apps/web/src/app/(marketing)/near",
  "apps/web/src/app/api/agents/[chain]/[agentChainId]/attestation",
  "apps/web/src/app/api/marketplace/services/[id]/intent",
])
  await walk(directory);
paths.add(".github/workflows/near.yml");
paths.add(".github/workflows/pages.yml");
paths.add("packages/custody-core/src/nearAgentSigner.ts");
paths.add("packages/custody-core/src/nearIntentsSwap.ts");
paths.add("apps/web/public/near/agent-wallet.wasm");
function permitted(name) {
  const parts = name.split("/");
  if (
    !["apps", "packages"].includes(parts[0]) &&
    !name.startsWith("scripts/near/") &&
    !name.startsWith("docs/near/") &&
    ![
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "turbo.json",
      ".github/workflows/near.yml",
      ".github/workflows/pages.yml",
    ].includes(name)
  )
    return false;
  if (
    parts.some(
      (p) =>
        p.startsWith(".env") ||
        [
          "node_modules",
          "target",
          "dist",
          "generated",
          ".next",
          ".git",
          "out",
          "build",
          ".turbo",
          "coverage",
          "data",
          "deployments",
          "artifacts",
          "cache",
        ].includes(p) ||
        /seed/i.test(p),
    )
  )
    return false;
  if (/\.(db|sqlite3?|pem|key|p12|dat|log)$/i.test(name)) return false;
  if (
    parts[0] === "packages" &&
    parts[1]?.startsWith("contracts-") &&
    parts[1] !== "contracts-near" &&
    parts.some((p) => ["scripts", "test", "tests"].includes(p))
  )
    return false;
  return true;
}
let copied = 0;
for (const name of paths) {
  if (
    !permitted(name) ||
    name.endsWith(".tsbuildinfo") ||
    name.endsWith("next-env.d.ts")
  )
    continue;
  const from = path.join(source, name),
    to = path.join(destination, name);
  let info;
  try {
    info = await stat(from);
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await unlink(to);
      } catch {}
      continue;
    }
    throw error;
  }
  if (!info.isFile()) continue;
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  copied++;
}
await copyFile(
  path.join(source, "docs/near/README.md"),
  path.join(destination, "README.md"),
);
console.log(
  `Exported ${copied} source/artifact files into the isolated repository. No Git history, environment files, credentials, generated clients, databases, or seed wallets were copied.`,
);
