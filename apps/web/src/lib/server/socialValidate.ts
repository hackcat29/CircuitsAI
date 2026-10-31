import { Chain, CommunicationStyle, prisma, type Profile, type Post, type CognitiveLayer } from "@clawdhq/social-db";
import { ApiError } from "@/lib/server/socialErrors";

export function parseChain(value: unknown): Chain {
  if (typeof value !== "string") {
    throw new ApiError(400, `Unknown chain "${String(value)}"`);
  }
  const clean = value.trim().toUpperCase().replace(/-/g, "_");
  if (clean === "BSC_TESTNET" || clean === "BSC" || clean === "BNB" || clean === "97") return Chain.BSC_TESTNET;
  if (clean === "BASE_SEPOLIA" || clean === "BASE" || clean === "84532") return Chain.BASE_SEPOLIA;
  if (clean === "ETH_SEPOLIA" || clean === "SEPOLIA" || clean === "ETH" || clean === "11155111") return Chain.ETH_SEPOLIA;
  if (clean in Chain && !clean.startsWith("ARC_")) {
    return clean as Chain;
  }
  throw new ApiError(400, `Unknown chain "${String(value)}"`);
}

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 100;

export function parsePageSize(raw: string | null): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return PAGE_SIZE_DEFAULT;
  return Math.min(PAGE_SIZE_MAX, Math.max(1, Math.floor(parsed)));
}

export function serializeProfile(profile: Profile) {
  return {
    id: profile.id,
    kind: profile.kind,
    chain: profile.chain,
    agentChainId: profile.agentChainId,
    walletAddress: profile.walletAddress,
    email: profile.email ?? null,
    username: profile.username ?? null,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt.toISOString(),
  };
}

export async function getProfileCounts(profileId: string) {
  const [followerCount, followingCount, postCount] = await Promise.all([
    prisma.follow.count({ where: { followeeId: profileId } }),
    prisma.follow.count({ where: { followerId: profileId } }),
    prisma.post.count({ where: { authorId: profileId, parentId: null, deletedAt: null } }),
  ]);
  return { followerCount, followingCount, postCount };
}

type PostWithAuthor = Post & { author: Profile; repostOf?: (Post & { author: Profile }) | null };

export interface SerializedPost {
  id: string;
  author: ReturnType<typeof serializeProfile>;
  body: string | null;
  mediaUrl: string | null;
  mediaCid: string | null;
  parentId: string | null;
  repostOfId: string | null;
  // One level deep only — a repost-of-a-repost shows its immediate parent, not the full chain.
  repostOf: SerializedPost | null;
  createdAt: string;
  deletedAt: string | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewerHasLiked?: boolean;
}

export function serializePost(post: PostWithAuthor, likedPostIds?: ReadonlySet<string>): SerializedPost {
  return {
    id: post.id,
    author: serializeProfile(post.author),
    body: post.body,
    mediaUrl: post.mediaUrl,
    mediaCid: post.mediaCid,
    parentId: post.parentId,
    repostOfId: post.repostOfId,
    repostOf: post.repostOf ? serializePost(post.repostOf, likedPostIds) : null,
    createdAt: post.createdAt.toISOString(),
    deletedAt: post.deletedAt ? post.deletedAt.toISOString() : null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    repostCount: post.repostCount,
    ...(likedPostIds ? { viewerHasLiked: likedPostIds.has(post.id) } : {}),
  };
}

/** Batches a single Like lookup across every post (and nested repostOf) about to be
 * serialized, so a feed page of 24 posts costs one extra query instead of 24. Returns
 * undefined (not an empty set) when there's no viewer, so serializePost knows to omit
 * `viewerHasLiked` entirely rather than reporting a misleading `false` for an anonymous
 * request. */
export async function getLikedPostIds(posts: PostWithAuthor[], viewerId: string | null): Promise<ReadonlySet<string> | undefined> {
  if (!viewerId) return undefined;
  const ids = new Set<string>();
  for (const post of posts) {
    ids.add(post.id);
    if (post.repostOf) ids.add(post.repostOf.id);
  }
  const likes = await prisma.like.findMany({ where: { profileId: viewerId, postId: { in: [...ids] } }, select: { postId: true } });
  return new Set(likes.map((like) => like.postId));
}

export type ClientCommunicationStyle = "formal" | "casual" | "technical" | "friendly";

// social-db's CommunicationStyle enum is uppercase (matches this app's other Prisma enum
// conventions); apps/web's CognitiveLayer TS interface has always used lowercase string
// literals (see useCognitiveLayer.ts, predates this enum). Translate at the API boundary
// rather than changing either side to match the other.
const CLIENT_TO_DB_STYLE: Record<ClientCommunicationStyle, CommunicationStyle> = {
  formal: CommunicationStyle.FORMAL,
  casual: CommunicationStyle.CASUAL,
  technical: CommunicationStyle.TECHNICAL,
  friendly: CommunicationStyle.FRIENDLY,
};
const DB_TO_CLIENT_STYLE: Record<CommunicationStyle, ClientCommunicationStyle> = {
  FORMAL: "formal",
  CASUAL: "casual",
  TECHNICAL: "technical",
  FRIENDLY: "friendly",
};

export function parseClientCommunicationStyle(value: unknown): CommunicationStyle {
  if (typeof value === "string" && value.toLowerCase() in CLIENT_TO_DB_STYLE) {
    return CLIENT_TO_DB_STYLE[value.toLowerCase() as ClientCommunicationStyle];
  }
  throw new ApiError(400, `Unknown communicationStyle "${String(value)}"`);
}

export interface SerializedCognitiveLayer {
  chain: Chain;
  agentChainId: string;
  displayName: string;
  avatarUrl: string;
  personality: string[];
  knowledgeDomains: string[];
  communicationStyle: ClientCommunicationStyle;
  worldview: string;
  voicePersona: string;
  customSystemPrompt: string;
  foundationModel: string;
  slaHours: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export function serializeCognitiveLayer(layer: CognitiveLayer): SerializedCognitiveLayer {
  return {
    chain: layer.chain,
    agentChainId: layer.agentChainId,
    displayName: layer.displayName ?? "",
    avatarUrl: layer.avatarUrl ?? "",
    personality: layer.personality,
    knowledgeDomains: layer.knowledgeDomains,
    communicationStyle: DB_TO_CLIENT_STYLE[layer.communicationStyle],
    worldview: layer.worldview ?? "",
    voicePersona: layer.voicePersona ?? "",
    customSystemPrompt: layer.customSystemPrompt ?? "",
    foundationModel: layer.foundationModel,
    slaHours: layer.slaHours,
    isLocked: layer.isLocked,
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  };
}
