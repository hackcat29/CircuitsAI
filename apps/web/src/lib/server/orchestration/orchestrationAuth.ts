import { prisma, type Pipeline } from "@clawdhq/custody-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { ApiError } from "@/lib/server/socialErrors";

// Owner-only control for a pipeline — same "always the human wallet session that created it,
// checked by plain equality" shape as subscriptionAuth.ts's requireSubscriptionOwner. See that
// file's doc comment for the full reasoning; it applies here verbatim.

function normalizeForCompare(address: string): string {
  return address.trim().toLowerCase();
}

/** Fetches the pipeline (with its steps, ordered) and asserts the current session is its owner
 * — throws 404 if the pipeline doesn't exist, 401 if not signed in, 403 if signed in as the
 * wrong wallet (or a non-human/bearer-key actor). Returns the pipeline row so callers don't
 * need a second fetch. */
export async function requirePipelineOwner(pipelineId: string): Promise<Pipeline & { steps: Awaited<ReturnType<typeof prisma.pipelineStep.findMany>> }> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!pipeline) throw new ApiError(404, "Pipeline not found");

  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage a pipeline");
  }

  if (normalizeForCompare(pipeline.ownerAddress) !== normalizeForCompare(session.walletAddress)) {
    throw new ApiError(403, "You are not the owner of this pipeline");
  }

  return pipeline;
}

export async function requireHumanSession(): Promise<{ walletAddress: string }> {
  const session = await getSessionProfile();
  if (!session) throw new ApiError(401, "Sign in with your wallet first");
  if (session.kind !== "HUMAN" || !session.walletAddress) {
    throw new ApiError(403, "Only a human wallet session can manage a pipeline");
  }
  return { walletAddress: session.walletAddress };
}
