import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { verifyMessage } from "viem";
import { prisma, ApiKeyScope, type Chain, type Profile } from "@clawdhq/social-db";
import { Chain as MarketplaceChain } from "@clawdhq/marketplace-db";
import { getServerEvmAdapter, isEvmPrismaChain } from "@/lib/server/evmExchangeReaders";
import { ApiError } from "@/lib/server/socialErrors";

// Human auth: a wallet-signature session (nonce -> sign -> verify -> httpOnly JWT cookie).
// Agent auth (bearer API keys) lives in requireActor() below, alongside the session-cookie
// path, since every mutating route needs to accept either.

const SESSION_COOKIE = "chq_social_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function jwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set. See .env.example");
  return new TextEncoder().encode(secret);
}

function isValidAddressFormat(_chain: Chain, address: string): boolean {
  return EVM_ADDRESS_RE.test(address);
}

function normalizeAddress(_chain: Chain, address: string): string {
  return address.trim().toLowerCase();
}

function buildSignInMessage({ chain, address, nonce }: { chain: Chain; address: string; nonce: string }): string {
  return [
    "Circuits Protocol Social: sign in to prove wallet ownership.",
    "This request will not trigger a blockchain transaction or cost any gas.",
    "",
    `Address: ${address}`,
    `Chain: ${chain}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

async function verifySignatureForChain(_chain: Chain, address: string, message: string, signature: string): Promise<boolean> {
  try {
    return await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
  } catch {
    return false;
  }
}

export async function issueNonce(chain: Chain, rawAddress: string): Promise<{ nonce: string; message: string }> {
  if (!isValidAddressFormat(chain, rawAddress)) throw new ApiError(400, "Invalid address for chain");
  const address = normalizeAddress(chain, rawAddress);
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  await prisma.authNonce.create({ data: { jti: nonce, chain, address, expiresAt } });

  return { nonce, message: buildSignInMessage({ chain, address, nonce }) };
}

export async function generateUniqueUsername(candidateBase: string): Promise<string> {
  let base = candidateBase.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 15);
  if (base.length < 3) base = `user_${base}`;

  let candidate = base;
  let counter = 1;
  while (true) {
    const existing = await prisma.profile.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
    candidate = `${base.slice(0, 13)}_${counter}`;
    counter++;
    if (counter > 50) {
      return `${base.slice(0, 10)}_${randomBytes(2).toString("hex")}`;
    }
  }
}

/** Upserts a HUMAN profile for an address already verified as owned by the caller, and mints
 * the same session JWT every sign-in path uses. Captures verified Privy email and assigns a unique
 * initial username if unset. */
export async function createSessionForAddress(
  chain: Chain,
  rawAddress: string,
  options?: { email?: string },
): Promise<{ token: string; profile: Profile }> {
  const address = normalizeAddress(chain, rawAddress);
  const normalizedEmail = options?.email ? options.email.trim().toLowerCase() : undefined;

  let profile = await prisma.profile.findUnique({
    where: { walletAddress: address },
  });

  if (!profile) {
    const candidateBase = normalizedEmail ? normalizedEmail.split("@")[0] : `user_${address.slice(2, 8)}`;
    const username = await generateUniqueUsername(candidateBase);
    let emailToSet = normalizedEmail;
    if (emailToSet) {
      const existingEmail = await prisma.profile.findUnique({ where: { email: emailToSet } });
      if (existingEmail) emailToSet = undefined;
    }
    profile = await prisma.profile.create({
      data: {
        kind: "HUMAN",
        walletAddress: address,
        email: emailToSet,
        username,
      },
    });
  } else {
    // If existing profile has no email or username, backfill
    const updateData: { email?: string; username?: string } = {};
    if (!profile.email && normalizedEmail) {
      const existingEmail = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (!existingEmail) {
        updateData.email = normalizedEmail;
      }
    }
    if (!profile.username) {
      const candidateBase = normalizedEmail ? normalizedEmail.split("@")[0] : (profile.displayName ? profile.displayName : `user_${address.slice(2, 8)}`);
      updateData.username = await generateUniqueUsername(candidateBase);
    }
    if (Object.keys(updateData).length > 0) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: updateData,
      });
    }
  }

  const token = await new SignJWT({ profileId: profile.id, walletAddress: address, chain })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtSecretKey());

  return { token, profile };
}

export async function verifyNonceAndCreateSession(input: {
  chain: Chain;
  address: string;
  nonce: string;
  signature: string;
}): Promise<{ token: string; profile: Profile }> {
  const { chain, nonce, signature } = input;
  if (!isValidAddressFormat(chain, input.address)) throw new ApiError(400, "Invalid address for chain");
  const address = normalizeAddress(chain, input.address);

  const record = await prisma.authNonce.findUnique({ where: { jti: nonce } });
  if (!record || record.consumedAt || record.expiresAt < new Date() || record.chain !== chain || record.address !== address) {
    throw new ApiError(400, "Nonce is invalid, expired, or already used");
  }

  const message = buildSignInMessage({ chain, address, nonce });
  const validSignature = await verifySignatureForChain(chain, address, message, signature);
  if (!validSignature) throw new ApiError(401, "Signature verification failed");

  // Mark consumed before minting a session so a retried/duplicate request can't reuse it.
  await prisma.authNonce.update({ where: { jti: nonce }, data: { consumedAt: new Date() } });

  return createSessionForAddress(chain, address);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

interface SessionPayload {
  profileId: string;
  walletAddress: string;
  chain: Chain;
}

async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    if (typeof payload.profileId !== "string" || typeof payload.walletAddress !== "string" || typeof payload.chain !== "string") {
      return null;
    }
    return { profileId: payload.profileId, walletAddress: payload.walletAddress, chain: payload.chain as Chain };
  } catch {
    return null;
  }
}

export async function getSessionProfile(): Promise<Profile | null> {
  const session = await readSessionCookie();
  if (!session) return null;
  return prisma.profile.findUnique({ where: { id: session.profileId } });
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `chq_sk_${randomBytes(32).toString("hex")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export interface Actor {
  profile: Profile;
  /** Present only when authenticated via a bearer AgentApiKey — the scope that specific key was
   * minted with. Absent for a human wallet-session actor: an owner acting directly through their
   * own session isn't scope-limited the way an agent's own bearer key is. */
  apiKeyScope?: ApiKeyScope;
}

/** Every mutating /api/social/* route calls this first: a bearer API key identifies an
 * autonomous agent, a session cookie identifies a signed-in human. Exactly one of those two
 * credential types is required. */
export async function requireActor(request: Request): Promise<Actor> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice("Bearer ".length).trim();
    const keyHash = hashApiKey(key);
    const apiKey = await prisma.agentApiKey.findUnique({ where: { keyHash }, include: { profile: true } });
    if (!apiKey || apiKey.revokedAt) throw new ApiError(401, "Invalid or revoked API key");
    const now = Date.now();
    if (!apiKey.lastUsedAt || now - apiKey.lastUsedAt.getTime() > 60_000) {
      prisma.agentApiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(now) } }).catch(() => {});
    }
    return { profile: apiKey.profile, apiKeyScope: apiKey.scope };
  }

  const profile = await getSessionProfile();
  if (!profile) throw new ApiError(401, "Not signed in");
  return { profile };
}

/** Like requireActor(), but returns null instead of throwing — for read routes (feed, posts)
 * that annotate results with viewer-specific state (viewerHasLiked) when a viewer happens to
 * be identifiable, without requiring auth to read at all. */
export async function getOptionalActor(request: Request): Promise<Actor | null> {
  try {
    return await requireActor(request);
  } catch {
    return null;
  }
}

/** For /api/degen/* routes that an agent's own external "brain" calls autonomously (e.g.
 * placing an order) — requires specifically a TRADING-scope bearer key, not just any valid
 * actor. A human owner session is deliberately rejected here too: those routes are the
 * unattended-execution surface, not an owner-facing control panel (see requireActor's human
 * branch + assertAgentOwner for the owner-facing /api/degen/config, /kill, wallet routes). */
export async function requireTradingActor(request: Request): Promise<Actor> {
  const actor = await requireActor(request);
  if (actor.apiKeyScope !== ApiKeyScope.TRADING) {
    throw new ApiError(403, "This action requires a TRADING-scope API key");
  }
  return actor;
}

/** Resolves an agent's current on-chain owner via apps/web/src/lib/server/evmExchangeReaders.ts,
 * the same reader useAgentRegistration.ts uses. Returns null if the agent doesn't exist
 * on-chain or the chain's server adapter isn't configured (missing env), rather than throwing —
 * callers decide what that means. */
export async function getOnChainAgentOwner(chain: Chain, agentChainId: string): Promise<string | null> {
  // @clawdhq/social-db's Chain enum is a deliberate duplicate of @clawdhq/marketplace-db's
  // (see packages/social-db/prisma/schema.prisma) — same string values, different generated
  // TS types, hence the cast.
  const marketplaceChain = chain as unknown as MarketplaceChain;

  if (isEvmPrismaChain(marketplaceChain)) {
    try {
      const agent = await getServerEvmAdapter(marketplaceChain).getAgent(BigInt(agentChainId));
      return agent.owner;
    } catch {
      return null;
    }
  }
  return null;
}

export async function assertAgentOwner(chain: Chain, agentChainId: string, walletAddress: string): Promise<void> {
  const owner = await getOnChainAgentOwner(chain, agentChainId);
  if (!owner) throw new ApiError(404, "Agent not found on-chain");
  if (owner.toLowerCase() !== walletAddress.toLowerCase()) throw new ApiError(403, "You are not the on-chain owner of this agent");
}
