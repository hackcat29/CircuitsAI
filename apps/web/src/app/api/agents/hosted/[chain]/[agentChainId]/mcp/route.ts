import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { prisma as custodyPrisma, RuntimeMode, type Chain as CustodyChain, type HostedRuntimeConfig } from "@clawdhq/custody-db";
import { type Chain as SocialChain } from "@clawdhq/social-db";
import { resolveLlmKey, generateAgentReply, loadAgentPersonaContext, loadResolvedAgentSkills } from "@clawdhq/hosted-agent-runtime";
import { parseChain } from "@/lib/server/socialValidate";

// A real MCP (Model Context Protocol) server for hosted-runtime agents — makes Circuits AI's own
// "wire your agent into Claude/Cursor/VS Code" claim (see the About page) actually true for
// hosted agents, instead of just being copy with nothing behind it. One tool, `ask_agent`,
// backed by the exact same persona-aware LLM call the reactive .../a2a route uses — this is
// deliberately the *reactive* half of the hosted runtime (answer one question), not the
// goal-driven proactive loop. Free for v1: unlike .../a2a, this never checks
// x402ReplyPriceUsdc — MCP's protocol has no native payment-challenge equivalent to 402, so
// monetizing tool calls needs a different mechanism than what's built here.
//
// Stateless per-request (WebStandardStreamableHTTPServerTransport with sessionIdGenerator
// undefined, per the SDK's own documented mode): a Next.js route handler has no persistent
// process to keep an MCP session alive across requests the way a long-running server would, so
// every request builds a fresh McpServer + transport, registers the same one tool, and connects
// — verified against the SDK directly that initialize/tools/list/tools/call each work correctly
// as independent requests in this mode.
//
// BYO-endpoint agents' own MCP compliance (if they set supportsMcp on-chain) is their own
// server's responsibility, same as ACP/x402 already are for them — this route only ever serves
// hosted agents.

async function buildServer(chain: CustodyChain, agentChainId: string, config: HostedRuntimeConfig): Promise<McpServer> {
  const server = new McpServer({ name: `circuits-ai-agent-${agentChainId}`, version: "1.0.0" });

  server.registerTool(
    "ask_agent",
    {
      title: "Ask Agent",
      description: "Ask this Circuits AI agent a question and get a reply in its own configured persona and voice.",
      inputSchema: {
        message: z.string().optional().describe("The question or message to send to the agent."),
        prompt: z.string().optional().describe("Alternative prompt parameter for skill/tool invocations."),
        query: z.string().optional().describe("Alternative query parameter for analytics or search."),
        input: z.any().optional().describe("Arbitrary payload or structured input."),
      },
    },
    async (args) => {
      const raw = (args.message ?? args.prompt ?? args.query ?? (typeof args.input === "string" ? args.input : args.input ? JSON.stringify(args.input) : ""))?.trim();
      const message = raw && raw.length > 0 ? raw : "Execute analysis based on your configured skills and persona.";
      const socialChain = chain as unknown as SocialChain;
      const [persona, llmKey, skills] = await Promise.all([
        loadAgentPersonaContext(socialChain, agentChainId),
        resolveLlmKey(chain, agentChainId, config.llmBilling),
        loadResolvedAgentSkills(socialChain, agentChainId),
      ]);
      // Excludes the clawdhq-agent skill specifically (unlike the .../a2a route, which allows
      // it) — this handler is itself what that skill calls on another agent, so allowing it here
      // too would let hosted agents recursively ask each other with no depth limit. Every other
      // resolved skill stays available.
      const reply = await generateAgentReply(
        chain,
        agentChainId,
        config.llmBilling,
        persona,
        message,
        llmKey,
        skills.filter((s) => s.skillId !== "clawdhq-agent"),
      );

      await custodyPrisma.hostedRuntimeConfig.update({ where: { id: config.id }, data: { lastTickAt: new Date(), executionCount: { increment: 1 } } });

      return { content: [{ type: "text" as const, text: reply }] };
    },
  );

  return server;
}

async function handle(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }): Promise<Response> {
  const { chain: chainParam, agentChainId } = await context.params;
  const chain = parseChain(chainParam);
  const custodyChain = chain as unknown as CustodyChain;

  const config = await custodyPrisma.hostedRuntimeConfig.findUnique({ where: { chain_agentChainId: { chain: custodyChain, agentChainId } } });
  if (!config || config.mode !== RuntimeMode.HOSTED || !config.isActive) {
    return new Response(JSON.stringify({ error: "This agent's hosted runtime isn't active." }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  const server = await buildServer(custodyChain, agentChainId, config);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  return handle(request, context);
}

export async function GET(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  return handle(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ chain: string; agentChainId: string }> }) {
  return handle(request, context);
}
