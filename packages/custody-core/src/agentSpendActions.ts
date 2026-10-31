import { createHash } from "node:crypto";
import { parseUnits, formatUnits, isAddress } from "viem";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { SpendAction, type Chain } from "@clawdhq/custody-db";
import { getAgentEvmSigner } from "./agentEvmSigner.js";
import { getDecryptedAgentWallet } from "./agentWalletCustody.js";
import { executeAgentSpend, type AgentSpendExecutionResult } from "./agentSpendPolicy.js";
import { isEvmPrismaChain, viemChainFor, type EvmPrismaChain } from "./evmChainConfig.js";
import { getSigningEvmAdapter, transferErc20Amount } from "./signingEvmAdapter.js";
import { swapUsdcForWeth } from "./uniswapSwap.js";
import { postAgentChainActivityToClawdHq } from "./clawdhqLinkCustody.js";

/** Same digest convention as subscriptionRunJob.ts's sha256Hex — reimplemented here (not
 * imported) since that one isn't exported from this package's public surface. */
function sha256Hex(input: string): `0x${string}` {
  return `0x${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

/** POST_JOB spend action: posts a job on ClawdHQCore, funded and signed by the agent's own
 * platform-custodied AgentWallet rather than a Subscription's wallet — the on-chain call is
 * otherwise identical to subscriptionRunJob.ts's EVM branch (same guessed-`totalJobs + 1` id
 * tradeoff documented there). EVM-only for now, matching Subscriptions' own current scope.
 * Goes through executeAgentSpend, so it's gated by the agent's AgentSpendPolicy and logged to
 * AgentSpendLog like every other autonomous spend — callers (a manual owner-triggered route now,
 * Phase 5's tick loop later) never call postJob directly. */
export async function postJobFromAgentWallet(
  chain: Chain,
  agentChainId: string,
  hiredAgentId: string,
  taskDescription: string,
  budgetUsdc: string,
  deadlineDays: number,
): Promise<AgentSpendExecutionResult> {
  if (!isEvmPrismaChain(chain)) throw new Error(`postJobFromAgentWallet isn't wired up for ${chain} yet — EVM only for now.`);
  const evmChain: EvmPrismaChain = chain;

  const result = await executeAgentSpend(chain, agentChainId, SpendAction.POST_JOB, budgetUsdc, async () => {
    const signer = await getAgentEvmSigner(evmChain, agentChainId);
    if (!signer) throw new Error("No AgentWallet has been provisioned for this agent yet.");

    const adapter = getSigningEvmAdapter(evmChain, signer);
    const statsBefore = await adapter.getProtocolStats();
    const jobChainId = (statsBefore.totalJobs + 1n).toString();

    const taskHash = sha256Hex(taskDescription);
    const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000) + deadlineDays * 86400);
    const budget = parseUnits(budgetUsdc, 6);

    const txHashOrRef = await adapter.postJob({
      employerAgentId: BigInt(agentChainId),
      hiredAgentId: BigInt(hiredAgentId),
      taskHash,
      budget,
      deadline: deadlineSeconds,
    });

    return { txHashOrRef, targetRef: jobChainId };
  });

  await postAgentChainActivityToClawdHq(evmChain, agentChainId, (name, profileUrl) =>
    `💼 ${name} just hired agent #${hiredAgentId} for a ${budgetUsdc} USDC job on Circuits Protocol. ${profileUrl}`
  );
  return result;
}

/** X402_PAYMENT spend action: a direct USDC transfer from the agent's own AgentWallet to
 * `recipient`, funded and signed the same way postJobFromAgentWallet is. Scoped deliberately
 * narrower than the full x402 protocol: it doesn't negotiate a 402 response or verify a payment
 * requirement against a resource server first — the LLM-decided `recipient`/`amountUsdc` are
 * trusted only to the extent AgentSpendPolicy already bounds them (allowlisted action, capped
 * daily total), same trust model as postJobFromAgentWallet trusting an LLM-decided
 * hiredAgentId/budget. Extending this to a real negotiate-then-pay flow (fetch the resource,
 * read its 402 payment requirements, pay exactly what it asks) is a reasonable follow-up but a
 * materially bigger scope than "move funds through the already-gated spend path." EVM-only,
 * matching every other spend action in this codebase's current scope. */
export async function payFromAgentWallet(chain: Chain, agentChainId: string, recipient: string, amountUsdc: string, reason: string): Promise<AgentSpendExecutionResult> {
  if (!isEvmPrismaChain(chain)) throw new Error(`payFromAgentWallet isn't wired up for ${chain} yet — EVM only for now.`);
  const evmChain: EvmPrismaChain = chain;
  if (!isAddress(recipient)) throw new Error(`"${recipient}" isn't a valid ${chain} address.`);

  const result = await executeAgentSpend(chain, agentChainId, SpendAction.X402_PAYMENT, amountUsdc, async () => {
    const signer = await getAgentEvmSigner(evmChain, agentChainId);
    if (!signer) throw new Error("No AgentWallet has been provisioned for this agent yet.");

    const amount = parseUnits(amountUsdc, 6);
    const transfer = await transferErc20Amount(signer, evmChain, recipient as `0x${string}`, amount);

    return { txHashOrRef: transfer.txHashOrRef, targetRef: `${recipient} (${reason || "no reason given"})` };
  });

  await postAgentChainActivityToClawdHq(evmChain, agentChainId, (name, profileUrl) =>
    `💸 ${name} just made an x402 payment of ${amountUsdc} USDC on Circuits Protocol. ${profileUrl}`
  );
  return result;
}

/** Maps this app's own chain naming to @circle-fin/x402-batching's `SupportedChainName` — narrow
 * on purpose (Arc Testnet only, matching every other Gateway integration point in this codebase,
 * e.g. lib/server/circleGateway.ts's seller side) rather than a full table for every chain
 * Circle Gateway itself supports, most of which this app doesn't expose to users at all. */
function gatewayChainNameFor(chain: EvmPrismaChain): "arcTestnet" {
  if (chain === "ARC_TESTNET" || chain === "ARC_MAINNET") return "arcTestnet";
  throw new Error(`payX402ResourceFromAgentWallet only supports Arc chains right now, not ${chain}.`);
}

interface PaymentRequiredBody {
  x402Version?: number;
  accepts?: { network: string; amount: string }[];
}

/** Reads a URL's 402 challenge without paying it — used to learn the real price *before*
 * executeAgentSpend's policy check, which needs `amountUsdc` upfront (see its own doc comment).
 * Doubles as a free "is this even payable, and on our chain" check, same one GatewayClient.pay()
 * does again internally right before actually paying — a second cheap, side-effect-free GET, not
 * a real inefficiency. Returns null if the resource isn't gated at all (a plain 200). */
async function peekX402Price(url: string, evmChain: EvmPrismaChain): Promise<{ amountUsdc: string; amountRaw: bigint } | null> {
  const probe = await fetch(url);
  if (probe.status !== 402) return null;

  const header = probe.headers.get("PAYMENT-REQUIRED");
  if (!header) throw new Error(`${url} responded 402 but with no PAYMENT-REQUIRED header — this doesn't look like a Circle Gateway resource.`);

  let body: PaymentRequiredBody;
  try {
    body = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    throw new Error(`${url}'s PAYMENT-REQUIRED header isn't valid base64 JSON.`);
  }

  const network = `eip155:${viemChainFor(evmChain).id}`;
  const option = body.accepts?.find((o) => o.network === network);
  if (!option) throw new Error(`${url} doesn't accept payment on ${evmChain} (network ${network}).`);

  return { amountUsdc: (Number(option.amount) / 1_000_000).toString(), amountRaw: BigInt(option.amount) };
}

/** X402_PAYMENT spend action, negotiated version: unlike `payFromAgentWallet` above (a blind
 * transfer to a pre-agreed recipient/amount), this fetches `url` itself, reads its actual 402
 * challenge, and pays exactly what it asks for via Circle Gateway — the real "consume any
 * external x402/Gateway-protected resource" capability `payFromAgentWallet`'s own doc comment
 * flagged as a reasonable but materially bigger follow-up. That's now this function.
 *
 * `maxAmountUsdc` is the caller's (the LLM's) own price ceiling, checked against the resource's
 * *actual* advertised price before any spend-policy check, log write, or fund movement — the
 * real amount charged (and what AgentSpendPolicy/AgentSpendLog see) is always the resource's own
 * price, never the cap.
 *
 * LOCAL-custodied AgentWallets only for now: GatewayClient needs to sign real transactions
 * (deposit) and EIP-712 typed data (pay) itself, which means holding a raw private key — this
 * app's CIRCLE-custodied wallets deliberately never expose one (see getDecryptedAgentWallet's own
 * guard), matching the same LOCAL-only boundary getDecryptedAgentWallet already draws for every
 * other caller in this codebase that needs a raw signer rather than the abstracted EvmSigner
 * interface. Extending this to CIRCLE-custodied wallets needs Circle's own Wallets API to build
 * the deposit/pay transactions instead of local signing — a distinct, real piece of work.
 *
 * Auto-deposits the shortfall into the wallet's Gateway balance if it's short of the resource's
 * price — this is meant to work unattended (an agent autonomously discovering and paying for a
 * resource), so it can't stop and wait for a human to run a manual deposit step first the way
 * this feature's own pilot script did. */
export async function payX402ResourceFromAgentWallet(chain: Chain, agentChainId: string, url: string, maxAmountUsdc: string): Promise<AgentSpendExecutionResult & { data: unknown }> {
  if (!isEvmPrismaChain(chain)) throw new Error(`payX402ResourceFromAgentWallet isn't wired up for ${chain} yet — EVM only for now.`);
  const evmChain: EvmPrismaChain = chain;

  const signer = await getAgentEvmSigner(evmChain, agentChainId);
  if (!signer) throw new Error("No AgentWallet has been provisioned for this agent yet.");
  if (signer.custodyType !== "LOCAL") {
    throw new Error("Paying an external x402/Gateway resource is only supported for LOCAL-custodied AgentWallets right now — see this function's own doc comment for why.");
  }

  const price = await peekX402Price(url, evmChain);
  if (!price) {
    // Not actually gated — nothing to spend, nothing to log.
    const response = await fetch(url);
    return { txHashOrRef: "", data: await response.json() };
  }
  if (Number(price.amountUsdc) > Number(maxAmountUsdc)) {
    throw new Error(`${url} costs ${price.amountUsdc} USDC, above the ${maxAmountUsdc} USDC cap for this call.`);
  }

  let responseData: unknown;
  const result = await executeAgentSpend(chain, agentChainId, SpendAction.X402_PAYMENT, price.amountUsdc, async () => {
    const decrypted = await getDecryptedAgentWallet(evmChain, agentChainId);
    if (!decrypted) throw new Error("No AgentWallet has been provisioned for this agent yet.");

    const gatewayClient = new GatewayClient({ chain: gatewayChainNameFor(evmChain), privateKey: decrypted.privateKey as `0x${string}` });

    const balances = await gatewayClient.getBalances();
    if (balances.gateway.available < price.amountRaw) {
      await gatewayClient.deposit(formatUnits(price.amountRaw - balances.gateway.available, 6));
    }

    const paid = await gatewayClient.pay(url);
    responseData = paid.data;
    return { txHashOrRef: paid.transaction, targetRef: url };
  });

  await postAgentChainActivityToClawdHq(evmChain, agentChainId, (name, profileUrl) =>
    `🌐 ${name} just paid ${price.amountUsdc} USDC for an external resource via Circle Gateway on Circuits Protocol. ${profileUrl}`
  );
  return { ...result, data: responseData };
}

/** SWAP spend action: swaps the agent's own AgentWallet USDC for WETH via a real Uniswap V3
 * pool (uniswapSwap.ts) — the one spend action that actually moves value through a signed,
 * broadcast transaction built from a live third-party quote, rather than a flat platform fee.
 * That's exactly why it needed its own hardcoded action instead of becoming a "skill":
 * SkillInvocation (the http/mcp/clawdhq-agent kinds CALL_SKILL resolves) has no code path to an
 * AgentWallet's private key at all, by design — a skill's `priceUsdc` is a metering cost, never
 * the real value of whatever the call represents. Here, `amountUsdc` (the swap's own input
 * amount) IS what gets checked against the agent's dailyCapUsdc, so the cap means what it says
 * for this action, unlike a hypothetical "just wire a DEX as a skill" shortcut would have.
 * EVM-only, and further scoped to Base Sepolia / Ethereum Sepolia specifically — see
 * uniswapSwap.ts's top comment for why only those two. */
export async function swapAgentWalletUsdcForWeth(chain: Chain, agentChainId: string, amountUsdc: string): Promise<AgentSpendExecutionResult> {
  if (!isEvmPrismaChain(chain)) throw new Error(`swapAgentWalletUsdcForWeth isn't wired up for ${chain} yet — EVM only for now.`);
  const evmChain: EvmPrismaChain = chain;

  const result = await executeAgentSpend(chain, agentChainId, SpendAction.SWAP, amountUsdc, async () => {
    const signer = await getAgentEvmSigner(evmChain, agentChainId);
    if (!signer) throw new Error("No AgentWallet has been provisioned for this agent yet.");

    const amountIn = parseUnits(amountUsdc, 6);
    const swap = await swapUsdcForWeth(evmChain, signer, amountIn);

    return { txHashOrRef: swap.txHashOrRef, targetRef: `${swap.amountInUsdc} USDC -> ${swap.amountOutWeth} WETH` };
  });

  await postAgentChainActivityToClawdHq(evmChain, agentChainId, (name, profileUrl) =>
    `🔄 ${name} just swapped ${result.targetRef} on Circuits Protocol. ${profileUrl}`
  );
  return result;
}
