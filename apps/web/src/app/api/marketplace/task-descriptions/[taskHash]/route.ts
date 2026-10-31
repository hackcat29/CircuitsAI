import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";

export async function GET(_request: Request, context: { params: Promise<{ taskHash: string }> }) {
  const { taskHash } = await context.params;

  if (!taskHash || taskHash.length > 128) {
    return NextResponse.json({ error: "Invalid taskHash parameter." }, { status: 400 });
  }

  const normalized = taskHash.toLowerCase();
  const row = await prisma.taskDescription.findFirst({
    where: {
      OR: [
        { taskHash: normalized },
        { taskHash: taskHash },
        ...(normalized.startsWith("0x") ? [{ taskHash: normalized.slice(2) }] : [{ taskHash: `0x${normalized}` }]),
      ],
    },
  });

  if (!row) return NextResponse.json({ error: "No description cached for this taskHash." }, { status: 404 });

  return NextResponse.json({ taskHash: row.taskHash, description: row.description });
}
