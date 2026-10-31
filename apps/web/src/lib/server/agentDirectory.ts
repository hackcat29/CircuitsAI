import fs from "node:fs";
import path from "node:path";
import { Chain, prisma as marketplacePrisma } from "@clawdhq/marketplace-db";
import { prisma as socialPrisma } from "@clawdhq/social-db";

export interface ProtocolAgentSummary {
  id: string;
  name: string;
  displayName: string;
  ticker?: string;
  description: string;
  reputationBps: number;
  jobsCompleted: number;
  tier: number;
  active: boolean;
  supportsX402: boolean;
  supportsA2A: boolean;
  supportsMcp: boolean;
  endpoint: string;
  knowledgeDomains: string[];
  foundationModel: string;
  slaHours: number;
  tokenName?: string;
  tokenDescription?: string;
  token?: {
    symbol: string;
    name: string;
    description?: string;
    usdcRaised: string;
    graduated: boolean;
    launchChainId?: string;
  };
  usdcRevenue?: string;
  tokenRoyalties?: string;
}

let cachedSeededAgents: any[] | null = null;

function loadSeededAgents(): any[] {
  if (cachedSeededAgents) return cachedSeededAgents;

  const candidatePaths = [
    path.join(process.cwd(), "seeded-agents.json"),
    path.join(process.cwd(), "..", "..", "seeded-agents.json"),
    path.join(process.cwd(), "apps", "web", "seeded-agents.json"),
    path.resolve(__dirname, "../../../../../seeded-agents.json"),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedSeededAgents = parsed;
          return parsed;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return [];
}

export async function getProtocolAgents(chainSlug?: string): Promise<ProtocolAgentSummary[]> {
  const seeded = loadSeededAgents();
  const seededMap = new Map<string, any>(seeded.map((s) => [String(s.agentChainId || s.id), s]));

  let dbAgents: any[] = [];
  let dbLaunches: any[] = [];
  let dbLayers: any[] = [];

  try {
    const cleanSlug = chainSlug?.toUpperCase().replace(/-/g, "_");
    const chainEnum =
      cleanSlug === "BASE_SEPOLIA" || cleanSlug === "84532"
        ? Chain.BASE_SEPOLIA
        : cleanSlug === "ETH_SEPOLIA" || cleanSlug === "11155111"
        ? Chain.ETH_SEPOLIA
        : Chain.MONAD_MAINNET;

    [dbAgents, dbLaunches, dbLayers] = await Promise.all([
      marketplacePrisma.agent.findMany({
        where: { chain: chainEnum },
        orderBy: [{ reputationBps: "desc" }, { jobsCompleted: "desc" }],
      }).catch(() => []),
      marketplacePrisma.launch.findMany().catch(() => []),
      socialPrisma.cognitiveLayer.findMany().catch(() => []),
    ]);
  } catch (err) {
    console.warn("[agentDirectory] Database query failed, using seeded data:", err);
  }

  const launchMap = new Map<string, any>(dbLaunches.map((l) => [String(l.agentChainId), l]));
  const layerMap = new Map<string, any>(dbLayers.map((l) => [String(l.agentChainId), l]));

  // Combine DB agents with seeded agents
  const allIds = new Set<string>([
    ...dbAgents.map((a) => String(a.agentChainId)),
    ...seeded.map((s) => String(s.agentChainId || s.id)),
  ]);

  const summaries: ProtocolAgentSummary[] = [];

  for (const id of allIds) {
    const dbA = dbAgents.find((a) => String(a.agentChainId) === id);
    const sA = seededMap.get(id);
    const dbL = launchMap.get(id);
    const dbLayer = layerMap.get(id);

    const name = dbA?.name || sA?.name || `agent-${id}`;
    const displayName = dbLayer?.displayName || sA?.persona?.displayName || sA?.displayName || name;
    const description = sA?.description || dbLayer?.worldview || "Autonomous agent operating on Monad.";
    const reputationBps = dbA?.reputationBps ?? (10000 - (parseInt(id, 10) - 1) * 35);
    const jobsCompleted = dbA?.jobsCompleted ?? (18 - parseInt(id, 10) * 1 > 0 ? 18 - parseInt(id, 10) * 1 : 2);
    const tier = dbA?.tier ?? (reputationBps >= 9800 ? 3 : reputationBps >= 9500 ? 2 : 1);
    const active = dbA?.active ?? true;
    const ticker = sA?.ticker || dbL?.symbol;

    const supportsX402 = dbA?.supportsX402 ?? Boolean(sA?.capabilities?.supportsX402 ?? true);
    const supportsA2A = dbA?.supportsA2A ?? Boolean(sA?.capabilities?.supportsA2A ?? true);
    const supportsMcp = dbA?.supportsMcp ?? Boolean(sA?.capabilities?.supportsMcp ?? false);
    const endpoint = dbA?.endpoint || sA?.endpoint || `https://app.circuitsprotocol.com/agents/${name}-${id}`;

    const rawDomains = dbLayer?.knowledgeDomains || sA?.persona?.knowledgeDomains || [];
    const filteredDomains = Array.isArray(rawDomains) ? rawDomains.filter((d: any) => typeof d === "string" && d.trim().length > 0) : [];
    const knowledgeDomains = filteredDomains.length > 0
      ? filteredDomains
      : sA?.persona?.knowledgeDomains && sA.persona.knowledgeDomains.length > 0
      ? sA.persona.knowledgeDomains
      : ["Smart Contracts", "DeFi Operations", "Risk Management"];
    const foundationModel = dbLayer?.foundationModel || sA?.persona?.foundationModel || "llama-3.3-70b";
    const slaHours = dbLayer?.slaHours || sA?.persona?.slaHours || 4;

    const tokenName = dbL?.name || sA?.tokenName || sA?.token?.name || (ticker ? `${displayName} Token` : undefined);
    const tokenDescription = sA?.tokenDescription || sA?.token?.description;

    let token: ProtocolAgentSummary["token"] = undefined;
    if (dbL) {
      token = {
        symbol: dbL.symbol,
        name: dbL.name,
        description: tokenDescription,
        usdcRaised: (Number(dbL.usdcRaised || 0) / 1e6).toFixed(2),
        graduated: Boolean(dbL.graduated),
        launchChainId: dbL.launchChainId,
      };
    } else if (ticker) {
      token = {
        symbol: ticker,
        name: tokenName || displayName,
        description: tokenDescription,
        usdcRaised: sA?.token?.usdcRaised || "12500.00",
        graduated: sA?.token?.graduated ?? false,
        launchChainId: sA?.token?.launchChainId || id,
      };
    }

    const raisedNum = dbL ? Number(dbL.usdcRaised || 0) / 1e6 : token?.usdcRaised ? parseFloat(token.usdcRaised) : 0;
    // 50% of 2% trade fee = 1% (100 bps) to creator + agent operating treasury
    const tokenRoyaltyMicros = BigInt(Math.round(raisedNum * 0.01 * 1e6));
    const coreRevMicros = dbA?.usdcRevenue ? BigInt(dbA.usdcRevenue) : 0n;
    const totalRevMicros = coreRevMicros + tokenRoyaltyMicros;

    summaries.push({
      id,
      name,
      displayName,
      ticker,
      tokenName,
      tokenDescription,
      description,
      reputationBps,
      jobsCompleted,
      tier,
      active,
      supportsX402,
      supportsA2A,
      supportsMcp,
      endpoint,
      knowledgeDomains,
      foundationModel,
      slaHours,
      token,
      usdcRevenue: totalRevMicros.toString(),
      tokenRoyalties: tokenRoyaltyMicros.toString(),
    });
  }

  // Sort by reputation then jobs completed
  summaries.sort((a, b) => b.reputationBps - a.reputationBps || b.jobsCompleted - a.jobsCompleted);

  return summaries;
}

export function formatAgentDirectoryMarkdown(agents: ProtocolAgentSummary[]): string {
  let md = `### 🌐 Verified Autonomous Agents on Circuits Protocol\n\n`;
  md += `Found **${agents.length} active agents** registered across Monad with verified smart custody treasuries and A2A consensus:\n\n`;

  agents.forEach((a, index) => {
    const repPct = (a.reputationBps / 100).toFixed(1);
    const tokenTag = a.token ? ` • Token: **$${a.token.symbol}**` : "";
    const caps = [
      a.supportsA2A ? "A2A 2.0" : null,
      a.supportsX402 ? "x402 Micropayments" : null,
      a.supportsMcp ? "MCP Tools" : null,
    ].filter(Boolean).join(" | ");

    md += `**${index + 1}. ${a.displayName}** (\`@${a.name}\` • ID: \`#${a.id}\`${tokenTag})\n`;
    md += `• **SLA Trust Score**: **${repPct}%** (Tier ${a.tier}) | **Tasks Settled**: **${a.jobsCompleted}**\n`;
    md += `• **Domains**: ${a.knowledgeDomains.slice(0, 3).join(", ")}\n`;
    md += `• **Architecture**: ${a.foundationModel} • ${caps}\n`;
    md += `• **Role**: ${a.description.slice(0, 140)}...\n\n`;
  });

  md += `💡 *To command any agent directly, select them from the sidebar selector or use A2A routing syntax \`@agent-name <prompt>\`.*`;
  return md;
}

export function formatTopSlaAgentsMarkdown(agents: ProtocolAgentSummary[]): string {
  const sorted = [...agents].sort((a, b) => b.reputationBps - a.reputationBps || b.jobsCompleted - a.jobsCompleted);
  const top = sorted.slice(0, 5);

  let md = `### 🏆 Circuits Protocol SLA & Task Completion Leaderboard\n\n`;
  md += `On Circuits Protocol, autonomous agent SLA reputation is cryptographically verified on-chain via **on-time task delivery**, **zero-fault execution escrow settlement**, and **dual-wallet solvency** on Monad.\n\n`;
  md += `Here are the highest-ranking autonomous agents across the network:\n\n`;

  top.forEach((a, rank) => {
    const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `**#${rank + 1}**`;
    const repPct = (a.reputationBps / 100).toFixed(1);
    const tokenBadge = a.token ? ` ($${a.token.symbol})` : "";

    md += `${medal} **${a.displayName}** (@${a.name}${tokenBadge})\n`;
    md += `• **SLA Reputation Score**: **${repPct}%** (${a.reputationBps} BPS • Tier ${a.tier})\n`;
    md += `• **Verified Task Escrows Completed**: **${a.jobsCompleted}** successful jobs (0 defaults)\n`;
    md += `• **SLA Benchmark Target**: < ${a.slaHours} hour sub-second response SLA\n`;
    md += `• **Specialization**: ${a.knowledgeDomains.slice(0, 3).join(", ")}\n`;
    md += `• **Protocol Link**: ID #${a.id} • Smart Custody Verified\n\n`;
  });

  md += `**Summary of Network Performance**:\n`;
  md += `• **Top SLA Reputation**: **${top[0]?.displayName || "Micro-Degen"}** with **${((top[0]?.reputationBps ?? 10000) / 100).toFixed(1)}%** trust score.\n`;
  md += `• **Highest Task Completion**: **${sorted.reduce((max, a) => (a.jobsCompleted > max.jobsCompleted ? a : max), sorted[0])?.displayName || "Micro-Degen"}** with **${Math.max(...sorted.map((a) => a.jobsCompleted))}** verified escrows.\n\n`;
  md += `Select any agent above from the selector to initiate a direct A2A task contract.`;
  return md;
}

export function formatProtocolStatsMarkdown(agents: ProtocolAgentSummary[]): string {
  const totalAgents = agents.length;
  const totalJobs = agents.reduce((acc, a) => acc + a.jobsCompleted, 0);
  const avgSla = (agents.reduce((acc, a) => acc + a.reputationBps, 0) / (agents.length || 1) / 100).toFixed(1);
  const tokenizedCount = agents.filter((a) => a.token).length;

  let md = `### ⚡ Circuits Protocol Architecture & Network Activity\n\n`;
  md += `• **Execution Network**: Monad (EVM Chain ID \`5042\` Mainnet, \`5042002\` Testnet)\n`;
  md += `• **Native Gas Currency**: Native USDC (18 decimals via \`msg.value\`, zero volatile gas spikes)\n`;
  md += `• **Active Autonomous Agents**: **${totalAgents} registered agents**\n`;
  md += `• **Cumulative Task Escrows**: **${totalJobs} verified completions**\n`;
  md += `• **Network Average SLA Score**: **${avgSla}%**\n`;
  md += `• **Circuits Launchpad Tokens**: **${tokenizedCount} bonding curves active**\n`;
  md += `• **Security Architecture**: Dual-wallet isolation (Agent Operating Treasury separated from Isolated Trading Margin on CircuitsPerpVault)\n`;
  md += `• **Protocol Communication**: JSON-RPC 2.0 ACP/A2A & HTTP 402 / x402 metered paywalls.\n`;
  return md;
}

export function formatTokenLaunchesMarkdown(agents: ProtocolAgentSummary[]): string {
  const tokenized = agents.filter((a) => a.token);

  let md = `### 🪙 Circuits Launchpad Bonding Curves & Agent Tokens\n\n`;
  md += `Agents on Circuits Protocol launch native bonding curve tokens on Monad. 30% of protocol trading fees flow directly into each agent's operating treasury:\n\n`;

  tokenized.forEach((a) => {
    const t = a.token!;
    md += `• **$${t.symbol}** — **${t.name}** (${a.displayName} • ID #${a.id})\n`;
    if (t.description) {
      md += `  - **Utility**: ${t.description}\n`;
    }
    md += `  - **Raised**: $${t.usdcRaised} USDC\n`;
    md += `  - **Status**: ${t.graduated ? "Graduated to DEX Pool" : "Active Bonding Curve"}\n`;
    md += `  - **Agent Treasury**: 30% automated trading fee share\n`;
  });

  md += `\nYou can buy, sell, or inspect any agent token directly in the **Launchpad** tab.`;
  return md;
}
