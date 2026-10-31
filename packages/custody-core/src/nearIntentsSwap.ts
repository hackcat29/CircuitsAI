import { NearIntents } from "@clawdhq/near";
import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { prisma, SpendAction, type Chain } from "@clawdhq/custody-db";
import { getAgentEvmSigner } from "./agentEvmSigner.js";
import { executeAgentSpend } from "./agentSpendPolicy.js";
import { transferErc20Amount } from "./signingEvmAdapter.js";
import { viemChainFor, rpcUrlFor, usdcAddressFor, isEvmPrismaChain } from "./evmChainConfig.js";

/** Executable swaps need an explicit mainnet opt-in. Testnets are never routed into Intents. */
export async function swapAgentUsdcViaIntents(chain: Chain, agentChainId: string, amountUsdc: string) {
  if (!isEvmPrismaChain(chain) || viemChainFor(chain).testnet) throw new Error("NEAR Intents has no testnet; use a dry quote with mainnet assets");
  if (process.env.NEAR_INTENTS_ENABLE_EXECUTION !== "true") throw new Error("Live Intents execution is disabled; preview a dry quote first");
  const originAsset = process.env[`NEAR_INTENTS_ORIGIN_ASSET_${chain}`];
  const destinationAsset = process.env[`NEAR_INTENTS_SWAP_ASSET_${chain}`];
  if (!originAsset || !destinationAsset) throw new Error("Configure the mainnet source USDC and destination assets");
  const signer = await getAgentEvmSigner(chain, agentChainId);
  if (!signer) throw new Error("Agent wallet unavailable");
  const client = new NearIntents({ jwt: process.env.NEAR_INTENTS_JWT });
  const tokens = await client.tokens();
  const origin = tokens.find(t => t.assetId === originAsset), destination = tokens.find(t => t.assetId === destinationAsset);
  const chainName = ({ 143: "monad", 8453: "base", 1: "eth" } as Record<number, string>)[viemChainFor(chain).id];
  if (!chainName || origin?.blockchain !== chainName || !origin?.contractAddress || origin.symbol !== "USDC" || origin.decimals !== 6 || origin.contractAddress.toLowerCase() !== usdcAddressFor(chain).toLowerCase()) throw new Error("Origin asset must match this chain's configured USDC");
  if (!destination || destination.blockchain !== origin.blockchain) throw new Error("This action returns the output to the same-chain agent address; use a payment invoice for cross-chain recipients");
  const quote = await client.quote({ originAsset, destinationAsset, amount: parseUnits(amountUsdc, 6).toString(), recipient: signer.address, refundTo: signer.address, dry: false });
  if (quote.quote.depositMemo) throw new Error("Memo deposits require a chain-specific sender");
  const deposit = quote.quote.depositAddress;
  if (!deposit || !/^0x[0-9a-fA-F]{40}$/.test(deposit)) throw new Error("Invalid EVM deposit address");
  const amountIn = BigInt(quote.quote.amountIn);
  // EXACT_INPUT quote is not allowed to increase the input amount.
  if (amountIn !== parseUnits(amountUsdc, 6)) throw new Error("Quote amount differs from the requested spend");
  const result = await executeAgentSpend(chain, agentChainId, SpendAction.SWAP, formatUnits(amountIn, 6), async () => {
    // NEAR signing policies must separately approve this quote-specific deposit address.
    // Never auto-add solver addresses to owner policy from an untrusted quote.
    const sent = await transferErc20Amount(signer, chain, deposit as `0x${string}`, amountIn);
    const receipt = await createPublicClient({ chain: viemChainFor(chain), transport: http(rpcUrlFor(chain)) }).waitForTransactionReceipt({ hash: sent.txHashOrRef as `0x${string}` });
    if (receipt.status !== "success") throw new Error("Intents deposit reverted");
    try { await client.notifyDeposit(deposit, sent.txHashOrRef); } catch { /* Notification is optional; chain monitoring continues. */ }
    return { txHashOrRef: sent.txHashOrRef, targetRef: `Intents deposit ${deposit}; settlement pending` };
  });
  return result;
}
