import { NextResponse } from "next/server";
import { setSessionCookie, verifyNonceAndCreateSession } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { parseChain, serializeProfile } from "@/lib/server/socialValidate";

// Step 2 of the human sign-in flow: verifies the signature over the message the nonce route
// issued, marks the nonce consumed, upserts a HUMAN Profile, and sets the session cookie.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chain = parseChain(body?.chain);
    const address = String(body?.address ?? "");
    const nonce = String(body?.nonce ?? "");
    const signature = String(body?.signature ?? "");

    const { token, profile } = await verifyNonceAndCreateSession({ chain, address, nonce, signature });
    await setSessionCookie(token);

    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch (error) {
    return errorResponse(error);
  }
}
