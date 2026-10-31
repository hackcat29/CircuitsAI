import { BaseSepolia, EthereumSepolia } from "@circle-fin/bridge-kit/chains";
import { CCTPV2BridgingProvider } from "@circle-fin/provider-cctp-v2";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

// Routes USDC across chains using Circle's official CCTP v2 SDK (native burn-and-mint, not a
// wrapped-asset bridge) so an owner can fund whichever venue custody wallet needs it from a
// single deposit, rather than needing to already hold USDC natively on every chain a venue
// happens to live on. Deliberately built on Circle's own @circle-fin packages rather than
// hand-rolled contract/instruction calls. Every chain/contract mapping below was read directly
// from the installed package's shipped type definitions, not assumed from documentation prose.
//
// Only the chains this app's venues actually need are wired up: Base Sepolia and Ethereum
// Sepolia (ClawdHQ launches) — confirmed directly against @circle-fin/bridge-kit's shipped
// BridgeChain enum as genuinely CCTP-bridgeable. Not included: BSC_TESTNET has no chain
// definition in the SDK whatsoever (Circle does not issue CCTP-bridgeable USDC on BNB Chain —
// confirmed both via Circle's own supported-chains docs, which lists BNB Smart Chain as "USYC
// only", and via the SDK simply not defining it), and SUI_TESTNET exists in the SDK's broader
// Blockchain enum but not in BridgeChain, i.e. defined but not bridgeable. Routing must reject
// both explicitly rather than let a burn fail partway with no possible mint side.
export type CctpChain = "BASE_SEPOLIA" | "ETH_SEPOLIA";

const CCTP_CHAIN_DEFINITION = {
  BASE_SEPOLIA: BaseSepolia,
  ETH_SEPOLIA: EthereumSepolia,
} as const satisfies Record<CctpChain, unknown>;

export function isCctpChain(chain: string): chain is CctpChain {
  return chain in CCTP_CHAIN_DEFINITION;
}

async function buildWalletContext(chain: CctpChain, privateKey: string) {
  const adapter = createViemAdapterFromPrivateKey({ privateKey, capabilities: { addressContext: "developer-controlled" } });
  const definition = chain === "BASE_SEPOLIA" ? BaseSepolia : EthereumSepolia;
  return { adapter, chain: definition, address: await adapter.getAddress(definition) };
}

export interface RouteUsdcInput {
  sourceChain: CctpChain;
  /** Decrypted private key of the custodied wallet paying for the burn — transient, never
   * logged or persisted by this module. Caller (custody.ts) owns decrypt/zeroize lifecycle. */
  sourcePrivateKey: string;
  destinationChain: CctpChain;
  /** Decrypted private key of the custodied destination wallet. Both sides of every route this
   * function is actually used for are ClawdHQ-custodied wallets (an owner's deposit address
   * for a venue, or that venue's own trading wallet) — routeUsdc is never called with a
   * destination this app doesn't already hold a key for, so there's no forwarder-only/
   * no-destination-key case to support. useForwarder is still set below regardless: even with
   * an adapter present, Circle's relayer submits the mint rather than the adapter, so the
   * destination wallet never needs native gas on its own chain either way. */
  destinationPrivateKey: string;
  /** Decimal string, e.g. "50.00" — matches the SDK's own amount type, avoids float precision
   * issues on a real money amount. */
  amountUsdc: string;
}

export interface RouteUsdcResult {
  state: "pending" | "success" | "error";
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
}

/** Moves USDC from a custodied wallet on one chain to a custodied wallet on another via CCTP
 * v2's burn-and-mint (native USDC on both ends, not a wrapped representation). */
export async function routeUsdc(input: RouteUsdcInput): Promise<RouteUsdcResult> {
  const { sourceChain, sourcePrivateKey, destinationChain, destinationPrivateKey, amountUsdc } = input;

  if (sourceChain === destinationChain) {
    throw new Error("routeUsdc is for cross-chain transfers. Source and destination are the same chain here, use a same-chain transfer instead");
  }

  const provider = new CCTPV2BridgingProvider();
  const canForward = provider.supportsRoute(CCTP_CHAIN_DEFINITION[sourceChain], CCTP_CHAIN_DEFINITION[destinationChain], "USDC", true);
  if (!canForward) {
    throw new Error(`CCTP forwarder route from ${sourceChain} to ${destinationChain} is not supported`);
  }

  const source = await buildWalletContext(sourceChain, sourcePrivateKey);
  const destination = await buildWalletContext(destinationChain, destinationPrivateKey);

  const result = await provider.bridge({
    source,
    destination: { ...destination, useForwarder: true },
    amount: amountUsdc,
    token: "USDC",
    config: { transferSpeed: "FAST" },
  });

  return {
    state: result.state,
    sourceAddress: source.address,
    destinationAddress: destination.address,
    amount: result.amount,
  };
}
