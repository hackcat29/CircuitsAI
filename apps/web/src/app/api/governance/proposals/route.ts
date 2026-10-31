import { NextResponse } from "next/server";
import { Chain, ProposalCategory, ProposalState, prisma } from "@clawdhq/marketplace-db";

// Read-only: browses the indexer's cached governance proposals. All writes (createProposal/
// vote/execute) go directly on-chain from the caller's wallet via the SDK's EvmGovernorAdapter
// — this route never accepts or processes a state change (see marketplace-db's
// GovernanceProposal doc comment).

// Mirrors SELECTABLE_CHAINS in apps/web/src/lib/chains.ts, same reasoning as
// api/exchange/listings/route.ts's DEFAULT_CHAINS.
const DEFAULT_CHAINS: Chain[] = [Chain.MONAD_MAINNET, Chain.BASE_SEPOLIA, Chain.ETH_SEPOLIA, Chain.BSC_TESTNET];

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 100;

function parseChainParam(param: string | null): Chain | null {
  if (!param) return null;
  const clean = param.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean in Chain && !clean.startsWith("ARC_")) return clean as Chain;
  return null;
}

type ProposalWithVoterIds = Awaited<ReturnType<typeof prisma.governanceProposal.findMany<{ include: { votes: { select: { voterAgentChainId: true } } } }>>>[number];

function serializeProposal(proposal: ProposalWithVoterIds) {
  return {
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
    // Which on-chain agent ids have already voted on this proposal — lets the client disable
    // voting for whichever of the connected wallet's own agents already cast one, without a
    // separate detail-endpoint round trip per proposal card (see ClawdHQGovernor.sol: voting
    // identity is per-agent, not per-wallet).
    votedAgentChainIds: proposal.votes.map((vote) => vote.voterAgentChainId),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawChain = url.searchParams.get("chain");
  const chain = rawChain ? parseChainParam(rawChain) : null;
  const stateParam = url.searchParams.get("state");
  const categoryParam = url.searchParams.get("category");
  const cursor = url.searchParams.get("cursor");
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT));

  if (rawChain && !chain) {
    return NextResponse.json({ error: `Unknown chain "${rawChain}"` }, { status: 400 });
  }
  if (stateParam && !(stateParam in ProposalState)) {
    return NextResponse.json({ error: `Unknown state "${stateParam}"` }, { status: 400 });
  }
  if (categoryParam && !(categoryParam in ProposalCategory)) {
    return NextResponse.json({ error: `Unknown category "${categoryParam}"` }, { status: 400 });
  }

  const chainFilter = chain ? chain : { in: DEFAULT_CHAINS };

  const proposals = await prisma.governanceProposal.findMany({
    where: {
      chain: chainFilter,
      state: stateParam ? (stateParam as ProposalState) : undefined,
      category: categoryParam ? (categoryParam as ProposalCategory) : undefined,
    },
    include: { votes: { select: { voterAgentChainId: true } } },
    orderBy: { createdAtChain: "desc" },
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = proposals.length > pageSize;
  const page = hasMore ? proposals.slice(0, pageSize) : proposals;

  return NextResponse.json({
    proposals: page.map(serializeProposal),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
