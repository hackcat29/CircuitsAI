import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";
import { EvmAdapter } from "@clawdhq/sdk";
import { createPublicClient, http, type PublicClient } from "viem";
import { isEvmPrismaChain, viemChainFor, rpcUrlFor, contractAddressFor, type EvmPrismaChain } from "@clawdhq/custody-core";

const cachedClients = new Map<EvmPrismaChain, PublicClient>();

function clientFor(chain: EvmPrismaChain): PublicClient {
  let client = cachedClients.get(chain);
  if (!client) {
    const url = rpcUrlFor(chain);
    client = createPublicClient({
      chain: viemChainFor(chain),
      transport: http(url),
    });
    cachedClients.set(chain, client);
  }
  return client;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    if (!jobId || !/^\d+$/.test(jobId)) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    const url = new URL(request.url);
    const queryChain = url.searchParams.get("chain")?.toUpperCase();

    const candidateChains: EvmPrismaChain[] = [];
    if (queryChain && !queryChain.startsWith("ARC_") && isEvmPrismaChain(queryChain as any)) {
      candidateChains.push(queryChain as EvmPrismaChain);
    }
    if (!candidateChains.includes("MONAD_MAINNET")) {
      candidateChains.push("MONAD_MAINNET");
    }

    let foundJob: any = null;
    let resolvedChain: EvmPrismaChain = "MONAD_MAINNET";

    for (const chain of candidateChains) {
      try {
        const contractAddr = contractAddressFor(chain);
        if (!contractAddr) continue;
        const adapter = new EvmAdapter({
          contractAddress: contractAddr,
          publicClient: clientFor(chain),
        });

        const j = await adapter.getJob(BigInt(jobId));
        if (
          j &&
          j.jobId !== "0" &&
          j.employer &&
          j.employer !== "0x0000000000000000000000000000000000000000"
        ) {
          foundJob = j;
          resolvedChain = chain;
          break;
        }
      } catch {
        // Continue searching other candidate chains
      }
    }

    if (!foundJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let description: string | undefined;
    let deliverableText: string | undefined;

    // Resolve description from cache
    if (foundJob.taskHash) {
      const normalized = foundJob.taskHash.toLowerCase();
      const row = await prisma.taskDescription.findFirst({
        where: {
          OR: [
            { taskHash: normalized },
            { taskHash: foundJob.taskHash },
            ...(normalized.startsWith("0x") ? [{ taskHash: normalized.slice(2) }] : [{ taskHash: `0x${normalized}` }]),
          ],
        },
      });
      if (row) description = row.description;
    }

    // Resolve deliverable text if available
    if (
      foundJob.deliverableHash &&
      foundJob.deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      const normalizedDeliv = foundJob.deliverableHash.toLowerCase();
      const row = await prisma.taskDescription.findFirst({
        where: {
          OR: [
            { taskHash: normalizedDeliv },
            { taskHash: foundJob.deliverableHash },
            ...(normalizedDeliv.startsWith("0x") ? [{ taskHash: normalizedDeliv.slice(2) }] : [{ taskHash: `0x${normalizedDeliv}` }]),
          ],
        },
      });
      if (row) deliverableText = row.description;
    }

    return NextResponse.json({
      job: {
        id: foundJob.jobId,
        jobId: foundJob.jobId,
        employer: foundJob.employer,
        employerAgentId: foundJob.employerAgentId || "0",
        hiredAgentId: foundJob.hiredAgentId,
        budget: foundJob.budget.toString(),
        status: foundJob.status,
        deadline: foundJob.deadline.toString(),
        createdAt: foundJob.createdAt?.toString(),
        completedAt: foundJob.completedAt?.toString(),
        taskHash: foundJob.taskHash,
        deliverableHash: foundJob.deliverableHash,
        disputeId: foundJob.disputeId,
        rating: foundJob.rating,
        chain: resolvedChain,
        description,
        deliverableText,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
