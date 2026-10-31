import { mkdir, copyFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
for (const app of ["web", "near-demo"]) {
  await mkdir(new URL(`apps/${app}/public/near/`, root), { recursive: true });
  await copyFile(
    new URL(
      "packages/contracts-near/target/wasm32-unknown-unknown/release/circuits_agent_wallet.wasm",
      root,
    ),
    new URL(`apps/${app}/public/near/agent-wallet.wasm`, root),
  );
}
console.log("Copied agent-wallet WASM to both web previews.");
