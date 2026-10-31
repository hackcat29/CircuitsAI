import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: z.url(),
  NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL: z.url(),

  NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS: z.string(),
  NEXT_PUBLIC_ETH_SEPOLIA_CONTRACT_ADDRESS: z.string(),

  // Agent ownership exchange (separate contract from the job-marketplace contract above).
  NEXT_PUBLIC_BASE_SEPOLIA_EXCHANGE_ADDRESS: z.string(),
  NEXT_PUBLIC_ETH_SEPOLIA_EXCHANGE_ADDRESS: z.string(),

  // Bonding-curve launchpad (separate contract from the job-marketplace contract above —
  // split out because ClawdHQCore has no bytecode headroom left).
  NEXT_PUBLIC_BASE_SEPOLIA_LAUNCHPAD_ADDRESS: z.string(),
  NEXT_PUBLIC_ETH_SEPOLIA_LAUNCHPAD_ADDRESS: z.string(),

  NEXT_PUBLIC_BASE_SEPOLIA_USDC_ADDRESS: z.string(),
  NEXT_PUBLIC_ETH_SEPOLIA_USDC_ADDRESS: z.string(),

  // Agent reliability bonds (separate contract). Genuinely optional, unlike Exchange/Launchpad
  // above: staking is a brand-new, opt-in feature (ClawdHQCore.stakingContract defaults to
  // address(0), meaning "off") — an unset address here just means the app runs without it,
  // not a broken deployment.
  NEXT_PUBLIC_BASE_SEPOLIA_STAKING_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_STAKING_ADDRESS: z.string().optional().default(""),

  // Permissionless staked evaluator marketplace (separate contract). Same "genuinely optional"
  // shape as staking above — ClawdHQCore.evaluatorPoolContract defaults to address(0).
  NEXT_PUBLIC_BASE_SEPOLIA_EVALUATOR_POOL_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_EVALUATOR_POOL_ADDRESS: z.string().optional().default(""),

  // On-chain Client/Provider negotiation (separate contract). Same "genuinely optional" shape.
  NEXT_PUBLIC_BASE_SEPOLIA_NEGOTIATION_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_NEGOTIATION_ADDRESS: z.string().optional().default(""),

  // Cross-chain agent identity over Circle CCTP (separate contract, a different deployment per
  // chain). Same "genuinely optional" shape as staking/evaluator-pool/negotiation above.
  NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS: z.string().optional().default(""),

  // On-chain protocol governance (separate contract). Same "genuinely optional" shape as
  // staking/evaluator-pool/negotiation above — ClawdHQGovernor is a standalone UUPS proxy with
  // no Core-side toggle to gate on.
  NEXT_PUBLIC_BASE_SEPOLIA_GOVERNOR_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_GOVERNOR_ADDRESS: z.string().optional().default(""),

  // Uniswap / Xero Protocol — Uniswap v4 Hooks is the official graduation DEX on Monad mainnet. Under the
  // hood, Xero Protocol (our Uniswap V2 fork) is used on testnet until Uniswap deploys and publishes
  // official contract addresses on Monad. Same "genuinely optional" shape as staking/evaluator-pool above.
  NEXT_PUBLIC_BASE_SEPOLIA_XERO_FACTORY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_XERO_FACTORY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BASE_SEPOLIA_XERO_ROUTER_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_XERO_ROUTER_ADDRESS: z.string().optional().default(""),

  // Circle's TokenMessengerV2 — same canonical address on every CCTP v2 testnet chain, not a
  // ClawdHQ contract. Needed client-side so the Wallet page's CCTP self-bridge (useCctpSelfBridge)
  // can call `depositForBurn` directly via the signed-in owner's Circle wallet.
  NEXT_PUBLIC_BASE_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_ETH_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS: z.string().optional().default(""),

  // Circle's public (unauthenticated) CCTP v2 attestation service — safe to expose client-side,
  // same URL the indexer's relayer already calls server-side (see apps/indexer/src/config.ts's
  // bare CIRCLE_IRIS_API_URL). Read directly by the Wallet page's bridge-status polling.
  NEXT_PUBLIC_CIRCLE_IRIS_API_URL: z.string().optional().default(""),

  NEXT_PUBLIC_PINATA_GATEWAY_URL: z.url(),

  // Circle User-Controlled Wallets + Google Social Login — genuinely optional (unlike every
  // field above): the feature just renders as "not configured" until these are set, rather than
  // the whole app failing to boot. See .env.example's Circle section for full setup steps.
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_CIRCLE_APP_ID: z.string().optional().default(""),

  // Mirrors of the bare, server-only TREASURY_ADDRESS/*_LISTING_FEE_USDC vars — publishing a
  // skill or listing an x402 service both send a direct USDC transfer client-side (see
  // listingFeeVerify.ts's server-side counterpart), so the browser needs to know where to send
  // it and how much. Optional: an unset fee amount just means that listing type is free (same
  // "0/unset means free" convention as the on-chain registrationFee/launchFee).
  NEXT_PUBLIC_TREASURY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_SKILL_LISTING_FEE_USDC: z.string().optional().default(""),
  NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC: z.string().optional().default(""),

  // Circuits Protocol native Degen Vaults (Prediction Markets & Perpetuals & Agent Trading Vault)

  // BSC Testnet (Track A Binance Agent OS Mini Hackathon)
  NEXT_PUBLIC_BSC_TESTNET_RPC_URL: z.string().optional().default("https://bsc-testnet-rpc.publicnode.com"),
  NEXT_PUBLIC_BSC_TESTNET_CONTRACT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_EXCHANGE_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_LAUNCHPAD_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_STAKING_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_EVALUATOR_POOL_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_NEGOTIATION_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_CROSS_CHAIN_IDENTITY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_GOVERNOR_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_XERO_FACTORY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_XERO_ROUTER_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_PREDICTION_VAULT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_PERP_VAULT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_BSC_TESTNET_AGENT_TRADING_VAULT_ADDRESS: z.string().optional().default(""),



  // Monad Mainnet (Chain ID 143)
  NEXT_PUBLIC_MONAD_MAINNET_RPC_URL: z.string().optional().default("https://rpc.monad.xyz"),
  NEXT_PUBLIC_MONAD_MAINNET_CONTRACT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_EXCHANGE_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_LAUNCHPAD_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_USDC_ADDRESS: z.string().optional().default("0x754704Bc059F8C67012fEd69BC8A327a5aafb603"),
  NEXT_PUBLIC_MONAD_MAINNET_STAKING_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_EVALUATOR_POOL_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_NEGOTIATION_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_CROSS_CHAIN_IDENTITY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_GOVERNOR_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_XERO_FACTORY_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_XERO_ROUTER_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_X402_FACILITATOR_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_PREDICTION_VAULT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_PERP_VAULT_ADDRESS: z.string().optional().default(""),
  NEXT_PUBLIC_MONAD_MAINNET_AGENT_TRADING_VAULT_ADDRESS: z.string().optional().default(""),
});

export type ClientEnv = z.infer<typeof envSchema>;

function readClientEnv(): ClientEnv {
  const raw = {
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS ?? "",
    NEXT_PUBLIC_ETH_SEPOLIA_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_CONTRACT_ADDRESS ?? "",
    NEXT_PUBLIC_BASE_SEPOLIA_EXCHANGE_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXCHANGE_ADDRESS ?? "",
    NEXT_PUBLIC_ETH_SEPOLIA_EXCHANGE_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_EXCHANGE_ADDRESS ?? "",
    NEXT_PUBLIC_BASE_SEPOLIA_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LAUNCHPAD_ADDRESS ?? "",
    NEXT_PUBLIC_ETH_SEPOLIA_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_LAUNCHPAD_ADDRESS ?? "",
    NEXT_PUBLIC_BASE_SEPOLIA_USDC_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDC_ADDRESS ?? "",
    NEXT_PUBLIC_ETH_SEPOLIA_USDC_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_USDC_ADDRESS ?? "",
    NEXT_PUBLIC_BASE_SEPOLIA_STAKING_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_STAKING_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_STAKING_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_STAKING_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_EVALUATOR_POOL_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_EVALUATOR_POOL_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_EVALUATOR_POOL_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_EVALUATOR_POOL_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_NEGOTIATION_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_NEGOTIATION_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_NEGOTIATION_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_NEGOTIATION_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_GOVERNOR_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_GOVERNOR_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_GOVERNOR_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_GOVERNOR_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_XERO_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_XERO_FACTORY_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_XERO_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_XERO_FACTORY_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_XERO_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_XERO_ROUTER_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_XERO_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_XERO_ROUTER_ADDRESS,
    NEXT_PUBLIC_BASE_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS,
    NEXT_PUBLIC_ETH_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS,
    NEXT_PUBLIC_CIRCLE_IRIS_API_URL: process.env.NEXT_PUBLIC_CIRCLE_IRIS_API_URL,
    NEXT_PUBLIC_PINATA_GATEWAY_URL: process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_CIRCLE_APP_ID: process.env.NEXT_PUBLIC_CIRCLE_APP_ID,
    NEXT_PUBLIC_TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    NEXT_PUBLIC_SKILL_LISTING_FEE_USDC: process.env.NEXT_PUBLIC_SKILL_LISTING_FEE_USDC,
    NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC: process.env.NEXT_PUBLIC_SERVICE_LISTING_FEE_USDC,
    NEXT_PUBLIC_BSC_TESTNET_RPC_URL: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
    NEXT_PUBLIC_BSC_TESTNET_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_CONTRACT_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_EXCHANGE_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_EXCHANGE_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_LAUNCHPAD_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_STAKING_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_STAKING_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_EVALUATOR_POOL_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_EVALUATOR_POOL_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_NEGOTIATION_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_NEGOTIATION_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_CROSS_CHAIN_IDENTITY_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_CROSS_CHAIN_IDENTITY_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_GOVERNOR_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_GOVERNOR_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_XERO_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_XERO_FACTORY_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_XERO_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_XERO_ROUTER_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_PREDICTION_VAULT_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_PREDICTION_VAULT_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_PERP_VAULT_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_PERP_VAULT_ADDRESS,
    NEXT_PUBLIC_BSC_TESTNET_AGENT_TRADING_VAULT_ADDRESS: process.env.NEXT_PUBLIC_BSC_TESTNET_AGENT_TRADING_VAULT_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL ?? "https://rpc.monad.xyz",
    NEXT_PUBLIC_MONAD_MAINNET_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_CONTRACT_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_EXCHANGE_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_EXCHANGE_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_LAUNCHPAD_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_LAUNCHPAD_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_USDC_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_USDC_ADDRESS ?? "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    NEXT_PUBLIC_MONAD_MAINNET_STAKING_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_STAKING_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_EVALUATOR_POOL_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_EVALUATOR_POOL_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_NEGOTIATION_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_NEGOTIATION_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_CROSS_CHAIN_IDENTITY_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_CROSS_CHAIN_IDENTITY_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_GOVERNOR_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_GOVERNOR_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_XERO_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_XERO_FACTORY_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_XERO_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_XERO_ROUTER_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_X402_FACILITATOR_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_X402_FACILITATOR_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_PREDICTION_VAULT_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_PREDICTION_VAULT_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_PERP_VAULT_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_PERP_VAULT_ADDRESS,
    NEXT_PUBLIC_MONAD_MAINNET_AGENT_TRADING_VAULT_ADDRESS: process.env.NEXT_PUBLIC_MONAD_MAINNET_AGENT_TRADING_VAULT_ADDRESS,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid or missing environment variables:\n${issues}\n\nCopy .env.example to .env and fill in the required values.`);
  }
  return parsed.data;
}

export const env = readClientEnv();
