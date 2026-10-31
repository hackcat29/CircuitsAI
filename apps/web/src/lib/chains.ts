import { baseSepolia, sepolia, bscTestnet, monad, type Chain } from "viem/chains";
import { env } from "./env";

export type ChainFamily = "evm";

export type EvmChainId = 84532 | 11155111 | 97 | 143;
export type ChainId = EvmChainId;

interface BaseChainMeta {
  chainId: ChainId;
  chainFamily: ChainFamily;
  chainName: string;
  shortName?: string;
  logo: string;
  color: string;
  explorerUrl: string;
  usdcAddress: string;
  contractAddress: string;
}

export interface EvmChainConfig extends BaseChainMeta {
  chainFamily: "evm";
  chainId: EvmChainId;
  viemChain: Chain;
  /** ClawdHQAgentExchange — the agent ownership marketplace, a separate contract from
   * `contractAddress` (ClawdHQCore, the agent registry/job-marketplace contract). */
  exchangeAddress: string;
  /** ClawdHQLaunchpad — the bonding-curve token launchpad, also a separate contract from
   * `contractAddress` (split out because Core has no bytecode headroom left). */
  launchpadAddress: string;
  /** ClawdHQStaking — agent reliability bonds, also a separate contract. Empty string until
   * deployed and configured — genuinely optional, unlike exchangeAddress/launchpadAddress
   * (see env.ts's doc comment on this var). */
  stakingAddress: string;
  /** ClawdHQEvaluatorPool — the permissionless staked evaluator marketplace, also a separate
   * contract. Same "genuinely optional" shape as stakingAddress. */
  evaluatorPoolAddress: string;
  /** ClawdHQNegotiation — fully on-chain Client/Provider offer/counter/accept, also a separate
   * contract. Same "genuinely optional" shape as stakingAddress. */
  negotiationAddress: string;
  /** ClawdHQCrossChainIdentity — links this chain's agents to the same conceptual agent on the
   * other CCTP chains, over Circle CCTP. Unlike every other address above, this is a genuinely
   * *different* deployment per chain (its own proxy, own storage), not one shared contract.
   * Same "genuinely optional" shape as stakingAddress otherwise. */
  crossChainIdentityAddress: string;
  /** ClawdHQGovernor — on-chain protocol governance, also a separate contract. Same "genuinely
   * optional" shape as stakingAddress. */
  governorAddress: string;
  /** Sushi V3 / Uniswap V2 / Xero Factory — Uniswap v4 Hooks is the official graduation DEX on Monad mainnet;
   * on testnets, Xero Protocol is wired under the hood. {ClawdHQLaunchpad-graduateLaunch} migrates
   * liquidity into this factory/router/position manager. */
  xeroFactoryAddress: string;
  /** Uniswap V2 / Xero Router — the address actually wired into
   * ClawdHQLaunchpad.uniswapV2Router, and what apps/web trades a graduated token against. */
  xeroRouterAddress: string;
  /** Sushi V3 Position Manager for concentrated liquidity graduation */
  sushiV3PositionManager?: string;
  /** Sushi V3 fee tier (e.g. 3000 for 0.30%) */
  sushiV3Fee?: number;
  /** CircuitsPredictionVault — on-chain binary prediction markets with USDC collateral & UMA/Pyth resolution on Monad. */
  predictionVaultAddress?: string;
  /** CircuitsPerpVault — on-chain perpetual futures vault supporting 50x leverage and continuous 8h funding rates on Monad. */
  perpVaultAddress?: string;
  /** CircuitsAgentTradingVault — on-chain isolated margin & collateral vault per agent on Monad. */
  agentTradingVaultAddress?: string;
  /** X402Facilitator — HTTP 402 micro-payment facilitator for autonomous AI agent rails. */
  x402FacilitatorAddress?: string;
  /** This chain's Circle CCTP V2 domain id (e.g. Base Sepolia=6, Eth Sepolia=0)
   * — needed client-side only for display/lookup (e.g. "which chain does domain 6 mean") when
   * reading a ClawdHQCrossChainIdentity contract's `peerContractByDomain`. Not secret, not an
   * address — a public protocol constant, safe to hardcode per chain. */
  cctpDomain: number;
  /** Circle's TokenMessengerV2 — same canonical address on every CCTP v2 testnet chain, not a
   * ClawdHQ contract. Needed client-side for the Wallet page's CCTP self-bridge
   * (useCctpSelfBridge), which calls `depositForBurn` on it directly via the signed-in owner's
   * Circle wallet. Empty string if not configured — the bridge UI just hides that chain as a
   * source option, same "genuinely optional" shape as stakingAddress. */
  cctpTokenMessengerAddress: string;
  /** Same RPC URL wagmi.ts's transports map already uses — duplicated here so
   * useCircleWalletClient.ts can build a plain viem WalletClient without needing a wagmi
   * connection (Circle signs; wagmi's own useWalletClient requires a connected wallet, which
   * this app no longer has). */
  rpcUrl: string;
  /** Circle's own blockchain identifier for this chain (e.g. "MONAD") — a Social Login
   * user gets one wallet *per chain* here (see packages/circle/socialWallets.ts's
   * SOCIAL_LOGIN_BLOCKCHAINS), each with its own Circle walletId even though the underlying EOA
   * address is identical across all of them. */
  circleBlockchain?: string;
}

export const BASE_SEPOLIA: EvmChainConfig = {
  chainId: 84532,
  chainFamily: "evm",
  chainName: "Base Sepolia",
  shortName: "Base",
  logo: "/chains/base.svg",
  color: "#0052FF",
  explorerUrl: "https://sepolia.basescan.org",
  usdcAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_USDC_ADDRESS,
  contractAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_CONTRACT_ADDRESS,
  exchangeAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_EXCHANGE_ADDRESS,
  launchpadAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_LAUNCHPAD_ADDRESS,
  stakingAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_STAKING_ADDRESS,
  evaluatorPoolAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_EVALUATOR_POOL_ADDRESS,
  negotiationAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_NEGOTIATION_ADDRESS,
  crossChainIdentityAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS,
  governorAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_GOVERNOR_ADDRESS,
  xeroFactoryAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_XERO_FACTORY_ADDRESS,
  xeroRouterAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_XERO_ROUTER_ADDRESS,
  cctpDomain: 6,
  cctpTokenMessengerAddress: env.NEXT_PUBLIC_BASE_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS,
  rpcUrl: env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  viemChain: baseSepolia,
  circleBlockchain: "BASE-SEPOLIA",
};

export const ETH_SEPOLIA: EvmChainConfig = {
  chainId: 11155111,
  chainFamily: "evm",
  chainName: "Ethereum Sepolia",
  shortName: "Sepolia",
  logo: "/chains/eth.svg",
  color: "#627EEA",
  explorerUrl: "https://sepolia.etherscan.io",
  usdcAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_USDC_ADDRESS,
  contractAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_CONTRACT_ADDRESS,
  exchangeAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_EXCHANGE_ADDRESS,
  launchpadAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_LAUNCHPAD_ADDRESS,
  stakingAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_STAKING_ADDRESS,
  evaluatorPoolAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_EVALUATOR_POOL_ADDRESS,
  negotiationAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_NEGOTIATION_ADDRESS,
  crossChainIdentityAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_CROSS_CHAIN_IDENTITY_ADDRESS,
  governorAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_GOVERNOR_ADDRESS,
  xeroFactoryAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_XERO_FACTORY_ADDRESS,
  xeroRouterAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_XERO_ROUTER_ADDRESS,
  cctpDomain: 0,
  cctpTokenMessengerAddress: env.NEXT_PUBLIC_ETH_SEPOLIA_CCTP_TOKEN_MESSENGER_ADDRESS,
  rpcUrl: env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
  viemChain: sepolia,
  circleBlockchain: "ETH-SEPOLIA",
};

/** BSC Testnet — Binance Smart Chain Testnet (Track A Binance Agent OS Mini Hackathon). */
export const BSC_TESTNET: EvmChainConfig = {
  chainId: 97,
  chainFamily: "evm",
  chainName: "BNB Chain",
  shortName: "BNB",
  logo: "/chains/bsc.svg",
  color: "#F3BA2F",
  explorerUrl: "https://testnet.bscscan.com",
  usdcAddress: env.NEXT_PUBLIC_BSC_TESTNET_USDC_ADDRESS || "0xE17a676753e9fC58101F6cb8050309c73238a30e",
  contractAddress: env.NEXT_PUBLIC_BSC_TESTNET_CONTRACT_ADDRESS || "0xcCd275856C12FB6dd862A7Af4Be20Ca41D5758E4",
  exchangeAddress: env.NEXT_PUBLIC_BSC_TESTNET_EXCHANGE_ADDRESS || "0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc",
  launchpadAddress: env.NEXT_PUBLIC_BSC_TESTNET_LAUNCHPAD_ADDRESS || "0xfc4C43191f5336374A7Be184eE68ac818148A4ca",
  stakingAddress: env.NEXT_PUBLIC_BSC_TESTNET_STAKING_ADDRESS || "0xf42B887C8595D50B66F05310b74A65283FA7796d",
  evaluatorPoolAddress: env.NEXT_PUBLIC_BSC_TESTNET_EVALUATOR_POOL_ADDRESS || "0x075a5E7bBDEE2781974CcA05abaF702C098074bc",
  negotiationAddress: env.NEXT_PUBLIC_BSC_TESTNET_NEGOTIATION_ADDRESS || "0x87e8A76d130Dc322F5198F80914651FcD018c74c",
  crossChainIdentityAddress: env.NEXT_PUBLIC_BSC_TESTNET_CROSS_CHAIN_IDENTITY_ADDRESS || "",
  governorAddress: env.NEXT_PUBLIC_BSC_TESTNET_GOVERNOR_ADDRESS || "0x046616658E5b71Ae2C43C8659B544ACb378d1A30",
  xeroFactoryAddress: env.NEXT_PUBLIC_BSC_TESTNET_XERO_FACTORY_ADDRESS || "0xD0cd71F38503fba92ba1484114d82CC6B08dE891",
  xeroRouterAddress: env.NEXT_PUBLIC_BSC_TESTNET_XERO_ROUTER_ADDRESS || "0x4F7b10d274F9Ba58739A57E9EdB520Aa0a5d6747",
  predictionVaultAddress: env.NEXT_PUBLIC_BSC_TESTNET_PREDICTION_VAULT_ADDRESS || "0xeFa1Cd0293c88dd3e264Ab7FF72865434f18f98f",
  perpVaultAddress: env.NEXT_PUBLIC_BSC_TESTNET_PERP_VAULT_ADDRESS || "0xa3D8c5e6a8Fe5169DD25304fFC64DcEDB271026E",
  agentTradingVaultAddress: env.NEXT_PUBLIC_BSC_TESTNET_AGENT_TRADING_VAULT_ADDRESS || "0x01052Ed474A628F652Da1fC017CCFFa3a1b3CE80",
  cctpDomain: 999,
  cctpTokenMessengerAddress: "",
  rpcUrl: env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
  viemChain: bscTestnet,
  circleBlockchain: "BNB-TESTNET",
};

/** Monad Mainnet — 10,000 TPS parallel EVM Layer 1 with sub-second finality. */
export const MONAD_MAINNET: EvmChainConfig = {
  chainId: 143,
  chainFamily: "evm",
  chainName: "Monad",
  shortName: "Monad",
  logo: "/chains/monad.svg",
  color: "#836EF9",
  explorerUrl: "https://monadscan.com",
  usdcAddress: env.NEXT_PUBLIC_MONAD_MAINNET_USDC_ADDRESS || "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  contractAddress: env.NEXT_PUBLIC_MONAD_MAINNET_CONTRACT_ADDRESS,
  exchangeAddress: env.NEXT_PUBLIC_MONAD_MAINNET_EXCHANGE_ADDRESS,
  launchpadAddress: env.NEXT_PUBLIC_MONAD_MAINNET_LAUNCHPAD_ADDRESS,
  stakingAddress: env.NEXT_PUBLIC_MONAD_MAINNET_STAKING_ADDRESS,
  evaluatorPoolAddress: env.NEXT_PUBLIC_MONAD_MAINNET_EVALUATOR_POOL_ADDRESS,
  negotiationAddress: env.NEXT_PUBLIC_MONAD_MAINNET_NEGOTIATION_ADDRESS,
  crossChainIdentityAddress: env.NEXT_PUBLIC_MONAD_MAINNET_CROSS_CHAIN_IDENTITY_ADDRESS,
  governorAddress: env.NEXT_PUBLIC_MONAD_MAINNET_GOVERNOR_ADDRESS,
  xeroFactoryAddress: env.NEXT_PUBLIC_MONAD_MAINNET_XERO_FACTORY_ADDRESS,
  xeroRouterAddress: env.NEXT_PUBLIC_MONAD_MAINNET_XERO_ROUTER_ADDRESS,
  x402FacilitatorAddress: env.NEXT_PUBLIC_MONAD_MAINNET_X402_FACILITATOR_ADDRESS,
  predictionVaultAddress: env.NEXT_PUBLIC_MONAD_MAINNET_PREDICTION_VAULT_ADDRESS,
  perpVaultAddress: env.NEXT_PUBLIC_MONAD_MAINNET_PERP_VAULT_ADDRESS,
  agentTradingVaultAddress: env.NEXT_PUBLIC_MONAD_MAINNET_AGENT_TRADING_VAULT_ADDRESS,
  cctpDomain: 9998,
  cctpTokenMessengerAddress: "",
  rpcUrl: env.NEXT_PUBLIC_MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
  viemChain: monad,
  circleBlockchain: "MONAD",
};

export const ALL_CHAINS: EvmChainConfig[] = [MONAD_MAINNET, BSC_TESTNET, BASE_SEPOLIA, ETH_SEPOLIA];

export const EVM_CHAINS: EvmChainConfig[] = [MONAD_MAINNET, BSC_TESTNET, BASE_SEPOLIA, ETH_SEPOLIA];

/** Chains offered in the UI: only Monad Mainnet is selectable in the app. */
export const SELECTABLE_CHAINS: EvmChainConfig[] = [MONAD_MAINNET];

export function getChainById(chainId: ChainId): EvmChainConfig | undefined {
  return ALL_CHAINS.find((c) => c.chainId === chainId);
}

export function isEvmChain(chain: EvmChainConfig): chain is EvmChainConfig {
  return chain.chainFamily === "evm";
}

/** Matches @clawdhq/marketplace-db's `Chain` enum values exactly. */
export type IndexerChainSlug = "BASE_SEPOLIA" | "ETH_SEPOLIA" | "BSC_TESTNET" | "MONAD_MAINNET";

const INDEXER_CHAIN_SLUG_BY_CHAIN_ID: Record<string, IndexerChainSlug> = {
  "97": "BSC_TESTNET",
  "84532": "BASE_SEPOLIA",
  "11155111": "ETH_SEPOLIA",
  "143": "MONAD_MAINNET",
};

export function toIndexerChainSlug(chain: EvmChainConfig): IndexerChainSlug {
  return INDEXER_CHAIN_SLUG_BY_CHAIN_ID[String(chain.chainId)];
}

export function fromIndexerChainSlug(slug: string): EvmChainConfig | undefined {
  return ALL_CHAINS.find((chain) => toIndexerChainSlug(chain) === slug);
}
