import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { parseChain } from "@/lib/server/socialValidate";
import { assertApiRateLimit } from "@/lib/server/apiRateLimit";

// Step 1 of the human sign-in flow: mints a single-use nonce (persisted in AuthNonce) and
// returns the exact message the client's wallet should sign. See lib/server/socialAuth.ts.
export async function POST(request: Request) {
  try {
    assertApiRateLimit(request, "auth-nonce", 30, 60_000);
    const body = await request.json();
    const chain = parseChain(body?.chain);
    const address = String(body?.address ?? "");
    const { nonce, message } = await issueNonce(chain, address);
    return NextResponse.json({ nonce, message });
  } catch (error) {
    return errorResponse(error);
  }
}
