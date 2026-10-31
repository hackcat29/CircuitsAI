import { NextResponse } from "next/server";
import { prisma as socialPrisma } from "@clawdhq/social-db";
import { prisma as marketplacePrisma } from "@clawdhq/marketplace-db";
import { errorResponse } from "@/lib/server/socialErrors";
import { agentUrlId } from "@/lib/agentSlug";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export interface UserOperationItem {
  id: string;
  type:
    | "AGENT_REGISTERED"
    | "TOKEN_LAUNCH_CREATED"
    | "TOKEN_SWAP"
    | "EXCHANGE_LISTED"
    | "BID_PLACED"
    | "SERVICE_PUBLISHED"
    | "AGENT_BROADCAST"
    | "KNOWLEDGE_CONTRIBUTED";
  title: string;
  description: string;
  timestamp: string;
  txHash?: string | null;
  chain?: string | null;
  agentName?: string | null;
  agentId?: string | null;
  tokenSymbol?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown>;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawParam } = await context.params;
    const cleanParam = decodeURIComponent(rawParam).replace(/^@/, "").trim();

    // 1. Resolve Profile in social-db
    let profile = await socialPrisma.profile.findFirst({
      where: { username: { equals: cleanParam, mode: "insensitive" } },
    });

    if (!profile) {
      profile =
        (await socialPrisma.profile.findUnique({ where: { walletAddress: cleanParam } })) ??
        (EVM_ADDRESS_RE.test(cleanParam)
          ? await socialPrisma.profile.findUnique({
              where: { walletAddress: cleanParam.toLowerCase() },
            })
          : null);
    }

    const walletAddress = profile?.walletAddress || (EVM_ADDRESS_RE.test(cleanParam) ? cleanParam : null);

    if (!walletAddress && !profile) {
      return NextResponse.json({ operations: [], totalCount: 0 });
    }

    const operations: UserOperationItem[] = [];

    if (walletAddress) {
      // 2. Fetch on-chain activities from marketplace database
      const [
        agents,
        launches,
        trades,
        listings,
        bids,
        services,
      ] = await Promise.all([
        marketplacePrisma.agent.findMany({
          where: { owner: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAtChain: "desc" },
          take: 50,
        }).catch(() => []),
        marketplacePrisma.launch.findMany({
          where: { creator: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAtChain: "desc" },
          take: 50,
        }).catch(() => []),
        marketplacePrisma.launchTrade.findMany({
          where: { traderAddress: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAtChain: "desc" },
          take: 50,
        }).catch(() => []),
        marketplacePrisma.listing.findMany({
          where: { seller: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAtChain: "desc" },
          take: 50,
        }).catch(() => []),
        marketplacePrisma.bid.findMany({
          where: { bidder: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAtChain: "desc" },
          take: 50,
        }).catch(() => []),
        marketplacePrisma.serviceListing.findMany({
          where: { ownerAddress: { equals: walletAddress, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }).catch(() => []),
      ]);

      const agentMap = new Map<string, string>();
      for (const a of agents) {
        agentMap.set(a.agentChainId, a.name);
      }

      // Map Agents Registered
      for (const agent of agents) {
        operations.push({
          id: `agent-reg-${agent.id}`,
          type: "AGENT_REGISTERED",
          title: `Registered Agent: ${agent.name}`,
          description: `Deployed agent ${agent.name} (#${agent.agentChainId}) on ${agent.chain} with Tier ${agent.tier}`,
          timestamp: agent.createdAtChain.toISOString(),
          chain: agent.chain,
          agentName: agent.name,
          agentId: agent.agentChainId,
          href: `/agents/${encodeURIComponent(agent.name.toLowerCase().replace(/\s+/g, "-"))}-${agent.agentChainId}`,
          metadata: {
            tier: agent.tier,
            jobsCompleted: agent.jobsCompleted,
            reputationBps: agent.reputationBps,
            revenue: agent.usdcRevenue.toString(),
          },
        });
      }

      // Map Token Launches
      for (const launch of launches) {
        const agentName = launch.name || agentMap.get(launch.agentChainId) || `Agent #${launch.agentChainId}`;
        operations.push({
          id: `launch-${launch.id}`,
          type: "TOKEN_LAUNCH_CREATED",
          title: `Launched Agent Token: $${launch.symbol}`,
          description: `Created fair-launch bonding curve for ${agentName} ($${launch.symbol}) on ${launch.chain}`,
          timestamp: launch.createdAtChain.toISOString(),
          chain: launch.chain,
          agentName,
          tokenSymbol: launch.symbol,
          agentId: launch.agentChainId,
          href: `/launchpad/${launch.launchChainId}`,
          metadata: {
            token: launch.token,
            usdcRaised: launch.usdcRaised.toString(),
            graduated: launch.graduated,
          },
        });
      }

      // Fetch launch metadata for trades to display exact coin name and symbol
      const tradeLaunchIds = trades.map((t) => t.launchChainId);
      const tradeLaunches = tradeLaunchIds.length > 0
        ? await marketplacePrisma.launch.findMany({
            where: { launchChainId: { in: tradeLaunchIds } },
          }).catch(() => [])
        : [];
      const tradeLaunchMap = new Map(tradeLaunches.map((l) => [l.launchChainId, l]));

      // Map Token Swaps with exact coin name and token amount
      for (const trade of trades) {
        const launch = tradeLaunchMap.get(trade.launchChainId);
        const coinSymbol = launch?.symbol || "TOKEN";
        const coinName = launch?.name || coinSymbol;
        const usdc = (Number(trade.usdcAmount) / 1e6).toFixed(2);
        const tokenAmount = (Number(trade.tokenAmount) / 1e18).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        });

        operations.push({
          id: `trade-${trade.id}`,
          type: "TOKEN_SWAP",
          title: `${trade.side === "BUY" ? "Bought" : "Sold"} $${coinSymbol} (${coinName})`,
          description: `${trade.side === "BUY" ? "Purchased" : "Sold"} ${tokenAmount} $${coinSymbol} for $${usdc} USDC on ${trade.chain}`,
          timestamp: trade.createdAtChain.toISOString(),
          txHash: trade.txHash,
          chain: trade.chain,
          tokenSymbol: coinSymbol,
          agentName: coinName,
          href: `/launchpad/${trade.launchChainId}`,
          metadata: {
            side: trade.side,
            tokenAmount: trade.tokenAmount.toString(),
            usdcAmount: trade.usdcAmount.toString(),
            launchChainId: trade.launchChainId,
            tokenSymbol: coinSymbol,
            tokenName: coinName,
          },
        });
      }

      // Map Exchange Listings
      for (const listing of listings) {
        const agentName = agentMap.get(listing.agentChainId) || `Agent #${listing.agentChainId}`;
        operations.push({
          id: `listing-${listing.id}`,
          type: "EXCHANGE_LISTED",
          title: `Listed ${agentName} for Ownership Acquisition`,
          description: `Opened ${listing.mode.toLowerCase()} listing for ${agentName} on ${listing.chain}`,
          timestamp: listing.createdAtChain.toISOString(),
          chain: listing.chain,
          agentName,
          agentId: listing.agentChainId,
          href: `/exchange/${listing.id}`,
          metadata: {
            mode: listing.mode,
            status: listing.status,
          },
        });
      }

      // Map Exchange Bids
      for (const bid of bids) {
        const bidUsdc = (Number(bid.amountUsdc) / 1e6).toFixed(2);
        operations.push({
          id: `bid-${bid.id}`,
          type: "BID_PLACED",
          title: `Placed Ownership Bid on Exchange`,
          description: `Bid $${bidUsdc} USDC on Agent listing on ${bid.chain}`,
          timestamp: bid.createdAtChain.toISOString(),
          chain: bid.chain,
          href: `/exchange`,
          metadata: {
            amountUsdc: bid.amountUsdc.toString(),
            active: bid.active,
          },
        });
      }

      // Map Services Published
      for (const service of services) {
        const price = (Number(service.priceUsdcMicros) / 1e6).toFixed(4);
        operations.push({
          id: `service-${service.id}`,
          type: "SERVICE_PUBLISHED",
          title: `Published Metered Service: ${service.name}`,
          description: `Offered pay-per-call API at $${price} USDC on ${service.chain}`,
          timestamp: service.createdAt.toISOString(),
          chain: service.chain,
          agentName: service.name,
          agentId: service.agentChainId,
          href: `/marketplace/${service.id}`,
          metadata: {
            callCount: service.callCount,
            status: service.status,
          },
        });
      }

      // Fetch Autonomous Agent Broadcasts on ClawdHQ Social Feed
      const ownedAgentChainIds = agents.map((a) => a.agentChainId);
      if (ownedAgentChainIds.length > 0) {
        const agentSocialProfiles = await socialPrisma.profile.findMany({
          where: {
            kind: "AGENT",
            agentChainId: { in: ownedAgentChainIds },
          },
          select: { id: true, displayName: true, username: true, agentChainId: true },
        });

        if (agentSocialProfiles.length > 0) {
          const profileIds = agentSocialProfiles.map((p) => p.id);
          const profileMap = new Map(agentSocialProfiles.map((p) => [p.id, p]));

          const agentPosts = await socialPrisma.post.findMany({
            where: { authorId: { in: profileIds } },
            orderBy: { createdAt: "desc" },
            take: 50,
          });

          for (const post of agentPosts) {
            const author = profileMap.get(post.authorId);
            const agentName =
              author?.displayName ||
              (author?.agentChainId ? agentMap.get(author.agentChainId) : null) ||
              author?.username ||
              "Agent";

            const agentSlug = author?.agentChainId ? agentUrlId(agentName, author.agentChainId) : null;
            const clawdAgentFeedHref = author?.username
              ? `https://www.clawdhq.xyz/${author.username}`
              : agentSlug
              ? `https://www.clawdhq.xyz/agents/${agentSlug}`
              : `https://www.clawdhq.xyz/circuits`;

            operations.push({
              id: `agent-post-${post.id}`,
              type: "AGENT_BROADCAST",
              title: `${agentName} Insight Broadcast`,
              description:
                (post.body ?? "").length > 180
                  ? (post.body ?? "").slice(0, 180) + "…"
                  : (post.body ?? "(no content)"),
              timestamp: post.createdAt.toISOString(),
              agentName,
              agentId: author?.agentChainId ?? undefined,
              href: clawdAgentFeedHref,
              metadata: {
                postId: post.id,
                likesCount: post.likeCount ?? 0,
                commentsCount: post.commentCount ?? 0,
              },
            });
          }
        }
      }
    }

    // Sort chronologically descending
    operations.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      operations,
      totalCount: operations.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
