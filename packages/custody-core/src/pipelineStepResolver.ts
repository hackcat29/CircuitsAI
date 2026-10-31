import { createPublicClient } from "viem";
import { EvmAdapter } from "@clawdhq/sdk";
import { prisma, PipelineStatus, PipelineStepStatus } from "@clawdhq/custody-db";
import { isEvmPrismaChain, viemChainFor, rpcTransportFor, contractAddressFor, type EvmPrismaChain } from "./evmChainConfig.js";
import { getSigningEvmAdapter, localEvmSigner } from "./signingEvmAdapter.js";
import { getDecryptedPipelineWallet } from "./pipelineCustody.js";
import { advancePipelineForJobOutcome } from "./pipelineAdvance.js";

/** Resolves any in-flight SUBMITTED pipeline steps where the hired agent or employer
 * is ready to perform on-chain job transitions (acceptJob -> submitDeliverable -> confirmDelivery).
 * Ensures pipelines autonomously advance end-to-end without stalling. */
export async function resolveActivePipelineSteps(): Promise<{ resolvedCount: number; errors: string[] }> {
  const steps = await prisma.pipelineStep.findMany({
    where: {
      status: PipelineStepStatus.SUBMITTED,
      jobChainId: { not: null },
      pipeline: { status: PipelineStatus.ACTIVE },
    },
    include: { pipeline: true },
    take: 10,
  });

  let resolvedCount = 0;
  const errors: string[] = [];

  for (const step of steps) {
    if (!step.jobChainId) continue;
    if (!isEvmPrismaChain(step.pipeline.chain)) continue;

    const chain = step.pipeline.chain as EvmPrismaChain;
    const jobId = BigInt(step.jobChainId);

    try {
      const readAdapter = new EvmAdapter({
        contractAddress: contractAddressFor(chain),
        publicClient: createPublicClient({ chain: viemChainFor(chain), transport: rpcTransportFor(chain) }),
      });

      // Re-read job status in case deliverable was just submitted
      const freshJob = await readAdapter.getJob(jobId);

      // Status 1: Delivered -> employer (PipelineWallet) confirms delivery
      if (freshJob.status === 1) {
        const pipelineWallet = await getDecryptedPipelineWallet(step.pipelineId);
        if (pipelineWallet) {
          const employerAdapter = getSigningEvmAdapter(chain, localEvmSigner(chain, pipelineWallet.privateKey));
          const confirmTx = await employerAdapter.confirmDelivery(jobId, 5);
          await employerAdapter.waitForTransaction(confirmTx);
          resolvedCount++;
        }
      }

      // Status 2: Completed -> ensure DB has caught up
      if (freshJob.status === 2 && step.status === PipelineStepStatus.SUBMITTED) {
        await advancePipelineForJobOutcome(chain, step.jobChainId, "completed");
        resolvedCount++;
      }
    } catch (err) {
      const msg = `Failed to resolve step ${step.id} (job ${step.jobChainId}): ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[pipelineStepResolver] ${msg}`);
      errors.push(msg);
    }
  }

  return { resolvedCount, errors };
}
