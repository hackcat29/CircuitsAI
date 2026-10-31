import { createSocialWalletsClient } from "@clawdhq/circle";

// Thin wrapper around @clawdhq/circle's socialWallets.ts client factory, matching
// lib/server/circle/ownerWallet.ts's caching pattern — one client instance per server process,
// not one per request.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example`);
  return value;
}

let cachedClient: ReturnType<typeof createSocialWalletsClient> | undefined;
export function socialWalletsClient(): ReturnType<typeof createSocialWalletsClient> {
  if (!cachedClient) cachedClient = createSocialWalletsClient(requireEnv("CIRCLE_API_KEY"));
  return cachedClient;
}
