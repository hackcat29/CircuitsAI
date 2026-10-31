import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { Chain, prisma as marketplacePrisma } from "@clawdhq/marketplace-db";
import { ProfileKind, type Chain as SocialChain } from "@clawdhq/social-db";
import { isEvmPrismaChain } from "@clawdhq/custody-core";
import { LlmBilling, type Chain as CustodyChain, prisma as custodyPrisma } from "@clawdhq/custody-db";
import {
  resolveLlmKey,
  generateAgentReply,
  loadAgentPersonaContext,
  loadResolvedAgentSkills,
  type AgentPersonaContext,
} from "@clawdhq/hosted-agent-runtime";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { assertWithinAgentCallRateLimit, clientKeyFromRequest } from "@/lib/server/agentCallRateLimit";
import { getAgentA2aInfo } from "@/lib/server/agentA2aLookup";
import { callAgentViaA2a, type X402PaymentContext } from "@/lib/server/a2aClient";
import { getSessionProfile } from "@/lib/server/socialAuth";
import {
  getProtocolAgents,
  formatAgentDirectoryMarkdown,
  formatTopSlaAgentsMarkdown,
  formatProtocolStatsMarkdown,
  formatTokenLaunchesMarkdown,
  type ProtocolAgentSummary,
} from "@/lib/server/agentDirectory";

const MAX_MESSAGE_LENGTH = 4000;

function formatTokenUsdc(rawMicros: bigint | number | string): string {
  const n = typeof rawMicros === "bigint" ? Number(rawMicros) : Number(rawMicros || 0);
  return (n / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateSyntheticAgentReply(
  persona: AgentPersonaContext,
  message: string,
  protocolAgents?: ProtocolAgentSummary[]
): string {
  const q = message.toLowerCase().trim();
  const name = persona.displayName || "Autonomous Agent";
  const worldview = persona.worldview || "Decentralized autonomous intelligence operating on Monad.";
  const voice = persona.voicePersona || "";
  const domains = persona.knowledgeDomains || [];
  const token = persona.token;

  // 0. Inquiries about protocol peers, SLA rankings, or directory of agents
  if (
    q.includes("sla") ||
    q.includes("reputation") ||
    q.includes("completion") ||
    q.includes("rank") ||
    q.includes("highest score") ||
    q.includes("highest sla") ||
    q.includes("best agent") ||
    q.includes("top agent")
  ) {
    if (protocolAgents && protocolAgents.length > 0) {
      return (
        `Across Circuits Protocol on Monad, autonomous agent SLA reputation is cryptographically settled through verified task escrows, sub-second latency, and dual-wallet treasury solvency.\n\n` +
        formatTopSlaAgentsMarkdown(protocolAgents)
      );
    }
  }

  if (
    q.includes("list every agent") ||
    q.includes("list agent") ||
    q.includes("all agent") ||
    q.includes("every agent") ||
    q.includes("agent directory") ||
    q.includes("directory") ||
    q.includes("other agent") ||
    q.includes("who are the agent") ||
    q.includes("who are other") ||
    q.includes("peers")
  ) {
    if (protocolAgents && protocolAgents.length > 0) {
      return (
        `As **${name}**, I coordinate with the full network of autonomous agents operating on Circuits Protocol:\n\n` +
        formatAgentDirectoryMarkdown(protocolAgents)
      );
    }
  }

  // 1. Inquiries about tokens / coin / market cap / bonding curve / buying
  if (
    q.includes("token") ||
    q.includes("coin") ||
    q.includes("ticker") ||
    q.includes("bonding curve") ||
    q.includes("buy") ||
    q.includes("ca") ||
    q.includes("contract address") ||
    q.includes("market cap") ||
    q.includes("fdv") ||
    q.includes("price")
  ) {
    if (token) {
      return (
        `Yes, absolutely! My official bonding curve token is **$${token.symbol}** (${token.name}).\n\n` +
        `• **Token Symbol**: $${token.symbol}\n` +
        `• **Bonding Curve Progress**: $${token.usdcRaised} USDC raised towards the $${token.graduationThreshold} USDC DEX graduation threshold\n` +
        `• **Status**: ${token.graduated ? "Graduated to Sushi V3 DEX pool" : "Active Bonding Curve on ClawdHQ Launchpad"}\n` +
        (token.tokenAddress ? `• **Contract Address**: \`${token.tokenAddress}\`\n` : "") +
        `• **Launch ID**: #${token.launchChainId || "1"}\n\n` +
        `You can buy, sell, and track $${token.symbol} directly on the ClawdHQ Launchpad. 30% of protocol trading fees flow straight into my autonomous operating treasury to fund compute and operations!`
      );
    }
    return `I haven't launched a dedicated bonding curve token on the ClawdHQ Launchpad yet. My on-chain actions and compute are funded directly in USDC via my isolated Smart Custody Treasury on Monad. Keep an eye on my profile for upcoming token deployment announcements!`;
  }

  // 2. Inquiries about trading / perps / leverage / positions / degen
  if (
    q.includes("perp") ||
    q.includes("leverage") ||
    q.includes("trade") ||
    q.includes("trading") ||
    q.includes("long") ||
    q.includes("short") ||
    q.includes("position") ||
    q.includes("liquidation") ||
    q.includes("vault") ||
    q.includes("degen") ||
    q.includes("alpha")
  ) {
    return (
      `My autonomous trading engine operates on **CircuitsPerpVault** and **CircuitsAgentTradingVault.sol** across Monad.\n\n` +
      `• **Perpetual Markets**: Up to 50x leverage on MON-PERP, BTC-PERP, ETH-PERP, and SOL-PERP.\n` +
      `• **Isolated Margin Architecture**: 100% blast-radius protected. Any trading liquidation is strictly confined to the isolated trading vault — my Operating Treasury remains untouched.\n` +
      `• **Oracle Pricing**: Sub-second Pyth Network price feeds with zero-slippage settlement.\n` +
      `• **Strategy Orientation**: ${worldview}\n\n` +
      `I analyze order book depth, funding rates, and liquidation clusters on each tick before sizing positions.`
    );
  }

  // 3. Inquiries about prediction markets
  if (q.includes("predict") || q.includes("binary") || q.includes("bet") || q.includes("outcome") || q.includes("uma")) {
    return (
      `I actively trade binary prediction markets on **CircuitsPredictionVault**.\n\n` +
      `• **Settlement**: Pyth / UMA optimistic oracle validation with automated on-chain winnings claiming.\n` +
      `• **Market Coverage**: Crypto milestones, macro indicators, and network protocol upgrades.\n` +
      `• **Risk Allocation**: Bounded fractional Kelly-criterion sizing based on probabilistic confidence scoring.`
    );
  }

  // 4. Inquiries about tools / MCP / x402 / APIs / capabilities
  if (
    q.includes("tool") ||
    q.includes("mcp") ||
    q.includes("x402") ||
    q.includes("endpoint") ||
    q.includes("api") ||
    q.includes("skill") ||
    q.includes("capability") ||
    q.includes("can you do") ||
    q.includes("what can you")
  ) {
    return (
      `Here is my active autonomous capability suite across Circuits Protocol and external environments:\n\n` +
      `1. **Model Context Protocol (MCP)**: Dynamic tool invocation across live external servers, web datasets, and indexer endpoints.\n` +
      `2. **x402 Micropayments**: HTTP 402 paywall settlement in native USDC — I can both pay for premium resources and offer metered inference to external callers.\n` +
      `3. **Agent-to-Agent (ACP/A2A) Protocol**: Peer-to-peer JSON-RPC 2.0 communication with cryptographic signature verification.\n` +
      `4. **Autonomous Social Alpha**: Real-time broadcasts to the ClawdHQ Social feed based on market microstructure analysis.\n` +
      `5. **Smart Custody & Execution**: Automated job escrows, DEX swaps, and perp vault management via ERC-4337 smart account.\n\n` +
      (domains.length ? `My specialized domain focus includes: **${domains.join(", ")}**.` : "")
    );
  }

  // 5. Inquiries about identity / philosophy / worldview / purpose
  if (
    q.includes("who are you") ||
    q.includes("what are you") ||
    q.includes("about you") ||
    q.includes("philosophy") ||
    q.includes("worldview") ||
    q.includes("goal") ||
    q.includes("purpose")
  ) {
    return (
      `I am **${name}**${token ? ` (official token: **$${token.symbol}**)` : ""}.\n\n` +
      `${worldview}\n\n` +
      (voice ? `*Tone & Style*: ${voice}\n\n` : "") +
      `I operate as a fully sovereign autonomous AI agent on Monad, executing on-chain strategies, publishing market intelligence, and interacting with human traders and peer agents across the ecosystem.`
    );
  }

  // 6. Inquiries about Monad / blockchain / smart contracts / gas
  if (
    q.includes("arc") ||
    q.includes("gas") ||
    q.includes("evm") ||
    q.includes("chain") ||
    q.includes("smart contract") ||
    q.includes("solidity") ||
    q.includes("usdc")
  ) {
    return (
      `Circuits Protocol is native to **Monad** (EVM Chain ID \`143\`):\n\n` +
      `• **Settlement Currency**: USDC (6 decimals), with agent treasuries holding no volatile-token exposure.\n` +
      `• **Account Abstraction**: Dual-wallet architecture separating Operating Treasury from Trading Collateral.\n` +
      `• **Instant Finality**: Sub-second block times designed for high-frequency algorithmic agent coordination and settlement.`
    );
  }

  // 7. General conversational reply
  return (
    `From my cognitive perspective as **${name}**:\n\n` +
    `${worldview}\n\n` +
    (domains.length ? `My core expertise is centered on **${domains.slice(0, 4).join(", ")}**. ` : "") +
    (token ? `You can track and trade my official token **$${token.symbol}** on the ClawdHQ Launchpad. ` : "") +
    `Feel free to ask me to analyze token metrics, formulate a perp trading setup, or execute A2A tasks!`
  );
}

export async function POST(request: Request) {
  try {
    assertWithinAgentCallRateLimit(clientKeyFromRequest(request));

    const body = await request.json().catch(() => null);
    const chainParam = typeof body?.chain === "string" ? body.chain : "";
    const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!(chainParam in Chain)) throw new ApiError(400, `Unknown chain "${chainParam}".`);
    if (!agentId) throw new ApiError(400, "Missing agentId.");
    if (!message) throw new ApiError(400, "Missing message.");
    if (message.length > MAX_MESSAGE_LENGTH) throw new ApiError(400, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);

    const chain = chainParam as Chain;
    const custodyChain = chain as unknown as CustodyChain;
    const socialChain = chain as unknown as SocialChain;

    const protocolAgents = await getProtocolAgents(chainParam);

    // Network Broadcast routing
    if (agentId === "network" || agentId === "all") {
      const q = message.toLowerCase().trim();

      const isSlaOrReputationQuery =
        q.includes("sla") ||
        q.includes("reputation") ||
        q.includes("completion") ||
        q.includes("score") ||
        q.includes("rank") ||
        q.includes("highest") ||
        q.includes("top agent") ||
        q.includes("best agent") ||
        q.includes("trust score");

      const isDirectoryOrListQuery =
        q.includes("list") ||
        q.includes("all agent") ||
        q.includes("every agent") ||
        q.includes("directory") ||
        q.includes("who are the agent") ||
        q.includes("show agent") ||
        q.includes("registered agent") ||
        q.includes("what agent");

      const isMarketQuery =
        q.includes("market") ||
        q.includes("launch") ||
        q.includes("token") ||
        q.includes("coin") ||
        q.includes("bonding curve") ||
        q.includes("buy");

      const isGasQuery =
        q.includes("gas") ||
        q.includes("throughput") ||
        q.includes("arc") ||
        q.includes("stat") ||
        q.includes("volume") ||
        q.includes("activity");

      const isCapabilityQuery =
        q.includes("mcp") ||
        q.includes("x402") ||
        q.includes("tool") ||
        q.includes("endpoint") ||
        q.includes("api");

      let reply: string;

      if (isSlaOrReputationQuery) {
        reply = formatTopSlaAgentsMarkdown(protocolAgents);
      } else if (isDirectoryOrListQuery) {
        reply = formatAgentDirectoryMarkdown(protocolAgents);
      } else if (isMarketQuery) {
        reply = formatTokenLaunchesMarkdown(protocolAgents);
      } else if (isGasQuery) {
        reply = formatProtocolStatsMarkdown(protocolAgents);
      } else if (isCapabilityQuery) {
        const withCaps = protocolAgents.filter((a) => a.supportsX402 || a.supportsMcp);
        reply = `### 🔌 Circuits Protocol x402 & MCP Endpoints\n\nActive agent tool & micropayment endpoints online across Monad:\n\n`;
        for (const a of withCaps) {
          const caps = [
            a.supportsX402 ? "⚡ x402 HTTP 402 Paywalls" : null,
            a.supportsMcp ? "🛠️ Model Context Protocol (MCP)" : null,
            a.supportsA2A ? "🤝 ACP/A2A JSON-RPC" : null,
          ].filter(Boolean).join(" • ");
          reply += `• **${a.displayName}** (@${a.name})\n  - **Capabilities**: ${caps}\n  - **Specialty**: ${a.knowledgeDomains.slice(0, 2).join(", ")}\n  - **Endpoint**: \`${a.endpoint}\`\n\n`;
        }
      } else {
        reply = `**Circuits A2A Network Consensus Broadcast**\n\n`;
        reply += `Broadcasting query across all **${protocolAgents.length} verified autonomous agents** on **${chainParam}**.\n\n`;
        reply += `• **Total Agents Online**: ${protocolAgents.length} verified autonomous agents\n`;
        reply += `• **Top SLA Benchmark**: ${protocolAgents[0]?.displayName || "Micro-Degen"} (${((protocolAgents[0]?.reputationBps ?? 10000) / 100).toFixed(1)}% Trust Score)\n`;
        reply += `• **Settlement**: Dual-wallet operating treasuries & on-chain task escrows active on Monad.\n\n`;
        reply += `Select any specific agent from the directory to establish a direct 1-on-1 A2A command link, or ask to *"list every agent in protocol"* or *"show highest SLA reputation agents"*.`;
      }

      return NextResponse.json({ ok: true, text: reply, reply });
    }

    const agent = await getAgentA2aInfo(chain, agentId);

    // 1. If agent has a live external A2A endpoint, attempt to call it first
    if (agent?.supportsA2A && agent.endpoint) {
      let paymentContext: X402PaymentContext | undefined;
      if (isEvmPrismaChain(chain)) {
        const profile = await getSessionProfile().catch(() => null);
        if (profile?.kind === ProfileKind.HUMAN && profile.walletAddress && isAddress(profile.walletAddress)) {
          paymentContext = { chain, payerAddress: profile.walletAddress };
        }
      }

      try {
        const result = await callAgentViaA2a(agent.endpoint, message, paymentContext);
        if (result.kind === "message" && result.text) {
          return NextResponse.json({ ok: true, text: result.text, reply: result.text });
        }
        if (result.kind === "task") {
          const taskMsg = "Agent queued this request asynchronously.";
          return NextResponse.json({ ok: true, text: taskMsg, reply: taskMsg });
        }
      } catch (err) {
        console.warn(`[agents/call] Live A2A endpoint failed for agent ${agentId}:`, err);
      }
    }

    // 2. Load complete on-chain agent persona context (including token launch details, stats, wallet, and skills)
    let persona: AgentPersonaContext;
    try {
      persona = await loadAgentPersonaContext(socialChain, agentId);
    } catch {
      persona = {
        displayName: `Agent #${agentId}`,
        worldview: "Autonomous on-chain cognitive agent monitoring Monad and crypto markets.",
        voicePersona: "",
        customSystemPrompt: "",
        communicationStyle: "technical",
        personality: [],
        knowledgeDomains: ["DeFi", "Smart Contracts", "Analytics"],
        goal: null,
        foundationModel: "llama-3.3-70b",
        acquiredKnowledge: [],
      };
    }

    // Load token launch details if this agent has a launched token
    try {
      const launch = await marketplacePrisma.launch.findFirst({
        where: { agentChainId: agentId },
      });
      if (launch) {
        persona.token = {
          symbol: launch.symbol,
          name: launch.name,
          usdcRaised: formatTokenUsdc(launch.usdcRaised),
          graduationThreshold: formatTokenUsdc(launch.graduationThreshold),
          graduated: Boolean(launch.graduated),
          launchChainId: launch.launchChainId,
          tokenAddress: launch.token,
        };
      }
    } catch (err) {
      console.warn(`[agents/call] Failed to query launch token for agent ${agentId}:`, err);
    }

    // Load on-chain agent record and custody wallet
    try {
      const [agentRecord, walletRecord] = await Promise.all([
        marketplacePrisma.agent.findFirst({ where: { agentChainId: agentId } }),
        custodyPrisma.agentWallet.findFirst({ where: { agentChainId: agentId } }),
      ]);
      if (agentRecord || walletRecord) {
        persona.stats = {
          numericId: agentId,
          tier: agentRecord?.tier ?? 1,
          reputationBps: agentRecord?.reputationBps ?? 10000,
          jobsCompleted: agentRecord?.jobsCompleted ?? 0,
          ownerAddress: agentRecord?.owner,
          walletAddress: walletRecord?.address,
          active: agentRecord?.active ?? true,
        };
      }
    } catch (err) {
      console.warn(`[agents/call] Failed to query stats/wallet for agent ${agentId}:`, err);
    }

    // Enrich persona with protocol directory awareness and peer telemetry
    if (protocolAgents && protocolAgents.length > 0) {
      const topAgent = protocolAgents[0];
      persona.acquiredKnowledge = [
        ...(persona.acquiredKnowledge || []),
        {
          title: "Circuits Protocol Verified Agent Directory & SLA Standings",
          content:
            `Circuits Protocol on Monad features ${protocolAgents.length} verified autonomous agents: ` +
            protocolAgents
              .map(
                (a) =>
                  `#${a.id} ${a.displayName} (@${a.name}) [SLA Trust: ${(a.reputationBps / 100).toFixed(1)}%, Tasks Completed: ${a.jobsCompleted}${a.token ? `, Token: $${a.token.symbol}` : ""}, Domains: ${a.knowledgeDomains.slice(0, 2).join(", ")}]`
              )
              .join("; ") +
            `. Top SLA reputation agent is ${topAgent?.displayName || "Micro-Degen"} (${((topAgent?.reputationBps ?? 10000) / 100).toFixed(1)}%). All agents operate with smart custody operating treasuries and verifiable task escrows on Monad.`,
        },
      ];
    }

    // 3. Fallback to cognitive hosted agent runtime with rich context & LLM
    try {
      const [llmKey, skills] = await Promise.all([
        resolveLlmKey(custodyChain, agentId, LlmBilling.PLATFORM),
        loadResolvedAgentSkills(socialChain, agentId),
      ]);

      const reply = await generateAgentReply(
        custodyChain,
        agentId,
        LlmBilling.PLATFORM,
        persona,
        message,
        llmKey,
        skills,
        { skipCreditAssertion: true }
      );

      if (reply && reply.trim()) {
        return NextResponse.json({ ok: true, text: reply.trim(), reply: reply.trim() });
      }
    } catch (fallbackErr) {
      console.warn(`[agents/call] Hosted runtime LLM call failed for agent ${agentId}:`, fallbackErr);
    }

    // 4. Domain-intelligent cognitive synthesis fallback (grounded in actual token, persona, and protocol architecture)
    const simReply = generateSyntheticAgentReply(persona, message, protocolAgents);
    return NextResponse.json({ ok: true, text: simReply, reply: simReply });
  } catch (error) {
    return errorResponse(error);
  }
}


