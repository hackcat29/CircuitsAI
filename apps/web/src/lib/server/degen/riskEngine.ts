import { prisma, Prisma, Venue, RiskEventKind, type Chain, type TradingAgentConfig } from "@clawdhq/degen-db";
import { getGraduationProgress } from "@/lib/server/degen/venues/clawdhqLaunch";

// Runs before every order, PAPER or LIVE alike — see the plan's "Risk engine" section. The
// graduation guard exists specifically because ClawdHQLaunchpad's buyTokens/sellTokens both
// revert once a launch graduates and there's no DEX migration anywhere in the contracts — an
// agent that walks a position into graduation is stuck holding an untradeable token, so new
// CLAWDHQ_LAUNCH buys are blocked as usdcRaised approaches the threshold rather than letting a
// strategy discover the dead end at graduation time.

const GRADUATION_GUARD_THRESHOLD_BPS = 9_000n; // block new buys past 90% of the way to graduation

export interface RiskCheckInput {
  chain: Chain;
  agentChainId: string;
  venue: Venue;
  action: string;
  market: string;
  sizeUsdc: Prisma.Decimal;
}

export type RiskCheckResult = { allowed: true; config: TradingAgentConfig } | { allowed: false; reason: string; kind: RiskEventKind };

async function logRiskEvent(chain: Chain, agentChainId: string, kind: RiskEventKind, detail: string): Promise<void> {
  await prisma.riskEvent.create({ data: { chain, agentChainId, kind, detail } });
}

/** Sum of Position.realizedPnlUsdc across everything this agent closed today, in its
 * configured mode. A reasonable approximation of "today's trading loss" without a full P&L
 * attribution engine — every Position row is already updated transactionally alongside the
 * TradingOrder that moved it (see packages/degen-db's schema comment), so this is a plain
 * aggregate, not a derived computation of its own. */
async function todaysRealizedPnl(chain: Chain, agentChainId: string, mode: TradingAgentConfig["mode"]): Promise<Prisma.Decimal> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const positions = await prisma.position.findMany({
    where: { chain, agentChainId, mode, updatedAt: { gte: startOfDay } },
    select: { realizedPnlUsdc: true },
  });
  return positions.reduce((sum, p) => sum.plus(p.realizedPnlUsdc), new Prisma.Decimal(0));
}

export async function checkRisk(input: RiskCheckInput): Promise<RiskCheckResult> {
  const { chain, agentChainId, venue, action, market, sizeUsdc } = input;

  const config = await prisma.tradingAgentConfig.findUnique({ where: { chain_agentChainId: { chain, agentChainId } } });
  if (!config) {
    return { allowed: false, reason: "Trading is not configured for this agent yet", kind: RiskEventKind.VENUE_NOT_ALLOWED };
  }

  if (config.killSwitchEnabled) {
    return { allowed: false, reason: config.killedReason ?? "Kill switch is engaged", kind: RiskEventKind.KILL_SWITCH };
  }

  if (!config.allowedVenues.includes(venue)) {
    await logRiskEvent(chain, agentChainId, RiskEventKind.VENUE_NOT_ALLOWED, `${venue} is not in this agent's allowed venues`);
    return { allowed: false, reason: `${venue} is not enabled for this agent`, kind: RiskEventKind.VENUE_NOT_ALLOWED };
  }

  if (sizeUsdc.gt(config.maxPositionUsdc)) {
    await logRiskEvent(chain, agentChainId, RiskEventKind.POSITION_CAP, `Order size ${sizeUsdc.toString()} exceeds cap ${config.maxPositionUsdc.toString()}`);
    return {
      allowed: false,
      reason: `Order size exceeds this agent's max position cap (${config.maxPositionUsdc.toString()} USDC)`,
      kind: RiskEventKind.POSITION_CAP,
    };
  }

  const realizedToday = await todaysRealizedPnl(chain, agentChainId, config.mode);
  if (realizedToday.isNegative() && realizedToday.abs().gte(config.maxDailyLossUsdc)) {
    const reason = `Daily loss cap breached (${realizedToday.abs().toString()} >= ${config.maxDailyLossUsdc.toString()} USDC), kill switch engaged automatically`;
    await prisma.tradingAgentConfig.update({
      where: { id: config.id },
      data: { killSwitchEnabled: true, killedAt: new Date(), killedReason: reason },
    });
    await logRiskEvent(chain, agentChainId, RiskEventKind.DAILY_LOSS, reason);
    return { allowed: false, reason, kind: RiskEventKind.DAILY_LOSS };
  }

  if (venue === Venue.CLAWDHQ_LAUNCH && action === "BUY") {
    const progress = await getGraduationProgress(market);
    if (progress && !progress.graduated && progress.graduationThreshold > 0n) {
      const progressBps = (progress.usdcRaised * 10_000n) / progress.graduationThreshold;
      if (progressBps >= GRADUATION_GUARD_THRESHOLD_BPS) {
        const reason =
          "This launch is close to graduation. New buys are blocked because ClawdHQCore has no trading path after graduation (see ClawdHQCore.sol's LaunchNotActive revert)";
        await logRiskEvent(chain, agentChainId, RiskEventKind.GRADUATION_GUARD, `${market} at ${progressBps.toString()}bps toward graduation`);
        return { allowed: false, reason, kind: RiskEventKind.GRADUATION_GUARD };
      }
    }
  }

  return { allowed: true, config };
}
