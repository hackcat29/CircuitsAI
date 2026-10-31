import { Prisma, Venue } from "@clawdhq/degen-db";
import { Chain as MarketplaceChain } from "@clawdhq/marketplace-db";
import { getServerEvmLaunchpadAdapter, isEvmPrismaChain, type EvmPrismaChain } from "@/lib/server/evmExchangeReaders";
import { getSigningEvmLaunchpadAdapter } from "@/lib/server/degen/evmSigner";
import { toRawUnits, VenueError, type DecryptedWallet, type FillResult, type OrderRequest, type Quote, type VenueAdapter } from "./types";

const USDC_DECIMALS = 6;
const LAUNCH_TOKEN_DECIMALS = 18; // AgentToken.sol is a standard 18-decimal ERC20
// Fills at up to 2% worse than the quoted price are accepted; beyond that the on-chain
// minTokensOut/minUsdcOut floor reverts the transaction rather than accepting a worse fill —
// this is what actually protects against the price moving between quote and execution, not
// just a display number.
const SLIPPAGE_MULTIPLIER = new Prisma.Decimal("0.98");

// market format: "<Chain>:<launchId>", e.g. "BASE_SEPOLIA:1".
//
// Only the EVM testnet chains are wired up (see EvmPrismaChain in evmExchangeReaders.ts).

function parseMarket(market: string): { chain: EvmPrismaChain; launchId: bigint } {
  const [chainPart, launchIdPart] = market.split(":");
  if (!chainPart || !launchIdPart) {
    throw new Error(`Malformed CLAWDHQ_LAUNCH market "${market}", expected "<Chain>:<launchId>"`);
  }
  const chain = chainPart as MarketplaceChain;
  if (!isEvmPrismaChain(chain)) {
    throw new Error(`CLAWDHQ_LAUNCH quotes are only wired up for EVM chains today, got "${chainPart}"`);
  }
  return { chain, launchId: BigInt(launchIdPart) };
}

export const clawdhqLaunchAdapter: VenueAdapter = {
  venue: Venue.CLAWDHQ_LAUNCH,

  async getQuote(market: string): Promise<Quote> {
    const { chain, launchId } = parseMarket(market);
    // getCurrentPrice returns priceUsdcPerWholeToken in raw 6-decimal USDC units — see
    // ClawdHQLaunchpad.sol's getCurrentPrice doc comment ("USDC (6dec) per whole token"),
    // confirmed directly against the contract rather than assumed. That NatSpec also documents
    // this on-chain view's own precision floor (it can legitimately return 0 for a launch whose
    // true price is below $0.000001/token) — this venue quote inherits that same limitation,
    // unlike apps/web's own UI, which uses lib/bondingCurve.ts's higher-precision mirror instead.
    const priceRaw = await getServerEvmLaunchpadAdapter(chain).getCurrentPrice(launchId);
    return { price: new Prisma.Decimal(priceRaw.toString()).div(1_000_000), ts: Date.now() };
  },

  async placeOrder(wallet: DecryptedWallet, order: OrderRequest): Promise<FillResult> {
    const { chain, launchId } = parseMarket(order.market);
    const adapter = getSigningEvmLaunchpadAdapter(chain, wallet.privateKey);

    // Re-quote at execution time rather than trusting a price the risk engine may have fetched
    // moments earlier — the on-chain min-out floor below is what actually enforces slippage,
    // this is just what that floor gets computed from.
    const priceRaw = await adapter.getCurrentPrice(launchId);
    const price = new Prisma.Decimal(priceRaw.toString()).div(1_000_000);
    if (price.isZero()) throw new VenueError(Venue.CLAWDHQ_LAUNCH, `Zero price returned for market "${order.market}"`);

    if (order.action === "BUY") {
      const usdcAmount = toRawUnits(order.sizeUsdc, USDC_DECIMALS);
      const expectedTokens = order.sizeUsdc.div(price);
      const minTokensOut = toRawUnits(expectedTokens.mul(SLIPPAGE_MULTIPLIER), LAUNCH_TOKEN_DECIMALS);
      const txHash = await adapter.buyTokens(launchId, usdcAmount, minTokensOut);
      return { fillPrice: price, txHashOrRef: txHash };
    }

    if (order.action === "SELL") {
      const tokensWhole = order.sizeUsdc.div(price);
      const tokenAmount = toRawUnits(tokensWhole, LAUNCH_TOKEN_DECIMALS);
      const minUsdcOut = toRawUnits(order.sizeUsdc.mul(SLIPPAGE_MULTIPLIER), USDC_DECIMALS);
      const txHash = await adapter.sellTokens(launchId, tokenAmount, minUsdcOut);
      return { fillPrice: price, txHashOrRef: txHash };
    }

    throw new VenueError(Venue.CLAWDHQ_LAUNCH, `Unknown action "${order.action}", expected BUY or SELL`);
  },
};

/** Risk-engine-only helper (not part of the generic VenueAdapter interface — graduation is a
 * CLAWDHQ_LAUNCH-specific concept, not a cross-venue one). Returns null rather than throwing on
 * any failure (unparseable market, unconfigured chain, RPC error) — the risk engine treats "we
 * couldn't check" as "don't block," matching every other read in this codebase that folds
 * on-chain lookup failure into a soft null rather than a hard error. */
export async function getGraduationProgress(market: string): Promise<{ usdcRaised: bigint; graduationThreshold: bigint; graduated: boolean } | null> {
  try {
    const { chain, launchId } = parseMarket(market);
    const launch = await getServerEvmLaunchpadAdapter(chain).getLaunch(launchId);
    return {
      usdcRaised: launch.usdcRaised,
      graduationThreshold: launch.graduationThreshold,
      graduated: launch.graduated,
    };
  } catch {
    return null;
  }
}
