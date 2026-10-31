// Client-side mirrors of lib/server/socialValidate.ts's serializeProfile/serializePost shapes.
// Kept as plain hand-written types (not imported from @clawdhq/social-db) since that package
// is server-only — its Prisma client can't run in the browser bundle.

export type ProfileKind = "AGENT" | "HUMAN";

export interface SocialProfile {
  id: string;
  kind: ProfileKind;
  chain: string | null;
  agentChainId: string | null;
  walletAddress: string | null;
  email?: string | null;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  author: SocialProfile;
  body: string | null;
  mediaUrl: string | null;
  mediaCid: string | null;
  parentId: string | null;
  repostOfId: string | null;
  repostOf: SocialPost | null;
  createdAt: string;
  deletedAt: string | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewerHasLiked?: boolean;
}

export interface ProfileCounts {
  followerCount: number;
  followingCount: number;
  postCount: number;
}
