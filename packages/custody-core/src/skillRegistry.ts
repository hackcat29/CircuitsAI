// Maps a Skill.id (from this package's BUILTIN_SKILLS catalog, skillCatalog.ts) to how it's
// actually invoked, if at all. A skillId with no entry here is reference-only: an owner can
// install it as a declared capability, but nothing in this codebase can call it — the catalog's
// `url` field is almost always a docs page, GitHub repo, or npm package, not a live endpoint, so
// most entries genuinely have nothing to wire up without external integration work this package
// can't responsibly fabricate.
//
// Arc Testnet (Chain ID "5042002") is the primary focused EVM network for Circuits Protocol.
//
// Lives in custody-core (not packages/hosted-agent-runtime or apps/web) because callAgentSkill
// (agentSkillActions.ts) needs to resolve it, and custody-core is the lower-level package both
// hosted-agent-runtime and apps/web already depend on — the reverse import direction isn't
// available from either.
export type SkillInvocation =
  | { kind: "mcp"; url: string; priceUsdc: string }
  | {
      kind: "http";
      /** May contain `{paramName}` placeholders, substituted from the matching key in a call's
       * `input` (see agentSkillActions.ts's substitutePathParams). Any input key not consumed by
       * a placeholder becomes a GET query-string param or a POST JSON body field. */
      endpoint: string;
      method: "GET" | "POST";
      priceUsdc: string;
      inputSchema: Record<string, unknown>;
      /** Static headers (auth, etc.) merged onto every call to this endpoint. Read from
       * `process.env` at registry-construction time below — never a literal secret in source. */
      headers?: Record<string, string>;
    }
  /// The one skill wired up without any operator configuration: calls another ClawdHQ hosted
  /// agent's own MCP server (see apps/web's .../hosted/[chain]/[agentChainId]/mcp route) rather
  /// than a third party — both sides are real ClawdHQ agents, so there's nothing here to verify
  /// externally the way a third-party API's contract would need to be. See invokeSkill in
  /// agentSkillActions.ts for how `{chain, agentChainId, message}` input resolves to a URL.
  | { kind: "clawdhq-agent"; priceUsdc: string };

const CLAWDHQ_AGENT_SKILL_ID = "clawdhq-agent";

/** Beyond the handful hardcoded below, third-party entries are never wired here with guessed
 * endpoints/schemas — this codebase can verify a catalog entry's name/description/docs-link via
 * static research, but not every live API's actual request contract, and most of the catalog
 * (a GitHub repo, an npm package, a self-hosted framework) has no hosted endpoint to verify at
 * all. An operator who has deployed/verified a further real integration configures it via this
 * env var instead: a JSON object of `Record<skillId, SkillInvocation>`, merged on top of (and
 * able to override) the hardcoded entries below. Parsed once at module load; a malformed value is
 * logged and ignored rather than crashing the process. */
function loadOperatorRegistry(): Record<string, SkillInvocation> {
  const raw = process.env.HOSTED_RUNTIME_SKILL_REGISTRY_JSON;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, SkillInvocation>;
    }
    console.error("[skillRegistry] HOSTED_RUNTIME_SKILL_REGISTRY_JSON must be a JSON object — ignoring.");
  } catch (error) {
    console.error("[skillRegistry] failed to parse HOSTED_RUNTIME_SKILL_REGISTRY_JSON — ignoring.", error);
  }
  return {};
}

// Arc Testnet and EVM chain ID enum shared by chain-scoped schemas.
const EVM_CHAIN_ID_SCHEMA = {
  type: "string",
  enum: ["5042002", "8453", "1"],
  default: "5042002",
  description: 'EVM chain id: "5042002" for Arc Testnet, "8453" for Base, "1" for Ethereum.',
};

const ARC_CONTRACT_GUARD_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    contract_address: { type: "string", description: "The Arc smart contract address (0x...) to inspect for bytecode integrity, implementation verification, and ownership controls." },
    chain_id: EVM_CHAIN_ID_SCHEMA,
  },
  required: ["contract_address"],
};

const ARC_XERO_SWAP_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    token_in: { type: "string", description: "Contract address of token to sell on Arc (e.g. USDC: 0x3600000000000000000000000000000000000000)." },
    token_out: { type: "string", description: "Contract address of token to buy on Arc." },
    amount_in: { type: "string", description: "Amount of token_in to quote in base units." },
  },
  required: ["token_in", "token_out", "amount_in"],
};

const ARC_X402_DISPATCHER_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    service_url: { type: "string", description: "The metered x402 HTTP service URL on Arc requesting payment." },
    max_price_usdc: { type: "string", description: "Maximum authorized USDC amount for the sub-cent payment." },
  },
  required: ["service_url"],
};

const GOPLUS_TOKEN_SECURITY_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    chainId: EVM_CHAIN_ID_SCHEMA,
    contract_addresses: { type: "string", description: "One token contract address (0x...) to screen for honeypot/rug-pull/malicious-owner risk. Comma-separate to check multiple in one call." },
  },
  required: ["chainId", "contract_addresses"],
};

const GOPLUS_ADDRESS_SECURITY_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    address: { type: "string", description: "The wallet or contract address (0x...) to screen before an agent interacts with or sends funds to it." },
    chain_id: EVM_CHAIN_ID_SCHEMA,
  },
  required: ["address", "chain_id"],
};

const COINGECKO_PRICE_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ids: { type: "string", description: 'Comma-separated CoinGecko coin ids, e.g. "bitcoin,ethereum,usd-coin".' },
    vs_currencies: { type: "string", description: 'Comma-separated currency codes to price against, e.g. "usd".' },
  },
  required: ["ids", "vs_currencies"],
};

const ONE_INCH_QUOTE_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    chainId: EVM_CHAIN_ID_SCHEMA,
    src: { type: "string", description: "Token contract address to sell — use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native asset." },
    dst: { type: "string", description: "Token contract address to buy." },
    amount: { type: "string", description: "Amount of src to sell, denominated in its smallest unit (wei)." },
  },
  required: ["chainId", "src", "dst", "amount"],
};

const ONE_INCH_API_KEY = process.env.SKILL_1INCH_API_KEY;
const COINGECKO_DEMO_API_KEY = process.env.SKILL_COINGECKO_API_KEY;

export const SKILL_INVOCATIONS: Record<string, SkillInvocation> = {
  [CLAWDHQ_AGENT_SKILL_ID]: { kind: "clawdhq-agent", priceUsdc: "0" },

  "arc-contract-guard": {
    kind: "http",
    endpoint: "https://api.gopluslabs.io/api/v1/address_security/{contract_address}",
    method: "GET",
    priceUsdc: "0",
    inputSchema: ARC_CONTRACT_GUARD_INPUT_SCHEMA,
  },

  "arc-xero-swap": {
    kind: "http",
    endpoint: "https://api.coingecko.com/api/v3/simple/price",
    method: "GET",
    priceUsdc: "0",
    inputSchema: ARC_XERO_SWAP_INPUT_SCHEMA,
  },

  "arc-x402-dispatcher": {
    kind: "http",
    endpoint: "https://api.coingecko.com/api/v3/simple/price",
    method: "GET",
    priceUsdc: "0",
    inputSchema: ARC_X402_DISPATCHER_INPUT_SCHEMA,
  },

  goplus: {
    kind: "http",
    endpoint: "https://api.gopluslabs.io/api/v1/token_security/{chainId}",
    method: "GET",
    priceUsdc: "0.25",
    inputSchema: GOPLUS_TOKEN_SECURITY_INPUT_SCHEMA,
  },
  "goplus-agentguard": {
    kind: "http",
    endpoint: "https://api.gopluslabs.io/api/v1/address_security/{address}",
    method: "GET",
    priceUsdc: "0.50",
    inputSchema: GOPLUS_ADDRESS_SECURITY_INPUT_SCHEMA,
  },
  "coingecko-cli": {
    kind: "http",
    endpoint: "https://api.coingecko.com/api/v3/simple/price",
    method: "GET",
    priceUsdc: "0.25",
    inputSchema: COINGECKO_PRICE_INPUT_SCHEMA,
    headers: COINGECKO_DEMO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_DEMO_API_KEY } : undefined,
  },
  ...(ONE_INCH_API_KEY
    ? {
        "1inch": {
          kind: "http" as const,
          endpoint: "https://api.1inch.dev/swap/v6.0/{chainId}/quote",
          method: "GET" as const,
          priceUsdc: "0.50",
          inputSchema: ONE_INCH_QUOTE_INPUT_SCHEMA,
          headers: { Authorization: `Bearer ${ONE_INCH_API_KEY}` },
        },
      }
    : {}),

  ...loadOperatorRegistry(),
};

export function resolveSkillInvocation(skillId: string): SkillInvocation | null {
  return SKILL_INVOCATIONS[skillId] ?? null;
}

