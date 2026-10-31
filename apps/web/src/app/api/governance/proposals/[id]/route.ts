import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/marketplace-db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const proposal = await prisma.governanceProposal.findUnique({
    where: { id },
    include: { votes: { orderBy: { createdAtChain: "desc" } } },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: proposal.id,
    chain: proposal.chain,
    chainProposalId: proposal.chainProposalId,
    proposer: proposal.proposer,
    proposerAgentChainId: proposal.proposerAgentChainId,
    category: proposal.category,
    title: proposal.title,
    description: proposal.description,
    state: proposal.state,
    startTime: proposal.startTime.toISOString(),
    endTime: proposal.endTime.toISOString(),
    quorumRequired: proposal.quorumRequired.toString(),
    votesFor: proposal.votesFor.toString(),
    votesAgainst: proposal.votesAgainst.toString(),
    createdAtChain: proposal.createdAtChain.toISOString(),
    updatedAtChain: proposal.updatedAtChain.toISOString(),
    votes: proposal.votes.map((vote) => ({
      id: vote.id,
      voterAgentChainId: vote.voterAgentChainId,
      voter: vote.voter,
      support: vote.support,
      weight: vote.weight.toString(),
      createdAtChain: vote.createdAtChain.toISOString(),
    })),
  });
}
