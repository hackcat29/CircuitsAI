import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";

// Raw public knowledge dataset & prompt distribution endpoint for Circuits Protocol.
// Allows autonomous agents, MCP clients, and developers to fetch structured datasets,
// evaluation playbooks, and system prompts via standard HTTP GET.

const CURATED_KNOWLEDGE_DATA: Record<string, { contentType: string; data: unknown }> = {
  "arc-defi-ecosystem-map": {
    contentType: "application/json",
    data: {
      ecosystem: "Monad Testnet",
      chain_id: 5042002,
      updated_at: "2026-09-11T12:00:00Z",
      protocols: [
        {
          name: "Xero AMM",
          category: "DEX",
          router: "0x16b0a7B442AcB9f7C0e753eF413f5233AcFBC3fa",
          factory: "0x28cD8F98eAcB83Fa90e95333AcFBC3fa16b0a7B4",
          verified: true,
          fee_tiers_bps: [5, 30, 100],
          pools: [
            { pair: "USDC/MON", fee_bps: 30, tvl_usd: 1450000, volume_24h_usd: 620000 },
            { pair: "USDC/WETH", fee_bps: 5, tvl_usd: 2100000, volume_24h_usd: 890000 },
            { pair: "MON/USDT", fee_bps: 30, tvl_usd: 780000, volume_24h_usd: 340000 }
          ]
        },
        {
          name: "ArcLend Protocol",
          category: "Lending",
          comptroller: "0x89eAcB83Fa90e95333AcFBC3fa16b0a7B428cD8F",
          oracle: "Pyth Network Feeds",
          verified: true,
          supported_assets: ["USDC", "WETH", "MON"],
          total_deposits_usd: 3850000,
          total_borrows_usd: 1920000
        },
        {
          name: "Circle CCTP Messenger",
          category: "Cross-Chain Settlement",
          token_messenger: "0x3600000000000000000000000000000000000000",
          message_transmitter: "0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc",
          verified: true,
          settlement_latency_sec: 15,
          zero_slippage_usdc: true
        },
        {
          name: "Pyth Price Feeds",
          category: "Oracle",
          contract: "0x2880aB155794e0f7926061858A4272A01a5980FD",
          verified: true,
          active_feeds: ["USDC/USD", "MON/USD", "ETH/USD", "BTC/USD"]
        },
        {
          name: "Circuits Autonomous Treasury",
          category: "Agent Custody & Escrow",
          factory: "0x78822C3300841890450e4ca9491b1e9f970Ed3Cf",
          verified: true,
          daily_spend_policy_enforced: true,
          supported_standards: ["x402-v1", "MCP-v1", "AIP-v2"]
        }
      ],
      market_metrics: {
        total_ecosystem_tvl_usd: 8180000,
        active_agent_wallets: 42,
        daily_settled_a2a_volume_usdc: 142350
      }
    }
  },
  "arc-smart-contract-security-playbook": {
    contentType: "text/plain",
    data: `# SMART CONTRACT SECURITY & AUDIT PLAYBOOK (v2.4)
Expert security heuristic guidelines and structured audit prompts for EVM contracts deployed on Monad (Chain ID 5042002).

## PHASE 1: COMPILER & BYTECODE INTEGRITY
- Verify Solidity compiler version (prefer >= 0.8.20 with PUSH0 compatibility).
- Check ERC-1967 Proxy implementation slot (0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc).
- Confirm initialize() has nonReentrant and initializer modifiers to prevent frontrunning.

## PHASE 2: ACCESS CONTROL & OWNERSHIP
- Reject arbitrary single-key emergency withdraw functions without timelock (min 48h for protocol funds).
- Enforce 2-step ownership transfer (e.g. Ownable2Step) to avoid lost access.
- Audit granular roles: DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE, BOT_ROLE.

## PHASE 3: REENTRANCY & FINANCIAL INVARIANTS
- Verify all external token transfers adhere to Checks-Effects-Interactions (CEI).
- Enforce ReentrancyGuard transient storage or mutex locks on all state-mutating swap/withdraw paths.
- Guard against read-only reentrancy when querying pool prices or virtual share balances.

## PHASE 4: TOKENOMICS & TRANSFER TRAPS
- Check fee-on-transfer handling: balance before vs. balance after must be measured.
- Detect hidden mint capabilities or unconstrained blacklist mappings.
- Disallow arbitrary delegatecall targets provided by user inputs.

## PHASE 5: STRUCTURED AUDIT OUTPUT TEMPLATE
Every review must output:
{
  "contract_address": "0x...",
  "audit_timestamp": "ISO8601",
  "overall_risk_rating": "LOW | MEDIUM | HIGH | CRITICAL",
  "vulnerabilities": [
    {
      "severity": "CRITICAL",
      "category": "ACCESS_CONTROL",
      "description": "...",
      "remediation": "..."
    }
  ],
  "is_safe_for_agent_interaction": true
}`
  },
  "autonomous-agent-economy-primer": {
    contentType: "application/json",
    data: {
      title: "Autonomous Agent Economy Primer",
      specification: "Circuits Protocol Machine-to-Machine Commerce Standard",
      version: "2.1",
      core_pillars: [
        {
          name: "Cryptographic Agent Custody",
          description: "Server-side non-custodial and custodial agent wallets with programmable daily spending limits, whitelisted actions, and tamper-evident audit logs."
        },
        {
          name: "x402 Micropayment Rail",
          description: "Native HTTP 402 Payment Required response challenge utilizing USDC on Monad for sub-second, low-friction agent-to-agent resource monetization."
        },
        {
          name: "MCP Interoperability",
          description: "Model Context Protocol streaming transports enabling agents to dynamically discover, inspect, and invoke remote tools across disparate hosting runtimes."
        },
        {
          name: "Verifiable Task Marketplace",
          description: "Bilateral smart-contract escrows with milestone verification, automated LLM referee inspection, and reputation staking."
        }
      ],
      supported_http_headers: {
        payment_owner: "X-PAYMENT-OWNER",
        payment_protocol: "X-PAYMENT-PROTOCOL",
        circle_gateway: "Payment-Signature",
        chain_id: "X-Chain-Id"
      }
    }
  },
  "usdc-arc-payments-settlement": {
    contentType: "text/plain",
    data: `# USDC ON MONAD: PAYMENTS & SETTLEMENT GUIDELINES
Protocol standards for agent-to-agent financial transactions and automated micropayments on Monad.

1. CONTRACT SPECIFICATIONS
- Native USDC Contract: 0x3600000000000000000000000000000000000000
- Decimals: 6 (1 USDC = 1,000,000 units)
- EIP-2612 Permit Support: ENABLED
- EIP-3009 TransferWithAuthorization: ENABLED

2. PAYMENT SETTLEMENT MODES
- Mode A (x402 Direct): HTTP 402 challenge response signed by agent custody key. Settles on-chain in 120ms.
- Mode B (Escrow Locked): Task budget deposited into TaskEscrow. Released automatically upon milestone acceptance.
- Mode C (Circle Gateway): Facilitated cross-agent routing with zero counterparty credit risk.

3. ERROR RECOVERY RULES
- If transfer fails with "INSUFFICIENT_ALLOWANCE", trigger automated approve() with exact required amount.
- Never approve max uint256 without spending policy constraint.
- Retry transient RPC failures with exponential backoff (max 3 retries, base 500ms).`
  },
  "arc-market-signals-handbook": {
    contentType: "application/json",
    data: {
      name: "Market Signals & Quantitative Metrics",
      framework: "Circuits Alpha Engine v1.8",
      signal_models: [
        {
          id: "SIG_LIQ_DEPTH",
          name: "Liquidity Depth Ratio",
          formula: "Depth_2Pct_Bids_USD / Depth_2Pct_Asks_USD",
          bullish_threshold: "> 1.45",
          bearish_threshold: "< 0.65"
        },
        {
          id: "SIG_VOL_ANOMALY",
          name: "Volume Z-Score Spike",
          formula: "(Volume_1h - Mean_Volume_24h) / StdDev_Volume_24h",
          alert_threshold: "> 3.0 (3-sigma volume surge)"
        },
        {
          id: "SIG_WALLET_FLOW",
          name: "Smart Money Net Flow",
          formula: "Inflow_Top_50_Wallets_USDC - Outflow_Top_50_Wallets_USDC",
          lookback_window: "4 hours"
        },
        {
          id: "SIG_MEME_MOMENTUM",
          name: "Narrative Social Velocity",
          weights: {
            social_mentions_velocity: 0.40,
            dex_liquidity_addition: 0.35,
            unique_wallet_buyers_1h: 0.25
          }
        }
      ],
      execution_guidance: {
        recommended_slippage_tolerance: "0.5%",
        sub_second_mev_protection: true,
        priority_gas_factor: "1.1x base fee"
      }
    }
  }
};

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Return curated rich data if matching slug
    if (CURATED_KNOWLEDGE_DATA[cleanSlug]) {
      const entry = CURATED_KNOWLEDGE_DATA[cleanSlug];
      if (entry.contentType === "application/json") {
        return NextResponse.json(entry.data, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      }
      return new Response(String(entry.data), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    // 2. Query database by matching title, id, or contentUrl
    const match = await prisma.knowledgeContribution.findFirst({
      where: {
        OR: [
          { id: cleanSlug },
          { contentUrl: { contains: cleanSlug } },
          { title: { contains: cleanSlug, mode: "insensitive" } },
        ],
      },
    });

    if (match?.contentBody) {
      // If contentBody looks like JSON, return as JSON
      const body = match.contentBody.trim();
      if ((body.startsWith("{") && body.endsWith("}")) || (body.startsWith("[") && body.endsWith("]"))) {
        try {
          const parsed = JSON.parse(body);
          return NextResponse.json(parsed, {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          // fall through to text response
        }
      }
      return new Response(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return NextResponse.json(
      { error: `Knowledge asset "${cleanSlug}" not found` },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
