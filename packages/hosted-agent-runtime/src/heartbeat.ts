import fs from "node:fs";
import path from "node:path";
import { prisma as custodyPrisma, type Chain as CustodyChain } from "@clawdhq/custody-db";
import { prisma as socialPrisma, type Chain as SocialChain } from "@clawdhq/social-db";
import {
  getDecryptedClawdHqApiKey,
  checkClawdHqDms,
  getClawdHqDmConversations,
  replyClawdHqDmConversation,
  searchClawdHq,
  getClawdHqFeed,
  replyToClawdHqPost,
  getClawdHqAgentPosts,
  postToClawdHq,
  likeClawdHqPost,
  followClawdHqAgent,
  sendClawdHqAgentTip,
  getAgentWalletAddress,
  circuitsAgentProfileUrl,
} from "@clawdhq/custody-core";
import { ClawMem, memoryAgentKey } from "@clawdhq/clawmem";
import { loadAgentPersonaContext } from "./persona.js";
import { resolveLlmKey, generateDmReply, generateThreadContribution } from "./llmClient.js";
import {
  synthesizeMilestoneFromOptions,
  detectAgentDappMilestones,
  type FormattedMilestonePost,
} from "./milestones.js";

const clawMem = new ClawMem();

export type HeartbeatOutcome = "reply" | "post" | "interact" | "investigate" | "defer" | "no-op";

export interface HeartbeatHistoryEntry {
  timestamp: number;
  outcome: HeartbeatOutcome;
  summary: string;
  targetId?: string;
  topic?: string;
}

export interface HeartbeatState {
  lastHeartbeatAt: number;
  lastPostAt: number;
  lastProcessedDmId?: string;
  recentTopics: string[];
  recentInteractions: string[];
  likedPostIds?: string[];
  followingHandles?: string[];
  deferredOpportunities: { postId: string; reason: string; expiresAt: string }[];
  quietMode: boolean;
  cadenceMinutes: number;
  lastOutcome?: HeartbeatOutcome;
  lastOutcomeSummary?: string;
  decisionTrace?: string[];
  recentHistory: HeartbeatHistoryEntry[];
}

export interface HeartbeatExecutionResult {
  outcome: HeartbeatOutcome;
  summary: string;
  decisionTrace: string[];
  state: HeartbeatState;
  postedContent?: string;
  targetId?: string;
}

// In-memory cache for fast, seamless reading during UI polls and background scheduler ticks
const STATE_MEMORY_CACHE = new Map<string, HeartbeatState>();

function stateKey(chain: CustodyChain, agentChainId: string): string {
  return `${chain}:${agentChainId}`;
}

function getHeartbeatStateFilePath(chain: CustodyChain, agentChainId: string): string {
  let baseDir = process.cwd();
  // When running inside apps/web or a package subfolder, resolve repo root data/ directory
  if (fs.existsSync(path.resolve(baseDir, "../../data"))) {
    baseDir = path.resolve(baseDir, "../..");
  } else if (fs.existsSync(path.resolve(baseDir, "../data"))) {
    baseDir = path.resolve(baseDir, "..");
  }
  const dir = path.resolve(baseDir, "data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
  return path.join(dir, `heartbeat_state_${chain}_${agentChainId}.json`);
}

export async function loadHeartbeatState(chain: CustodyChain, agentChainId: string): Promise<HeartbeatState> {
  const key = stateKey(chain, agentChainId);
  const cached = STATE_MEMORY_CACHE.get(key);
  if (cached) return cached;

  const defaultState: HeartbeatState = {
    lastHeartbeatAt: 0,
    lastPostAt: 0,
    recentTopics: [],
    recentInteractions: [],
    likedPostIds: [],
    followingHandles: [],
    deferredOpportunities: [],
    quietMode: false,
    cadenceMinutes: 60,
    recentHistory: [],
  };

  // 1. Check local persistent state file
  try {
    const filePath = getHeartbeatStateFilePath(chain, agentChainId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        const merged: HeartbeatState = {
          ...defaultState,
          ...parsed,
          recentTopics: Array.isArray(parsed.recentTopics) ? parsed.recentTopics : [],
          recentInteractions: Array.isArray(parsed.recentInteractions) ? parsed.recentInteractions : [],
          likedPostIds: Array.isArray(parsed.likedPostIds) ? parsed.likedPostIds : [],
          followingHandles: Array.isArray(parsed.followingHandles) ? parsed.followingHandles : [],
          deferredOpportunities: Array.isArray(parsed.deferredOpportunities) ? parsed.deferredOpportunities : [],
          recentHistory: Array.isArray(parsed.recentHistory) ? parsed.recentHistory.slice(0, 15) : [],
        };
        STATE_MEMORY_CACHE.set(key, merged);
        return merged;
      }
    }
  } catch (fileErr) {
    console.warn(`[heartbeat] local state file lookup notice for ${chain}:${agentChainId}:`, fileErr);
  }

  // 2. Fallback to ClawMem
  try {
    const memKey = memoryAgentKey(chain as any, agentChainId);
    const stored = (await (clawMem as any).recall?.(memKey, "heartbeat", "state")) as HeartbeatState | undefined;
    if (stored && typeof stored === "object") {
      const merged: HeartbeatState = {
        ...defaultState,
        ...stored,
        recentTopics: Array.isArray(stored.recentTopics) ? stored.recentTopics : [],
        recentInteractions: Array.isArray(stored.recentInteractions) ? stored.recentInteractions : [],
        likedPostIds: Array.isArray(stored.likedPostIds) ? stored.likedPostIds : [],
        followingHandles: Array.isArray(stored.followingHandles) ? stored.followingHandles : [],
        deferredOpportunities: Array.isArray(stored.deferredOpportunities) ? stored.deferredOpportunities : [],
        recentHistory: Array.isArray(stored.recentHistory) ? stored.recentHistory.slice(0, 15) : [],
      };
      STATE_MEMORY_CACHE.set(key, merged);
      return merged;
    }
  } catch (err) {
    console.warn(`[heartbeat] ClawMem state lookup notice for ${chain}:${agentChainId}:`, err);
  }

  STATE_MEMORY_CACHE.set(key, defaultState);
  return defaultState;
}

export async function saveHeartbeatState(chain: CustodyChain, agentChainId: string, state: HeartbeatState): Promise<void> {
  const key = stateKey(chain, agentChainId);
  STATE_MEMORY_CACHE.set(key, state);

  // 1. Write to local persistent file
  try {
    const filePath = getHeartbeatStateFilePath(chain, agentChainId);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
  } catch (fileErr) {
    console.warn(`[heartbeat] local state file save notice for ${chain}:${agentChainId}:`, fileErr);
  }

  // 2. Sync to ClawMem
  try {
    const memKey = memoryAgentKey(chain as any, agentChainId);
    await clawMem.remember(memKey, "heartbeat", "state", {
      lastHeartbeatAt: state.lastHeartbeatAt,
      lastPostAt: state.lastPostAt,
      lastProcessedDmId: state.lastProcessedDmId,
      recentTopics: state.recentTopics.slice(0, 10),
      recentInteractions: state.recentInteractions.slice(0, 15),
      likedPostIds: (state.likedPostIds || []).slice(-50),
      followingHandles: (state.followingHandles || []).slice(-50),
      deferredOpportunities: state.deferredOpportunities,
      quietMode: state.quietMode,
      cadenceMinutes: state.cadenceMinutes,
      lastOutcome: state.lastOutcome,
      lastOutcomeSummary: state.lastOutcomeSummary,
      recentHistory: state.recentHistory.slice(0, 15),
    });
  } catch (err) {
    console.warn(`[heartbeat] ClawMem state persistence notice for ${chain}:${agentChainId}:`, err);
  }
}

export async function updateHeartbeatSettings(
  chain: CustodyChain,
  agentChainId: string,
  settings: Partial<Pick<HeartbeatState, "quietMode" | "cadenceMinutes">>,
): Promise<HeartbeatState> {
  const state = await loadHeartbeatState(chain, agentChainId);
  if (typeof settings.quietMode === "boolean") state.quietMode = settings.quietMode;
  if (typeof settings.cadenceMinutes === "number" && settings.cadenceMinutes > 0) {
    state.cadenceMinutes = settings.cadenceMinutes;
  }
  await saveHeartbeatState(chain, agentChainId, state);
  return state;
}

function recordHistoryEntry(
  state: HeartbeatState,
  outcome: HeartbeatOutcome,
  summary: string,
  extra?: { targetId?: string; topic?: string },
): void {
  const entry: HeartbeatHistoryEntry = {
    timestamp: Date.now(),
    outcome,
    summary,
    targetId: extra?.targetId,
    topic: extra?.topic,
  };
  state.lastOutcome = outcome;
  state.lastOutcomeSummary = summary;
  state.recentHistory = [entry, ...(state.recentHistory || []).slice(0, 14)];
}



/** Executes the full ClawdHQ Agent Heartbeat loop according to clawdhq.xyz/heartbeat.md.
 * Evaluates environment in strict priority order:
 *  1. Direct Messages
 *  2. Replies & Direct Mentions
 *  3. Ongoing Conversations
 *  4. Feed Opportunities
 *  5. Cooldown & Real Work Verification
 *  6. Safe Publish or Clean No-Op
 */
export async function runAgentHeartbeat(
  chain: CustodyChain,
  agentChainId: string,
  options?: {
    forceBroadcast?: boolean;
    overrideQuietMode?: boolean;
    candidatePostContent?: string;
    workContext?: string;
    recentPerpTrade?: string;
    recentPredictionTrade?: string;
    recentJobSummary?: string;
    runtimeReceiptUrl?: string;
    telemetryContext?: any;
  },
): Promise<HeartbeatExecutionResult> {
  const socialChain = chain as unknown as SocialChain;
  const state = await loadHeartbeatState(chain, agentChainId);
  const now = Date.now();
  state.lastHeartbeatAt = now;

  const decisionTrace: string[] = [
    `Heartbeat initiated at ${new Date(now).toISOString()}`,
    `Cadence: Every ${state.cadenceMinutes} minutes | Quiet Mode: ${state.quietMode ? "ON" : "OFF"}`,
  ];

  // 1. Verify ClawdHQ link credentials
  const linkData = await getDecryptedClawdHqApiKey(chain, agentChainId);
  if (!linkData) {
    const summary = "Heartbeat skipped: Agent is not connected to ClawdHQ (no active link / API key found).";
    decisionTrace.push("Status check: ClawdHqLink not active. Concluded cleanly.");
    recordHistoryEntry(state, "no-op", summary);
    await saveHeartbeatState(chain, agentChainId, state);
    return { outcome: "no-op", summary, decisionTrace, state };
  }

  const { apiKey, handle } = linkData;
  decisionTrace.push(`Authenticated as @${handle} on ClawdHQ`);

  // 2. Load persona & LLM credentials
  const persona = await loadAgentPersonaContext(socialChain, agentChainId);
  const hostedConfig = await custodyPrisma.hostedRuntimeConfig.findUnique({
    where: { chain_agentChainId: { chain, agentChainId } },
  });
  const llmBilling = hostedConfig?.llmBilling ?? (hostedConfig as any)?.mode ?? "PLATFORM";

  let llmKey: any = null;
  try {
    llmKey = await resolveLlmKey(chain, agentChainId, llmBilling as any);
  } catch (keyErr) {
    decisionTrace.push(`LLM Key notice: ${keyErr instanceof Error ? keyErr.message : String(keyErr)}`);
  }

  // ── Priority 1: Direct Messages Requiring Response (clawdhq.xyz/heartbeat.md) ──
  decisionTrace.push("Priority 1: Inspecting unread Direct Messages (GET /dm/check)");
  try {
    const dmCheck = await checkClawdHqDms(apiKey);
    if (dmCheck.total_unread > 0) {
      decisionTrace.push(`Found ${dmCheck.total_unread} unread Direct Message(s)`);
      const conversations = await getClawdHqDmConversations(apiKey, true);
      const targetConv = conversations[0];

      if (targetConv && llmKey) {
        const rawMsg = typeof targetConv.last_message === "string" ? targetConv.last_message : targetConv.last_message?.content || "";
        decisionTrace.push(`Generating authentic reply for DM conversation ${targetConv.id} (from @${targetConv.participant?.handle || "observer"})`);
        const replyText = await generateDmReply(chain, agentChainId, llmBilling as any, persona, rawMsg || "Hello", llmKey, targetConv.participant?.handle);

        await replyClawdHqDmConversation(apiKey, targetConv.id, replyText);
        state.lastProcessedDmId = targetConv.id;
        const summary = `Replied to DM from @${targetConv.participant?.handle || "peer"} (Conversation #${targetConv.id})`;
        decisionTrace.push(`Priority 1 satisfied: Replied to DM conversation ${targetConv.id}`);

        recordHistoryEntry(state, "reply", summary, { targetId: targetConv.id });
        state.decisionTrace = decisionTrace;
        await saveHeartbeatState(chain, agentChainId, state);

        return { outcome: "reply", summary, decisionTrace, state, targetId: targetConv.id };
      }
    } else {
      decisionTrace.push("Priority 1 check: No pending direct messages.");
    }
  } catch (dmErr) {
    decisionTrace.push(`Priority 1 notice (GET /dm/check): ${dmErr instanceof Error ? dmErr.message : String(dmErr)}`);
  }

  // ── Priority 2: Replies & Direct Mentions (clawdhq.xyz/heartbeat.md) ──
  decisionTrace.push(`Priority 2: Inspecting direct mentions for @${handle} (GET /search?q=@${handle})`);
  try {
    const mentions = await searchClawdHq(`@${handle}`, 5, apiKey);
    const unhandledMention = mentions.find((m) => {
      if (!m.id) return false;
      const authorHandle = (m.agent?.handle || m.author?.handle || "").replace(/^@/, "").toLowerCase();
      if (!authorHandle || authorHandle === handle.toLowerCase()) return false;
      if (m.is_replied_by_me) return false;
      if (state.recentInteractions.includes(m.id)) return false;
      return true;
    });

    if (unhandledMention) {
      const authorHandle = (unhandledMention.agent?.handle || unhandledMention.author?.handle || "peer").replace(/^@/, "");
      const mentionText = unhandledMention.body || unhandledMention.content || "";
      decisionTrace.push(`Priority 2 met: Found mention on post ${unhandledMention.id} by @${authorHandle}: "${mentionText.slice(0, 60)}"`);

      let replyContent = "";
      if (llmKey) {
        try {
          replyContent = await generateThreadContribution(
            chain,
            agentChainId,
            llmBilling as any,
            persona,
            { authorHandle, postContent: mentionText },
            llmKey,
          );
        } catch (llmErr) {
          decisionTrace.push(`Thread generation notice: ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`);
        }
      }

      if (!replyContent) {
        const primaryDomain = (persona?.knowledgeDomains && persona.knowledgeDomains[0]) || "on-chain analytics & execution";
        replyContent = `@${authorHandle} Appreciate the mention! From a perspective focused on ${primaryDomain} on Arc Network, keeping telemetry transparent and operations verifiable is critical here.`;
      }

      const { postId } = await replyToClawdHqPost(apiKey, unhandledMention.id, replyContent);
      state.recentInteractions = [
        unhandledMention.id,
        authorHandle,
        ...state.recentInteractions.filter((x) => x !== unhandledMention.id && x !== authorHandle).slice(0, 20),
      ];

      const summary = `Replied to mention on post #${unhandledMention.id} from @${authorHandle}`;
      decisionTrace.push(`Priority 2 satisfied: Sent thread reply ${postId} on parent post ${unhandledMention.id}`);

      recordHistoryEntry(state, "reply", summary, { targetId: unhandledMention.id });
      state.decisionTrace = decisionTrace;
      await saveHeartbeatState(chain, agentChainId, state);

      return { outcome: "reply", summary, decisionTrace, state, targetId: postId };
    } else {
      decisionTrace.push("Priority 2 check: No unhandled direct mentions.");
    }
  } catch (mentionErr) {
    decisionTrace.push(`Priority 2 notice: ${mentionErr instanceof Error ? mentionErr.message : String(mentionErr)}`);
  }

  // ── Priority 3 & 4: Feed Opportunities, Social Interactions (Likes/Follows/Tips) ──
  decisionTrace.push("Priority 3 & 4: Inspecting recent feed for domain opportunities (GET /feed)");
  let peerPosts: any[] = [];
  let topCandidate: { post: any; score: number } | null = null;
  let likesGiven = 0;
  let followsGiven = 0;
  let tipSent = false;

  try {
    const feed = await getClawdHqFeed("for-you", 25, apiKey);
    decisionTrace.push(`Feed inspected: ${feed.length} recent network posts examined.`);

    // Look for genuine peer posts from other agents
    peerPosts = feed.filter((p) => {
      if (!p.id) return false;
      const authorHandle = (p.agent?.handle || (p as any).author?.handle || "").replace(/^@/, "").toLowerCase();
      if (!authorHandle || authorHandle === handle.toLowerCase()) return false;
      if (p.is_replied_by_me) return false;
      const text = (p.content || p.body || "").trim();
      if (text.length < 15) return false;
      return true;
    });

    if (peerPosts.length > 0) {
      // Score relevance against this agent's persona domains and worldview
      const domains: string[] = (persona?.knowledgeDomains || []).map((d: string) => d.toLowerCase());
      const scored = peerPosts.map((post) => {
        const text = (post.content || post.body || "").toLowerCase();
        let score = 0;
        for (const domain of domains) {
          const words = domain.split(/\s+/).filter((w: string) => w.length > 3);
          for (const w of words) {
            if (text.includes(w)) score += 3;
          }
        }
        const keywords = [
          "arc", "circuits", "liquidity", "vault", "trading", "agent", "token", "yield",
          "defi", "risk", "perps", "prediction", "market", "governance", "clawdhq", "bonding", "pool"
        ];
        for (const kw of keywords) {
          if (text.includes(kw)) score += 1;
        }
        return { post, score };
      });

      scored.sort((a, b) => b.score - a.score);
      topCandidate = scored[0] || null;

      // 1. Like relevant peer posts (clawdhq.xyz/heartbeat.md "interact" outcome)
      if (!state.likedPostIds) state.likedPostIds = [];
      for (const item of scored.slice(0, 3)) {
        if (item.score >= 1 && !state.likedPostIds.includes(item.post.id)) {
          try {
            const liked = await likeClawdHqPost(apiKey, item.post.id);
            if (liked) {
              state.likedPostIds.push(item.post.id);
              likesGiven++;
              const pAuthor = (item.post.agent?.handle || (item.post as any).author?.handle || "peer").replace(/^@/, "");
              decisionTrace.push(`Interacted: Liked post #${item.post.id} by @${pAuthor}`);
            }
          } catch {
            // Non-fatal
          }
        }
      }

      // 2. Follow high-affinity peer agents
      if (!state.followingHandles) state.followingHandles = [];
      if (topCandidate && topCandidate.score >= 2) {
        const candidateAuthor = (topCandidate.post.agent?.handle || (topCandidate.post as any).author?.handle || "").replace(/^@/, "");
        if (candidateAuthor && candidateAuthor.toLowerCase() !== handle.toLowerCase() && !state.followingHandles.includes(candidateAuthor)) {
          try {
            const agentWalletAddress = await getAgentWalletAddress(chain, agentChainId).catch(() => null);
            const followed = await followClawdHqAgent(apiKey, candidateAuthor, agentWalletAddress || undefined);
            if (followed) {
              state.followingHandles.push(candidateAuthor);
              followsGiven++;
              decisionTrace.push(`Interacted: Followed peer agent @${candidateAuthor}`);
            }
          } catch {
            // Non-fatal
          }
        }
      }

      // 3. Tip high-signal peer agent (if spend policy allows)
      if (topCandidate && topCandidate.score >= 3) {
        const lastTip = state.recentHistory?.find((h) => h.outcome === "interact" && h.topic === "peer-agent-tip");
        const elapsedSinceTipMs = lastTip ? now - lastTip.timestamp : Infinity;
        if (elapsedSinceTipMs > 3 * 3600 * 1000) {
          try {
            const policy = await custodyPrisma.agentSpendPolicy.findUnique({
              where: { chain_agentChainId: { chain, agentChainId } },
            });
            if (policy?.isEnabled && policy.dailyCapUsdc.greaterThan(0)) {
              const targetAuthor = (topCandidate.post.agent?.handle || (topCandidate.post as any).author?.handle || "").replace(/^@/, "");
              if (targetAuthor && targetAuthor.toLowerCase() !== handle.toLowerCase()) {
                const tipRes = await sendClawdHqAgentTip(apiKey, {
                  recipientHandle: targetAuthor,
                  amountUsd: "0.20",
                  note: `Autonomous alpha appreciation tip for post #${topCandidate.post.id}`,
                }).catch(() => null);
                if (tipRes?.success) {
                  tipSent = true;
                  decisionTrace.push(`Interacted: Sent $0.20 USDC tip to @${targetAuthor} on ClawdHQ`);
                  recordHistoryEntry(state, "interact", `Tipped $0.20 to @${targetAuthor} on ClawdHQ`, { targetId: topCandidate.post.id, topic: "peer-agent-tip" });
                }
              }
            }
          } catch (tipErr) {
            decisionTrace.push(`Tip evaluation notice: ${tipErr instanceof Error ? tipErr.message : String(tipErr)}`);
          }
        }
      }
    }
  } catch (feedErr) {
    decisionTrace.push(`Feed inspection notice: ${feedErr instanceof Error ? feedErr.message : String(feedErr)}`);
  }

  const hadInteractions = likesGiven > 0 || followsGiven > 0 || tipSent;

  // ── Priority 5 & 6: Verified Multi-Dapp Milestones or Rich Regular Insights ──
  // Check broadcast cooldown: 45 minutes (allows regular high-signal broadcasting without spam)
  const hoursSinceLastPost = (now - (state.lastPostAt || 0)) / (1000 * 60 * 60);
  const isBroadcastDue =
    hoursSinceLastPost >= 0.75 ||
    !state.lastPostAt ||
    Boolean(options?.forceBroadcast) ||
    Boolean(options?.candidatePostContent) ||
    Boolean(options?.workContext);

  if (isBroadcastDue && (!state.quietMode || options?.overrideQuietMode)) {
    decisionTrace.push(`Evaluating broadcast publication opportunity (${hoursSinceLastPost.toFixed(1)}h elapsed)`);

    let candidatePost: FormattedMilestonePost | {
      content: string;
      category: string;
      tags: string[];
      postType: string;
      mediaUrl?: string;
      topic: string;
    } | null = null;

    // Helper: ClawdHQ Content Quality Test filter
    const isLowEffortFiller = (text: string): boolean => {
      const clean = text.trim().toLowerCase();
      if (clean.length < 80) {
        const fillerPhrases = [
          "monitoring",
          "no significant",
          "no trades",
          "no spend history",
          "markets quiet",
          "ecosystem quiet",
          "standby",
          "scan initiated",
          "waiting for",
          "nothing to report",
          "ready to coordinate",
          "no updates",
          "no notable",
        ];
        if (fillerPhrases.some((phrase) => clean.includes(phrase))) {
          return true;
        }
      }
      const fillerPatterns = [
        /no significant (insights|updates|trends|signals) to (share|report)/,
        /waiting for spend history/,
        /no spend history yet/,
        /markets quiet/,
        /scan initiated/,
        /standby\. no trades/,
        /monitoring.*no (significant|trades|signals)/,
      ];
      return fillerPatterns.some((pattern) => pattern.test(clean));
    };

    // Step A: Prefer candidate post content from model tick decision only if it passes the Quality Test
    const rawCandidate = options?.candidatePostContent?.trim();
    if (rawCandidate && rawCandidate.length >= 60 && !isLowEffortFiller(rawCandidate)) {
      decisionTrace.push("Using authentic alpha insight proposed by cognitive agent tick decision.");
      // Strip any artificial category headers (e.g. "[🧠 INSIGHT | ...]") so post begins naturally
      const formattedContent = rawCandidate.replace(/^\[.*?\]\s*/g, "").trim();
      candidatePost = {
        content: formattedContent,
        topic: `${persona?.displayName || handle}-alpha`,
        category: "REGULAR",
        tags: ["alpha", "arc-network", "circuits-protocol"],
        postType: "regular",
        mediaUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}&backgroundColor=0f172a`,
      };
    } else if (rawCandidate && isLowEffortFiller(rawCandidate)) {
      decisionTrace.push(`Candidate post filtered by Content Quality Test (low-effort filler: "${rawCandidate.slice(0, 45)}…"). Elevating to rich domain telemetry or no-op.`);
    }

    // Step B: Check for verified multi-Dapp milestone across all protocol pages
    if (!candidatePost) {
      candidatePost = synthesizeMilestoneFromOptions(persona, agentChainId, {
        workContext: options?.workContext,
        runtimeReceiptUrl: options?.runtimeReceiptUrl,
        recentPerpTrade: options?.recentPerpTrade,
        recentPredictionTrade: options?.recentPredictionTrade,
        recentJobSummary: options?.recentJobSummary,
      });
    }

    if (!candidatePost) {
      // Scan database for recent milestones across Launchpad, Agent Store, Governance, Skills, etc.
      candidatePost = await detectAgentDappMilestones(
        chain,
        agentChainId,
        persona,
        state.lastPostAt,
        state.recentTopics,
      );
    }

    // If no candidate post from LLM and no pending verified on-chain milestone, enforce strict clean no-op
    if (!candidatePost) {
      decisionTrace.push("No dynamic post proposed by agent LLM and no pending on-chain milestones — executing clean no-op.");
    }

    if (candidatePost) {
      const { content, topic, category, tags, postType, mediaUrl } = candidatePost;

      // Duplicate-content check (heartbeat.md rule: GET /search?q=<topic>&limit=5)
      decisionTrace.push(`Running duplicate-content check for topic "${topic}"`);
      let isDuplicate = false;
      try {
        const topicMatches = await searchClawdHq(topic, 5, apiKey);
        if (topicMatches.length > 0 && state.recentTopics.includes(topic)) {
          isDuplicate = true;
          decisionTrace.push(`Topic "${topic}" recently saturated in agent history and feed.`);
        }
      } catch {
        // Non-fatal search check
      }

      if (!isDuplicate) {
        // Drop recovery: check recent posts by handle to avoid duplicate publishes on connection hiccup or repeats
        try {
          const recentPosts = await getClawdHqAgentPosts(handle, 10);
          const targetClean = content.trim().toLowerCase();
          const alreadyPosted = recentPosts.some((p) => {
            const postText = (p.content || p.body || "").trim().toLowerCase();
            if (!postText) return false;
            if (postText.slice(0, 40) === targetClean.slice(0, 40)) return true;
            if (targetClean.includes("circuitsprotocol.com") && postText.includes("circuitsprotocol.com")) {
              const firstTargetSentence = targetClean.split(/[.|—|:]/)[0]?.trim();
              if (firstTargetSentence && firstTargetSentence.length > 25 && postText.includes(firstTargetSentence)) {
                return true;
              }
            }
            return false;
          });

          if (alreadyPosted) {
            const summary = `Post already published on ClawdHQ (verified via drop recovery query).`;
            decisionTrace.push(summary);
            recordHistoryEntry(state, "no-op", summary);
            state.decisionTrace = decisionTrace;
            state.lastPostAt = now;
            await saveHeartbeatState(chain, agentChainId, state);
            return { outcome: "no-op", summary, decisionTrace, state };
          }
        } catch (dropErr) {
          console.warn(`[heartbeat] drop recovery query notice for ${handle}:`, dropErr);
        }

        // Publish post to ClawdHQ with category, tags, and media
        try {
          decisionTrace.push(`Publishing to ClawdHQ [${category}]: "${content.slice(0, 60)}…"`);
          const { postId } = await postToClawdHq(apiKey, content, {
            mediaUrl,
            category,
            tags,
            postType,
          });

          // Mirror to local social database so it renders immediately in profile feeds
          try {
            const profile = await socialPrisma.profile.upsert({
              where: { chain_agentChainId: { chain: socialChain, agentChainId } },
              update: {},
              create: { kind: "AGENT", chain: socialChain, agentChainId },
            });
            await socialPrisma.post.create({
              data: { authorId: profile.id, body: content, mediaUrl: mediaUrl || null },
            });
          } catch (dbErr) {
            console.warn(`[heartbeat] local mirror notice for ${chain}:${agentChainId}:`, dbErr);
          }

          state.lastPostAt = now;
          state.recentTopics = [topic, ...state.recentTopics.slice(0, 5)];
          const summary = `Published ${category.toLowerCase().replace(/_/g, " ")} to ClawdHQ: "${content.slice(0, 75)}…"`;
          decisionTrace.push(`Post published successfully (ID #${postId}, Category: ${category}). Cooldown reset.`);

          recordHistoryEntry(state, "post", summary, { targetId: postId, topic });
          state.decisionTrace = decisionTrace;
          await saveHeartbeatState(chain, agentChainId, state);

          return { outcome: "post", summary, decisionTrace, state, postedContent: content, targetId: postId };
        } catch (postErr) {
          decisionTrace.push(`Post publish error: ${postErr instanceof Error ? postErr.message : String(postErr)}`);
        }
      }
    }
  }

  // ── Peer Replying (when broadcast not due or cooldown active) ──
  if (topCandidate && topCandidate.score >= 1) {
    const targetPost = topCandidate.post;
    const targetAuthor = (targetPost.agent?.handle || (targetPost as any).author?.handle || "peer").replace(/^@/, "");
    const lastPeerReply = state.recentHistory?.find((h) => h.outcome === "reply" && h.topic === "peer-agent-reply");
    const elapsedSincePeerReplyMs = lastPeerReply ? now - lastPeerReply.timestamp : Infinity;

    // Anti-echo: do not reply back-and-forth repeatedly to the same author without intervening context
    const isEcho = state.recentInteractions[0] === targetAuthor;

    if (!isEcho && elapsedSincePeerReplyMs > 15 * 60 * 1000 && !state.recentInteractions.includes(targetPost.id)) {
      decisionTrace.push(`Priority 3 & 4 opportunity identified: @${targetAuthor}'s post #${targetPost.id} (relevance score: ${topCandidate.score})`);

      let replyContent = "";
      if (llmKey) {
        try {
          replyContent = await generateThreadContribution(
            chain,
            agentChainId,
            llmBilling as any,
            persona,
            { authorHandle: targetAuthor, postContent: targetPost.content || targetPost.body || "" },
            llmKey,
          );
        } catch (llmErr) {
          decisionTrace.push(`Thread generation notice: ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`);
        }
      }

      if (!replyContent) {
        const primaryDomain = (persona?.knowledgeDomains && persona.knowledgeDomains[0]) || "on-chain liquidity & risk";
        replyContent = `@${targetAuthor} Insightful perspective. From an autonomous ${primaryDomain} perspective on Arc Network, ensuring verifiable execution and deep reserve liquidity is critical here. Look forward to seeing how this evolves.`;
      }

      const { postId } = await replyToClawdHqPost(apiKey, targetPost.id, replyContent, {
        category: "PEER_REPLY",
        tags: ["peer-reply", "collaboration", "arc-network"],
        postType: "reply",
      });

      state.recentInteractions = [targetAuthor, targetPost.id, ...state.recentInteractions.slice(0, 15)];
      const summary = `Replied to peer @${targetAuthor}'s post (#${targetPost.id}): "${replyContent.slice(0, 60)}…"`;
      decisionTrace.push(`Priority 3 & 4 satisfied: Published peer reply #${postId} on post #${targetPost.id}`);

      recordHistoryEntry(state, "reply", summary, { targetId: targetPost.id, topic: "peer-agent-reply" });
      state.decisionTrace = decisionTrace;
      await saveHeartbeatState(chain, agentChainId, state);

      return { outcome: "reply", summary, decisionTrace, state, postedContent: replyContent, targetId: postId };
    }
  }

  // ── Clean Completion (Interact or No-Op) ──
  if (hadInteractions) {
    const summary = `Heartbeat completed with feed interactions (${likesGiven} like(s), ${followsGiven} follow(s)${tipSent ? ", 1 tip" : ""}).`;
    decisionTrace.push(`Outcome: interact (${summary})`);
    recordHistoryEntry(state, "interact", summary);
    state.decisionTrace = decisionTrace;
    await saveHeartbeatState(chain, agentChainId, state);
    return { outcome: "interact", summary, decisionTrace, state };
  }

  const summary = "Heartbeat completed cleanly (no-op: environment quiet, broadcast cooldown active).";
  decisionTrace.push("All priorities evaluated: Environment quiet. Concluded cleanly.");
  decisionTrace.push("Outcome: no-op (heartbeat loop completed successfully).");

  recordHistoryEntry(state, "no-op", summary);
  state.decisionTrace = decisionTrace;
  await saveHeartbeatState(chain, agentChainId, state);

  return { outcome: "no-op", summary, decisionTrace, state };
}
