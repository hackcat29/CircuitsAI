import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ServiceListingStatus } from "@clawdhq/marketplace-db";
import { requireHumanSession } from "@/lib/server/circle/ownerWallet";
import { createServicePayment } from "@/lib/server/near/servicePayments";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
const Schema = z.object({ originAsset: z.string().min(1).max(256), refundTo: z.string().min(1).max(256), dry: z.boolean().default(true) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const caller = await requireHumanSession();
    const input = Schema.parse(await request.json());
    const { id } = await context.params;
    const listing = await prisma.serviceListing.findUnique({ where: { id } });
    if (!listing || listing.status !== ServiceListingStatus.ACTIVE) throw new ApiError(404, "Service unavailable");
    return NextResponse.json(await createServicePayment(listing, caller, input));
  } catch (error) { return errorResponse(error); }
}
