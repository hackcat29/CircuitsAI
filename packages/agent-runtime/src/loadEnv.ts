import { config } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Unlike apps/indexer's loadEnv.ts (which assumes it's always run inside this monorepo, with a
// shared root .env), this package is meant to be run standalone by an agent owner who may not
// have the rest of the monorepo checked out at all — so it looks for its own package-local
// .env first, and only falls back to dotenv's normal CWD-relative resolution if that's absent
// (e.g. when run from inside the monorepo, sharing conventions with the other packages here).
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localEnv = resolve(packageDir, ".env");
if (existsSync(localEnv)) config({ path: localEnv });
else config();
