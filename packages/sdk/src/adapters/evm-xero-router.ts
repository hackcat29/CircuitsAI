import { getContract, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { xeroRouterAbi, xeroFactoryAbi } from "../abi/index.js";
import { ensureErc20Allowance } from "./erc20.js";

export interface EvmXeroRouterAdapterConfig {
  contractAddress: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

interface UntypedContract {
  read: Record<string, (args?: readonly unknown[]) => Promise<unknown>>;
  write: Record<string, (args?: readonly unknown[]) => Promise<Hex>>;
}

/** Talks to a deployed XeroRouter (packages/contracts-evm/contracts/xero/XeroRouter.sol) — the
 * ERC20<->ERC20 AMM router {ClawdHQLaunchpad-graduateLaunch} migrates a launch's liquidity
 * into, and the only way to keep trading a token once it's graduated (the bonding curve's own
 * buyTokens/sellTokens revert `LaunchNotActive` after that point). Same allowance-handling
 * shape as EvmLaunchpadAdapter — callers don't need to think about `approve` separately; each
 * write method below ensures it first. */
export class EvmXeroRouterAdapter {
  private readonly contract: UntypedContract;
  private readonly contractAddress: Address;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private factoryAddress: Address | undefined;

  constructor(config: EvmXeroRouterAdapterConfig) {
    this.contractAddress = config.contractAddress;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.contract = getContract({
      address: config.contractAddress,
      abi: xeroRouterAbi,
      client: { public: config.publicClient, wallet: config.walletClient },
    }) as unknown as UntypedContract;
  }

  private getSenderAddress(): Address {
    const address = this.walletClient?.account?.address;
    if (!address) throw new Error("EvmXeroRouterAdapter: no connected wallet account to send this transaction from.");
    return address;
  }

  private async ensureAllowance(tokenAddress: Address, amount: bigint): Promise<void> {
    await ensureErc20Allowance(
      { public: this.publicClient, wallet: this.walletClient },
      tokenAddress,
      this.getSenderAddress(),
      this.contractAddress,
      amount
    );
  }

  /** Resolves an existing pair's own LP-token address via the factory — needed so
   * `removeLiquidity` can approve the router to pull LP tokens on the caller's behalf.
   * Lazily reads and caches `router.factory()`. */
  private async getPairAddress(tokenA: Address, tokenB: Address): Promise<Address> {
    if (!this.factoryAddress) {
      this.factoryAddress = (await this.contract.read.factory([])) as Address;
    }
    const factory = getContract({
      address: this.factoryAddress,
      abi: xeroFactoryAbi,
      client: { public: this.publicClient },
    }) as unknown as { read: { getPair: (args: readonly [Address, Address]) => Promise<Address> } };
    return factory.read.getPair([tokenA, tokenB]);
  }

  async getAmountsOut(amountIn: bigint, path: Address[]): Promise<bigint[]> {
    return (await this.contract.read.getAmountsOut([amountIn, path])) as bigint[];
  }

  async getAmountsIn(amountOut: bigint, path: Address[]): Promise<bigint[]> {
    return (await this.contract.read.getAmountsIn([amountOut, path])) as bigint[];
  }

  async addLiquidity(args: {
    tokenA: Address;
    tokenB: Address;
    amountADesired: bigint;
    amountBDesired: bigint;
    amountAMin: bigint;
    amountBMin: bigint;
    deadline: bigint;
  }): Promise<Hex> {
    const to = this.getSenderAddress();
    await this.ensureAllowance(args.tokenA, args.amountADesired);
    await this.ensureAllowance(args.tokenB, args.amountBDesired);
    return this.contract.write.addLiquidity([
      args.tokenA,
      args.tokenB,
      args.amountADesired,
      args.amountBDesired,
      args.amountAMin,
      args.amountBMin,
      to,
      args.deadline,
    ]) as Promise<Hex>;
  }

  async removeLiquidity(args: {
    tokenA: Address;
    tokenB: Address;
    liquidity: bigint;
    amountAMin: bigint;
    amountBMin: bigint;
    deadline: bigint;
  }): Promise<Hex> {
    const to = this.getSenderAddress();
    const pairAddress = await this.getPairAddress(args.tokenA, args.tokenB);
    await this.ensureAllowance(pairAddress, args.liquidity);
    return this.contract.write.removeLiquidity([
      args.tokenA,
      args.tokenB,
      args.liquidity,
      args.amountAMin,
      args.amountBMin,
      to,
      args.deadline,
    ]) as Promise<Hex>;
  }

  async swapExactTokensForTokens(args: { amountIn: bigint; amountOutMin: bigint; path: Address[]; deadline: bigint }): Promise<Hex> {
    const to = this.getSenderAddress();
    await this.ensureAllowance(args.path[0], args.amountIn);
    return this.contract.write.swapExactTokensForTokens([args.amountIn, args.amountOutMin, args.path, to, args.deadline]) as Promise<Hex>;
  }

  async swapTokensForExactTokens(args: { amountOut: bigint; amountInMax: bigint; path: Address[]; deadline: bigint }): Promise<Hex> {
    const to = this.getSenderAddress();
    await this.ensureAllowance(args.path[0], args.amountInMax);
    return this.contract.write.swapTokensForExactTokens([args.amountOut, args.amountInMax, args.path, to, args.deadline]) as Promise<Hex>;
  }

  /** Use instead of `swapExactTokensForTokens` whenever `path[0]` might be a fee-on-transfer
   * token — e.g. a graduated AgentToken, which charges 2% on every transfer once graduated
   * (see AgentToken.sol). The plain swap reverts in that case (the pair receives less than its
   * pre-computed nominal input, failing its own k-invariant check); this measures the pair's
   * real received balance instead. */
  async swapExactTokensForTokensSupportingFeeOnTransferTokens(args: {
    amountIn: bigint;
    amountOutMin: bigint;
    path: Address[];
    deadline: bigint;
  }): Promise<Hex> {
    const to = this.getSenderAddress();
    await this.ensureAllowance(args.path[0], args.amountIn);
    return this.contract.write.swapExactTokensForTokensSupportingFeeOnTransferTokens([
      args.amountIn,
      args.amountOutMin,
      args.path,
      to,
      args.deadline,
    ]) as Promise<Hex>;
  }
}
