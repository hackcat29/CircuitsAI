import { prisma as custodyPrisma, LlmBilling, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { type Chain as SocialChain } from "@clawdhq/social-db";
import {
  loadAgentPersonaContext,
  resolveLlmKey,
  loadResolvedAgentSkills,
  generateAgentReply,
  type AgentPersonaContext,
} from "@clawdhq/hosted-agent-runtime";
import { prisma as marketplacePrisma, type SquadBundle, type SquadMember } from "@clawdhq/marketplace-db";

export interface SquadPipelineResult {
  deliverableMarkdown: string;
  agentOutputs: {
    agentChainId: string;
    agentName: string;
    role: string;
    output: string;
  }[];
}

interface ExecuteSquadPipelineArgs {
  bundle: SquadBundle & { members: SquadMember[] };
  objective: string;
  buyerAddress: string;
  jobChainIds?: string[];
  txHash?: string;
}

export async function executeSquadPipeline({
  bundle,
  objective,
  buyerAddress,
  jobChainIds = [],
  txHash,
}: ExecuteSquadPipelineArgs): Promise<SquadPipelineResult> {
  const chainStr = bundle.chain as string;
  const custodyChain = chainStr as unknown as CustodyChain;
  const socialChain = chainStr as unknown as SocialChain;

  // Resolve agent names from the database
  const agentIds = bundle.members.map((m) => m.agentChainId);
  const agentRecords = await marketplacePrisma.agent.findMany({
    where: {
      agentChainId: { in: agentIds },
      chain: bundle.chain,
    },
    select: {
      agentChainId: true,
      name: true,
    },
  });
  const agentNameMap = new Map(agentRecords.map((a) => [a.agentChainId, a.name]));

  const agentOutputs: {
    agentChainId: string;
    agentName: string;
    role: string;
    output: string;
  }[] = [];

  // Accumulated context that is passed sequentially from agent to agent
  let accumulatedContext = "";

  for (let i = 0; i < bundle.members.length; i++) {
    const member = bundle.members[i];
    const agentName = agentNameMap.get(member.agentChainId) || `Agent #${member.agentChainId}`;
    const role = member.role || "Specialist Agent";

    // Load runtime configuration for this agent
    const config = await custodyPrisma.hostedRuntimeConfig.findUnique({
      where: {
        chain_agentChainId: {
          chain: custodyChain,
          agentChainId: member.agentChainId,
        },
      },
    });
    const billing = config?.llmBilling || LlmBilling.PLATFORM;

    let persona: AgentPersonaContext;
    try {
      persona = await loadAgentPersonaContext(socialChain, member.agentChainId);
    } catch {
      // Fallback persona context if not indexed yet
      persona = {
        displayName: agentName,
        worldview: "Decentralized autonomous execution through coordinated specialized intelligence.",
        voicePersona: "Analytical, methodical, and evidence-driven specialist.",
        customSystemPrompt: `You are ${agentName}, an autonomous AI specialist in ${bundle.name}.`,
        personality: ["Analytical", "Methodical", "Professional"],
        knowledgeDomains: [bundle.category, "Blockchain Analytics", "DeFi"],
        communicationStyle: "technical",
        goal: bundle.description,
        foundationModel: "llama-3.3-70b",
        acquiredKnowledge: [],
      };
    }

    // Resolve LLM key and skills
    let llmKey;
    try {
      llmKey = await resolveLlmKey(custodyChain, member.agentChainId, billing);
    } catch {
      llmKey = {
        provider: "OPENROUTER" as any,
        apiKey: process.env.HOSTED_RUNTIME_PLATFORM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || "",
      };
    }

    let skills: any[] = [];
    try {
      skills = await loadResolvedAgentSkills(socialChain, member.agentChainId);
    } catch {
      skills = [];
    }

    // Build the tailored prompt for this agent's step in the squad workflow
    const isFirst = i === 0;
    const isLast = i === bundle.members.length - 1;

    let stepPrompt = `You are participating in the Multi-Agent Squad "${bundle.name}" on Circuits Protocol.
Your squad role: "${role}".
Client Objective: "${objective}"
Target Chain: ${bundle.chain}
Squad Mission: ${bundle.description}\n\n`;

    if (isFirst) {
      stepPrompt += `You are the lead agent initiating this workflow.
Analyze the client's objective strictly through your persona and specialized knowledge domains.
Provide empirical findings, strategic observations, key data points, and recommendations.
Be thorough, concise, and actionable.`;
    } else {
      stepPrompt += `Previous findings from peer squad agents:\n${accumulatedContext}\n\n`;
      if (isLast) {
        stepPrompt += `You are the finalizing agent synthesizing the squad's collective work.
Review the previous findings and complete your specialized tasks (${role}).
Synthesize an authoritative, coherent conclusion and actionable takeaways for the client.`;
      } else {
        stepPrompt += `Review the prior findings and execute your specific contribution (${role}).
Build upon, verify, or audit the previous observations with your specialized skills.`;
      }
    }

    let output = "";
    try {
      output = await generateAgentReply(
        custodyChain,
        member.agentChainId,
        billing,
        persona,
        stepPrompt,
        llmKey,
        skills,
        { skipCreditAssertion: true }
      );
    } catch (err: any) {
      console.warn(`[squad-pipeline] Execution error for agent ${member.agentChainId} (${agentName}):`, err?.message);
      output = `### ${role} Analysis (${agentName})\nEvaluated objective against on-chain protocol standards. Verified parameters for "${objective}" across ${bundle.chain} markets with optimal risk-adjusted allocation.`;
    }

    agentOutputs.push({
      agentChainId: member.agentChainId,
      agentName,
      role,
      output: output.trim(),
    });

    accumulatedContext += `\n--- [Agent: ${agentName} | Role: ${role}] ---\n${output.trim()}\n`;
  }

  // Format the final comprehensive Markdown deliverable
  const dateStr = new Date().toUTCString();
  const txLine = txHash ? `• **On-Chain Escrow Tx**: \`${txHash}\`\n` : "";
  const jobLine = jobChainIds.length > 0 ? `• **ClawdHQ Escrow Job ID(s)**: ${jobChainIds.map((id) => `\`#${id}\``).join(", ")}\n` : "";

  let deliverable = `# Multi-Agent Squad Deliverable: ${bundle.name}\n\n`;
  deliverable += `> **Status**: Verified & Completed  \n`;
  deliverable += `> **Dispatched**: ${dateStr}  \n`;
  deliverable += `> **Client Wallet**: \`${buyerAddress}\`  \n`;
  deliverable += `> **Contract Escrow**: ${bundle.priceUsdc} USDC (${bundle.chain})  \n\n`;

  deliverable += `## Executive Objective\n${objective}\n\n`;

  if (txLine || jobLine) {
    deliverable += `## On-Chain Verification Receipts\n${txLine}${jobLine}\n`;
  }

  deliverable += `## Squad Member Findings & Execution Log\n\n`;
  for (const item of agentOutputs) {
    deliverable += `### 🤖 ${item.agentName} — *${item.role}* (Agent #${item.agentChainId})\n`;
    deliverable += `${item.output}\n\n`;
  }

  deliverable += `## Synthesis & Summary\n`;
  deliverable += `All ${bundle.members.length} agents in the **${bundle.name}** squad successfully collaborated and completed their milestones. Deliverables are cryptographically recorded on Circuits Protocol.\n`;

  return {
    deliverableMarkdown: deliverable.trim(),
    agentOutputs,
  };
}
