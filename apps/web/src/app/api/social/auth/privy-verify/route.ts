import { NextResponse } from "next/server";
import { PrivyClient, type LinkedAccount } from "@privy-io/node";
import { createSessionForAddress, setSessionCookie } from "@/lib/server/socialAuth";
import { errorResponse, ApiError } from "@/lib/server/socialErrors";
import { serializeProfile } from "@/lib/server/socialValidate";
import { assertApiRateLimit } from "@/lib/server/apiRateLimit";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function privyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new ApiError(500, "Privy is not configured on the server (NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET)");
  return new PrivyClient({ appId, appSecret });
}

/** A linked_account entry with type "wallet" always carries at least these two fields, whether
 * it's the user's embedded wallet or an external one they linked — see the w3s SDK's own
 * identity-token parser (parseUserFromIdentityTokenPayload), which is what actually produces the
 * runtime shape here. wallet_client_type isn't declared on every member of the broader
 * LinkedAccount union (the identity token's parser uses a narrower shape than the general API),
 * so it's read defensively rather than asserted. */
function walletAddressFrom(linkedAccounts: LinkedAccount[]): string | undefined {
  const wallets = linkedAccounts.filter(
    (a): a is LinkedAccount & { address: string } => a.type === "wallet" && typeof (a as { address?: unknown }).address === "string",
  );
  // Prefer the embedded (Privy-custodied) wallet over any externally-linked one — this is the
  // same wallet PrivyAppProvider.tsx's client-side `user?.wallet?.address` resolves to.
  const embedded = wallets.find((a) => (a as { wallet_client_type?: unknown }).wallet_client_type === "privy");
  return (embedded ?? wallets[0])?.address;
}

function emailFrom(linkedAccounts: LinkedAccount[]): string | undefined {
  const emailAcc = linkedAccounts.find(
    (a) => a.type === "email" && typeof (a as { address?: unknown }).address === "string",
  );
  if (emailAcc) return (emailAcc as { address: string }).address;
  const googleAcc = linkedAccounts.find(
    (a) => a.type === "google_oauth" && typeof (a as { email?: unknown }).email === "string",
  );
  return (googleAcc as { email: string } | undefined)?.email;
}

/** Mints a ClawdHQ session for a Privy-authenticated user's EVM wallet address. Never trusts a
 * client-claimed address — instead it verifies the presented identity token's signature against
 * Privy's own JWKS (via @privy-io/node), and only ever uses the wallet address Privy itself
 * reports as linked to that verified user. That server-side verification *is* the proof of
 * ownership here, the same role a signature plays in verifyNonceAndCreateSession. Establishes
 * the `chq_social_session` httpOnly JWT cookie so all /api/social and /api/agents routes treat
 * the user as an authenticated HUMAN actor. */
export async function POST(request: Request) {
  try {
    assertApiRateLimit(request, "privy-verify", 20, 60_000);
    const body = await request.json().catch(() => null);
    const identityToken = typeof body?.identityToken === "string" ? body.identityToken : undefined;
    if (!identityToken) throw new ApiError(400, "identityToken is required");

    const client = privyClient();
    const user = await client
      .utils()
      .auth()
      .verifyIdentityToken(identityToken)
      .catch((err) => {
        console.error("privy-verify: verifyIdentityToken failed:", err);
        return null;
      });
    if (!user) throw new ApiError(401, "Invalid or expired Privy identity token");

    const address = walletAddressFrom(user.linked_accounts);
    if (!address || !EVM_ADDRESS_RE.test(address)) {
      console.error("privy-verify: no EVM wallet address found on verified user's linked_accounts:", JSON.stringify(user.linked_accounts));
      throw new ApiError(404, "No EVM wallet found for this Privy user. Try signing in again");
    }

    const email = emailFrom(user.linked_accounts);
    const { token, profile } = await createSessionForAddress("MONAD_MAINNET", address, { email });
    await setSessionCookie(token);

    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch (error) {
    return errorResponse(error);
  }
}
