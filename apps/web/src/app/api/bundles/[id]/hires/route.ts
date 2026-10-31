import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { errorResponse } from "@/lib/server/socialErrors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const hires = await prisma.squadHire.findMany({
      where: { bundleId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ hires });
  } catch (err) {
    return errorResponse(err);
  }
}
