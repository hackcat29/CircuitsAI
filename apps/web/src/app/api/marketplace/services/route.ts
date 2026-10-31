import { NextResponse } from "next/server";
import { parseUnits, formatUnits } from "viem";
import { Chain, ServiceListingStatus, prisma } from "@clawdhq/marketplace-db";
import { isEvmPrismaChain } from "@clawdhq/custody-core";
import { requireHumanSession } from "@/lib/server/circle/ownerWallet";
import { isAgentOwner } from "@/lib/server/agentOwnerVerify";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { verifyListingFeeTxHash } from "@/lib/server/listingFeeVerify";

// Real registry for the Task Market's "Services" tab — previously just a "Coming Soon"
// placeholder. Scoped per-chain like Tasks/Subscriptions (a listing lives on whichever EVM
// chain its agent is registered on); payment is a plain on-chain USDC transfer, verified by
// serviceCallVerify.ts, not tied to any one chain the way an earlier Circle-wallet-specific
// design was.

function parseChain(value: string | null | undefined): Chain | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean in Chain && isEvmPrismaChain(clean)) return clean as Chain;
  return null;
}

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;

function serialize(listing: Awaited<ReturnType<typeof prisma.serviceListing.findMany>>[number]) {
  return {
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
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = parseChain(url.searchParams.get("chain"));
  if (!chain) return NextResponse.json({ error: "Missing or unsupported chain" }, { status: 400 });
  const agentChainId = url.searchParams.get("agentChainId");

  const candidateChains = [chain];

  const listings = await prisma.serviceListing.findMany({
    where: { chain: { in: candidateChains }, status: ServiceListingStatus.ACTIVE, agentChainId: agentChainId ?? undefined },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ listings: listings.map(serialize) });
}

export async function POST(request: Request) {
  try {
    const ownerAddress = await requireHumanSession();

    const body = await request.json().catch(() => null);
    const chain = parseChain(typeof body?.chain === "string" ? body.chain : null);
    const agentChainId = typeof body?.agentChainId === "string" ? body.agentChainId.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    const priceUsdc = typeof body?.priceUsdc === "string" ? body.priceUsdc.trim() : "";

    if (!chain) throw new ApiError(400, "Missing or unsupported chain.");
    if (!agentChainId) throw new ApiError(400, "Missing agentChainId.");
    if (!name || name.length > MAX_NAME_LENGTH) throw new ApiError(400, `name is required and must be ${MAX_NAME_LENGTH} characters or fewer.`);
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) throw new ApiError(400, `description is required and must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);

    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      throw new ApiError(400, "endpoint must be a valid URL.");
    }
    if (endpointUrl.protocol !== "http:" && endpointUrl.protocol !== "https:") throw new ApiError(400, "endpoint must be http(s).");

    let priceUsdcMicros: bigint;
    try {
      priceUsdcMicros = parseUnits(priceUsdc, 6);
    } catch {
      throw new ApiError(400, "priceUsdc must be a decimal USDC amount, e.g. \"0.05\".");
    }
    if (priceUsdcMicros <= 0n) throw new ApiError(400, "priceUsdc must be greater than 0.");

    const verified = await isAgentOwner(chain, agentChainId, ownerAddress);
    if (!verified) throw new ApiError(403, "You aren't the on-chain owner of this agent on this chain.");

    const feeTxHash = await verifyListingFeeTxHash("SERVICE_LISTING_FEE_USDC", chain, ownerAddress, body?.feeTxHash);

    const listing = await prisma.serviceListing.create({
      data: { chain, agentChainId, ownerAddress, name, description, endpoint, priceUsdcMicros, feeTxHash: feeTxHash ?? undefined },
    });

    return NextResponse.json({ listing: serialize(listing) });
  } catch (error) {
    return errorResponse(error);
  }
}
