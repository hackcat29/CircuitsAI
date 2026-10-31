/** Thin HTTP client for ClawdHQ (https://clawdhq.xyz) — a genuinely separate AI-agent social
 * platform, deployed independently of Circuits Protocol with its own database and its own Circle
 * developer account. There is no shared backend and no shared Circle credentials between the two
 * — confirmed against ClawdHQ's own live deployment before writing this: it has its own
 * AGENT_REGISTRY_ADDRESS, its own CIRCLE_API_KEY/CIRCLE_TREASURY_WALLET, its own Postgres.
 *
 * "Wallet unification" instead works because both platforms operate on Arc Testnet and ClawdHQ's
 * own Agent model natively supports an externally-owned payout wallet (`walletType: 'EXTERNAL'`,
 * set via POST /agents/wallet) — pointing it at the same on-chain address Circuits Protocol
 * already custodies means both platforms read the identical real balance directly from the
 * chain, with no custom sync code and nothing that can drift out of sync.
 *
 * Every function here is a pure fetch wrapper — no Prisma, no encryption, safe to import from
 * anywhere. See clawdhqLinkCustody.ts for the encrypted-storage layer built on top of this. */

function apiBaseUrl(): string {
  return process.env.CLAWDHQ_API_BASE_URL || "https://api.clawdhq.xyz";
}

export interface ClawdHqRegisterResult {
  clawdhqAgentId: string;
  apiKey: string;
  claimUrl: string;
}

/** POST /agents/register. Handle must already be confirmed available by the caller (see
 * clawdhqLinkCustody.ts's handle-dedup loop) — ClawdHQ itself only reports the collision via a
 * 409 after the fact, it doesn't offer a separate availability-check endpoint. */
export async function registerClawdHqAgent(params: {
  name: string;
  handle: string;
  description?: string;
  avatarUrl?: string;
  ownerAddress?: string;
}): Promise<ClawdHqRegisterResult> {
  const res = await fetch(`${apiBaseUrl()}/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      handle: params.handle,
      description: params.description,
      avatar_url: params.avatarUrl,
      owner_address: params.ownerAddress,
    }),
  });
  const body = (await res.json().catch(() => null)) as { error?: string; agent?: { id: string; api_key: string; claim_url: string } } | null;
  if (!res.ok || !body?.agent) {
    if (res.status === 409) throw new ClawdHqHandleTakenError(params.handle);
    throw new Error(`ClawdHQ registration failed (${res.status}): ${body?.error ?? "unknown error"}`);
  }
  return { clawdhqAgentId: body.agent.id, apiKey: body.agent.api_key, claimUrl: body.agent.claim_url };
}

export class ClawdHqHandleTakenError extends Error {
  constructor(public readonly handle: string) {
    super(`ClawdHQ handle "${handle}" is already taken`);
  }
}

/** True if `handle` is free on ClawdHQ right now — best-effort pre-check via the public
 * GET /agents/:handle (404 = free), used to avoid burning obviously-taken handles before
 * attempting a real registration. Not atomic with registerClawdHqAgent (nothing stops a
 * concurrent registration between the check and the real call), which is exactly why
 * registerClawdHqAgent also handles the 409 itself rather than trusting this alone. */
export async function isClawdHqHandleAvailable(handle: string): Promise<boolean> {
  const res = await fetch(`${apiBaseUrl()}/agents/${encodeURIComponent(handle)}`);
  return res.status === 404;
}

/** POST /agents/wallet — attaches an externally-owned payout address (walletType: 'EXTERNAL')
 * to an already-registered ClawdHQ agent. Auth: that agent's own ClawdHQ API key. */
export async function linkClawdHqWallet(apiKey: string, walletAddress: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/agents/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`ClawdHQ wallet link failed (${res.status}): ${body?.error ?? "unknown error"}`);
  }
}

export interface PostToClawdHqOptions {
  mediaUrl?: string;
  replyToId?: string;
  category?: "ACTIVITY_BROADCAST" | "REGULAR" | "PEER_REPLY" | string;
  tags?: string[];
  postType?: "broadcast" | "regular" | "reply" | string;
}

/** POST /posts — publishes as the authenticated agent. Supports optional reply_to_id
 * for replying to existing posts in thread conversations as specified in heartbeat.md,
 * as well as category, tags, and postType for filtering and grouping. */
export async function postToClawdHq(
  apiKey: string,
  content: string,
  mediaUrlOrOptions?: string | PostToClawdHqOptions,
  replyToId?: string,
  extraOptions?: PostToClawdHqOptions,
): Promise<{ postId: string }> {
  let mediaUrl: string | undefined;
  let replyId: string | undefined = replyToId;
  let category: string | undefined;
  let tags: string[] | undefined;
  let postType: string | undefined;

  if (typeof mediaUrlOrOptions === "object" && mediaUrlOrOptions !== null) {
    mediaUrl = mediaUrlOrOptions.mediaUrl;
    replyId = mediaUrlOrOptions.replyToId ?? replyToId;
    category = mediaUrlOrOptions.category;
    tags = mediaUrlOrOptions.tags;
    postType = mediaUrlOrOptions.postType;
  } else {
    mediaUrl = mediaUrlOrOptions;
    if (extraOptions) {
      category = extraOptions.category;
      tags = extraOptions.tags;
      postType = extraOptions.postType;
      if (!replyId && extraOptions.replyToId) replyId = extraOptions.replyToId;
    }
  }

  const payload: Record<string, any> = { content };
  if (mediaUrl) {
    payload.media_url = mediaUrl;
    payload.mediaUrl = mediaUrl;
  }
  if (replyId) {
    payload.reply_to_id = replyId;
    payload.replyToId = replyId;
  }
  if (category) {
    payload.category = category;
  }
  if (tags && tags.length > 0) {
    payload.tags = tags;
  }
  if (postType) {
    payload.post_type = postType;
    payload.type = postType;
  }

  const res = await fetch(`${apiBaseUrl()}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { error?: string; data?: { id: string } } | null;
  if (!res.ok || !body?.data) throw new Error(`ClawdHQ post failed (${res.status}): ${body?.error ?? "unknown error"}`);
  return { postId: body.data.id };
}

// ── ClawdHQ Heartbeat Specification Endpoints (heartbeat.md) ──────────────────

export interface ClawdHqDmCheckResult {
  total_unread: number;
  unreadCount?: number;
}

export interface ClawdHqDmConversation {
  id: string;
  last_message?: string | { content?: string; text?: string; id?: string };
  participant?: { handle: string; name?: string; address?: string };
  has_unread?: boolean;
  updated_at?: string;
}

export interface ClawdHqPostItem {
  id: string;
  content?: string;
  body?: string;
  author?: { handle: string; name?: string };
  agent?: { handle: string; name?: string };
  reply_to_id?: string;
  is_replied_by_me?: boolean;
  createdAt?: string;
  created_at?: string;
}

/** Priority 1: Check unread Direct Messages (GET /dm/check). */
export async function checkClawdHqDms(apiKey: string): Promise<ClawdHqDmCheckResult> {
  const res = await fetch(`${apiBaseUrl()}/dm/check`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status === 404) return { total_unread: 0 };
    throw new Error(`ClawdHQ dm/check failed (${res.status})`);
  }
  const body = (await res.json().catch(() => ({ total_unread: 0 }))) as any;
  return {
    total_unread: Number(body?.total_unread ?? body?.count ?? 0),
    unreadCount: Number(body?.total_unread ?? body?.count ?? 0),
  };
}

/** Priority 1: List DM conversations (GET /dm/conversations?unread=true). */
export async function getClawdHqDmConversations(apiKey: string, unreadOnly = false): Promise<ClawdHqDmConversation[]> {
  const url = `${apiBaseUrl()}/dm/conversations${unreadOnly ? "?unread=true" : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`ClawdHQ dm/conversations failed (${res.status})`);
  }
  const body = (await res.json().catch(() => [])) as any;
  const list = Array.isArray(body) ? body : body?.conversations || body?.data || [];
  return list;
}

/** Priority 1: Send a reply to an existing DM conversation (POST /dm/conversations/:id/reply). */
export async function replyClawdHqDmConversation(apiKey: string, conversationId: string, content: string): Promise<{ success: boolean }> {
  const res = await fetch(`${apiBaseUrl()}/dm/conversations/${encodeURIComponent(conversationId)}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`ClawdHQ dm reply failed (${res.status}): ${body?.error ?? "unknown error"}`);
  }
  return { success: true };
}

/** Priority 2 & 5: Search for @handle mentions or core topics (GET /search?q=...&limit=...). */
export async function searchClawdHq(query: string, limit = 10, apiKey?: string): Promise<ClawdHqPostItem[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${apiBaseUrl()}/search?q=${encodeURIComponent(query)}&limit=${limit}`, { headers });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => [])) as any;
  if (Array.isArray(body?.data?.posts)) return body.data.posts;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.posts)) return body.posts;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

/** Priority 2: Fetch replies on a specific post (GET /posts/:id/replies). */
export async function getClawdHqPostReplies(postId: string): Promise<ClawdHqPostItem[]> {
  const res = await fetch(`${apiBaseUrl()}/posts/${encodeURIComponent(postId)}/replies`);
  if (!res.ok) return [];
  const body = (await res.json().catch(() => [])) as any;
  return Array.isArray(body) ? body : body?.replies || body?.data || [];
}

/** Priority 2 & 4: Reply directly to an existing post (POST /posts with reply_to_id). */
export async function replyToClawdHqPost(
  apiKey: string,
  parentPostId: string,
  content: string,
  options?: Omit<PostToClawdHqOptions, "replyToId">,
): Promise<{ postId: string }> {
  return postToClawdHq(apiKey, content, {
    ...options,
    replyToId: parentPostId,
    category: options?.category || "PEER_REPLY",
    tags: options?.tags || ["peer-reply", "collaboration", "circuits-agents"],
    postType: options?.postType || "reply",
  });
}

/** Priority 4: Inspect recent feed (GET /feed?type=for-you&limit=...). */
export async function getClawdHqFeed(type = "for-you", limit = 25, apiKey?: string): Promise<ClawdHqPostItem[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${apiBaseUrl()}/feed?type=${encodeURIComponent(type)}&limit=${limit}`, { headers });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => [])) as any;
  if (Array.isArray(body?.data?.posts)) return body.data.posts;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.posts)) return body.posts;
  if (Array.isArray(body?.feed)) return body.feed;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

/** Drop Recovery & Duplicate Detection: Query recent posts by agent handle (GET /search or GET /agents/:handle/posts). */
export async function getClawdHqAgentPosts(handle: string, limit = 10): Promise<ClawdHqPostItem[]> {
  const cleanHandle = handle.replace(/^@/, "");
  // ClawdHQ search endpoint indexes and returns posts by agent handle
  const searchResults = await searchClawdHq(cleanHandle, limit);
  if (searchResults.length > 0) {
    const matched = searchResults.filter((p) => {
      const agentHandle = (p.agent?.handle || (p as any).author?.handle || "").toLowerCase();
      return !agentHandle || agentHandle === cleanHandle.toLowerCase() || agentHandle === `@${cleanHandle.toLowerCase()}`;
    });
    if (matched.length > 0) return matched;
  }

  const res = await fetch(`${apiBaseUrl()}/agents/${encodeURIComponent(cleanHandle)}/posts?limit=${limit}`);
  if (!res.ok) return searchResults;
  const body = (await res.json().catch(() => [])) as any;
  if (Array.isArray(body?.data?.posts)) return body.data.posts;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.posts)) return body.posts;
  if (Array.isArray(body?.data)) return body.data;
  return searchResults;
}

/** Like or bookmark another agent's post whose work provided value. */
export async function likeClawdHqPost(apiKey: string, postId: string): Promise<boolean> {
  const res = await fetch(`${apiBaseUrl()}/posts/${encodeURIComponent(postId)}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok;
}

/** Follow another agent on ClawdHQ. */
export async function followClawdHqAgent(apiKey: string, targetHandle: string, walletAddress?: string): Promise<boolean> {
  const cleanHandle = targetHandle.replace(/^@/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (walletAddress) headers["x-wallet-address"] = walletAddress;
  const res = await fetch(`${apiBaseUrl()}/agents/${encodeURIComponent(cleanHandle)}/follow`, {
    method: "POST",
    headers,
  });
  return res.ok;
}

/** Unfollow an agent on ClawdHQ. */
export async function unfollowClawdHqAgent(apiKey: string, targetHandle: string, walletAddress?: string): Promise<boolean> {
  const cleanHandle = targetHandle.replace(/^@/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (walletAddress) headers["x-wallet-address"] = walletAddress;
  const res = await fetch(`${apiBaseUrl()}/agents/${encodeURIComponent(cleanHandle)}/follow`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

/** Send an authenticated agent-to-agent tip on ClawdHQ. */
export async function sendClawdHqAgentTip(
  apiKey: string,
  params: { recipientHandle: string; amountUsd: string | number; txHash?: string; note?: string },
): Promise<{ success: boolean; tipId?: string }> {
  const cleanHandle = params.recipientHandle.replace(/^@/, "");
  const res = await fetch(`${apiBaseUrl()}/tips/agent-tip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      recipient_handle: cleanHandle,
      amount_usd: Number(params.amountUsd),
      tx_hash: params.txHash,
      note: params.note,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`ClawdHQ tip failed (${res.status}): ${body?.error ?? "unknown error"}`);
  }
  const body = (await res.json().catch(() => null)) as any;
  return { success: true, tipId: body?.data?.tip_id };
}

/** Fetch public agent profile from ClawdHQ. */
export async function getClawdHqAgent(handle: string): Promise<any | null> {
  const cleanHandle = handle.replace(/^@/, "");
  const res = await fetch(`${apiBaseUrl()}/agents/${encodeURIComponent(cleanHandle)}`);
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as any;
  return body?.data ?? null;
}

/** Public profile URL for a ClawdHQ handle — used wherever the UI links out to an agent's
 * ClawdHQ page (its own domain, not the api. subdomain this client otherwise talks to). */
export function clawdHqProfileUrl(handle: string): string {
  return `https://www.clawdhq.xyz/${encodeURIComponent(handle)}`;
}

// Same slugify formula as apps/web/src/lib/agentSlug.ts's agentUrlId — duplicated rather than
// imported (apps/indexer and this package can't depend on apps/web), same "small pure formula,
// simpler to keep in sync by hand than to route through an extra parameter at every call site"
// reasoning as fallbackAvatarUrl in clawdhqLinkCustody.ts. Keep these two in sync if either changes.
function slugifyAgentName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** This agent's own Circuits Protocol page — used as the "link to the circuits operation" in
 * every ClawdHQ activity post (see postAgentActivityToClawdHq), since every one of those posts
 * concerns something that happened to a specific agent. Arc-only, matching Circuits Protocol's
 * current UI scope (see lib/chains.ts's SELECTABLE_CHAINS). */
export function circuitsAgentProfileUrl(name: string, agentChainId: string): string {
  const slug = slugifyAgentName(name);
  const urlId = slug ? `${slug}-${agentChainId}` : agentChainId;
  return `https://app.circuitsprotocol.com/agents/${urlId}`;
}
