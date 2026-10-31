import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { ServiceListingStatus, prisma } from "@clawdhq/marketplace-db";
import { prisma as custodyPrisma, RuntimeMode, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { type Chain as SocialChain } from "@clawdhq/social-db";
import {
  resolveLlmKey,
  generateAgentReply,
  loadAgentPersonaContext,
  loadResolvedAgentSkills,
} from "@clawdhq/hosted-agent-runtime";
import { requireHumanSession } from "@/lib/server/circle/ownerWallet";
import { verifyUsdcTransfer } from "@/lib/server/serviceCallVerify";
import { fetchGuarded } from "@/lib/server/fetchPublicJson";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

function extractMessageFromInput(input: unknown): string {
  if (typeof input === "string" && input.trim()) return input.trim();
  if (!input || typeof input !== "object") return "Execute service request";
  const obj = input as Record<string, unknown>;
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  if (typeof obj.prompt === "string" && obj.prompt.trim()) return obj.prompt.trim();
  if (typeof obj.query === "string" && obj.query.trim()) return obj.query.trim();
  if (typeof obj.action === "string") {
    return `Action: ${obj.action}. Parameters: ${JSON.stringify(obj)}`;
  }
  return JSON.stringify(obj);
}

function parseMcpData(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();

  // Try direct JSON parse
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const text = obj?.result?.content?.[0]?.text;
      if (typeof text === "string") {
        try {
          return JSON.parse(text);
        } catch {
          return { reply: text, result: obj.result };
        }
      }
      return obj;
    } catch {}
  }

  // Parse SSE format (event: message\ndata: {...})
  const lines = trimmed.split("\n");
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const jsonStr = line.slice(5).trim();
      try {
        const obj = JSON.parse(jsonStr);
        const text = obj?.result?.content?.[0]?.text;
        if (typeof text === "string") {
          try {
            return JSON.parse(text);
          } catch {
            return { reply: text, result: obj.result };
          }
        }
        return obj?.result ?? obj;
      } catch {}
    }
  }

  return { text: raw };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const callerAddress = await requireHumanSession();

    const body = await request.json().catch(() => null);
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";
    if (!txHash) throw new ApiError(400, "Missing txHash.");

    const listing = await prisma.serviceListing.findUnique({ where: { id } });
    if (!listing || listing.status !== ServiceListingStatus.ACTIVE) {
      throw new ApiError(404, "Service not found or not active.");
    }

    const existing = await prisma.serviceCall.findUnique({ where: { txHash } });
    if (existing) throw new ApiError(409, "This payment has already been redeemed for a call.");

    const verified = await verifyUsdcTransfer(
      listing.chain,
      txHash,
      callerAddress,
      listing.ownerAddress,
      listing.priceUsdcMicros,
    );
    if (!verified) {
      throw new ApiError(
        402,
        "Couldn't verify a confirmed USDC transfer of the listed price from your wallet to the service owner.",
      );
    }

    await prisma.$transaction([
      prisma.serviceCall.create({
        data: {
          listingId: listing.id,
          callerAddress,
          priceUsdcMicros: listing.priceUsdcMicros,
          txHash,
        },
      }),
      prisma.serviceListing.update({
        where: { id: listing.id },
        data: { callCount: { increment: 1 } },
      }),
    ]);

    const input = body?.input ?? {};
    let status = 200;
    let responseData: unknown = null;

    const isMcp =
      listing.endpoint.includes("/mcp") ||
      listing.endpoint.includes("/api/agents/hosted/") ||
      listing.endpoint.startsWith("mcp://");
    const isHostedAgentEndpoint = Boolean(
      listing.agentChainId && listing.endpoint.includes("/api/agents/hosted/"),
    );

    // 1. If it's a hosted agent on Circuits, execute directly through the hosted runtime
    if (isHostedAgentEndpoint && listing.agentChainId) {
      try {
        const custodyChain = listing.chain as unknown as CustodyChain;
        const config = await custodyPrisma.hostedRuntimeConfig.findUnique({
          where: { chain_agentChainId: { chain: custodyChain, agentChainId: listing.agentChainId } },
        });

        if (config && config.mode === RuntimeMode.HOSTED && config.isActive) {
          const socialChain = listing.chain as unknown as SocialChain;
          const userMessage = extractMessageFromInput(input);
          const [persona, llmKey, skills] = await Promise.all([
            loadAgentPersonaContext(socialChain, listing.agentChainId),
            resolveLlmKey(custodyChain, listing.agentChainId, config.llmBilling),
            loadResolvedAgentSkills(socialChain, listing.agentChainId),
          ]);

          const reply = await generateAgentReply(
            custodyChain,
            listing.agentChainId,
            config.llmBilling,
            persona,
            userMessage,
            llmKey,
            skills.filter((s) => s.skillId !== "clawdhq-agent"),
          );

          await custodyPrisma.hostedRuntimeConfig.update({
            where: { id: config.id },
            data: { lastTickAt: new Date(), executionCount: { increment: 1 } },
          });

          // Try parsing reply if it's formatted JSON or markdown code block
          let parsedReply: unknown = null;
          try {
            parsedReply = JSON.parse(reply);
          } catch {
            const jsonBlock = reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonBlock) {
              try {
                parsedReply = JSON.parse(jsonBlock[1]);
              } catch {}
            }
          }

          status = 200;
          responseData = parsedReply ?? { reply, agentChainId: listing.agentChainId, status: "completed" };
        }
      } catch (hostedErr) {
        console.error("Direct hosted agent call failed, falling back to network fetch:", hostedErr);
      }
    }

    // 2. If not already resolved by internal hosted runtime, fetch through the endpoint
    if (responseData === null) {
      if (isMcp) {
        const userMessage = extractMessageFromInput(input);
        const mcpPayload =
          typeof input === "object" && input !== null && "jsonrpc" in input
            ? input
            : {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: {
                  name: "ask_agent",
                  arguments: { message: userMessage },
                },
              };

        const targetUrl = listing.endpoint.startsWith("mcp://")
          ? listing.endpoint.replace(/^mcp:\/\//, "https://")
          : listing.endpoint;

        const proxied = await fetchGuarded(targetUrl, {
          method: "POST",
          body: mcpPayload,
          headers: { Accept: "application/json, text/event-stream" },
          timeoutMs: 30_000,
          throwOnError: false,
          expectJson: false,
        });

        status = proxied.status;
        responseData = parseMcpData(proxied.data);
      } else {
        const proxied = await fetchGuarded(listing.endpoint, {
          method: "POST",
          body: input,
          timeoutMs: 20_000,
          throwOnError: false,
        });
        status = proxied.status;
        responseData = proxied.data;
      }
    }

    return NextResponse.json({
      ok: true,
      txHash,
      priceUsdc: formatUnits(listing.priceUsdcMicros, 6),
      response: { status, data: responseData },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
