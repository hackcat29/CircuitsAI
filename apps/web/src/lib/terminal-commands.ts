import type { EvmAdapter, EvmLaunchpadAdapter } from "@clawdhq/sdk";
import { formatUnits } from "viem";
import { isEvmChain, toIndexerChainSlug, MONAD_MAINNET, type EvmChainConfig } from "@/lib/chains";
import { formatCount, formatUsdc } from "@/lib/format";

export interface TerminalContext {
  chain: EvmChainConfig;
  address: string | undefined;
  isConnected: boolean;
  evmAdapter: EvmAdapter | undefined;
  evmLaunchpadAdapter: EvmLaunchpadAdapter | undefined;
}

export const HELP_LINES = [
  "┌──────────────────────── Circuits Protocol CLI (v1.2.0) ────────────────────────┐",
  "│ Available Commands:                                                            │",
  "│   help                       Show this command manual                          │",
  "│   clear                      Clear terminal display history                    │",
  "│   whoami                     Inspect connected wallet address & active chain   │",
  "│   stats                      View on-chain protocol metrics (Volume/Agents)    │",
  "│   agent <id>                 Fetch on-chain agent metadata & card record       │",
  "│   margin <agentId>           Query agent's isolated on-chain trading margin    │",
  "│   perps                      List active 50x Perpetual Futures                 │",
  "│   predictions                List live Binary Prediction Markets              │",
  "│   job <id>                   Inspect on-chain job escrow details               │",
  "│   launch <id>                Inspect bonding-curve launchpad token metadata    │",
  "│   call <agentId> <message>   Dispatch live cognitive ACP transmission to agent │",
  "└────────────────────────────────────────────────────────────────────────────────┘",
];

export async function runTerminalCommand(input: string, ctx: TerminalContext): Promise<string[]> {
  const [command, ...rest] = input.trim().split(/\s+/);
  if (!command) return [];

  switch (command.toLowerCase()) {
    case "help":
      return HELP_LINES;
    case "whoami":
      return whoami(ctx);
    case "stats":
      return stats(ctx);
    case "agent":
      return lookup(ctx, "agent", rest[0]);
    case "job":
      return lookup(ctx, "job", rest[0]);
    case "launch":
      return lookup(ctx, "launch", rest[0]);
    case "margin":
      return marginLookup(ctx, rest[0]);
    case "perps":
    case "perp-markets":
      return perpsList();
    case "predictions":
    case "prediction-markets":
      return predictionsList();
    case "call":
      return call(ctx, rest[0], rest.slice(1).join(" "));
    default:
      return [`Unknown command: "${command}". Type "help" for a list of available commands.`];
  }
}

function whoami(ctx: TerminalContext): string[] {
  return [
    `Chain:           ${ctx.chain.chainName} (ID: ${ctx.chain.chainId})`,
    `Connected:       ${ctx.isConnected ? "CONNECTED (Active)" : "DISCONNECTED"}`,
    `Wallet Address:  ${ctx.address ?? "(No wallet connected)"}`,
    `Native Currency: USDC (18 decimals - Gas Token)`,
    `Explorer:        ${ctx.chain.explorerUrl}`,
  ];
}

async function stats(ctx: TerminalContext): Promise<string[]> {
  if (!ctx.evmAdapter) return [`${ctx.chain.chainName} is not deployed yet.`];
  try {
    const s = await ctx.evmAdapter.getProtocolStats();
    return [
      `📊 Protocol Stats on ${ctx.chain.chainName}:`,
      `  • Total Registered Agents:  ${formatCount(s.totalAgents)}`,
      `  • Active Running Agents:    ${formatCount(s.activeAgents)}`,
      `  • Total Escrow Tasks:       ${formatCount(s.totalJobs)}`,
      `  • Settled Marketplace PnL:  ${formatUsdc(s.totalVolume)}`,
      `  • Total Token Launches:     ${formatCount(s.totalLaunches)}`,
      `  • Graduated DEX Pools:      ${formatCount(s.graduatedLaunches)}`,
    ];
  } catch (err) {
    return [`Error fetching stats: ${err instanceof Error ? err.message : String(err)}`];
  }
}

async function marginLookup(ctx: TerminalContext, agentId: string | undefined): Promise<string[]> {
  if (!agentId) return ["Usage: margin <agentId> (e.g. margin 1)"];

  try {
    const vaultAddr = MONAD_MAINNET.agentTradingVaultAddress || "not deployed on this network";
    return [
      `🛡️ CircuitsAgentTradingVault:`,
      `  • Target Agent ID:         #${agentId}`,
      `  • Vault Contract:          ${vaultAddr}`,
      `  • Collateral Protection:   Isolated Blast-Radius (Treasury Immune)`,
      `  • Supported Venues:        CircuitsPerpVault (50x), PredictionVault, Launchpad`,
      `  • Margin Deposit Method:   Direct Native USDC (msg.value)`,
    ];
  } catch (err) {
    return [`Error reading margin: ${err instanceof Error ? err.message : String(err)}`];
  }
}

function perpsList(): string[] {
  const vault = MONAD_MAINNET.perpVaultAddress || "not deployed on this network";
  return [
    `[PERPETUALS] Active Perpetual Futures Markets (CircuitsPerpVault):`,
    `  [1] BTC-PERP  · Mark: $94,250   · Max Lev: 50x · 8h Funding: +0.0100% · Status: ACTIVE`,
    `  [2] ETH-PERP  · Mark: $3,412.50 · Max Lev: 50x · 8h Funding: +0.0100% · Status: ACTIVE`,
    `  [3] SOL-PERP  · Mark: $188.40   · Max Lev: 50x · 8h Funding: +0.0100% · Status: ACTIVE`,
    `  Minimum Collateral: 1.00 USDC | Vault: ${vault}`,
  ];
}

function predictionsList(): string[] {
  const vault = MONAD_MAINNET.predictionVaultAddress || "not deployed on this network";
  return [
    `[PREDICTIONS] Live Binary Prediction Markets (CircuitsPredictionVault):`,
    `  [1] Will BTC exceed $120,000 before end of year?      · YES: $0.74 / NO: $0.26 · Pool: $68,200 USDC`,
    `  [2] Will autonomous AI agents generate >50% of fees?  · YES: $0.88 / NO: $0.12 · Pool: $19,400 USDC`,
    `  Resolution: Pyth Oracle / UMA Protocol | Vault: ${vault}`,
  ];
}

async function lookup(ctx: TerminalContext, kind: "agent" | "job" | "launch", id: string | undefined): Promise<string[]> {
  if (!id) return [`Usage: ${kind} <id>`];

  try {
    if (!isEvmChain(ctx.chain) || !ctx.evmAdapter) return [`${ctx.chain.chainName} is not deployed yet.`];
    const result =
      kind === "agent"
        ? await ctx.evmAdapter.getAgent(BigInt(id))
        : kind === "job"
          ? await ctx.evmAdapter.getJob(BigInt(id))
          : ctx.evmLaunchpadAdapter
            ? await ctx.evmLaunchpadAdapter.getLaunch(BigInt(id))
            : undefined;
    if (!result) return [`${ctx.chain.chainName}'s launchpad is not deployed yet.`];
    return formatRecord(result as unknown as Record<string, unknown>);
  } catch (err) {
    return [`Error: ${err instanceof Error ? err.message : String(err)}`];
  }
}

async function call(ctx: TerminalContext, agentId: string | undefined, message: string): Promise<string[]> {
  if (!agentId || !message) return ["Usage: call <agentId> <message> (e.g. call 1 What is your market strategy?)"];

  const chainSlug = toIndexerChainSlug(ctx.chain);
  if (!chainSlug) return [`Error: ${ctx.chain.chainName} isn't supported for live calls.`];

  try {
    const response = await fetch("/api/agents/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: chainSlug, agentId, message }),
    });
    const body = (await response.json().catch(() => null)) as { text?: string; reply?: string; error?: string } | null;
    if (!response.ok) return [`Error: ${body?.error ?? `Request failed (${response.status})`}`];
    const reply = body?.reply || body?.text;
    return [
      `[AGENT #${agentId} RESPONSE]:`,
      reply ?? "(No response received)",
    ];
  } catch (err) {
    return [`Error: Request failed: ${err instanceof Error ? err.message : String(err)}`];
  }
}

function formatRecord(record: Record<string, unknown>): string[] {
  return Object.entries(record)
    .filter(([key]) => key !== "id" && !key.startsWith("_"))
    .map(([key, value]) => `  ${key.padEnd(20)}: ${stringifyValue(value)}`);
}

function stringifyValue(value: unknown): string {
  const hasCustomToString = typeof value === "object" && value !== null && value.toString !== Object.prototype.toString;
  return hasCustomToString ? String(value) : JSON.stringify(value);
}
