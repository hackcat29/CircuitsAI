import { NextResponse } from "next/server";
import { prisma as marketplacePrisma, ListingMode, ListingStatus } from "@clawdhq/marketplace-db";
import { prisma as degenPrisma, Mode as DegenMode, OrderStatus as DegenOrderStatus } from "@clawdhq/degen-db";
import { prisma as custodyPrisma, PaymentPullStatus, SpendAction, AgentSpendStatus } from "@clawdhq/custody-db";

// "Protocol Volume" — every real USDC movement anywhere in the app, fees included wherever a
// fee is layered on top of (rather than carved out of) the amount summed below:
//
//  - Job marketplace: Core.totalVolume, read live on-chain by useProtocolStats — gross budget
//    (ClawdHQCore.sol's _releaseEscrow does `totalVolume += amount` *before* subtracting the
//    protocol fee), summed client-side and added to this route's total by the
//    useTotalProtocolVolume hook, not here.
//  - Subscriptions / Orchestration pipelines: deliberately NOT summed separately —
//    packages/custody-core/src/subscriptionRunJob.ts and pipelineRunJob.ts both just call
//    ClawdHQCore's postJob/confirmDelivery, so Subscription.totalPaidUsdc and
//    PipelineStep.budgetUsdc are the exact same USDC already counted once via Core.totalVolume
//    above — adding them here would double-count the same money.
//  - Launchpad: every bonding-curve buy/sell (LaunchTrade.usdcAmount — gross, fee-inclusive,
//    see candles/route.ts's own doc comment).
//  - Agent Exchange: settled Auction-mode sales (Listing joined to its winning Bid.amountUsdc —
//    the gross bid; ClawdHQAgentExchange.sol's _settleSale takes its fee out of this amount,
//    doesn't add one on top, so no separate fee line is needed). Open-mode settled sales aren't
//    counted — the contract never populates a field the indexer can persist for those.
//  - Degen: live (non-paper) filled orders only (TradingOrder.requestedUsdc, mode=LIVE,
//    status=FILLED) — paper-mode bankroll is fake by design.
//  - Knowledge: KnowledgeUsage.priceUsdc — the gross per-resolve price, already inclusive of
//    the owner/protocol 50/50 split (ownerShareUsdc + protocolShareUsdc == priceUsdc).
//  - Skills / other x402-gated resources: PaymentPull rows (the shared X402Facilitator ledger),
//    *excluding* the two rows each KnowledgeUsage already accounts for (ownerPullId/
//    protocolPullId) — otherwise a Knowledge resolve would be counted twice, once here and once
//    above.
//  - x402-services listings: ServiceCall.priceUsdcMicros — a separate, direct wallet-to-wallet
//    payment rail from PaymentPull (see useServiceListings.ts), not a subset of it.
//  - Agent Store hosted-runtime spend: AgentSpendLog rows with action=X402_PAYMENT — a raw
//    ERC20 transfer from an agent's own AgentWallet (packages/custody-core/src/
//    agentSpendActions.ts's payFromAgentWallet), never routed through PaymentPull, so this is
//    also non-overlapping with the Skills bucket above.
//
// Known remaining gaps (real USDC, no cheap aggregate exists yet — not included): the one-time
// Skill-publish listing fee (SKILL_LISTING_FEE_USDC — platform revenue more than "volume", and
// not persisted anywhere except a per-row feeTxHash with no amount column), and
// ClawdHQEvaluatorPool's per-dispute evaluationRequestFee (a live contract *rate*, not an
// accumulated counter — would need an event-log scan to total). Explicitly excluded on purpose:
// Staking bonds and Circle/CCTP self-bridges move a user's own collateral/funds between their
// own wallets, not protocol volume; Governance/Negotiation have no USDC transfer at all; Social
// has no paid features today.
export async function GET() {
  const [launchTradeSum, soldAuctionListings, degenSum, serviceCallSum, knowledgeUsages, agentSpendSum] = await Promise.all([
    marketplacePrisma.launchTrade.aggregate({ _sum: { usdcAmount: true } }),
    marketplacePrisma.listing.findMany({
      where: { status: ListingStatus.SOLD, mode: ListingMode.AUCTION, highestBidChainId: { not: null } },
      select: { highestBidChainId: true, bids: { select: { chainBidId: true, amountUsdc: true } } },
    }),
    degenPrisma.tradingOrder.aggregate({
      _sum: { requestedUsdc: true },
      where: { mode: DegenMode.LIVE, status: DegenOrderStatus.FILLED },
    }),
    marketplacePrisma.serviceCall.aggregate({ _sum: { priceUsdcMicros: true } }),
    custodyPrisma.knowledgeUsage.findMany({ select: { priceUsdc: true, ownerPullId: true, protocolPullId: true } }),
    custodyPrisma.agentSpendLog.aggregate({
      _sum: { amountUsdc: true },
      where: { action: SpendAction.X402_PAYMENT, status: AgentSpendStatus.SUCCEEDED },
    }),
  ]);

  const launchpadVolumeUsdc = launchTradeSum._sum.usdcAmount ?? 0n;

  const exchangeVolumeUsdc = soldAuctionListings.reduce((sum, listing) => {
    const winningBid = listing.bids.find((b) => b.chainBidId === listing.highestBidChainId);
    return sum + (winningBid?.amountUsdc ?? 0n);
  }, 0n);

  // requestedUsdc/priceUsdc/amountUsdc below are whole-dollar Decimal(30,10) columns (e.g. 15.5
  // meaning $15.50), not raw 6-decimal integers like the BigInt fields above — converted to the
  // same raw-integer convention formatUsdc expects everywhere else.
  const degenVolumeUsdc = BigInt(Math.round(Number(degenSum._sum.requestedUsdc ?? 0) * 1_000_000));

  const serviceVolumeUsdc = serviceCallSum._sum.priceUsdcMicros ?? 0n;

  const knowledgeVolumeUsdc = knowledgeUsages.reduce((sum, u) => sum + BigInt(Math.round(Number(u.priceUsdc) * 1_000_000)), 0n);
  const knowledgePullIds = knowledgeUsages.flatMap((u) => [u.ownerPullId, u.protocolPullId]);

  const otherPulls = await custodyPrisma.paymentPull.findMany({
    where: { status: PaymentPullStatus.SUCCEEDED, id: { notIn: knowledgePullIds } },
    select: { amountUsdc: true },
  });
  const skillsVolumeUsdc = otherPulls.reduce((sum, p) => sum + BigInt(Math.round(Number(p.amountUsdc) * 1_000_000)), 0n);

  const agentStoreVolumeUsdc = BigInt(Math.round(Number(agentSpendSum._sum.amountUsdc ?? 0) * 1_000_000));

  const totalUsdc =
    launchpadVolumeUsdc + exchangeVolumeUsdc + degenVolumeUsdc + serviceVolumeUsdc + knowledgeVolumeUsdc + skillsVolumeUsdc + agentStoreVolumeUsdc;

  return NextResponse.json({
    launchpadVolumeUsdc: launchpadVolumeUsdc.toString(),
    exchangeVolumeUsdc: exchangeVolumeUsdc.toString(),
    degenVolumeUsdc: degenVolumeUsdc.toString(),
    serviceVolumeUsdc: serviceVolumeUsdc.toString(),
    knowledgeVolumeUsdc: knowledgeVolumeUsdc.toString(),
    skillsVolumeUsdc: skillsVolumeUsdc.toString(),
    agentStoreVolumeUsdc: agentStoreVolumeUsdc.toString(),
    totalUsdc: totalUsdc.toString(),
  });
}
