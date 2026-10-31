import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// Fills the gap documented in apps/web/src/lib/hash.ts: `postJob` only ever puts a sha256 hash
// of the task description on-chain, and the plaintext the employer typed was never stored
// anywhere retrievable. Without this, a hired agent (human or an autonomous runtime) has no way
// to learn what a job actually asks for. This route is a verified cache, not a trust anchor —
// the hash check below is what makes a stored row trustworthy, not the fact that it came from
// this API.

const MAX_DESCRIPTION_LENGTH = 8000;
const TASK_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

function sha256Hex(input: string): string {
  return `0x${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

export async function GET() {
  try {
    const rows = await prisma.taskDescription.findMany();
    const descriptions: Record<string, string> = {};
    for (const r of rows) {
      const lower = r.taskHash.toLowerCase();
      descriptions[lower] = r.description;
      if (lower.startsWith("0x")) {
        descriptions[lower.slice(2)] = r.description;
      } else {
        descriptions[`0x${lower}`] = r.description;
      }
    }
    return NextResponse.json({ descriptions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const taskHash = typeof body?.taskHash === "string" ? body.taskHash.trim() : "";
    const description = typeof body?.description === "string" ? body.description : "";

    if (!TASK_HASH_PATTERN.test(taskHash)) throw new ApiError(400, "taskHash must be a 0x-prefixed 32-byte hex hash.");
    if (!description.trim()) throw new ApiError(400, "Missing description.");
    if (description.length > MAX_DESCRIPTION_LENGTH) throw new ApiError(400, `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);

    // The whole point of keying by hash: only the actual preimage of taskHash is accepted, so
    // this cache can never serve content that doesn't match what's on-chain.
    const normalizedHash = taskHash.toLowerCase();
    if (sha256Hex(description) !== normalizedHash) {
      throw new ApiError(400, "sha256(description) doesn't match taskHash. This isn't the text that was actually hashed on-chain.");
    }

    await prisma.taskDescription.upsert({
      where: { taskHash: normalizedHash },
      create: { taskHash: normalizedHash, description },
      update: { description },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
