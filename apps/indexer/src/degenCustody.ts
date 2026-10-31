import { prisma, WalletStatus, type Chain, type Venue } from "@clawdhq/degen-db";
import { LocalRootKeyProvider, decryptPrivateKey as decryptWithProvider, type RootKeyProvider } from "@clawdhq/custody-core";

// Mirrors apps/web/src/lib/server/degen/custody.ts's getDecryptedTradingWallet exactly — the
// original can't be imported directly (it's apps/web-only Next.js server code, not a shared
// package), but its own dependencies are already just @clawdhq/degen-db + @clawdhq/custody-core,
// both of which apps/indexer can depend on too. Duplicated here rather than in a shared package
// because TradingWallet lives in degen-db itself (unlike Subscriptions' wallets, which
// custody-core already owns via custody-db) — moving it would mean migrating a live table,
// which is out of scope for adding one new venue. Same *encryption* implementation either way
// (LocalRootKeyProvider/decryptPrivateKey), so there is still only one place that logic lives.
//
// *** DEV-MODE WARNING *** — see custody-core's LocalRootKeyProvider doc comment: the only
// provider implemented right now is dev-only, same caveat apps/web's own copy already carries.
function getRootKeyProvider(): RootKeyProvider {
  const provider = process.env.DEGEN_KMS_PROVIDER || "local";
  if (provider === "local") return new LocalRootKeyProvider("DEGEN_LOCAL_ROOT_KEY");
  throw new Error(`DEGEN_KMS_PROVIDER="${provider}" has no implementation yet. Only "local" (dev-only) exists.`);
}

export async function getDecryptedTradingWallet(chain: Chain, agentChainId: string, venue: Venue): Promise<{ address: string; privateKey: string } | null> {
  const wallet = await prisma.tradingWallet.findUnique({ where: { chain_agentChainId_venue: { chain, agentChainId, venue } } });
  if (!wallet || wallet.status !== WalletStatus.ACTIVE) return null;
  return { address: wallet.address, privateKey: await decryptWithProvider(wallet.encryptedPrivateKey, getRootKeyProvider()) };
}
