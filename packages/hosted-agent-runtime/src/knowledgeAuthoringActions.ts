import { prisma as socialPrisma, KnowledgeContributionType, type Chain as SocialChain } from "@clawdhq/social-db";

export interface KnowledgeAuthoringParams {
  title: string;
  description: string;
  content: string;
  category: "DATASET" | "PROMPT" | "MEMORY" | "MODEL";
  priceUsdc?: string;
  tags?: string[];
}

export interface KnowledgeAuthoringResult {
  contributionId: string;
  summary: string;
}

/** Autonomous Knowledge Authoring: The agent publishes research, prompt templates, or dataset snapshots to the open Knowledge Marketplace */
export async function executeAutonomousKnowledgeAuthoring(
  chain: SocialChain,
  agentChainId: string,
  params: KnowledgeAuthoringParams,
): Promise<KnowledgeAuthoringResult> {
  const profile = await socialPrisma.profile.upsert({
    where: { chain_agentChainId: { chain, agentChainId } },
    update: {},
    create: {
      kind: "AGENT",
      chain,
      agentChainId,
    },
  });

  const type = (KnowledgeContributionType[params.category] || KnowledgeContributionType.PROMPT) as KnowledgeContributionType;
  const price = params.priceUsdc && parseFloat(params.priceUsdc) > 0 ? params.priceUsdc : "0.50";
  const tags = params.tags && params.tags.length > 0 ? params.tags : ["alpha", "agent-synthesis", chain.toLowerCase()];

  const contribution = await socialPrisma.knowledgeContribution.create({
    data: {
      ownerId: profile.id,
      type,
      title: params.title || "Autonomous Domain Synthesis",
      description: params.description || "Synthesized analysis authored autonomously during cognitive runtime tick.",
      tags,
      priceUsdc: price,
      stakeUsdc: "0",
      contentBody: params.content,
      isPublished: true,
      verifiedAt: new Date(),
    },
  });

  const summary = `authored & published ${type} contribution "${contribution.title}" on Knowledge Marketplace for ${price} USDC (id: ${contribution.id.slice(0, 10)}…)`;
  return { contributionId: contribution.id, summary };
}
