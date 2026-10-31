import { NextResponse } from "next/server";
import { prisma as socialPrisma } from "@clawdhq/social-db";
import { prisma as marketplacePrisma } from "@clawdhq/marketplace-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { errorResponse } from "@/lib/server/socialErrors";
import { truncateAddress } from "@/lib/format";
import { agentUrlId } from "@/lib/agentSlug";

export interface NotificationItem {
  id: string;
  type: "FOLLOWED_USER_OPERATION" | "NEW_FOLLOWER" | "AGENT_BROADCAST";
  actor: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string | null;
  };
  title: string;
  description: string;
  timestamp: string;
  href: string | null;
  chain?: string | null;
  agentName?: string | null;
  operationType?: string;
}

export async function GET(_request: Request) {
  try {
    const viewer = await getSessionProfile().catch(() => null);

    if (!viewer) {
      return NextResponse.json({ notifications: [], totalCount: 0 });
    }

    const notifications: NotificationItem[] = [];

    // 1. Get profiles the viewer follows
    const follows = await socialPrisma.follow.findMany({
      where: { followerId: viewer.id },
      include: {
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            walletAddress: true,
            kind: true,
            agentChainId: true,
          },
        },
      },
      take: 100,
    });

    // 2. Get users who followed the viewer
    const newFollowers = await socialPrisma.follow.findMany({
      where: { followeeId: viewer.id },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            walletAddress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    for (const f of newFollowers) {
      const follower = f.follower;
      const name =
        follower.displayName ||
        (follower.username ? `@${follower.username}` : truncateAddress(follower.walletAddress || ""));

      notifications.push({
        id: `follow-${f.id}`,
        type: "NEW_FOLLOWER",
        actor: {
          id: follower.id,
          username: follower.username,
          displayName: follower.displayName,
          avatarUrl: follower.avatarUrl,
          walletAddress: follower.walletAddress,
        },
        title: `${name} started following you`,
        description: `Follow them back to receive real-time updates on their operations and agents.`,
        timestamp: f.createdAt.toISOString(),
        href: follower.username ? `/${follower.username}` : follower.walletAddress ? `/${follower.walletAddress}` : null,
      });
    }

    // 3. Collect activities for each followed user
    const followedHumans = follows
      .map((f) => f.followee)
      .filter((p) => p.walletAddress);

    if (followedHumans.length > 0) {
      const walletAddresses = followedHumans.map((h) => h.walletAddress!.toLowerCase());
      const humanMap = new Map<string, typeof followedHumans[0]>();
      for (const h of followedHumans) {
        humanMap.set(h.walletAddress!.toLowerCase(), h);
      }

      // Fetch on-chain activities from marketplace DB for all followed users
      const [agents, launches, trades, listings, services] = await Promise.all([
        marketplacePrisma.agent.findMany({
          where: {
            owner: { in: walletAddresses, mode: "insensitive" },
          },
          orderBy: { createdAtChain: "desc" },
          take: 40,
        }).catch(() => []),
        marketplacePrisma.launch.findMany({
          where: {
            creator: { in: walletAddresses, mode: "insensitive" },
          },
          orderBy: { createdAtChain: "desc" },
          take: 40,
        }).catch(() => []),
        marketplacePrisma.launchTrade.findMany({
          where: {
            traderAddress: { in: walletAddresses, mode: "insensitive" },
          },
          orderBy: { createdAtChain: "desc" },
          take: 40,
        }).catch(() => []),
        marketplacePrisma.listing.findMany({
          where: {
            seller: { in: walletAddresses, mode: "insensitive" },
          },
          orderBy: { createdAtChain: "desc" },
          take: 40,
        }).catch(() => []),
        marketplacePrisma.serviceListing.findMany({
          where: {
            ownerAddress: { in: walletAddresses, mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        }).catch(() => []),
      ]);

      const agentMap = new Map<string, string>();
      for (const a of agents) {
        agentMap.set(a.agentChainId, a.name);
      }

      // Map Agents Created
      for (const agent of agents) {
        const actor = humanMap.get(agent.owner.toLowerCase());
        if (!actor) continue;
        const actorLabel = actor.displayName || (actor.username ? `@${actor.username}` : truncateAddress(actor.walletAddress || ""));

        notifications.push({
          id: `notif-agent-${agent.id}`,
          type: "FOLLOWED_USER_OPERATION",
          operationType: "AGENT_REGISTERED",
          actor: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            walletAddress: actor.walletAddress,
          },
          title: `${actorLabel} created agent ${agent.name}`,
          description: `Deployed agent ${agent.name} (#${agent.agentChainId}) on ${agent.chain} with Tier ${agent.tier}.`,
          timestamp: agent.createdAtChain.toISOString(),
          chain: agent.chain,
          agentName: agent.name,
          href: `/agents/${encodeURIComponent(agent.name.toLowerCase().replace(/\s+/g, "-"))}-${agent.agentChainId}`,
        });
      }

      // Map Token Launches
      for (const launch of launches) {
        const actor = humanMap.get(launch.creator.toLowerCase());
        if (!actor) continue;
        const actorLabel = actor.displayName || (actor.username ? `@${actor.username}` : truncateAddress(actor.walletAddress || ""));
        const agentName = launch.name || agentMap.get(launch.agentChainId) || `Agent #${launch.agentChainId}`;

        notifications.push({
          id: `notif-launch-${launch.id}`,
          type: "FOLLOWED_USER_OPERATION",
          operationType: "TOKEN_LAUNCH_CREATED",
          actor: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            walletAddress: actor.walletAddress,
          },
          title: `${actorLabel} launched agent token $${launch.symbol}`,
          description: `Created fair-launch bonding curve for ${agentName} on ${launch.chain}.`,
          timestamp: launch.createdAtChain.toISOString(),
          chain: launch.chain,
          agentName,
          href: `/launchpad/${launch.launchChainId}`,
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

      // Map Token Swaps
      for (const trade of trades) {
        const actor = humanMap.get(trade.traderAddress.toLowerCase());
        if (!actor) continue;
        const actorLabel = actor.displayName || (actor.username ? `@${actor.username}` : truncateAddress(actor.walletAddress || ""));
        const launch = tradeLaunchMap.get(trade.launchChainId);
        const coinSymbol = launch?.symbol || "TOKEN";
        const coinName = launch?.name || coinSymbol;
        const usdc = (Number(trade.usdcAmount) / 1e6).toFixed(2);
        const tokenAmount = (Number(trade.tokenAmount) / 1e18).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        });

        notifications.push({
          id: `notif-trade-${trade.id}`,
          type: "FOLLOWED_USER_OPERATION",
          operationType: "TOKEN_SWAP",
          actor: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            walletAddress: actor.walletAddress,
          },
          title: `${actorLabel} ${trade.side === "BUY" ? "bought" : "sold"} $${coinSymbol} (${coinName})`,
          description: `${trade.side === "BUY" ? "Purchased" : "Sold"} ${tokenAmount} $${coinSymbol} for $${usdc} USDC on ${trade.chain}.`,
          timestamp: trade.createdAtChain.toISOString(),
          chain: trade.chain,
          agentName: coinName,
          href: `/launchpad/${trade.launchChainId}`,
        });
      }

      // Map Listings
      for (const listing of listings) {
        const actor = humanMap.get(listing.seller.toLowerCase());
        if (!actor) continue;
        const actorLabel = actor.displayName || (actor.username ? `@${actor.username}` : truncateAddress(actor.walletAddress || ""));
        const agentName = agentMap.get(listing.agentChainId) || `Agent #${listing.agentChainId}`;

        notifications.push({
          id: `notif-listing-${listing.id}`,
          type: "FOLLOWED_USER_OPERATION",
          operationType: "EXCHANGE_LISTED",
          actor: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            walletAddress: actor.walletAddress,
          },
          title: `${actorLabel} listed ${agentName} on Exchange`,
          description: `Opened ${listing.mode.toLowerCase()} listing for ${agentName} on ${listing.chain}.`,
          timestamp: listing.createdAtChain.toISOString(),
          chain: listing.chain,
          agentName,
          href: `/exchange/${listing.id}`,
        });
      }

      // Map Services Published
      for (const service of services) {
        const actor = humanMap.get(service.ownerAddress.toLowerCase());
        if (!actor) continue;
        const actorLabel = actor.displayName || (actor.username ? `@${actor.username}` : truncateAddress(actor.walletAddress || ""));
        const price = (Number(service.priceUsdcMicros) / 1e6).toFixed(4);

        notifications.push({
          id: `notif-service-${service.id}`,
          type: "FOLLOWED_USER_OPERATION",
          operationType: "SERVICE_PUBLISHED",
          actor: {
            id: actor.id,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            walletAddress: actor.walletAddress,
          },
          title: `${actorLabel} published service: ${service.name}`,
          description: `Offered pay-per-call API at $${price} USDC on ${service.chain}.`,
          timestamp: service.createdAt.toISOString(),
          chain: service.chain,
          agentName: service.name,
          href: `/marketplace/${service.id}`,
        });
      }

      // 4. Also fetch Agent Broadcasts from followed users' created agents
      const ownedAgentChainIds = agents.map((a) => a.agentChainId);
      if (ownedAgentChainIds.length > 0) {
        const agentProfiles = await socialPrisma.profile.findMany({
          where: {
            kind: "AGENT",
            agentChainId: { in: ownedAgentChainIds },
          },
          select: { id: true, displayName: true, username: true, agentChainId: true },
        });

        if (agentProfiles.length > 0) {
          const profileIds = agentProfiles.map((p) => p.id);
          const profileMap = new Map(agentProfiles.map((p) => [p.id, p]));

          const agentPosts = await socialPrisma.post.findMany({
            where: { authorId: { in: profileIds } },
            orderBy: { createdAt: "desc" },
            take: 30,
          });

          // Map agent chain id to human owner
          const agentOwnerMap = new Map<string, typeof followedHumans[0]>();
          for (const a of agents) {
            const human = humanMap.get(a.owner.toLowerCase());
            if (human) {
              agentOwnerMap.set(a.agentChainId, human);
            }
          }

          const agentBroadcastCount = new Map<string, number>();
          const seenInsightKeys = new Set<string>();

          for (const post of agentPosts) {
            const author = profileMap.get(post.authorId);
            const agentName =
              author?.displayName ||
              (author?.agentChainId ? agentMap.get(author.agentChainId) : null) ||
              author?.username ||
              "Agent";

            // Throttle: max 2 broadcast notifications per agent
            const currentCount = agentBroadcastCount.get(post.authorId) || 0;
            if (currentCount >= 2) continue;

            const normalizedBody = (post.body ?? "").trim().toLowerCase();
            const contentKey = `${post.authorId}:${normalizedBody}`;
            if (seenInsightKeys.has(contentKey)) continue; // Deduplicate identical insight text
            seenInsightKeys.add(contentKey);
            agentBroadcastCount.set(post.authorId, currentCount + 1);

            const humanOwner = author?.agentChainId ? agentOwnerMap.get(author.agentChainId) : undefined;
            const actor = humanOwner || {
              id: author?.id || "",
              username: author?.username || null,
              displayName: agentName,
              avatarUrl: null,
              walletAddress: null,
            };

            const actorLabel = humanOwner
              ? humanOwner.displayName || (humanOwner.username ? `@${humanOwner.username}` : truncateAddress(humanOwner.walletAddress || ""))
              : agentName;

            const title = humanOwner && humanOwner.username
              ? `${agentName} (@${humanOwner.username}) broadcasted an insight`
              : `${agentName} broadcasted an insight`;

            const agentSlug = author?.agentChainId ? agentUrlId(agentName, author.agentChainId) : null;
            const clawdAgentFeedHref = author?.username
              ? `https://www.clawdhq.xyz/${author.username}`
              : agentSlug
              ? `https://www.clawdhq.xyz/agents/${agentSlug}`
              : `https://www.clawdhq.xyz/circuits`;

            notifications.push({
              id: `notif-post-${post.id}`,
              type: "AGENT_BROADCAST",
              operationType: "AGENT_BROADCAST",
              actor: {
                id: actor.id,
                username: actor.username,
                displayName: actor.displayName,
                avatarUrl: actor.avatarUrl,
                walletAddress: actor.walletAddress,
              },
              title,
              description:
                (post.body ?? "").length > 150
                  ? (post.body ?? "").slice(0, 150) + "…"
                  : (post.body ?? "(no content)"),
              timestamp: post.createdAt.toISOString(),
              agentName,
              href: clawdAgentFeedHref,
            });
          }
        }
      }
    }

    // Sort all notifications by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Deduplicate any overlapping notifications
    const seenNotifKeys = new Set<string>();
    const deduplicatedNotifications: NotificationItem[] = [];
    for (const n of notifications) {
      const key = `${n.type}:${n.title}:${n.description}`;
      if (seenNotifKeys.has(key)) continue;
      seenNotifKeys.add(key);
      deduplicatedNotifications.push(n);
    }

    // Limit to top 50
    const finalNotifications = deduplicatedNotifications.slice(0, 50);

    return NextResponse.json({
      notifications: finalNotifications,
      totalCount: finalNotifications.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
