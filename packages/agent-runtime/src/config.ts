import "./loadEnv.js";
import { isEvmPrismaChain, type EvmPrismaChain } from "@clawdhq/custody-core";

export interface RuntimeConfig {
  /** Which of ClawdHQCore's deployed EVM chains this agent lives on — same enum custody-core's
   * getSigningEvmAdapter/rpcUrlFor/contractAddressFor already key off, so the runtime reuses
   * whatever NEXT_PUBLIC_{CHAIN}_RPC_URL / _CONTRACT_ADDRESS an owner already has configured
   * for apps/web or apps/indexer, rather than inventing its own RPC/address env vars. */
  chain: EvmPrismaChain;
  /** The on-chain numeric agent id this instance works on behalf of. One runtime process per
   * agent — an owner running several agents runs several instances of this process. */
  agentChainId: bigint;
  /** Must be the private key of the address that *owns* this agent on-chain
   * (`agents[agentChainId].owner`) — that's what ClawdHQCore.sol's acceptJob/submitDeliverable
   * actually check, not any platform-custodied wallet. Never ClawdHQ's own AgentWallet key. */
  ownerPrivateKey: `0x${string}`;
  pollIntervalMs: number;
  /** Reject any job below this budget outright, before ever calling the decision policy —
   * the simplest possible default guard against working for free. Set to "0" to accept
   * everything the policy allows. */
  minBudgetUsdc: bigint;
  /** Base URL of the ClawdHQ web app whose /api/marketplace/task-descriptions cache this
   * instance reads from to recover a job's plaintext description from its on-chain taskHash. */
  taskDescriptionsBaseUrl: string;
  /** Where this process persists its scan cursor and in-flight job bookkeeping between
   * restarts (see state.ts) — deliberately a local file, not a database, so this package has
   * zero infrastructure dependency beyond the chain RPC and taskDescriptionsBaseUrl. */
  stateFilePath: string;
  a2aTimeoutMs: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see packages/agent-runtime/.env.example`);
  return value;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const chain = requireEnv("AGENT_CHAIN");
  if (!isEvmPrismaChain(chain)) {
    throw new Error(`AGENT_CHAIN="${chain}" isn't a recognized EVM chain — expected one of BSC_TESTNET/BASE_SEPOLIA/ETH_SEPOLIA/ARC_MAINNET/ARC_TESTNET/MONAD_TESTNET.`);
  }

  return {
    chain,
    agentChainId: BigInt(requireEnv("AGENT_CHAIN_ID")),
    ownerPrivateKey: requireEnv("OWNER_PRIVATE_KEY") as `0x${string}`,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
    minBudgetUsdc: BigInt(process.env.MIN_BUDGET_USDC_MICROS ?? "0"),
    taskDescriptionsBaseUrl: process.env.TASK_DESCRIPTIONS_BASE_URL ?? "http://localhost:3000",
    stateFilePath: process.env.STATE_FILE_PATH ?? "./agent-runtime-state.json",
    a2aTimeoutMs: Number(process.env.A2A_TIMEOUT_MS ?? 20_000),
  };
}
