import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// Same gap, same fix as apps/web/src/app/api/marketplace/task-descriptions/route.ts:
// registerAgent/updateAgentMetadata only ever put a sha256 hash of the description on-chain
// (see useAgentRegistration.ts's metadataHash) — the plaintext an owner typed was never stored
// anywhere retrievable until this cache existed. Verified cache, not a trust anchor: the hash
// check below is what makes a stored row trustworthy, not the fact that it came from this API.

const MAX_DESCRIPTION_LENGTH = 8000;
const METADATA_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

function sha256Hex(input: string): string {
  return `0x${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const metadataHash = typeof body?.metadataHash === "string" ? body.metadataHash.trim() : "";
    const description = typeof body?.description === "string" ? body.description : "";

    if (!METADATA_HASH_PATTERN.test(metadataHash)) throw new ApiError(400, "metadataHash must be a 0x-prefixed 32-byte hex hash.");
    if (!description.trim()) throw new ApiError(400, "Missing description.");
    if (description.length > MAX_DESCRIPTION_LENGTH) throw new ApiError(400, `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);

    // The whole point of keying by hash: only the actual preimage of metadataHash is accepted,
    // so this cache can never serve content that doesn't match what's on-chain.
    const normalizedHash = metadataHash.toLowerCase();
    if (sha256Hex(description) !== normalizedHash) {
      throw new ApiError(400, "sha256(description) doesn't match metadataHash. This isn't the text that was actually hashed on-chain.");
    }

    await prisma.agentDescription.upsert({
      where: { metadataHash: normalizedHash },
      create: { metadataHash: normalizedHash, description },
      // A second submission of the same hash can only ever carry identical content (sha256 is
      // collision-resistant), so this update is a no-op in practice — upsert just avoids a
      // races-with-itself unique-constraint error on a concurrent duplicate POST.
      update: { description },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
