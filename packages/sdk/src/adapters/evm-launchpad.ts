import { getContract, parseEventLogs, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { clawdHQLaunchpadAbi } from "../abi/index.js";
import type { LaunchSummary, BuybackInterval } from "../types.js";
import { ensureErc20Allowance } from "./erc20.js";

export interface EvmLaunchpadAdapterConfig {
  contractAddress: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

interface UntypedContract {
  read: Record<string, (args?: readonly unknown[]) => Promise<unknown>>;
  write: Record<string, (args?: readonly unknown[]) => Promise<Hex>>;
}

/** Talks to the `ClawdHQLaunchpad` contract — the bonding-curve agent-token launchpad, a
 * separate contract from `ClawdHQCore`'s agent registry/job marketplace (see `EvmAdapter`),
 * split out because Core has no bytecode headroom left. `createLaunch` checks agent ownership
 * against Core directly on-chain (via `IClawdHQCore`), so no ownership check is needed here. */
export class EvmLaunchpadAdapter {
  private readonly contract: UntypedContract;
  private readonly contractAddress: Address;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private usdcAddress: Address | undefined;

  constructor(config: EvmLaunchpadAdapterConfig) {
    this.contractAddress = config.contractAddress;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.contract = getContract({
      address: config.contractAddress,
      abi: clawdHQLaunchpadAbi,
      client: { public: config.publicClient, wallet: config.walletClient },
    }) as unknown as UntypedContract;
  }

  /** Every launch/buy pulls USDC via `safeTransferFrom`, which requires a prior ERC20
   * `approve`. Callers don't need to think about allowances separately — each write method
   * below calls this first. Lazily resolves the USDC contract address from
   * `ClawdHQLaunchpad.usdc()` rather than requiring callers to pass it. */
  private async ensureUsdcAllowance(owner: Address, amount: bigint): Promise<void> {
    if (amount === 0n) return;
    if (!this.usdcAddress) {
      this.usdcAddress = (await this.contract.read.usdc([])) as Address;
    }
    await ensureErc20Allowance(
      { public: this.publicClient, wallet: this.walletClient },
      this.usdcAddress,
      owner,
      this.contractAddress,
      amount
    );
  }

  private getSenderAddress(): Address {
    const address = this.walletClient?.account?.address;
    if (!address) throw new Error("EvmLaunchpadAdapter: no connected wallet account to send this transaction from.");
    return address;
  }

  async getLaunch(launchId: bigint): Promise<LaunchSummary> {
    // AgentLaunch's layout, in declaration order (see ClawdHQLaunchpad.sol): launchId, agentId,
    // token, name, symbol, creator, totalSupply, usdcRaised, tokensSold, graduationThreshold,
    // bondingBasePrice (deprecated), bondingSlope (deprecated), createdAt, graduatedAt,
    // antiSnipeUntil, graduated, active, creatorAllocBps (deprecated), buybackPoolUsdc (deprecated),
    // buybackInterval, nextBuybackAt, initialVirtualUsdcReserve, tradingStartsAt, buybackBps
    const launch = (await this.contract.read.launches([launchId])) as unknown as readonly [
      bigint, bigint, Address, string, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean, number, bigint, number, bigint, bigint, bigint, number,
    ];
    return {
      launchId: launch[0].toString(),
      agentId: launch[1].toString(),
      token: launch[2],
      creator: launch[5],
      name: launch[3],
      symbol: launch[4],
      tokensSold: launch[8],
      usdcRaised: launch[7],
      graduationThreshold: launch[9],
      graduated: launch[15],
      active: launch[16],
      initialVirtualUsdcReserve: launch[21],
      buybackPoolUsdc: launch[18] ?? 0n,
      buybackBps: Number(launch[23] ?? 2000),
      buybackInterval: launch[19] as BuybackInterval,
      nextBuybackAt: launch[20],
      tradingStartsAt: launch[22],
    };
  }

  async getCurrentPrice(launchId: bigint): Promise<bigint> {
    return (await this.contract.read.getCurrentPrice([launchId])) as bigint;
  }

  /** USDC (6dec) charged by {createLaunch} — exposed separately from `createLaunch` itself so
   * a caller (e.g. CreateLaunchDialog) can show the fee before the user submits, not just
   * silently pay whatever it happens to be. */
  async getLaunchFee(): Promise<bigint> {
    return (await this.contract.read.launchFee([])) as bigint;
  }

  /** `launchAt` — unix seconds trading should open at; 0 (the default) or any timestamp at/before
   * "now" means immediately. */
  async createLaunch(args: {
    agentId: bigint;
    name: string;
    symbol: string;
    buybackInterval: BuybackInterval;
    buybackBps?: number;
    launchAt?: bigint;
  }): Promise<Hex> {
    const launchFee = (await this.contract.read.launchFee([])) as bigint;
    await this.ensureUsdcAllowance(this.getSenderAddress(), launchFee);
    return this.contract.write.createLaunch([
      args.agentId,
      args.name,
      args.symbol,
      args.buybackInterval,
      args.buybackBps ?? 2000,
      args.launchAt ?? 0n,
    ]) as Promise<Hex>;
  }

  /** Allows the agent owner to adjust buyback cadence and treasury percentage. */
  async setBuybackConfig(launchId: bigint, interval: BuybackInterval, buybackBps: number): Promise<Hex> {
    return this.contract.write.setBuybackConfig([launchId, interval, buybackBps]) as Promise<Hex>;
  }

  /** Spends an explicit USDC amount from caller/treasury to buy and burn tokens. */
  async executeBuybackWithAmount(launchId: bigint, amountUsdc: bigint): Promise<Hex> {
    await this.ensureUsdcAllowance(this.getSenderAddress(), amountUsdc);
    return this.contract.write.executeBuybackWithAmount([launchId, amountUsdc]) as Promise<Hex>;
  }

  /** Resolves the real on-chain launchId assigned to a `createLaunch` transaction, by decoding
   * its `LaunchCreated` event — mirrors `EvmAdapter.waitForAgentRegistration` exactly. Callers
   * that need to safely chain a further action against the new launch (e.g. an immediate
   * pre-buy) should use this instead of guessing from `totalLaunches + 1`, which races any
   * other launch created in between. */
  async waitForLaunchCreation(txHash: Hex): Promise<bigint> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    const [event] = parseEventLogs({ abi: clawdHQLaunchpadAbi, eventName: "LaunchCreated", logs: receipt.logs });
    if (!event) throw new Error("LaunchCreated event not found in the launch-creation transaction receipt");
    return (event.args as { launchId: bigint }).launchId;
  }

  async buyTokens(launchId: bigint, usdcAmount: bigint, minTokensOut: bigint): Promise<Hex> {
    await this.ensureUsdcAllowance(this.getSenderAddress(), usdcAmount);
    return this.contract.write.buyTokens([launchId, usdcAmount, minTokensOut]) as Promise<Hex>;
  }

  async sellTokens(
    launchId: bigint,
    tokenAmount: bigint,
    minUsdcOut: bigint,
    tokenAddress?: Address
  ): Promise<Hex> {
    let resolvedToken = tokenAddress;
    if (!resolvedToken) {
      const launch = (await this.contract.read.launches([launchId])) as unknown as readonly [
        bigint, bigint, Address, ...unknown[]
      ];
      resolvedToken = launch[2];
    }
    await ensureErc20Allowance(
      { public: this.publicClient, wallet: this.walletClient },
      resolvedToken,
      this.getSenderAddress(),
      this.contractAddress,
      tokenAmount
    );
    return this.contract.write.sellTokens([launchId, tokenAmount, minUsdcOut]) as Promise<Hex>;
  }

  async graduateLaunch(launchId: bigint): Promise<Hex> {
    return this.contract.write.graduateLaunch([launchId]) as Promise<Hex>;
  }

  /** Creator-only, and only before `tradingStartsAt` — opens a scheduled launch's trading
   * immediately instead of waiting for the originally-chosen time. */
  async startTradingNow(launchId: bigint): Promise<Hex> {
    return this.contract.write.startTradingNow([launchId]) as Promise<Hex>;
  }

  /** Spends this launch's accumulated buyback pool to repurchase-and-burn tokens from the
   * curve at the current price — permissionless, callable by anyone regardless of whether
   * they've ever bought/sold this launch. */
  async executeBuyback(launchId: bigint): Promise<Hex> {
    return this.contract.write.executeBuyback([launchId]) as Promise<Hex>;
  }
}
