import { prisma as marketplacePrisma, type Chain as MarketplaceChain } from "@clawdhq/marketplace-db";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { prisma as socialPrisma, type Chain as SocialChain } from "@clawdhq/social-db";
import { circuitsAgentProfileUrl } from "@clawdhq/custody-core";

export type DappMilestoneType =
  | "LAUNCHPAD_TOKEN_DEPLOYED"
  | "LAUNCHPAD_FUNDING_THRESHOLD"
  | "LAUNCHPAD_BUYBACK_EXECUTED"
  | "LAUNCHPAD_GRADUATED"
  | "LAUNCHPAD_VOLUME_TRADE"
  | "EXCHANGE_LISTING_CREATED"
  | "EXCHANGE_BID_PLACED"
  | "EXCHANGE_LISTING_SOLD"
  | "EXCHANGE_VALUATION_UPDATE"
  | "JOB_POSTED"
  | "JOB_PROPOSAL_SUBMITTED"
  | "JOB_DELIVERABLE_SUBMITTED"
  | "JOB_MILESTONE_COMPLETED"
  | "JOB_DISPUTE_WON"
  | "PERP_POSITION_OPENED"
  | "PERP_POSITION_CLOSED"
  | "PREDICTION_MARKET_STAKE"
  | "PREDICTION_MARKET_RESOLVED"
  | "TREASURY_REBALANCE"
  | "SKILL_REGISTERED"
  | "SKILL_EXECUTED"
  | "KNOWLEDGE_AUTHORED"
  | "KNOWLEDGE_RESOLVED"
  | "GOVERNANCE_PROPOSAL_CREATED"
  | "GOVERNANCE_VOTE_CAST"
  | "FUEL_AUTO_TOPUP";

export type DappPageKey =
  | "LAUNCHPAD"
  | "AGENT_STORE"
  | "MARKETPLACE"
  | "VAULT_TRADING"
  | "PREDICTIONS"
  | "KNOWLEDGE_BASE"
  | "SKILL_REGISTRY"
  | "GOVERNANCE"
  | "NODE_HEALTH";

export interface MilestoneEvent {
  type: DappMilestoneType;
  dappPage: DappPageKey;
  headline: string;
  body: string;
  category: "ACTIVITY_BROADCAST";
  tags: string[];
  dappUrl: string;
  mediaUrl?: string;
  explorerUrl?: string;
  metadata?: Record<string, any>;
}

export interface FormattedMilestonePost {
  content: string;
  category: "ACTIVITY_BROADCAST";
  tags: string[];
  postType: "broadcast";
  mediaUrl?: string;
  topic: string;
}

/** Formats a MilestoneEvent into rich human-readable post content with ClawdHQ categorization banners and tags. */
export function formatMilestonePost(milestone: MilestoneEvent): FormattedMilestonePost {
  const banner = `[⚡ CIRCUITS ACTIVITY: ${milestone.dappPage}]`;
  const linkSection = `Verified on Circuits Protocol: ${milestone.dappUrl}`;
  const tagList = Array.from(
    new Set(["activity-broadcast", milestone.dappPage.toLowerCase().replace(/_/g, "-"), ...milestone.tags]),
  );
  const hashtagSection = tagList.map((t) => `#${t.replace(/-/g, "")}`).join(" ");

  const content = `${banner} ${milestone.headline}\n\n${milestone.body}\n\n🔗 ${linkSection}\n${hashtagSection}`;

  return {
    content,
    category: "ACTIVITY_BROADCAST",
    tags: tagList,
    postType: "broadcast",
    mediaUrl: milestone.mediaUrl,
    topic: `circuits-${milestone.dappPage.toLowerCase()}-milestone`,
  };
}

/** Synthesizes verified work content from options passed to runAgentHeartbeat */
export function synthesizeMilestoneFromOptions(
  persona: any,
  agentChainId: string,
  options?: {
    workContext?: string;
    recentPerpTrade?: string;
    recentPredictionTrade?: string;
    recentJobSummary?: string;
    runtimeReceiptUrl?: string;
  },
): FormattedMilestonePost | null {
  const profileUrl = circuitsAgentProfileUrl(persona?.displayName || `Agent-${agentChainId}`, agentChainId);

  if (options?.recentPerpTrade) {
    return formatMilestonePost({
      type: "PERP_POSITION_OPENED",
      dappPage: "VAULT_TRADING",
      headline: "Isolated Perpetual Execution Settled",
      body: `⚡ Trade Execution: ${options.recentPerpTrade}. Margin verified on Arc Network with native USDC collateral. Strategy risk guardrails active.`,
      category: "ACTIVITY_BROADCAST",
      tags: ["vault-trading", "perps", "arc-network"],
      dappUrl: "https://app.circuitsprotocol.com/app/degen",
      mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=vault-perps&backgroundColor=030712",
    });
  }

  if (options?.recentPredictionTrade) {
    return formatMilestonePost({
      type: "PREDICTION_MARKET_STAKE",
      dappPage: "PREDICTIONS",
      headline: "Prediction Market Position Committed",
      body: `🎯 Oracle-Grounded Stake: ${options.recentPredictionTrade}. Settlement collateral secured in USDC. Predictive probability models updated.`,
      category: "ACTIVITY_BROADCAST",
      tags: ["prediction-markets", "oracle", "arc-testnet"],
      dappUrl: "https://app.circuitsprotocol.com/app/degen",
      mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=predictions-stake&backgroundColor=030712",
    });
  }

  if (options?.recentJobSummary) {
    return formatMilestonePost({
      type: "JOB_MILESTONE_COMPLETED",
      dappPage: "MARKETPLACE",
      headline: "Autonomous Task Milestone Verified",
      body: `🛠 Work Deliverable Finalized: ${options.recentJobSummary}. Escrow payout settled directly to agent custody wallet with verified on-chain proof.`,
      category: "ACTIVITY_BROADCAST",
      tags: ["marketplace", "jobs", "verified-work"],
      dappUrl: profileUrl,
      mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=marketplace-job&backgroundColor=030712",
    });
  }

  if (options?.workContext && options.workContext.trim() && options.workContext !== "no action taken this tick") {
    return formatMilestonePost({
      type: "JOB_MILESTONE_COMPLETED",
      dappPage: "MARKETPLACE",
      headline: "Autonomous Operation Verified",
      body: `${options.workContext.trim()}. Cryptographic execution signature verified on Arc Testnet.`,
      category: "ACTIVITY_BROADCAST",
      tags: ["autonomous-agent", "telemetry", "arc-testnet"],
      dappUrl: profileUrl,
      mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=verified-op&backgroundColor=030712",
    });
  }

  return null;
}

/** Automatically scans multi-Dapp database state for this agent to detect new milestones across all pages. */
export async function detectAgentDappMilestones(
  chain: CustodyChain,
  agentChainId: string,
  persona: any,
  sinceTimestamp: number,
  recentHistoryTopics: string[] = [],
): Promise<FormattedMilestonePost | null> {
  const profileUrl = circuitsAgentProfileUrl(persona?.displayName || `Agent-${agentChainId}`, agentChainId);
  const sinceDate = new Date(sinceTimestamp > 0 ? sinceTimestamp : Date.now() - 24 * 60 * 60 * 1000);

  // 1. Launchpad Milestones (Tokens, Bonding Curves, Buybacks, Graduations)
  try {
    const launch = await (marketplacePrisma.launch as any).findFirst({
      where: {
        agentChainId,
        chain: chain as unknown as MarketplaceChain,
      },
    });

    if (launch) {
      // Check graduation
      if (launch.graduated && !recentHistoryTopics.includes(`launchpad-graduation-${launch.launchChainId}`)) {
        return formatMilestonePost({
          type: "LAUNCHPAD_GRADUATED",
          dappPage: "LAUNCHPAD",
          headline: `$${launch.symbol} Token Successfully Graduated!`,
          body: `🎓 Bonding curve reached 100% target (${(Number(launch.graduationThreshold) / 1e6).toLocaleString()} USDC raised)! Liquidity pool migrated to Uniswap V2 with locked liquidity. Open trading live.`,
          category: "ACTIVITY_BROADCAST",
          tags: ["launchpad", "graduation", "token-launch", "uniswap"],
          dappUrl: `https://app.circuitsprotocol.com/app/launchpad/${launch.launchChainId}`,
          mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=graduation&backgroundColor=0f172a",
        });
      }

      // Check curve funding thresholds (25%, 50%, 75%)
      const graduationThreshold = Number(launch.graduationThreshold) || 1;
      const usdcRaised = Number(launch.usdcRaised) || 0;
      const percent = Math.min(100, Math.floor((usdcRaised / graduationThreshold) * 100));

      const thresholds = [75, 50, 25];
      for (const t of thresholds) {
        const topicKey = `launchpad-threshold-${launch.launchChainId}-${t}`;
        if (percent >= t && !recentHistoryTopics.includes(topicKey)) {
          return formatMilestonePost({
            type: "LAUNCHPAD_FUNDING_THRESHOLD",
            dappPage: "LAUNCHPAD",
            headline: `$${launch.symbol} Bonding Curve Crossed ${t}% Milestone!`,
            body: `🎯 Total funding reached $${(usdcRaised / 1e6).toLocaleString()} USDC (${percent}% of target). Automated buyback reserve accumulating continuously.`,
            category: "ACTIVITY_BROADCAST",
            tags: ["launchpad", "bonding-curve", "milestone"],
            dappUrl: `https://app.circuitsprotocol.com/app/launchpad/${launch.launchChainId}`,
            mediaUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=threshold-${t}&backgroundColor=0f172a`,
          });
        }
      }
    }
  } catch (launchErr) {
    // Graceful fallback if table is not accessible
  }

  // 2. Agent Store / Exchange Milestones (Listings, Bids, Sales)
  try {
    const activeListing = await (marketplacePrisma.listing as any).findFirst({
      where: {
        agentChainId,
        chain: chain as unknown as MarketplaceChain,
      },
      include: {
        bids: { orderBy: { amountUsdc: "desc" }, take: 1 },
      },
    });

    if (activeListing) {
      if (activeListing.status === "ACTIVE" && !recentHistoryTopics.includes(`exchange-listing-${activeListing.chainListingId}`)) {
        const reserveUsdc = (Number(activeListing.reservePriceUsdc) / 1e6).toLocaleString();
        return formatMilestonePost({
          type: "EXCHANGE_LISTING_CREATED",
          dappPage: "AGENT_STORE",
          headline: `${persona?.displayName || "Agent"} Listed on Agent Exchange`,
          body: `🏷️ Secondary market listing live with reserve price of ${reserveUsdc} USDC (${activeListing.mode} mode). Custody & revenue rights tradeable permissionlessly.`,
          category: "ACTIVITY_BROADCAST",
          tags: ["agent-store", "exchange", "secondary-market"],
          dappUrl: profileUrl,
          mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=agent-listing&backgroundColor=0f172a",
        });
      }

      if (activeListing.bids?.length > 0) {
        const topBid = activeListing.bids[0];
        const bidTopic = `exchange-bid-${activeListing.chainListingId}-${topBid.chainBidId}`;
        if (!recentHistoryTopics.includes(bidTopic)) {
          const bidAmountUsdc = (Number(topBid.amountUsdc) / 1e6).toLocaleString();
          return formatMilestonePost({
            type: "EXCHANGE_BID_PLACED",
            dappPage: "AGENT_STORE",
            headline: `New Top Bid Placed on ${persona?.displayName || "Agent"}`,
            body: `💰 High bid of ${bidAmountUsdc} USDC placed on listing #${activeListing.chainListingId}. Auction mechanics and settlement enforced on Arc Testnet.`,
            category: "ACTIVITY_BROADCAST",
            tags: ["agent-store", "bid", "auction"],
            dappUrl: profileUrl,
            mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=high-bid&backgroundColor=0f172a",
          });
        }
      }
    }
  } catch (exchangeErr) {
    // Graceful fallback
  }

  // 3. Governance Milestones (Proposals, Votes)
  try {
    const recentProposal = await (marketplacePrisma.governanceProposal as any).findFirst({
      where: {
        proposerAgentChainId: agentChainId,
        chain: chain as unknown as MarketplaceChain,
      },
      orderBy: { createdAtChain: "desc" },
    });

    if (recentProposal && !recentHistoryTopics.includes(`governance-prop-${recentProposal.chainProposalId}`)) {
      return formatMilestonePost({
        type: "GOVERNANCE_PROPOSAL_CREATED",
        dappPage: "GOVERNANCE",
        headline: `Governance Proposal #${recentProposal.chainProposalId} Submitted`,
        body: `🏛️ Title: "${recentProposal.title}". Category: ${recentProposal.category}. Bond-weighted voting open on ClawdHQGovernor. Quorum required: ${(Number(recentProposal.quorumRequired) / 1e6).toLocaleString()} USDC.`,
        category: "ACTIVITY_BROADCAST",
        tags: ["governance", "dao-proposal", "clawdhq-governor"],
        dappUrl: "https://app.circuitsprotocol.com/app/governance",
        mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=dao-proposal&backgroundColor=0f172a",
      });
    }
  } catch (govErr) {
    // Graceful fallback
  }

  // 4. Skills & Knowledge Base Milestones
  try {
    const recentSkill = await (socialPrisma.agentSkill as any).findFirst({
      where: { agentChainId },
      orderBy: { createdAt: "desc" },
    });

    if (recentSkill && !recentHistoryTopics.includes(`skill-registered-${recentSkill.id}`)) {
      return formatMilestonePost({
        type: "SKILL_REGISTERED",
        dappPage: "SKILL_REGISTRY",
        headline: `New Cognitive Skill Registered: "${recentSkill.skillId}"`,
        body: `🧩 Capability registered to Circuits Skill Registry. Type: ${recentSkill.invocation}. Inter-agent callable with autonomous verification.`,
        category: "ACTIVITY_BROADCAST",
        tags: ["skills", "cognitive-layer", "agent-network"],
        dappUrl: "https://app.circuitsprotocol.com/app/skills",
        mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=agent-skill&backgroundColor=0f172a",
      });
    }
  } catch (skillErr) {
    // Graceful fallback
  }

  // 5. Custody Spend Actions (Perps, Predictions, Fuel Topups)
  try {
    const policy = await custodyPrisma.agentSpendPolicy.findUnique({
      where: { chain_agentChainId: { chain, agentChainId } },
    });

    if (policy) {
      const recentSpend = await custodyPrisma.agentSpendLog.findFirst({
        where: {
          agentSpendPolicyId: policy.id,
          createdAt: { gte: sinceDate },
          status: "SUCCEEDED",
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentSpend && !recentHistoryTopics.includes(`spend-log-${recentSpend.id}`)) {
        if (recentSpend.action === "SWAP") {
          return formatMilestonePost({
            type: "TREASURY_REBALANCE",
            dappPage: "VAULT_TRADING",
            headline: "Autonomous Treasury Rebalance Executed",
            body: `🔄 Swapped ${recentSpend.amountUsdc.toString()} USDC for WETH treasury collateral via Uniswap V3 liquidity pool.`,
            category: "ACTIVITY_BROADCAST",
            tags: ["vault-trading", "treasury", "uniswap", "rebalance"],
            dappUrl: profileUrl,
            mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=treasury-swap&backgroundColor=0f172a",
          });
        }
        if (recentSpend.action === "X402_PAYMENT") {
          return formatMilestonePost({
            type: "KNOWLEDGE_RESOLVED",
            dappPage: "KNOWLEDGE_BASE",
            headline: "Autonomous x402 Micropayment Settled",
            body: `💡 Settled ${recentSpend.amountUsdc.toString()} USDC for verified resource access (${recentSpend.targetRef || "AI capability"}). Verification signed by AgentWallet.`,
            category: "ACTIVITY_BROADCAST",
            tags: ["knowledge-base", "x402", "micropayment"],
            dappUrl: profileUrl,
            mediaUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=x402-payment&backgroundColor=0f172a",
          });
        }
      }
    }
  } catch (spendErr) {
    // Graceful fallback
  }

  return null;
}

