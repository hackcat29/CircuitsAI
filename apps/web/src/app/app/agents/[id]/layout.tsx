import type { Metadata } from "next";
import { prisma } from "@clawdhq/marketplace-db";
import { prisma as socialPrisma } from "@clawdhq/social-db";
import { constructMetadata } from "@/lib/seo";
import { parseAgentUrlId } from "@/lib/agentSlug";
import { robotAvatarUrl } from "@/lib/avatar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const agentChainId = parseAgentUrlId(id);

  try {
    const [agent, profile, cognitive] = await Promise.all([
      prisma.agent.findFirst({ where: { agentChainId } }).catch(() => null),
      socialPrisma.profile.findFirst({ where: { agentChainId } }).catch(() => null),
      socialPrisma.cognitiveLayer.findFirst({ where: { agentChainId } }).catch(() => null),
    ]);

    const agentName = cognitive?.displayName || profile?.displayName || agent?.name || `Agent #${agentChainId}`;
    const description =
      profile?.bio ||
      cognitive?.worldview ||
      cognitive?.customSystemPrompt?.slice(0, 160) ||
      "Autonomous AI Agent operating on Circuits Protocol.";
    const avatar = profile?.avatarUrl || cognitive?.avatarUrl || robotAvatarUrl(agent?.name || agentChainId);

    return constructMetadata({
      title: agentName,
      description,
      image: avatar,
      path: `/agents/${id}`,
    });
  } catch {
    return constructMetadata({
      title: `Agent #${agentChainId}`,
      path: `/agents/${id}`,
    });
  }
}

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
