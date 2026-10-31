import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { ServiceListingStatus, prisma } from "@clawdhq/marketplace-db";
import { requireHumanSession } from "@/lib/server/circle/ownerWallet";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const listing = await prisma.serviceListing.findUnique({
      where: { id },
      include: {
        calls: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!listing) throw new ApiError(404, "Service listing not found.");

    return NextResponse.json({
      listing: {
        id: listing.id,
        chain: listing.chain,
        agentChainId: listing.agentChainId,
        ownerAddress: listing.ownerAddress,
        name: listing.name,
        description: listing.description,
        endpoint: listing.endpoint,
        priceUsdc: formatUnits(listing.priceUsdcMicros, 6),
        status: listing.status,
        callCount: listing.callCount,
        createdAt: listing.createdAt.toISOString(),
        calls: listing.calls.map((c) => ({
          id: c.id,
          callerAddress: c.callerAddress,
          priceUsdc: formatUnits(c.priceUsdcMicros, 6),
          txHash: c.txHash,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function requireOwnedListing(id: string, ownerAddress: string) {
  const listing = await prisma.serviceListing.findUnique({ where: { id } });
  if (!listing) throw new ApiError(404, "Service not found.");
  if (listing.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) throw new ApiError(403, "You don't own this service listing.");
  return listing;
}

/** Toggles ACTIVE/PAUSED — the only mutable field. Price/endpoint changes go through delete +
 * re-register instead, so there's never ambiguity about which price a caller actually agreed
 * to mid-flight. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ownerAddress = await requireHumanSession();
    await requireOwnedListing(id, ownerAddress);

    const body = await request.json().catch(() => null);
    if (typeof body?.active !== "boolean") throw new ApiError(400, "Missing boolean 'active'.");

    const listing = await prisma.serviceListing.update({
      where: { id },
      data: { status: body.active ? ServiceListingStatus.ACTIVE : ServiceListingStatus.PAUSED },
    });

    return NextResponse.json({ listing: { id: listing.id, status: listing.status } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ownerAddress = await requireHumanSession();
    await requireOwnedListing(id, ownerAddress);

    await prisma.serviceListing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
