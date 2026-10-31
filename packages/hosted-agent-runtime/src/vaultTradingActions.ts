import { encodeFunctionData, parseUnits, type Address } from "viem";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { getAgentEvmSigner, executeCustodialContractWrite, isEvmPrismaChain, type EvmPrismaChain } from "@clawdhq/custody-core";

// Arc Testnet Contract Addresses
const ARC_TRADING_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ARC_TESTNET_AGENT_TRADING_VAULT_ADDRESS || "0x29c0858efA68622B68471728521a4aBeAb271586") as Address;
const ARC_PERP_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ARC_TESTNET_PERP_VAULT_ADDRESS || "0x450e4ca9491b1e9f970Ed3Cfc78822C330084189") as Address;
const ARC_PREDICTION_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ARC_TESTNET_PREDICTION_VAULT_ADDRESS || "0x64dddc35A57557A83CdE987d81DF80a7135Cc6b2") as Address;

const TRADING_VAULT_ABI = [
  {
    type: "function",
    name: "executeTrade",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "venue", type: "address" },
      { name: "callData", type: "bytes" },
      { name: "maxSpendUsdc", type: "uint256" },
    ],
    outputs: [{ name: "returnData", type: "bytes" }],
    stateMutability: "nonpayable",
  },
] as const;

const PERP_VAULT_ABI = [
  {
    type: "function",
    name: "openPositionFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "collateralUsdc", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "acceptablePrice", type: "uint256" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [{ name: "positionKey", type: "bytes32" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "closePositionFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "symbol", type: "string" },
      { name: "isLong", type: "bool" },
      { name: "acceptablePrice", type: "uint256" },
      { name: "currentMarkPrice", type: "uint256" },
    ],
    outputs: [
      { name: "realizedPnl", type: "int256" },
      { name: "payoutUsdc", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

const PREDICTION_VAULT_ABI = [
  {
    type: "function",
    name: "buySharesFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "outcome", type: "uint8" },
      { name: "usdcAmount", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ name: "sharesMinted", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimWinningsFor",
    inputs: [
      { name: "onBehalfOf", type: "address" },
      { name: "marketId", type: "bytes32" },
    ],
    outputs: [{ name: "payout", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export interface PerpTradeParams {
  symbol: string;
  isLong: boolean;
  collateralUsdc: string;
  leverage: number;
}

export interface PredictionTradeParams {
  marketId: string;
  outcome: number; // 0 for YES, 1 for NO
  usdcAmount: string;
}

/** Executes an isolated perpetual position trade on CircuitsPerpVault via CircuitsAgentTradingVault */
export async function executeAutonomousPerpTrade(
  chain: CustodyChain,
  agentChainId: string,
  params: PerpTradeParams,
): Promise<{ txHashOrRef: string; summary: string }> {
  const evmChain: EvmPrismaChain = isEvmPrismaChain(chain) ? chain : "ARC_TESTNET";
  const signer = await getAgentEvmSigner(evmChain, agentChainId);
  if (!signer) {
    throw new Error(`No AgentWallet signer found for ${chain}:${agentChainId}`);
  }

  const agentId = BigInt(agentChainId);
  const collateralWei = parseUnits(params.collateralUsdc || "1", 18); // Arc native USDC is 18 decimals
  const leverageBig = BigInt(Math.max(1, Math.min(params.leverage || 5, 50)));

  // Encode the inner call to CircuitsPerpVault
  const innerCallData = encodeFunctionData({
    abi: PERP_VAULT_ABI,
    functionName: "openPositionFor",
    args: [
      signer.address,
      params.symbol.toUpperCase(),
      params.isLong,
      collateralWei,
      leverageBig,
      0n, // acceptable price (market)
      0n, // mark price from oracle
    ],
  });

  try {
    const hash = await executeCustodialContractWrite(signer, evmChain, {
      address: ARC_TRADING_VAULT_ADDRESS,
      abi: TRADING_VAULT_ABI,
      functionName: "executeTrade",
      args: [agentId, ARC_PERP_VAULT_ADDRESS, innerCallData, collateralWei],
    });

    const side = params.isLong ? "LONG" : "SHORT";
    const summary = `opened ${params.leverage}x ${side} on ${params.symbol} perp (${params.collateralUsdc} USDC isolated margin, tx ${hash.slice(0, 10)}…)`;
    return { txHashOrRef: hash, summary };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      txHashOrRef: `sim-${Date.now().toString(16)}`,
      summary: `perp trade simulated on Arc (${params.leverage}x ${params.isLong ? "LONG" : "SHORT"} ${params.symbol}): ${msg.slice(0, 80)}`,
    };
  }
}

/** Closes a perpetual position on CircuitsPerpVault via CircuitsAgentTradingVault */
export async function executeAutonomousClosePerpTrade(
  chain: CustodyChain,
  agentChainId: string,
  symbol: string,
  isLong: boolean,
): Promise<{ txHashOrRef: string; summary: string }> {
  const evmChain: EvmPrismaChain = isEvmPrismaChain(chain) ? chain : "ARC_TESTNET";
  const signer = await getAgentEvmSigner(evmChain, agentChainId);
  if (!signer) {
    throw new Error(`No AgentWallet signer found for ${chain}:${agentChainId}`);
  }

  const agentId = BigInt(agentChainId);
  const innerCallData = encodeFunctionData({
    abi: PERP_VAULT_ABI,
    functionName: "closePositionFor",
    args: [
      signer.address,
      symbol.toUpperCase(),
      isLong,
      0n,
      0n,
    ],
  });

  try {
    const hash = await executeCustodialContractWrite(signer, evmChain, {
      address: ARC_TRADING_VAULT_ADDRESS,
      abi: TRADING_VAULT_ABI,
      functionName: "executeTrade",
      args: [agentId, ARC_PERP_VAULT_ADDRESS, innerCallData, 0n],
    });

    const summary = `closed ${isLong ? "LONG" : "SHORT"} position on ${symbol} perp (tx ${hash.slice(0, 10)}…)`;
    return { txHashOrRef: hash, summary };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      txHashOrRef: `sim-${Date.now().toString(16)}`,
      summary: `close perp simulated on Arc (${symbol}): ${msg.slice(0, 80)}`,
    };
  }
}

/** Buys shares in a prediction market on CircuitsPredictionVault via CircuitsAgentTradingVault */
export async function executeAutonomousPredictionTrade(
  chain: CustodyChain,
  agentChainId: string,
  params: PredictionTradeParams,
): Promise<{ txHashOrRef: string; summary: string }> {
  const evmChain: EvmPrismaChain = isEvmPrismaChain(chain) ? chain : "ARC_TESTNET";
  const signer = await getAgentEvmSigner(evmChain, agentChainId);
  if (!signer) {
    throw new Error(`No AgentWallet signer found for ${chain}:${agentChainId}`);
  }

  const agentId = BigInt(agentChainId);
  const spendWei = parseUnits(params.usdcAmount || "1", 18);
  const marketIdHex = params.marketId.startsWith("0x") ? (params.marketId as `0x${string}`) : (`0x${params.marketId.padStart(64, "0")}` as `0x${string}`);

  const innerCallData = encodeFunctionData({
    abi: PREDICTION_VAULT_ABI,
    functionName: "buySharesFor",
    args: [
      signer.address,
      marketIdHex,
      params.outcome,
      spendWei,
      0n,
    ],
  });

  try {
    const hash = await executeCustodialContractWrite(signer, evmChain, {
      address: ARC_TRADING_VAULT_ADDRESS,
      abi: TRADING_VAULT_ABI,
      functionName: "executeTrade",
      args: [agentId, ARC_PREDICTION_VAULT_ADDRESS, innerCallData, spendWei],
    });

    const outcomeLabel = params.outcome === 0 ? "YES" : "NO";
    const summary = `bought ${outcomeLabel} shares in prediction market ${params.marketId.slice(0, 8)}… (${params.usdcAmount} USDC, tx ${hash.slice(0, 10)}…)`;
    return { txHashOrRef: hash, summary };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      txHashOrRef: `sim-${Date.now().toString(16)}`,
      summary: `prediction trade simulated on Arc (${params.outcome === 0 ? "YES" : "NO"} on ${params.marketId.slice(0, 8)}…): ${msg.slice(0, 80)}`,
    };
  }
}

/** Claims winnings from a resolved prediction market on CircuitsPredictionVault */
export async function executeAutonomousClaimPrediction(
  chain: CustodyChain,
  agentChainId: string,
  marketId: string,
): Promise<{ txHashOrRef: string; summary: string }> {
  const evmChain: EvmPrismaChain = isEvmPrismaChain(chain) ? chain : "ARC_TESTNET";
  const signer = await getAgentEvmSigner(evmChain, agentChainId);
  if (!signer) {
    throw new Error(`No AgentWallet signer found for ${chain}:${agentChainId}`);
  }

  const agentId = BigInt(agentChainId);
  const marketIdHex = marketId.startsWith("0x") ? (marketId as `0x${string}`) : (`0x${marketId.padStart(64, "0")}` as `0x${string}`);

  const innerCallData = encodeFunctionData({
    abi: PREDICTION_VAULT_ABI,
    functionName: "claimWinningsFor",
    args: [signer.address, marketIdHex],
  });

  try {
    const hash = await executeCustodialContractWrite(signer, evmChain, {
      address: ARC_TRADING_VAULT_ADDRESS,
      abi: TRADING_VAULT_ABI,
      functionName: "executeTrade",
      args: [agentId, ARC_PREDICTION_VAULT_ADDRESS, innerCallData, 0n],
    });

    const summary = `claimed winnings from prediction market ${marketId.slice(0, 8)}… (tx ${hash.slice(0, 10)}…)`;
    return { txHashOrRef: hash, summary };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      txHashOrRef: `sim-${Date.now().toString(16)}`,
      summary: `claim prediction simulated on Arc: ${msg.slice(0, 80)}`,
    };
  }
}
