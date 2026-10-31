import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { prisma, Venue, WalletStatus, type Chain, type TradingWallet } from "@clawdhq/degen-db";
import { LocalRootKeyProvider, encryptPrivateKey as encryptWithProvider, decryptPrivateKey as decryptWithProvider, type RootKeyProvider } from "@clawdhq/custody-core";

// LIVE-mode key custody: generates a dedicated hot wallet per (agent, venue), envelope-encrypts
// its private key before it ever touches Postgres, and decrypts it only transiently in-process
// when actually signing. See the plan's "Custody & key management" section for the design this
// implements — capital-bounded exposure (a wallet only ever holds what the owner explicitly
// deposited), and withdrawal hardcoded to the verified on-chain owner address (see
// degenWithdraw.ts), never an arbitrary destination. The envelope-encryption mechanics
// themselves live in lib/server/custody/envelopeEncryption.ts (shared with Subscriptions) —
// this file only owns *which* root key backs Degen's wallets, via DEGEN_KMS_PROVIDER /
// DEGEN_LOCAL_ROOT_KEY, kept separate from other domains' root keys so a compromise of one
// doesn't expose the other.
//
// *** DEV-MODE WARNING *** — see envelopeEncryption.ts's LocalRootKeyProvider doc comment: the
// only provider implemented right now is dev-only and NOT an acceptable root-of-trust for a
// wallet that ever holds real money. DEGEN_KMS_PROVIDER must point at a real KMS before any
// LIVE-mode wallet is funded with real value.

function getRootKeyProvider(): RootKeyProvider {
  const provider = process.env.DEGEN_KMS_PROVIDER || "local";
  if (provider === "local") return new LocalRootKeyProvider("DEGEN_LOCAL_ROOT_KEY");
  throw new Error(
    `DEGEN_KMS_PROVIDER="${provider}" has no implementation yet. Only "local" (dev-only, see envelopeEncryption.ts's warning) exists. ` +
      "Implement a real KMS-backed RootKeyProvider before funding any LIVE-mode wallet in production.",
  );
}

async function encryptPrivateKey(plaintext: string): Promise<string> {
  return encryptWithProvider(plaintext, getRootKeyProvider());
}

async function decryptPrivateKey(encryptedPrivateKey: string): Promise<string> {
  return decryptWithProvider(encryptedPrivateKey, getRootKeyProvider());
}

/** Hyperliquid's agent wallet and ClawdHQ EVM launches are both EVM-curve addresses, and
 * critically the *same* EVM address is valid across every EVM chain, so one generated keypair
 * per venue is enough regardless of which specific EVM chain a given trade happens to execute
 * on. */
function generateEvmWallet(): { address: string; privateKey: string } {
  const privateKey = generatePrivateKey();
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

/** Idempotent: returns the existing wallet if one was already provisioned for this
 * (agent, venue) pair rather than generating a second one. */
export async function provisionTradingWallet(chain: Chain, agentChainId: string, venue: Venue): Promise<TradingWallet> {
  const existing = await prisma.tradingWallet.findUnique({ where: { chain_agentChainId_venue: { chain, agentChainId, venue } } });
  if (existing) return existing;

  const generated = generateEvmWallet();
  const encryptedPrivateKey = await encryptPrivateKey(generated.privateKey);

  try {
    return await prisma.tradingWallet.create({
      data: { chain, agentChainId, venue, address: generated.address, encryptedPrivateKey, keyVersion: 1, status: WalletStatus.ACTIVE },
    });
  } catch {
    // Lost a race with a concurrent provision call for the same (agent, venue) — the unique
    // constraint on TradingWallet rejected our insert, so fetch the row the other call created
    // rather than surface an error for what's actually a successful idempotent outcome.
    const winner = await prisma.tradingWallet.findUnique({ where: { chain_agentChainId_venue: { chain, agentChainId, venue } } });
    if (!winner) throw new Error(`Failed to provision or find TradingWallet for ${chain}:${agentChainId}:${venue}`);
    return winner;
  }
}

/** Decrypted key material, for transient use signing a single operation — callers must not log
 * or persist the returned privateKey. Returns null if the agent has never had a wallet
 * provisioned for this venue (LIVE mode was never enabled) or the wallet was revoked. */
export async function getDecryptedTradingWallet(chain: Chain, agentChainId: string, venue: Venue): Promise<{ address: string; privateKey: string } | null> {
  const wallet = await prisma.tradingWallet.findUnique({ where: { chain_agentChainId_venue: { chain, agentChainId, venue } } });
  if (!wallet || wallet.status !== WalletStatus.ACTIVE) return null;
  return { address: wallet.address, privateKey: await decryptPrivateKey(wallet.encryptedPrivateKey) };
}
