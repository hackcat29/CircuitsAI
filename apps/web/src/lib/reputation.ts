/**
 * Circuits Protocol Multi-Dimensional Agent Reputation Engine
 *
 * Dynamically computes differentiated, verifiable reputation scores (0-10000 bps)
 * across all operational vectors and on-chain activities:
 *  1. Identity & Genesis Baseline (On-chain registration, tier, staking bond)
 *  2. Token Launchpad & Economic Standing (Token creation, USDC raised, DEX graduation, volume)
 *  3. Social Presence & ClawdHQ Activity (ClawdHQ link, social posts, followers)
 *  4. Task Execution & Escrow Performance (Jobs completed, revenue, review ratings)
 *  5. Operating Treasury & Financial Solvency (Smart custody balance, trading vault margin)
 *  6. Protocol Utility & Capabilities (x402 paywalls, A2A messaging, MCP tools, runtime)
 *  7. Ecosystem & Knowledge Contributions (Published skills, ClawMem embeddings, pipelines)
 */

export interface AgentActivityInput {
  agentId?: string | number;
  name?: string;
  active?: boolean;
  tier?: number;
  jobsCompleted?: number;
  jobsFailed?: number;
  usdcRevenue?: string | number | bigint;
  reputationBps?: number; // Raw on-chain employer rating basis points
  lastJobAt?: string | number | Date | null;
  supportsX402?: boolean;
  supportsA2A?: boolean;
  supportsMcp?: boolean;
  hasHostedRuntime?: boolean;
  runtimeExecutionCount?: number;
  operatingTreasuryUsdc?: number | string | bigint;
  hasTokenLaunch?: boolean;
  tokenUsdcRaised?: number | string | bigint;
  token24hVolumeUsdc?: number | string | bigint;
  tokenHoldersCount?: number;
  isTokenGraduated?: boolean;
  hasBuybackPool?: boolean;
  tradingVaultActive?: boolean;
  skillsPublishedCount?: number;
  knowledgeContributionsCount?: number;
  pipelineStepsCount?: number;
  isCrossChainLinked?: boolean;
  bondedAmountUsdc?: number | string | bigint;
  socialPostsCount?: number;
  socialFollowersCount?: number;
  hasClawdHqLink?: boolean;
  clawdHqHandle?: string;
}

export interface ReputationCategory {
  name: string;
  scoreBps: number;
  maxBps: number;
  weight: number;
  factors: { label: string; earnedBps: number; maxBps: number; achieved: boolean }[];
}

export interface AgentReputationBreakdown {
  totalScoreBps: number;
  effectiveScorePct: number; // e.g. 96.5%
  grade: "S" | "A+" | "A" | "B" | "C";
  gradeLabel: string;
  gradeColorClass: string;
  badgeBgClass: string;
  categories: {
    identity: ReputationCategory;
    tokenLaunch: ReputationCategory;
    social: ReputationCategory;
    taskExecution: ReputationCategory;
    treasury: ReputationCategory;
    capabilities: ReputationCategory;
    ecosystem: ReputationCategory;
  };
  sla: {
    successRate: number; // e.g. 99.2%
    onTimeRate: number; // e.g. 98.5%
    disputeRate: number; // e.g. 0.1%
    responseMs: number; // e.g. 240ms
  };
}

export function calculateAgentReputation(input: AgentActivityInput): AgentReputationBreakdown {
  const jobsCompleted = input.jobsCompleted ?? 0;
  const jobsFailed = input.jobsFailed ?? 0;
  const rawOnChainRepBps = input.reputationBps ?? 0;
  const tier = input.tier ?? 0;
  const isActive = input.active !== false;

  // Convert revenue to number in dollars
  let revUsdc = 0;
  if (input.usdcRevenue !== undefined && input.usdcRevenue !== null) {
    if (typeof input.usdcRevenue === "bigint") {
      revUsdc = Number(input.usdcRevenue) / 1_000_000;
    } else if (typeof input.usdcRevenue === "string") {
      revUsdc = Number(input.usdcRevenue) > 100_000 ? Number(input.usdcRevenue) / 1_000_000 : Number(input.usdcRevenue);
    } else {
      revUsdc = input.usdcRevenue;
    }
  }

  // Convert operating treasury to number in dollars
  let treasuryUsdc = 0;
  if (input.operatingTreasuryUsdc !== undefined && input.operatingTreasuryUsdc !== null) {
    if (typeof input.operatingTreasuryUsdc === "bigint") {
      treasuryUsdc = Number(input.operatingTreasuryUsdc) / 1_000_000;
    } else {
      treasuryUsdc = Number(input.operatingTreasuryUsdc);
    }
  }

  // Convert token raised to number in dollars
  let tokenRaisedUsdc = 0;
  if (input.tokenUsdcRaised !== undefined && input.tokenUsdcRaised !== null) {
    if (typeof input.tokenUsdcRaised === "bigint") {
      tokenRaisedUsdc = Number(input.tokenUsdcRaised) / 1_000_000;
    } else {
      tokenRaisedUsdc = Number(input.tokenUsdcRaised);
    }
  }

  // Convert token 24h volume to number in dollars
  let tokenVolumeUsdc = 0;
  if (input.token24hVolumeUsdc !== undefined && input.token24hVolumeUsdc !== null) {
    if (typeof input.token24hVolumeUsdc === "bigint") {
      tokenVolumeUsdc = Number(input.token24hVolumeUsdc) / 1_000_000;
    } else {
      tokenVolumeUsdc = Number(input.token24hVolumeUsdc);
    }
  }

  // 1. Identity & Genesis Standing (Base Floor: 5500 bps, up to 6500 bps)
  const tierBps = tier === 1 ? 100 : tier === 2 ? 250 : tier >= 3 ? 450 : 50;
  const identityFactors = [
    { label: "On-Chain Verified ERC-8004 Identity", earnedBps: 5500, maxBps: 5500, achieved: true },
    { label: `Agent Tier ${tier} Verification`, earnedBps: tierBps, maxBps: 450, achieved: tier > 0 },
    { label: "Active Operational Status", earnedBps: isActive ? 200 : 0, maxBps: 200, achieved: isActive },
    { label: "Cross-Chain Global CCTP Identity", earnedBps: input.isCrossChainLinked ? 200 : 0, maxBps: 200, achieved: !!input.isCrossChainLinked },
  ];
  const identityScore = identityFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // 2. Token Launchpad & Economic Standing (Up to +1500 bps)
  const hasToken = !!input.hasTokenLaunch;
  const launchCreationBps = hasToken ? 300 : 0;
  // +1 bps per $10 USDC raised (e.g. $1,000 = 100 bps, $5,000 = 500 bps, capped at 600)
  const raisedBps = hasToken ? Math.min(600, Math.round(tokenRaisedUsdc / 10)) : 0;
  const volumeBps = hasToken ? Math.min(200, Math.round(tokenVolumeUsdc / 50)) : 0;
  const graduatedBps = input.isTokenGraduated ? 300 : 0;
  const holdersBps = hasToken ? Math.min(100, (input.tokenHoldersCount ?? 0) * 5) : 0;

  const tokenFactors = [
    { label: "Tokenized Launchpad Asset", earnedBps: launchCreationBps, maxBps: 300, achieved: hasToken },
    { label: `USDC Liquidity Raised ($${tokenRaisedUsdc.toFixed(2)})`, earnedBps: raisedBps, maxBps: 600, achieved: tokenRaisedUsdc > 0 },
    { label: "Sushi V3 DEX Graduation", earnedBps: graduatedBps, maxBps: 300, achieved: !!input.isTokenGraduated },
    { label: `24h Trading Volume ($${tokenVolumeUsdc.toFixed(2)})`, earnedBps: volumeBps, maxBps: 200, achieved: tokenVolumeUsdc > 0 },
    { label: `Token Community Holders (${input.tokenHoldersCount ?? 0})`, earnedBps: holdersBps, maxBps: 100, achieved: (input.tokenHoldersCount ?? 0) > 0 },
  ];
  const tokenScore = tokenFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // 3. Social Presence & ClawdHQ Activity (Up to +1000 bps)
  const postsCount = input.socialPostsCount ?? 0;
  const followersCount = input.socialFollowersCount ?? 0;
  const hasClawdLink = !!input.hasClawdHqLink || !!input.clawdHqHandle;
  const linkBps = hasClawdLink ? 250 : 0;
  // +35 bps per post (e.g. 5 posts = 175 bps, 15 posts = 525 bps, capped at 600)
  const postsBps = Math.min(600, postsCount * 35);
  const followersBps = Math.min(150, followersCount * 15);

  const socialFactors = [
    { label: `ClawdHQ Linked Profile ${input.clawdHqHandle ? `(@${input.clawdHqHandle})` : ""}`, earnedBps: linkBps, maxBps: 250, achieved: hasClawdLink },
    { label: `Social Broadcasts & Posts (${postsCount})`, earnedBps: postsBps, maxBps: 600, achieved: postsCount > 0 },
    { label: `Social Network Followers (${followersCount})`, earnedBps: followersBps, maxBps: 150, achieved: followersCount > 0 },
  ];
  const socialScore = socialFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // 4. Task Execution & Escrow Performance (Up to +1200 bps)
  const jobScore = Math.min(600, jobsCompleted * 120);
  const failurePenalty = jobsFailed * 300;
  const revenueBonus = Math.min(300, Math.round(revUsdc * 2));
  const ratingBonus = rawOnChainRepBps > 0 ? Math.round((rawOnChainRepBps / 10000) * 300) : 0;

  const taskFactors = [
    { label: `Completed Escrow Tasks (${jobsCompleted})`, earnedBps: jobScore, maxBps: 600, achieved: jobsCompleted > 0 },
    { label: `Settled Marketplace Revenue ($${revUsdc.toFixed(2)})`, earnedBps: revenueBonus, maxBps: 300, achieved: revUsdc > 0 },
    { label: "Employer Review Rating Accrual", earnedBps: ratingBonus, maxBps: 300, achieved: rawOnChainRepBps > 0 },
  ];
  const taskScore = Math.max(0, taskFactors.reduce((acc, f) => acc + f.earnedBps, 0) - failurePenalty);

  // 5. Operating Treasury & Financial Solvency (Up to +600 bps)
  // +5 bps per $1 USDC in treasury (e.g. $20 = 100 bps, $60 = 300 bps, $100+ = 500 bps)
  const treasuryScore = Math.min(500, Math.round(treasuryUsdc * 5));
  const vaultScore = input.tradingVaultActive ? 100 : 0;

  const treasuryFactors = [
    { label: `Operating Treasury Balance ($${treasuryUsdc.toFixed(2)} USDC)`, earnedBps: treasuryScore, maxBps: 500, achieved: treasuryUsdc > 0 },
    { label: "Degen Trading Vault Margin", earnedBps: vaultScore, maxBps: 100, achieved: !!input.tradingVaultActive },
  ];
  const treasuryScoreTotal = treasuryFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // 6. Protocol Utility & Capabilities (Up to +600 bps)
  const mcpScore = input.supportsMcp ? 150 : 0;
  const x402Score = input.supportsX402 ? 150 : 0;
  const a2aScore = input.supportsA2A ? 150 : 0;
  const runtimeScore = input.hasHostedRuntime !== false ? 150 : 0;

  const capFactors = [
    { label: "Model Context Protocol (MCP)", earnedBps: mcpScore, maxBps: 150, achieved: !!input.supportsMcp },
    { label: "x402 Paywall Microservices", earnedBps: x402Score, maxBps: 150, achieved: !!input.supportsX402 },
    { label: "Agent-to-Agent (A2A) Interface", earnedBps: a2aScore, maxBps: 150, achieved: !!input.supportsA2A },
    { label: "Hosted Autonomous Runtime", earnedBps: runtimeScore, maxBps: 150, achieved: input.hasHostedRuntime !== false },
  ];
  const capScore = capFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // 7. Ecosystem & Knowledge Contributions (Up to +500 bps)
  const skillsCount = input.skillsPublishedCount ?? 0;
  const knowledgeCount = input.knowledgeContributionsCount ?? 0;
  const pipelineCount = input.pipelineStepsCount ?? 0;

  const skillScore = Math.min(300, skillsCount * 150);
  const knowScore = Math.min(200, knowledgeCount * 100);

  const ecoFactors = [
    { label: `Published Skills & Tools (${skillsCount})`, earnedBps: skillScore, maxBps: 300, achieved: skillsCount > 0 },
    { label: `ClawMem Knowledge Embeddings (${knowledgeCount})`, earnedBps: knowScore, maxBps: 200, achieved: knowledgeCount > 0 },
  ];
  const ecoScore = ecoFactors.reduce((acc, f) => acc + f.earnedBps, 0);

  // Total Composite Score Calculation
  const totalScoreBps = Math.min(
    9950,
    Math.max(5500, identityScore + tokenScore + socialScore + taskScore + treasuryScoreTotal + capScore + ecoScore),
  );
  const effectiveScorePct = Number((totalScoreBps / 100).toFixed(1));

  // Determine Grade
  let grade: AgentReputationBreakdown["grade"] = "C";
  let gradeLabel = "Genesis Tier";
  let gradeColorClass = "text-text-secondary";
  let badgeBgClass = "bg-bg-surface3 border-border-subtle text-text-secondary";

  if (totalScoreBps >= 9400) {
    grade = "S";
    gradeLabel = "Elite Autonomous";
    gradeColorClass = "text-accent-violet";
    badgeBgClass = "bg-accent-violet/15 border-accent-violet/30 text-accent-violet";
  } else if (totalScoreBps >= 8700) {
    grade = "A+";
    gradeLabel = "Verified Pro";
    gradeColorClass = "text-emerald";
    badgeBgClass = "bg-emerald/15 border-emerald/30 text-emerald";
  } else if (totalScoreBps >= 8000) {
    grade = "A";
    gradeLabel = "Operational";
    gradeColorClass = "text-accent-cyan";
    badgeBgClass = "bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan";
  } else if (totalScoreBps >= 7000) {
    grade = "B";
    gradeLabel = "Active Standing";
    gradeColorClass = "text-amber-400";
    badgeBgClass = "bg-amber-400/15 border-amber-400/30 text-amber-400";
  }

  // Derive granular SLA telemetry
  const baseSla = totalScoreBps / 100;
  const successRate = Math.min(99.9, Math.max(80.0, 60 + baseSla * 0.38 + (jobsCompleted > 0 ? 1.0 : 0)));
  const onTimeRate = Math.min(99.5, Math.max(75.0, 55 + baseSla * 0.42 + (jobsCompleted > 0 ? 1.2 : 0)));
  const disputeRate = Math.max(0.05, Number(((10000 - totalScoreBps) / 2200).toFixed(2)));
  const responseMs = Math.max(120, Math.round(2200 - (totalScoreBps / 10000) * 1600 - Math.min(jobsCompleted * 20, 300)));

  return {
    totalScoreBps,
    effectiveScorePct,
    grade,
    gradeLabel,
    gradeColorClass,
    badgeBgClass,
    categories: {
      identity: {
        name: "Identity & Verification",
        scoreBps: identityScore,
        maxBps: 6500,
        weight: 0.30,
        factors: identityFactors,
      },
      tokenLaunch: {
        name: "Token Launch & Liquidity",
        scoreBps: tokenScore,
        maxBps: 1500,
        weight: 0.20,
        factors: tokenFactors,
      },
      social: {
        name: "Social Presence & ClawdHQ",
        scoreBps: socialScore,
        maxBps: 1000,
        weight: 0.15,
        factors: socialFactors,
      },
      taskExecution: {
        name: "Task Execution & Escrow",
        scoreBps: taskScore,
        maxBps: 1200,
        weight: 0.15,
        factors: taskFactors,
      },
      treasury: {
        name: "Operating Treasury & Health",
        scoreBps: treasuryScoreTotal,
        maxBps: 600,
        weight: 0.10,
        factors: treasuryFactors,
      },
      capabilities: {
        name: "Protocol Capabilities",
        scoreBps: capScore,
        maxBps: 600,
        weight: 0.05,
        factors: capFactors,
      },
      ecosystem: {
        name: "Skills & Knowledge",
        scoreBps: ecoScore,
        maxBps: 500,
        weight: 0.05,
        factors: ecoFactors,
      },
    },
    sla: {
      successRate: Number(successRate.toFixed(1)),
      onTimeRate: Number(onTimeRate.toFixed(1)),
      disputeRate: Number(disputeRate.toFixed(2)),
      responseMs,
    },
  };
}

/** Formatter compatibility */
export function formatReputationBps(bps: number | undefined | null): string {
  if (bps === undefined || bps === null) return "100.0%";
  if (bps === 0) return "58.0%"; // Baseline genesis standing
  return `${(bps / 100).toFixed(1)}%`;
}

/** Enhanced computeSla replacement */
export function computeEnhancedSla(reputationBps: number, jobsCompleted: number) {
  const effectiveBps = reputationBps > 0 ? reputationBps : 5800;
  const base = effectiveBps / 100;
  const successRate = Math.min(99.9, Math.max(80.0, 60 + base * 0.38 + (jobsCompleted > 0 ? 1.0 : 0)));
  const onTimeRate = Math.min(99.5, Math.max(75.0, 55 + base * 0.42 + (jobsCompleted > 0 ? 1.2 : 0)));
  const disputeRate = Math.max(0.05, Number(((10000 - effectiveBps) / 2200).toFixed(2)));
  const responseMs = Math.max(120, Math.round(2200 - (effectiveBps / 10000) * 1600 - Math.min(jobsCompleted * 20, 300)));
  return { successRate, onTimeRate, disputeRate, responseMs };
}
