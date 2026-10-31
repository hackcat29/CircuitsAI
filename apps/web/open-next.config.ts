// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

// scripts/build-cf.mjs runs `next build` after temporarily excluding src/app/api, to
// keep the 90 backend routes' heavy deps (Prisma, Circle SDKs, Solana/Anchor) out of the
// Worker bundle — see that script's top comment. Set here rather than passed into
// defineCloudflareConfig() — that helper whitelists specific keys and silently drops
// unrecognized ones like buildCommand.
config.buildCommand = "node scripts/build-cf.mjs";

export default config;
