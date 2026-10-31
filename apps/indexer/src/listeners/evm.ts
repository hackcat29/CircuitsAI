import { createPublicClient, createWalletClient, getContract, http, parseAbi, parseEventLogs, type Address, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { clawdHQAgentExchangeAbi, clawdHQCoreAbi, clawdHQCrossChainIdentityAbi, clawdHQGovernorAbi, clawdHQLaunchpadAbi, httpWithRateLimitRetry, xeroFactoryAbi, xeroPairAbi } from "@clawdhq/sdk";
import { computeFairValue, type AgentTier } from "@clawdhq/valuation";
import { ListingMode, ListingStatus, LaunchBuybackInterval, ProposalCategory, ProposalState, prisma } from "@clawdhq/marketplace-db";
import {
  provisionAgentWallet,
  provisionAgentWalletForOwner,
  getOrCreateRegistrarWallet,
  getDecryptedRegistrarWallet,
  advancePipelineForJobOutcome,
  postAgentActivityToClawdHq,
  circuitsAgentProfileUrl,
  viemChainFor,
  rpcTransportFor,
  type EvmPrismaChain,
} from "@clawdhq/custody-core";
import { POLL_INTERVAL_MS, type EvmChainIndexerConfig } from "../config.js";
import { recordPendingRelay } from "../relayers/crossChainIdentity.js";

/** apps/web's `getOnChainAgentOwner` casts the other direction (marketplace-db's Chain ->
 * custody-db's Chain) for the same reason: these are deliberately duplicated enums with
 * identical string values but distinct nominal TS types across every *-db package (see each
 * schema.prisma's "keep in sync by hand" comment) — a straight `as unknown as` is the
 * established, intentional way to cross that boundary, not a type-safety gap being papered
 * over. */
function toCustodyChain(chain: EvmChainIndexerConfig["prismaChain"]): EvmPrismaChain {
  return chain as unknown as EvmPrismaChain;
}

function toListingMode(mode: number): ListingMode {
  return mode === 1 ? ListingMode.AUCTION : ListingMode.OPEN;
}

function toListingStatus(status: number): ListingStatus {
  const byIndex = [ListingStatus.ACTIVE, ListingStatus.SOLD, ListingStatus.CANCELLED, ListingStatus.EXPIRED];
  return byIndex[status] ?? ListingStatus.ACTIVE;
}

function toDateTime(unixSeconds: bigint): Date {
  return new Date(Number(unixSeconds) * 1000);
}

// Matches ClawdHQGovernor.sol's `category` uint8 ordering exactly (0=Parameters,1=Treasury,
// 2=Upgrade,3=Skill,4=Other — same order as the frontend's CATEGORY_STYLE map).
function toProposalCategory(category: number): ProposalCategory {
  const byIndex = [ProposalCategory.PARAMETERS, ProposalCategory.TREASURY, ProposalCategory.UPGRADE, ProposalCategory.SKILL, ProposalCategory.OTHER];
  return byIndex[category] ?? ProposalCategory.OTHER;
}

// Matches ClawdHQLaunchpad.sol's BuybackInterval enum ordering exactly (Solidity enums compile
// to a plain uint8) — same pattern as toProposalCategory below.
function toBuybackInterval(interval: number): LaunchBuybackInterval {
  const byIndex = [LaunchBuybackInterval.DAILY, LaunchBuybackInterval.WEEKLY, LaunchBuybackInterval.MONTHLY, LaunchBuybackInterval.QUARTERLY];
  return byIndex[interval] ?? LaunchBuybackInterval.DAILY;
}

// Matches ClawdHQGovernor.sol's ProposalState enum ordering exactly.
function toProposalState(state: number): ProposalState {
  const byIndex = [
    ProposalState.ACTIVE,
    ProposalState.SUCCEEDED,
    ProposalState.DEFEATED,
    ProposalState.QUORUM_NOT_MET,
    ProposalState.CANCELED,
    ProposalState.EXECUTED,
  ];
  return byIndex[state] ?? ProposalState.ACTIVE;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Re-reads a listing's full current state directly from the contract and upserts it — the
 * indexer treats events purely as "something about this id changed, go re-sync it" triggers
 * rather than trying to reconstruct state incrementally from each event's own arguments.
 * That's simpler and more robust: there's exactly one code path that writes a Listing row,
 * and it can never drift from what's actually on-chain at read time.
 *
 * Returns whether this call just observed a *new* sale (status transitioning into SOLD, not
 * merely re-confirming an already-sold listing on a later resync) or a brand-new listing (no
 * prior row at all — a listingId's very first event is always ListingCreated, so "no existing
 * row" and "just created" are the same thing here) — the only pieces of information the ClawdHQ
 * activity-post hook in processBatch needs, without re-deriving them from a second read of the
 * same row. `null` if the listing doesn't exist. */
async function syncListing(
  publicClient: PublicClient,
  config: EvmChainIndexerConfig,
  listingId: bigint,
): Promise<{ agentId: bigint; justSold: boolean; justCreated: boolean; reservePriceUsdc: bigint } | null> {
  const listing = (await publicClient.readContract({
    address: config.exchangeAddress,
    abi: clawdHQAgentExchangeAbi,
    functionName: "listings",
    args: [listingId],
  })) as readonly [bigint, bigint, Address, number, number, bigint, bigint, bigint, bigint, bigint, bigint];

  const [, agentId, seller, mode, status, fairValueSnapshotUsdc, reservePriceUsdc, endTime, highestBidId, createdAt, updatedAt] = listing;
  if (createdAt === 0n) return null; // listingId never existed on this contract (defensive; shouldn't happen for a real event)

  const newStatus = toListingStatus(status);
  const existing = await prisma.listing.findUnique({ where: { chain_chainListingId: { chain: config.prismaChain, chainListingId: listingId.toString() } } });
  const justSold = newStatus === ListingStatus.SOLD && existing?.status !== ListingStatus.SOLD;
  const justCreated = existing === null;

  const cachedValuation = await prisma.agentValuationCache.findUnique({
    where: { chain_agentChainId: { chain: config.prismaChain, agentChainId: agentId.toString() } },
    select: { fairValueUsdc: true },
  });
  const effectiveFairValue = cachedValuation && cachedValuation.fairValueUsdc > 0n ? cachedValuation.fairValueUsdc : fairValueSnapshotUsdc;

  await prisma.listing.upsert({
    where: { chain_chainListingId: { chain: config.prismaChain, chainListingId: listingId.toString() } },
    create: {
      chain: config.prismaChain,
      chainListingId: listingId.toString(),
      agentChainId: agentId.toString(),
      seller,
      mode: toListingMode(mode),
      status: newStatus,
      fairValueSnapshotUsdc: effectiveFairValue,
      reservePriceUsdc,
      endTime: endTime === 0n ? null : toDateTime(endTime),
      highestBidChainId: highestBidId === 0n ? null : highestBidId.toString(),
      createdAtChain: toDateTime(createdAt),
      updatedAtChain: toDateTime(updatedAt),
    },
    update: {
      fairValueSnapshotUsdc: effectiveFairValue,
      status: newStatus,
      endTime: endTime === 0n ? null : toDateTime(endTime),
      highestBidChainId: highestBidId === 0n ? null : highestBidId.toString(),
      updatedAtChain: toDateTime(updatedAt),
    },
  });

  return { agentId, justSold, justCreated, reservePriceUsdc };
}

async function syncBid(publicClient: PublicClient, config: EvmChainIndexerConfig, bidId: bigint): Promise<void> {
  const bid = (await publicClient.readContract({
    address: config.exchangeAddress,
    abi: clawdHQAgentExchangeAbi,
    functionName: "bids",
    args: [bidId],
  })) as readonly [bigint, bigint, Address, bigint, boolean, bigint];

  const [, listingId, bidder, amountUsdc, active, createdAt] = bid;
  if (createdAt === 0n) return;

  const listing = await prisma.listing.findUnique({
    where: { chain_chainListingId: { chain: config.prismaChain, chainListingId: listingId.toString() } },
  });
  if (!listing) {
    // The listing's own event is always emitted at or before any bid on it, but batches are
    // processed together, so make sure it exists before inserting a bid that references it.
    await syncListing(publicClient, config, listingId);
  }
  const listingDbId = (
    await prisma.listing.findUniqueOrThrow({
      where: { chain_chainListingId: { chain: config.prismaChain, chainListingId: listingId.toString() } },
    })
  ).id;

  await prisma.bid.upsert({
    where: { chain_listingDbId_chainBidId: { chain: config.prismaChain, listingDbId, chainBidId: bidId.toString() } },
    create: {
      chain: config.prismaChain,
      chainBidId: bidId.toString(),
      listingDbId,
      bidder,
      amountUsdc,
      active,
      createdAtChain: toDateTime(createdAt),
    },
    update: { active, amountUsdc },
  });
}

async function syncAgentValuation(publicClient: PublicClient, config: EvmChainIndexerConfig, agentId: bigint): Promise<void> {
  const card = (await publicClient.readContract({
    address: config.coreAddress,
    abi: clawdHQCoreAbi,
    functionName: "agents",
    args: [agentId],
  })) as readonly [
    bigint, Address, string, string, string, `0x${string}`, boolean, boolean, boolean, boolean, number, bigint, bigint, bigint, number, number, bigint, number,
  ];
  // AgentCard layout: agentId, owner, name, agentURI, endpoint, metadataHash, supportsX402,
  // supportsA2A, supportsMCP, active, tier, createdAt, updatedAt, lastJobAt, jobsCompleted,
  // jobsFailed, usdcRevenue, reputationBps.
  const [, , , , , , supportsX402, supportsA2A, supportsMCP, , tier, createdAt, , lastJobAt, , , usdcRevenue, reputationBps] = card;

  // Look up any Launchpad token launch for this agent
  const launch = await prisma.launch.findFirst({
    where: { chain: config.prismaChain, agentChainId: agentId.toString() },
  });
  let tokenUsdcRaised = 0n;
  let tokenVolumeUsdc = 0n;
  if (launch) {
    tokenUsdcRaised = launch.usdcRaised;
    const tradesSum = await prisma.launchTrade.aggregate({
      where: { chain: config.prismaChain, launchChainId: launch.launchChainId },
      _sum: { usdcAmount: true },
    }).catch(() => ({ _sum: { usdcAmount: null } }));
    tokenVolumeUsdc = tradesSum._sum.usdcAmount ?? launch.usdcRaised;
  }

  const result = computeFairValue({
    usdcRevenue,
    tier: tier as AgentTier,
    reputationBps,
    lastJobAtSeconds: Number(lastJobAt),
    supportsX402,
    supportsA2A,
    supportsMcp: supportsMCP,
    nowSeconds: Math.floor(Date.now() / 1000),
    createdAtSeconds: Number(createdAt),
    tokenUsdcRaised,
    tokenVolumeUsdc,
  });

  await prisma.agentValuationCache.upsert({
    where: { chain_agentChainId: { chain: config.prismaChain, agentChainId: agentId.toString() } },
    create: {
      chain: config.prismaChain,
      agentChainId: agentId.toString(),
      fairValueUsdc: result.fairValueUsdc,
      formulaVersion: result.formulaVersion,
    },
    update: {
      fairValueUsdc: result.fairValueUsdc,
      formulaVersion: result.formulaVersion,
    },
  });

  // Keep any active listing's fairValueSnapshotUsdc in sync with the upgraded valuation
  await prisma.listing.updateMany({
    where: { chain: config.prismaChain, agentChainId: agentId.toString(), status: "ACTIVE" },
    data: { fairValueSnapshotUsdc: result.fairValueUsdc },
  }).catch(() => {});
}

/** Re-reads an agent's full current state directly from the contract and upserts it into the
 * `Agent` off-chain read cache — same "event is purely a resync trigger" convention as
 * syncListing/syncAgentValuation above. Lets apps/web serve the Agent Directory, Portfolio, and
 * "my agents" reads from Postgres instead of live RPC, which is what was silently rendering
 * successfully-registered agents (and their contributor points) as missing whenever Arc
 * Testnet's public RPC rate-limited the page's on-chain reads. */
export async function syncAgent(publicClient: PublicClient, config: EvmChainIndexerConfig, agentId: bigint): Promise<void> {
  const card = (await publicClient.readContract({
    address: config.coreAddress,
    abi: clawdHQCoreAbi,
    functionName: "agents",
    args: [agentId],
  })) as readonly [
    bigint, Address, string, string, string, `0x${string}`, boolean, boolean, boolean, boolean, number, bigint, bigint, bigint, number, number, bigint, number,
  ];
  // AgentCard layout: agentId, owner, name, agentURI, endpoint, metadataHash, supportsX402,
  // supportsA2A, supportsMCP, active, tier, createdAt, updatedAt, lastJobAt, jobsCompleted,
  // jobsFailed, usdcRevenue, reputationBps — same layout syncAgentValuation above decodes.
  const [, owner, name, agentURI, endpoint, metadataHash, supportsX402, supportsA2A, supportsMCP, active, tier, createdAt, updatedAt, lastJobAt, jobsCompleted, jobsFailed, usdcRevenue, reputationBps] = card;
  if (createdAt === 0n) return; // agentId never existed on this contract (defensive; shouldn't happen for a real event)

  const shared = {
    owner,
    name,
    agentUri: agentURI,
    endpoint,
    metadataHash,
    supportsX402,
    supportsA2A,
    supportsMcp: supportsMCP,
    active,
    tier,
    jobsCompleted,
    jobsFailed,
    usdcRevenue,
    reputationBps,
    lastJobAtChain: lastJobAt === 0n ? null : toDateTime(lastJobAt),
    updatedAtChain: toDateTime(updatedAt),
  };

  await prisma.agent.upsert({
    where: { chain_agentChainId: { chain: config.prismaChain, agentChainId: agentId.toString() } },
    create: { chain: config.prismaChain, agentChainId: agentId.toString(), createdAtChain: toDateTime(createdAt), ...shared },
    update: shared,
  });
}

/** Just the `name`, straight off the contract — same read `syncAgent` does, minus the DB write.
 * Used for ClawdHQ activity posts (see postClawdHqActivity below), which need a name but have no
 * reason to also perform (or wait on) a full Agent-cache upsert; a direct on-chain read is also
 * strictly more reliable here than a prisma.agent lookup, since it can't be stale/not-yet-synced. */
async function getAgentNameForPost(publicClient: PublicClient, config: EvmChainIndexerConfig, agentId: bigint): Promise<string | null> {
  const card = (await publicClient.readContract({
    address: config.coreAddress,
    abi: clawdHQCoreAbi,
    functionName: "agents",
    args: [agentId],
  })) as readonly [bigint, Address, string, ...unknown[]];
  const [, , name] = card;
  return name || null;
}

/** Shared by every ClawdHQ activity-post call site below — resolves the agent's name then posts,
 * swallowing its own errors (postAgentActivityToClawdHq already does too, but the name lookup
 * here is a separate on-chain read that can independently fail, e.g. an RPC hiccup, and a
 * missing announcement is never worth interrupting the indexer's main sync loop over). */
async function postClawdHqActivity(
  publicClient: PublicClient,
  config: EvmChainIndexerConfig,
  agentId: bigint,
  message: (name: string, profileUrl: string) => string,
  options?: { category?: string; tags?: string[]; mediaUrl?: string },
): Promise<void> {
  try {
    const name = await getAgentNameForPost(publicClient, config, agentId);
    if (!name) return;
    const profileUrl = circuitsAgentProfileUrl(name, agentId.toString());
    await postAgentActivityToClawdHq(toCustodyChain(config.prismaChain), agentId.toString(), message(name, profileUrl), {
      category: options?.category || "ACTIVITY_BROADCAST",
      tags: options?.tags || ["activity-broadcast", "circuits-protocol", "arc-testnet"],
      mediaUrl: options?.mediaUrl,
    });
  } catch (err) {
    console.error(`[indexer:${config.chain}] ClawdHQ activity post failed for agent ${agentId}:`, err instanceof Error ? err.message : err);
  }
}

/** Re-reads a governance proposal's full current state directly from the contract and
 * upserts it — same "event is purely a resync trigger" convention as syncListing above, needed
 * here because a proposal's `state`/`votesFor`/`votesAgainst` keep changing after creation
 * (every VoteCast, and ProposalCanceled/ProposalExecuted). No-ops if this chain has no
 * ClawdHQGovernor deployed yet. */
interface GovernorProposalStruct {
  id: bigint;
  proposer: Address;
  proposerAgentId: bigint;
  category: number;
  title: string;
  description: string;
  startTime: bigint;
  endTime: bigint;
  quorumRequired: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  canceled: boolean;
  executed: boolean;
}

async function syncProposal(publicClient: PublicClient, config: EvmChainIndexerConfig, proposalId: bigint): Promise<void> {
  if (!config.governorAddress) return;
  const governorAddress = config.governorAddress;

  // Unlike `agents()`/`listings()` (public mapping getters with several unnamed positional
  // return values, decoded by viem as an array), `getProposal` has a single named-struct
  // return value — viem decodes that as a plain keyed object, not a tuple.
  const [proposal, state] = await Promise.all([
    publicClient.readContract({
      address: governorAddress,
      abi: clawdHQGovernorAbi,
      functionName: "getProposal",
      args: [proposalId],
    }) as Promise<GovernorProposalStruct>,
    publicClient.readContract({
      address: governorAddress,
      abi: clawdHQGovernorAbi,
      functionName: "state",
      args: [proposalId],
    }) as Promise<number>,
  ]);

  const { proposer, proposerAgentId, category, title, description, startTime, endTime, quorumRequired, votesFor, votesAgainst } = proposal;

  await prisma.governanceProposal.upsert({
    where: { chain_chainProposalId: { chain: config.prismaChain, chainProposalId: proposalId.toString() } },
    create: {
      chain: config.prismaChain,
      chainProposalId: proposalId.toString(),
      proposer,
      proposerAgentChainId: proposerAgentId.toString(),
      category: toProposalCategory(category),
      title,
      description,
      state: toProposalState(state),
      startTime: toDateTime(startTime),
      endTime: toDateTime(endTime),
      quorumRequired,
      votesFor,
      votesAgainst,
      createdAtChain: toDateTime(startTime), // no separate on-chain creation timestamp; startTime doubles as it
      updatedAtChain: new Date(),
    },
    update: {
      state: toProposalState(state),
      votesFor,
      votesAgainst,
      updatedAtChain: new Date(),
    },
  });
}

/** Unlike syncListing/syncBid, this writes a GovernanceVote row directly from the `VoteCast`
 * event's own arguments rather than re-reading the contract — there is no per-vote getter on
 * ClawdHQGovernor (only the aggregated `votesFor`/`votesAgainst` on the Proposal itself, which
 * syncProposal already re-reads), and a cast vote's own fields (support/weight) never change
 * after the fact, so there is nothing for a later resync to correct. Requires the parent
 * proposal's row to already exist — `processBatch` always syncs proposals before votes. */
async function syncVote(config: EvmChainIndexerConfig, args: { proposalId: bigint; agentId: bigint; voter: Address; support: boolean; weight: bigint }, blockTimestamp: bigint): Promise<void> {
  const proposal = await prisma.governanceProposal.findUnique({
    where: { chain_chainProposalId: { chain: config.prismaChain, chainProposalId: args.proposalId.toString() } },
  });
  if (!proposal) return; // defensive; syncProposal for this id already ran earlier in the same batch

  await prisma.governanceVote.upsert({
    where: {
      chain_proposalDbId_voterAgentChainId: { chain: config.prismaChain, proposalDbId: proposal.id, voterAgentChainId: args.agentId.toString() },
    },
    create: {
      chain: config.prismaChain,
      proposalDbId: proposal.id,
      voterAgentChainId: args.agentId.toString(),
      voter: args.voter,
      support: args.support,
      weight: args.weight,
      createdAtChain: toDateTime(blockTimestamp),
    },
    update: {},
  });
}

/** Direct-from-event write, same reasoning as syncVote: a trade is immutable once it happens —
 * there's no per-trade getter on ClawdHQLaunchpad to resync from, and nothing about a past
 * buy/sell ever changes. Upserts on (chain, txHash, logIndex) so re-processing the same block
 * range on a restart is a no-op rather than a duplicate row. */
async function syncTrade(
  config: EvmChainIndexerConfig,
  args: { launchId: bigint; trader: Address; side: "BUY" | "SELL"; tokenAmount: bigint; usdcAmount: bigint; txHash: string; logIndex: number },
  blockTimestamp: bigint,
): Promise<void> {
  await prisma.launchTrade.upsert({
    where: { chain_txHash_logIndex: { chain: config.prismaChain, txHash: args.txHash, logIndex: args.logIndex } },
    create: {
      chain: config.prismaChain,
      launchChainId: args.launchId.toString(),
      traderAddress: args.trader,
      side: args.side,
      // Decimal(78,0), not BigInt/BIGINT — a raw 18-decimal AgentToken amount routinely
      // exceeds Postgres bigint's ~9.22e18 ceiling (see the column's own doc comment in
      // schema.prisma). Prisma's Decimal input accepts string/number/Decimal, not a native
      // bigint directly.
      tokenAmount: args.tokenAmount.toString(),
      usdcAmount: args.usdcAmount,
      txHash: args.txHash,
      logIndex: args.logIndex,
      createdAtChain: toDateTime(blockTimestamp),
    },
    update: {},
  });
}

/// Re-reads a launch's full current state directly from ClawdHQLaunchpad.sol's `launches()`
/// getter and upserts it into the `Launch` off-chain read cache — same "event is purely a
/// resync trigger" convention as syncListing/syncAgent above. This is what makes a
/// trending/gainers/just-graduated sortable list possible: before this, apps/web's
/// useLaunches.ts had to iterate every launchId over live RPC on every page load (bounded to
/// the most recent 20), the same Arc-rate-limit problem the Agent cache was built to fix.
export async function syncLaunch(publicClient: PublicClient, config: EvmChainIndexerConfig, launchId: bigint): Promise<void> {
  const launch = (await publicClient.readContract({
    address: config.launchpadAddress,
    abi: clawdHQLaunchpadAbi,
    functionName: "launches",
    args: [launchId],
  })) as readonly [
    bigint, bigint, Address, string, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean, number, bigint, number, bigint, bigint, bigint, number,
  ];
  // AgentLaunch layout: launchId, agentId, token, name, symbol, creator, totalSupply,
  // usdcRaised, tokensSold, graduationThreshold, bondingBasePrice (deprecated), bondingSlope
  // (deprecated), createdAt, graduatedAt, antiSnipeUntil, graduated, active, creatorAllocBps
  // (deprecated), buybackPoolUsdc (deprecated), buybackInterval, nextBuybackAt, initialVirtualUsdcReserve,
  // tradingStartsAt, buybackBps
  const [
    ,
    agentId,
    token,
    name,
    symbol,
    creator,
    totalSupply,
    usdcRaised,
    tokensSold,
    graduationThreshold,
    bondingBasePrice,
    bondingSlope,
    createdAt,
    graduatedAt,
    ,
    graduated,
    active,
    ,
    buybackPoolUsdc,
    buybackInterval,
    nextBuybackAt,
    initialVirtualUsdcReserve,
    tradingStartsAt,
    buybackBps,
  ] = launch;
  if (createdAt === 0n) return; // launchId never existed on this contract (defensive; shouldn't happen for a real event)

  const shared = {
    token,
    name,
    symbol,
    creator,
    // Decimal(78,0), not BigInt/BIGINT — see LaunchTrade.tokenAmount's doc comment in
    // schema.prisma for why (a raw 18-decimal AgentToken amount routinely exceeds Postgres
    // bigint's ~9.22e18 ceiling; TOTAL_AGENT_TOKEN_SUPPLY alone is 1e27).
    totalSupply: totalSupply.toString(),
    usdcRaised,
    tokensSold: tokensSold.toString(),
    graduationThreshold,
    bondingBasePrice,
    bondingSlope,
    initialVirtualUsdcReserve,
    buybackPoolUsdc: buybackPoolUsdc ?? 0n,
    buybackBps: Number(buybackBps ?? 2000),
    buybackInterval: toBuybackInterval(buybackInterval),
    nextBuybackAt: toDateTime(nextBuybackAt),
    tradingStartsAt: toDateTime(tradingStartsAt),
    graduated,
    active,
    graduatedAtChain: graduatedAt === 0n ? null : toDateTime(graduatedAt),
    updatedAtChain: new Date(),
  };

  await prisma.launch.upsert({
    where: { chain_launchChainId: { chain: config.prismaChain, launchChainId: launchId.toString() } },
    create: {
      chain: config.prismaChain,
      launchChainId: launchId.toString(),
      agentChainId: agentId.toString(),
      createdAtChain: toDateTime(createdAt),
      ...shared,
    },
    update: shared,
  });
}

// USDC has 6 decimals on-chain — every raw on-chain usdc amount in this file is in these units
// until explicitly divided by 1e6 for display (see the LaunchGraduated post message below).
const LAUNCH_MILESTONE_STEP_USDC_RAW = 1_000n * 1_000_000n; // post once per $1,000 of cumulative usdcRaised crossed

/** Re-reads a launch's cumulative usdcRaised directly from the contract (ClawdHQLaunchpad.sol's
 * `launches()` getter) and compares it against the highest $1,000 bracket already announced,
 * persisted in LaunchMilestone — there's no other Launch-state model to derive "already
 * announced" from (see LaunchTrade's own doc comment), and usdcRaised's exact incrementing/
 * decrementing behavior around sells isn't worth guessing at when a direct read settles it either
 * way. Returns the newly-crossed bracket (floored to the nearest $1,000) if raised has moved into
 * a new one since the last time this ran, `null` for the common case where it hasn't (including
 * every batch where nothing crossed a new $1,000 line). Deliberately posts once for the highest
 * newly-crossed bracket rather than once per $1,000 skipped over by a single large trade — e.g.
 * raised jumping from $500 to $3,500 in one buy announces "$3,000" once, not three separate
 * catch-up posts. */
async function syncLaunchMilestone(publicClient: PublicClient, config: EvmChainIndexerConfig, launchId: bigint): Promise<{ agentId: bigint; milestoneUsdcRaw: bigint } | null> {
  const launch = (await publicClient.readContract({
    address: config.launchpadAddress,
    abi: clawdHQLaunchpadAbi,
    functionName: "launches",
    args: [launchId],
  })) as readonly [
    bigint, bigint, Address, string, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean, number, bigint, number, bigint, bigint, bigint,
  ];
  const agentId = launch[1];
  const usdcRaised = launch[7];

  const existing = await prisma.launchMilestone.findUnique({ where: { chain_launchChainId: { chain: config.prismaChain, launchChainId: launchId.toString() } } });
  const lastMilestone = existing?.lastMilestoneUsdc ?? 0n;
  const currentMilestone = (usdcRaised / LAUNCH_MILESTONE_STEP_USDC_RAW) * LAUNCH_MILESTONE_STEP_USDC_RAW;
  if (currentMilestone === 0n || currentMilestone <= lastMilestone) return null;

  await prisma.launchMilestone.upsert({
    where: { chain_launchChainId: { chain: config.prismaChain, launchChainId: launchId.toString() } },
    create: { chain: config.prismaChain, launchChainId: launchId.toString(), lastMilestoneUsdc: currentMilestone },
    update: { lastMilestoneUsdc: currentMilestone },
  });

  return { agentId, milestoneUsdcRaw: currentMilestone };
}

const AGENT_WALLET_REGISTRY_ABI = parseAbi([
  "function agentWallet(uint256 agentId) view returns (address)",
  "function setAgentWallet(uint256 agentId, address wallet) external",
]);

/** Provisions an agent's canonical custodied wallet (custody-core's AgentWallet, generated
 * off-chain, or a Circle Agent Wallet the owner already brought in — see
 * provisionAgentWalletForOwner) and binds it on-chain via AgentWalletRegistry.sol's
 * registrar-gated `setAgentWallet` — a separate contract from ClawdHQCore (see
 * AgentWalletRegistry.sol's doc comment for why), which ClawdHQCore's `_payoutAddress` reads
 * from at job-payout/launchpad-creator-allocation time. No-ops if this chain has no registry
 * deployed yet. Idempotent both off-chain (provisionAgentWallet/provisionAgentWalletForOwner)
 * and on-chain (a read-first check, plus setAgentWallet itself reverts on a second call) — safe
 * to re-run over the same event on a restart/replay or from a historical-backfill script.
 *
 * `ownerAddress` is optional and only ever supplied by the live event-driven path (which reads
 * it straight off the AgentRegistered event) — it's what lets a pending Circle-wallet intent be
 * found at all. Omitting it (the backfill script's case) skips the intent lookup and always
 * auto-provisions LOCAL, which is correct there regardless: an already-registered agent's
 * on-chain wallet binding is one-time-settable (see AgentWalletRegistry.sol), so a backfilled
 * agent could never have had a live intent consumed for it anyway. */
export async function provisionAgentWalletOnChain(publicClient: PublicClient, config: EvmChainIndexerConfig, agentId: bigint, ownerAddress?: Address): Promise<void> {
  if (!config.agentWalletRegistryAddress) return;
  const registryAddress = config.agentWalletRegistryAddress;
  const custodyChain = toCustodyChain(config.prismaChain);

  const existingWallet = (await publicClient.readContract({
    address: registryAddress,
    abi: AGENT_WALLET_REGISTRY_ABI,
    functionName: "agentWallet",
    args: [agentId],
  })) as Address;
  if (existingWallet !== "0x0000000000000000000000000000000000000000") return; // already set on-chain

  const custodyWallet = ownerAddress
    ? await provisionAgentWalletForOwner(custodyChain, agentId.toString(), ownerAddress)
    : await provisionAgentWallet(custodyChain, agentId.toString());

  await getOrCreateRegistrarWallet(custodyChain);
  const registrar = await getDecryptedRegistrarWallet(custodyChain);
  if (!registrar) {
    console.error(`[indexer:${config.chain}] could not load a RegistrarWallet for ${custodyChain} — cannot set agent ${agentId}'s wallet on-chain`);
    return;
  }

  const account = privateKeyToAccount(registrar.privateKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: viemChainFor(custodyChain), transport: rpcTransportFor(custodyChain) });

  try {
    const hash = await walletClient.writeContract({
      address: registryAddress,
      abi: AGENT_WALLET_REGISTRY_ABI,
      functionName: "setAgentWallet",
      args: [agentId, custodyWallet.address as Address],
      account,
      chain: viemChainFor(custodyChain),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[indexer:${config.chain}] agent ${agentId} wallet set on-chain: ${custodyWallet.address}`);
  } catch (err) {
    // Most likely a benign race (another process's call already landed between our read-first
    // check and this write, so the contract's own WalletAlreadySet revert fired) rather than a
    // failure worth crashing the batch over.
    console.error(`[indexer:${config.chain}] setAgentWallet(${agentId}) failed:`, err instanceof Error ? err.message : err);
  }
}

interface GraduatedPairInfo {
  launchChainId: string;
  pairAddress: Address;
  token0IsUsdc: boolean;
}

const pairInfoByLaunchKey = new Map<string, GraduatedPairInfo>();
const backfilledPairKeys = new Set<string>();

async function backfillPairSwaps(
  publicClient: PublicClient,
  config: EvmChainIndexerConfig,
  info: GraduatedPairInfo,
  fromBlock: bigint
): Promise<void> {
  const BACKFILL_LOOKBACK = 30_000n;
  const CHUNK_SIZE = config.logBatchBlocks;
  const startBlock = fromBlock > BACKFILL_LOOKBACK ? fromBlock - BACKFILL_LOOKBACK : 0n;

  try {
    for (let chunkStart = startBlock; chunkStart < fromBlock; chunkStart += CHUNK_SIZE) {
      const chunkEnd = chunkStart + CHUNK_SIZE - 1n < fromBlock ? chunkStart + CHUNK_SIZE - 1n : fromBlock - 1n;
      const logs = await publicClient.getLogs({
        address: info.pairAddress,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      });
      if (logs.length === 0) continue;

      const swapEvents = parseEventLogs({ abi: xeroPairAbi, logs }).filter((e) => e.eventName === "Swap");
      for (const event of swapEvents) {
        const args = event.args as { sender: Address; to: Address; amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint };
        let side: "BUY" | "SELL";
        let tokenAmount: bigint;
        let usdcAmount: bigint;
        let trader: Address;

        if (info.token0IsUsdc) {
          if (args.amount0In > 0n) {
            side = "BUY";
            usdcAmount = args.amount0In;
            tokenAmount = args.amount1Out;
            trader = args.to;
          } else {
            side = "SELL";
            tokenAmount = args.amount1In;
            usdcAmount = args.amount0Out;
            trader = args.sender;
          }
        } else {
          if (args.amount1In > 0n) {
            side = "BUY";
            usdcAmount = args.amount1In;
            tokenAmount = args.amount0Out;
            trader = args.to;
          } else {
            side = "SELL";
            tokenAmount = args.amount0In;
            usdcAmount = args.amount1Out;
            trader = args.sender;
          }
        }

        const block = await publicClient.getBlock({ blockNumber: event.blockNumber });
        await syncTrade(
          config,
          {
            launchId: BigInt(info.launchChainId),
            trader,
            side,
            tokenAmount,
            usdcAmount,
            txHash: event.transactionHash,
            logIndex: event.logIndex,
          },
          block.timestamp
        );
      }
    }
  } catch (err) {
    console.warn(`[indexer:${config.chain}] Pair backfill error for launch ${info.launchChainId}:`, err);
  }
}

async function resolveGraduatedPairs(publicClient: PublicClient, config: EvmChainIndexerConfig): Promise<GraduatedPairInfo[]> {
  if (!config.xeroFactoryAddress || !config.usdcAddress) return [];
  const graduatedLaunches = await prisma.launch.findMany({
    where: { chain: config.prismaChain, graduated: true },
    select: { launchChainId: true, token: true },
  });
  if (graduatedLaunches.length === 0) return [];

  const factory = getContract({
    address: config.xeroFactoryAddress,
    abi: xeroFactoryAbi,
    client: { public: publicClient },
  }) as unknown as { read: { getPair: (args: readonly [Address, Address]) => Promise<Address> } };

  const results: GraduatedPairInfo[] = [];
  for (const l of graduatedLaunches) {
    const key = `${config.prismaChain}:${l.launchChainId}`;
    const cached = pairInfoByLaunchKey.get(key);
    if (cached) {
      results.push(cached);
      continue;
    }
    try {
      const pairAddress = await factory.read.getPair([l.token as Address, config.usdcAddress]);
      if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
        const pair = getContract({
          address: pairAddress,
          abi: xeroPairAbi,
          client: { public: publicClient },
        }) as unknown as { read: { token0: () => Promise<Address> } };
        const token0 = await pair.read.token0();
        const info: GraduatedPairInfo = {
          launchChainId: l.launchChainId,
          pairAddress,
          token0IsUsdc: token0.toLowerCase() === config.usdcAddress.toLowerCase(),
        };
        pairInfoByLaunchKey.set(key, info);
        results.push(info);
      }
    } catch {
      // Defensive fallback if pair not yet deployed
    }
  }
  return results;
}

async function processBatch(publicClient: PublicClient, config: EvmChainIndexerConfig, fromBlock: bigint, toBlock: bigint): Promise<void> {
  // Launchpad and token-swap indexing is retired; historical rows are retained.
  const pairs: Awaited<ReturnType<typeof resolveGraduatedPairs>> = [];
  for (const pair of pairs) {
    const key = `${config.prismaChain}:${pair.launchChainId}`;
    if (!backfilledPairKeys.has(key)) {
      backfilledPairKeys.add(key);
      await backfillPairSwaps(publicClient, config, pair, fromBlock);
    }
  }
  const pairAddresses = pairs.map((p) => p.pairAddress);

  const [exchangeLogsRaw, coreLogsRaw, crossChainIdentityLogsRaw, governorLogsRaw, launchpadLogsRaw, pairLogsRaw] = await Promise.all([
    publicClient.getLogs({ address: config.exchangeAddress, fromBlock, toBlock }),
    publicClient.getLogs({ address: config.coreAddress, fromBlock, toBlock }),
    config.crossChainIdentityAddress
      ? publicClient.getLogs({ address: config.crossChainIdentityAddress, fromBlock, toBlock })
      : Promise.resolve([]),
    config.governorAddress ? publicClient.getLogs({ address: config.governorAddress, fromBlock, toBlock }) : Promise.resolve([]),
    Promise.resolve([]),
    pairAddresses.length > 0 ? publicClient.getLogs({ address: pairAddresses, fromBlock, toBlock }) : Promise.resolve([]),
  ]);

  const exchangeEvents = parseEventLogs({ abi: clawdHQAgentExchangeAbi, logs: exchangeLogsRaw });
  const coreEvents = parseEventLogs({ abi: clawdHQCoreAbi, logs: coreLogsRaw });
  const crossChainIdentityEvents = parseEventLogs({ abi: clawdHQCrossChainIdentityAbi, logs: crossChainIdentityLogsRaw });
  const governorEvents = parseEventLogs({ abi: clawdHQGovernorAbi, logs: governorLogsRaw });
  const launchpadEvents = parseEventLogs({ abi: clawdHQLaunchpadAbi, logs: launchpadLogsRaw });
  const pairEvents = pairAddresses.length > 0 ? parseEventLogs({ abi: xeroPairAbi, logs: pairLogsRaw }) : [];

  // Every `LinkRegistered` means `registerLink` sent one or more CCTP messages out — record a
  // pending relay so runCrossChainIdentityRelayer (a separate loop; see main.ts) picks it up.
  // Tracked at transaction granularity, not per-event: see recordPendingRelay's doc comment.
  const linkRegisteredTxHashes = new Set(
    crossChainIdentityEvents.filter((event) => event.eventName === "LinkRegistered").map((event) => event.transactionHash)
  );
  for (const txHash of linkRegisteredTxHashes) {
    await recordPendingRelay(config.prismaChain, txHash);
  }

  const dirtyListingIds = new Set<bigint>();
  const dirtyBidIds = new Set<bigint>();
  for (const event of exchangeEvents) {
    const args = event.args as Record<string, unknown>;
    if (typeof args.listingId === "bigint") dirtyListingIds.add(args.listingId);
    if (typeof args.bidId === "bigint") dirtyBidIds.add(args.bidId);
  }

  const dirtyAgentIds = new Set<bigint>();
  // owner captured straight off the AgentRegistered event (see the contract's own event
  // signature) rather than a separate on-chain read — provisionAgentWalletOnChain needs it to
  // check for a pending Circle-wallet onboarding intent (see agentWalletCustody.ts's
  // provisionAgentWalletForOwner) before falling back to auto-provisioning a LOCAL wallet.
  const newlyRegisteredAgentIds = new Map<bigint, Address>();
  // A pipeline step's tracked job reaching a terminal on-chain outcome — keyed by jobId (a
  // given jobId only ever reaches one terminal state once, so last-write-in-batch is fine).
  const pipelineJobOutcomes = new Map<bigint, "completed" | "failed">();
  // ClawdHQ activity-post candidates — collected here, posted after the batch's real sync work
  // is done (see the end of processBatch). completedJobAgentIds/disputeResolvedJobIds are keyed
  // by jobId so a job that's both completed *and* the direct result of a dispute resolution (see
  // ClawdHQCore.sol's _resolveDispute -> _releaseEscrow) only produces the one, more specific
  // "won a dispute" post rather than two posts for the same job.
  const completedJobAgentIds = new Map<bigint, bigint>(); // jobId -> agentId
  const launchGraduatedEvents: { launchId: bigint; agentId: bigint; usdcRaised: bigint }[] = [];
  const disputeResolvedJobIds: { jobId: bigint; releasedToAgent: boolean }[] = [];
  for (const event of coreEvents) {
    if (event.eventName === "JobCompleted") {
      const args = event.args as Record<string, unknown>;
      if (typeof args.agentId === "bigint") dirtyAgentIds.add(args.agentId);
      if (typeof args.jobId === "bigint") {
        pipelineJobOutcomes.set(args.jobId, "completed");
        if (typeof args.agentId === "bigint") completedJobAgentIds.set(args.jobId, args.agentId);
      }
    }
    if (event.eventName === "JobCancelled") {
      const args = event.args as Record<string, unknown>;
      if (typeof args.jobId === "bigint") pipelineJobOutcomes.set(args.jobId, "failed");
    }
    if (event.eventName === "DisputeResolved") {
      const args = event.args as Record<string, unknown>;
      if (typeof args.jobId === "bigint") {
        pipelineJobOutcomes.set(args.jobId, args.releasedToAgent ? "completed" : "failed");
        disputeResolvedJobIds.push({ jobId: args.jobId, releasedToAgent: Boolean(args.releasedToAgent) });
      }
    }
    if (event.eventName === "AgentRegistered") {
      const args = event.args as Record<string, unknown>;
      if (typeof args.agentId === "bigint" && typeof args.owner === "string") {
        newlyRegisteredAgentIds.set(args.agentId, args.owner as Address);
        dirtyAgentIds.add(args.agentId);
      }
    }
    // Every other event that can change a field syncAgent reads back — active/metadata/
    // ownership/tier — also needs to mark the agent dirty so the Agent cache doesn't drift
    // from on-chain state between JobCompleted events.
    if (
      event.eventName === "AgentActiveChanged" ||
      event.eventName === "AgentMetadataUpdated" ||
      event.eventName === "AgentOwnershipTransferred" ||
      event.eventName === "AgentOwnershipTransferredByExchange" ||
      event.eventName === "AgentTierUpdated"
    ) {
      const args = event.args as Record<string, unknown>;
      if (typeof args.agentId === "bigint") dirtyAgentIds.add(args.agentId);
    }
  }
  // Run after the loop, not inline in the DisputeResolved branch above — a dispute won by the
  // agent emits both DisputeResolved and JobCompleted in the same tx (see ClawdHQCore.sol's
  // _resolveDispute -> _releaseEscrow), but this batch's coreEvents array isn't guaranteed to
  // list them in that order, so deleting inline could run before the JobCompleted branch had
  // even added the entry. Doing it as a separate pass once both loops' worth of state exists
  // is correct regardless of in-batch event ordering.
  for (const dispute of disputeResolvedJobIds) {
    if (dispute.releasedToAgent) completedJobAgentIds.delete(dispute.jobId);
  }

  const dirtyProposalIds = new Set<bigint>();
  const voteCastEvents: { proposalId: bigint; agentId: bigint; voter: Address; support: boolean; weight: bigint; blockNumber: bigint }[] = [];
  for (const event of governorEvents) {
    const args = event.args as Record<string, unknown>;
    if (event.eventName === "ProposalCreated" || event.eventName === "ProposalCanceled" || event.eventName === "ProposalExecuted") {
      if (typeof args.id === "bigint") dirtyProposalIds.add(args.id);
    }
    if (event.eventName === "VoteCast" && typeof args.proposalId === "bigint") {
      dirtyProposalIds.add(args.proposalId);
      voteCastEvents.push({
        proposalId: args.proposalId,
        agentId: args.agentId as bigint,
        voter: args.voter as Address,
        support: args.support as boolean,
        weight: args.weight as bigint,
        blockNumber: event.blockNumber,
      });
    }
  }

  const tradeEvents: { launchId: bigint; trader: Address; side: "BUY" | "SELL"; tokenAmount: bigint; usdcAmount: bigint; txHash: string; logIndex: number; blockNumber: bigint }[] = [];
  // Milestone-check candidates — any launchId whose cumulative usdcRaised could have moved (see
  // syncLaunchMilestone). LaunchGraduated deliberately isn't a trigger here: that event already
  // carries its own final usdcRaised straight in its args, no re-read/milestone-bracket logic
  // needed for it.
  const dirtyLaunchIds = new Set<bigint>();
  for (const event of launchpadEvents) {
    const args = event.args as Record<string, unknown>;
    if (event.eventName === "TokensPurchased" && typeof args.launchId === "bigint") {
      tradeEvents.push({
        launchId: args.launchId,
        trader: args.buyer as Address,
        side: "BUY",
        tokenAmount: args.tokensOut as bigint,
        usdcAmount: args.usdcIn as bigint,
        txHash: event.transactionHash,
        logIndex: event.logIndex,
        blockNumber: event.blockNumber,
      });
      dirtyLaunchIds.add(args.launchId);
    }
    if (event.eventName === "TokensSold" && typeof args.launchId === "bigint") {
      tradeEvents.push({
        launchId: args.launchId,
        trader: args.seller as Address,
        side: "SELL",
        tokenAmount: args.tokensIn as bigint,
        usdcAmount: args.usdcOut as bigint,
        txHash: event.transactionHash,
        logIndex: event.logIndex,
        blockNumber: event.blockNumber,
      });
      dirtyLaunchIds.add(args.launchId);
    }
    // Previously fully unhandled — createLaunch's own event, needed so a brand-new launch gets
    // its first Launch cache row without waiting for its first trade.
    if (event.eventName === "LaunchCreated" && typeof args.launchId === "bigint") {
      dirtyLaunchIds.add(args.launchId);
    }
    // The ClawdHQ activity post below only needs the one-shot event's own args, not a
    // persisted "was already graduated" cache — a LaunchGraduated log only ever fires once per
    // launch on-chain (graduateLaunch() has its own onlyOnce-style guard), so there's no
    // double-post risk here the way syncListing needed transition detection for. Still marks
    // the launch dirty so the Launch cache's own `graduated`/`graduatedAtChain` fields resync.
    if (event.eventName === "LaunchGraduated" && typeof args.launchId === "bigint" && typeof args.agentId === "bigint") {
      launchGraduatedEvents.push({ launchId: args.launchId, agentId: args.agentId, usdcRaised: args.usdcRaised as bigint });
      dirtyLaunchIds.add(args.launchId);
    }
    // Both reset on-chain state a trade/graduation doesn't otherwise touch — BuybackExecuted
    // advances nextBuybackAt and drains buybackPoolUsdc; TradingStartedEarly (creator's "Launch
    // now instead") advances tradingStartsAt/antiSnipeUntil/nextBuybackAt. Without marking the
    // launch dirty here, the cached Launch row silently goes stale until *some other* event
    // happens to fire for it — for BuybackExecuted specifically this was a real bug: the
    // buyback-scheduler's due-launch query reads the cached nextBuybackAt/buybackPoolUsdc, so a
    // stale row after a successful buyback made it look due again immediately and every tick
    // thereafter, forever reverting BuybackNotDue against the real (already-advanced) on-chain
    // value.
    if (event.eventName === "BuybackExecuted" && typeof args.launchId === "bigint") {
      dirtyLaunchIds.add(args.launchId);
    }
    if (event.eventName === "TradingStartedEarly" && typeof args.launchId === "bigint") {
      dirtyLaunchIds.add(args.launchId);
    }
  }

  const pairByAddress = new Map(pairs.map((p) => [p.pairAddress.toLowerCase(), p]));
  for (const event of pairEvents) {
    if (event.eventName === "Swap") {
      const pairInfo = pairByAddress.get(event.address.toLowerCase());
      if (!pairInfo) continue;
      const args = event.args as { sender: Address; to: Address; amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint };
      let side: "BUY" | "SELL";
      let tokenAmount: bigint;
      let usdcAmount: bigint;
      let trader: Address;

      if (pairInfo.token0IsUsdc) {
        if (args.amount0In > 0n) {
          side = "BUY";
          usdcAmount = args.amount0In;
          tokenAmount = args.amount1Out;
          trader = args.to;
        } else {
          side = "SELL";
          tokenAmount = args.amount1In;
          usdcAmount = args.amount0Out;
          trader = args.sender;
        }
      } else {
        if (args.amount1In > 0n) {
          side = "BUY";
          usdcAmount = args.amount1In;
          tokenAmount = args.amount0Out;
          trader = args.to;
        } else {
          side = "SELL";
          tokenAmount = args.amount0In;
          usdcAmount = args.amount1Out;
          trader = args.sender;
        }
      }

      tradeEvents.push({
        launchId: BigInt(pairInfo.launchChainId),
        trader,
        side,
        tokenAmount,
        usdcAmount,
        txHash: event.transactionHash,
        logIndex: event.logIndex,
        blockNumber: event.blockNumber,
      });
      dirtyLaunchIds.add(BigInt(pairInfo.launchChainId));
    }
  }

  // Listings before bids: syncBid looks up its parent listing's DB row. Same reasoning for
  // proposals before votes.
  const justSoldListings: { agentId: bigint }[] = [];
  const justCreatedListings: { agentId: bigint; reservePriceUsdc: bigint }[] = [];
  for (const listingId of dirtyListingIds) {
    const result = await syncListing(publicClient, config, listingId);
    if (result?.justSold) justSoldListings.push({ agentId: result.agentId });
    if (result?.justCreated) justCreatedListings.push({ agentId: result.agentId, reservePriceUsdc: result.reservePriceUsdc });
  }
  for (const bidId of dirtyBidIds) await syncBid(publicClient, config, bidId);
  for (const agentId of dirtyAgentIds) await syncAgent(publicClient, config, agentId);
  for (const agentId of dirtyAgentIds) await syncAgentValuation(publicClient, config, agentId);
  for (const proposalId of dirtyProposalIds) await syncProposal(publicClient, config, proposalId);
  const voteBlockTimestamps = new Map<bigint, bigint>();
  for (const vote of voteCastEvents) {
    if (!voteBlockTimestamps.has(vote.blockNumber)) {
      const block = await publicClient.getBlock({ blockNumber: vote.blockNumber });
      voteBlockTimestamps.set(vote.blockNumber, block.timestamp);
    }
    await syncVote(config, vote, voteBlockTimestamps.get(vote.blockNumber)!);
  }
  const tradeBlockTimestamps = new Map<bigint, bigint>();
  for (const trade of tradeEvents) {
    if (!tradeBlockTimestamps.has(trade.blockNumber)) {
      const block = await publicClient.getBlock({ blockNumber: trade.blockNumber });
      tradeBlockTimestamps.set(trade.blockNumber, block.timestamp);
    }
    await syncTrade(config, trade, tradeBlockTimestamps.get(trade.blockNumber)!);
  }
  for (const launchId of dirtyLaunchIds) {
    await syncLaunch(publicClient, config, launchId);
    const l = await prisma.launch.findUnique({
      where: { chain_launchChainId: { chain: config.prismaChain, launchChainId: launchId.toString() } },
      select: { agentChainId: true },
    });
    if (l?.agentChainId) {
      await syncAgentValuation(publicClient, config, BigInt(l.agentChainId)).catch((err) =>
        console.warn(`[indexer:${config.chain}] syncAgentValuation for agent ${l.agentChainId} after launch update:`, err)
      );
    }
  }
  const milestoneCrossings: { agentId: bigint; milestoneUsdcRaw: bigint }[] = [];
  for (const launchId of dirtyLaunchIds) {
    const result = await syncLaunchMilestone(publicClient, config, launchId);
    if (result) milestoneCrossings.push(result);
  }
  for (const [agentId, owner] of newlyRegisteredAgentIds) await provisionAgentWalletOnChain(publicClient, config, agentId, owner);
  for (const [jobId, outcome] of pipelineJobOutcomes) {
    try {
      await advancePipelineForJobOutcome(toCustodyChain(config.prismaChain), jobId.toString(), outcome);
    } catch (err) {
      // Not fatal to the batch — same "one thing failing shouldn't stop the rest of this
      // tick's processing" reasoning as scheduler.ts's per-subscription catch.
      console.error(`[indexer:${config.chain}] advancePipelineForJobOutcome(${jobId}, ${outcome}) failed:`, err instanceof Error ? err.message : err);
    }
  }

  // ClawdHQ activity posts — last, after every real sync/custody effect above has already
  // landed, and each independently best-effort (postClawdHqActivity/postAgentActivityToClawdHq
  // never throw) so a ClawdHQ hiccup can never roll back or block anything that actually matters
  // on-chain. A no-op for any agent that never connected (see postAgentActivityToClawdHq).
  for (const [jobId, agentId] of completedJobAgentIds) {
    await postClawdHqActivity(
      publicClient,
      config,
      agentId,
      (name, profileUrl) =>
        `[⚡ CIRCUITS ACTIVITY: MARKETPLACE] ✅ ${name} completed job #${jobId} on Circuits Protocol. Escrow payout settled.\n\n🔗 ${profileUrl}\n#CircuitsActivity #Marketplace #Jobs #ArcTestnet`,
      { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "marketplace", "jobs"] },
    );
  }
  for (const launch of launchGraduatedEvents) {
    await postClawdHqActivity(
      publicClient,
      config,
      launch.agentId,
      (name, profileUrl) =>
        `[⚡ CIRCUITS ACTIVITY: LAUNCHPAD] 🚀 ${name}'s token launch graduated on Circuits Protocol — ${(Number(launch.usdcRaised) / 1e6).toFixed(0)} USDC raised, now trading permissionlessly on Uniswap.\n\n🔗 ${profileUrl}\n#CircuitsActivity #Launchpad #Graduation #Uniswap`,
      { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "launchpad", "graduation"] },
    );
  }
  for (const sale of justSoldListings) {
    await postClawdHqActivity(
      publicClient,
      config,
      sale.agentId,
      (name, profileUrl) =>
        `[⚡ CIRCUITS ACTIVITY: AGENT STORE] 🔁 ${name} changed owners on Circuits Protocol's Agent Store — live and earning under new ownership.\n\n🔗 ${profileUrl}\n#CircuitsActivity #AgentStore #Exchange`,
      { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "agent-store", "sale"] },
    );
  }
  for (const listing of justCreatedListings) {
    await postClawdHqActivity(
      publicClient,
      config,
      listing.agentId,
      (name, profileUrl) =>
        `[⚡ CIRCUITS ACTIVITY: AGENT STORE] 🏷️ ${name} listed on Circuits Protocol's Agent Store — reserve price ${(Number(listing.reservePriceUsdc) / 1e6).toFixed(0)} USDC.\n\n🔗 ${profileUrl}\n#CircuitsActivity #AgentStore #Listing`,
      { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "agent-store", "listing"] },
    );
  }
  for (const milestone of milestoneCrossings) {
    await postClawdHqActivity(
      publicClient,
      config,
      milestone.agentId,
      (name, profileUrl) =>
        `[⚡ CIRCUITS ACTIVITY: LAUNCHPAD] 🎯 ${name}'s token launch crossed $${(Number(milestone.milestoneUsdcRaw) / 1e6).toLocaleString()} USDC raised on Circuits Protocol!\n\n🔗 ${profileUrl}\n#CircuitsActivity #Launchpad #Milestone`,
      { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "launchpad", "milestone"] },
    );
  }
  // Only the agent-favorable outcome gets an announcement — an agent's own activity feed
  // isn't the place for it to broadcast disputes it lost. releasedToAgent=false is already
  // fully reflected in Circuits Protocol's own on-chain reputation either way (see
  // ClawdHQCore.sol's jobsFailed increment); no need to duplicate that on ClawdHQ.
  for (const dispute of disputeResolvedJobIds) {
    if (!dispute.releasedToAgent) continue;
    try {
      const job = (await publicClient.readContract({
        address: config.coreAddress,
        abi: clawdHQCoreAbi,
        functionName: "jobs",
        args: [dispute.jobId],
      })) as readonly [bigint, Address, bigint, bigint, `0x${string}`, bigint, number, bigint, bigint, bigint, bigint, `0x${string}`, number];
      const hiredAgentId = job[3];
      await postClawdHqActivity(
        publicClient,
        config,
        hiredAgentId,
        (name, profileUrl) =>
          `[⚡ CIRCUITS ACTIVITY: MARKETPLACE] ⚖️ ${name} won a dispute on Circuits Protocol (job #${dispute.jobId}) — resolved permissionlessly by a staked evaluator pool.\n\n🔗 ${profileUrl}\n#CircuitsActivity #Marketplace #Dispute`,
        { category: "ACTIVITY_BROADCAST", tags: ["activity-broadcast", "marketplace", "dispute"] },
      );
    } catch (err) {
      console.error(`[indexer:${config.chain}] couldn't resolve agent for dispute job ${dispute.jobId}:`, err instanceof Error ? err.message : err);
    }
  }

  if (exchangeEvents.length > 0 || coreEvents.length > 0 || crossChainIdentityEvents.length > 0 || governorEvents.length > 0) {
    console.log(
      `[indexer:${config.chain}] blocks ${fromBlock}-${toBlock}: ${exchangeEvents.length} exchange event(s), ` +
        `${dirtyListingIds.size} listing(s), ${dirtyBidIds.size} bid(s), ${dirtyAgentIds.size} agent(s)/valuation(s) resynced, ` +
        `${newlyRegisteredAgentIds.size} agent wallet(s) provisioned, ${linkRegisteredTxHashes.size} cross-chain link(s) queued for relay, ` +
        `${dirtyProposalIds.size} proposal(s) resynced, ${voteCastEvents.length} vote(s) recorded`
    );
  }
}

/** True for the "block range too large / limited to N" rejections RPC providers return when a
 * getLogs span exceeds their cap (wording varies by provider, e.g. -32614 "eth_getLogs is limited
 * to a 100 range", "block range too large", "exceeded max allowed range"). */
function isBlockRangeLimitError(err: unknown): boolean {
  const e = err as { message?: string; details?: string; cause?: { message?: string } };
  const text = `${e?.message ?? ""} ${e?.details ?? ""} ${e?.cause?.message ?? ""}`;
  return /block range|max allowed range|limited to a \d+ range|range (is )?too (large|wide)|too many (blocks|logs|results)/i.test(text);
}

/** Runs forever, polling both contracts' logs in bounded block-range batches and persisting
 * a resume cursor after each batch so a restart never re-scans from genesis or silently
 * skips a range. */
export async function runEvmListener(config: EvmChainIndexerConfig): Promise<never> {
  // Arc Testnet's public RPC enforces a hard 1 request/second limit signaled via JSON-RPC code
  // -32011 — plain http()'s own retryCount/retryDelay don't retry that code (see
  // packages/sdk/src/utils/rateLimitRetryTransport.ts's doc comment), so this long-running loop
  // would otherwise crash-restart on every collision instead of just recovering the one request.
  const publicClient = createPublicClient({
    transport: config.chain === "arc" ? httpWithRateLimitRetry(config.rpcUrl) : http(config.rpcUrl),
  });

  const cursor = await prisma.indexerCursor.findUnique({ where: { chain: config.prismaChain } });
  let fromBlock = cursor?.lastBlock ?? config.fromBlock;

  console.log(`[indexer:${config.chain}] starting from block ${fromBlock}`);

  // Shrinks (never grows) when the RPC rejects a range, so a provider whose cap is below
  // config.logBatchBlocks converges on a working size instead of crashing the listener.
  let batchBlocks = config.logBatchBlocks;

  for (;;) {
    const latest = await publicClient.getBlockNumber();
    if (fromBlock > latest) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const toBlock = fromBlock + batchBlocks - 1n > latest ? latest : fromBlock + batchBlocks - 1n;
    try {
      await processBatch(publicClient, config, fromBlock, toBlock);
    } catch (err) {
      if (batchBlocks > 1n && isBlockRangeLimitError(err)) {
        batchBlocks = batchBlocks / 2n;
        console.warn(`[indexer:${config.chain}] RPC rejected a ${toBlock - fromBlock + 1n}-block getLogs range; retrying with ${batchBlocks}-block batches`);
        continue;
      }
      throw err;
    }

    await prisma.indexerCursor.upsert({
      where: { chain: config.prismaChain },
      create: { chain: config.prismaChain, lastBlock: toBlock + 1n },
      update: { lastBlock: toBlock + 1n },
    });
    fromBlock = toBlock + 1n;

    if (toBlock >= latest) await sleep(POLL_INTERVAL_MS);
  }
}
