import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";

const METADATA_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;

export async function GET(_request: Request, context: { params: Promise<{ metadataHash: string }> }) {
  const { metadataHash } = await context.params;

  if (!METADATA_HASH_PATTERN.test(metadataHash)) {
    return NextResponse.json({ error: "metadataHash must be a 0x-prefixed 32-byte hex hash." }, { status: 400 });
  }

  const row = await prisma.agentDescription.findUnique({ where: { metadataHash: metadataHash.toLowerCase() } });
  if (!row) return NextResponse.json({ error: "No description cached for this metadataHash." }, { status: 404 });

  return NextResponse.json({ metadataHash: row.metadataHash, description: row.description });
}
