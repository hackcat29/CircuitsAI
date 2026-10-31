// The Cloudflare Worker build must not include src/app/api: those 90 routes pull in
// Prisma clients (one bundling a 2.2MB WASM query engine), Circle SDKs, and Solana/Anchor,
// pushing the bundled Worker past Cloudflare's size limit even on the paid plan. Those
// routes keep running on EC2 (apps/web deployed there normally, api dir intact); the
// Cloudflare build only serves frontend routes and proxies /api/* via src/middleware.ts.
// Moving the directory out for the duration of `next build` is the only way to keep it
// out of the bundle without deleting it from the source tree.
import { existsSync, renameSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(fileURLToPath(import.meta.url), "../..");
const apiDir = path.join(webRoot, "src/app/api");
const excludedDir = path.join(webRoot, ".cf-excluded-api");

if (!existsSync(apiDir)) {
  throw new Error(`Expected ${apiDir} to exist before the Cloudflare build`);
}
renameSync(apiDir, excludedDir);

try {
  execSync("npx next build", { stdio: "inherit", cwd: webRoot });
} finally {
  renameSync(excludedDir, apiDir);
}
