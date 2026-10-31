"use client";

import { useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { SocialPost } from "@/lib/social/types";

interface PostListPage {
  posts?: SocialPost[];
  comments?: SocialPost[];
  nextCursor: string | null;
}

const POST_LIST_QUERY_KEYS = ["social-feed", "social-profile-posts", "social-comments"];

/** Patches every cached copy of a post (feed pages, profile-post pages, comment pages, and
 * the single-post query) at once — react-query has no built-in "this entity lives in N
 * different list queries" concept, so an optimistic like has to walk all of them by hand. */
function patchPostEverywhere(queryClient: QueryClient, postId: string, updater: (post: SocialPost) => SocialPost) {
  const patch = (post: SocialPost): SocialPost => {
    if (post.id === postId) return updater(post);
    if (post.repostOf?.id === postId) return { ...post, repostOf: updater(post.repostOf) };
    return post;
  };

  queryClient.setQueriesData<InfiniteData<PostListPage>>(
    { predicate: (query) => POST_LIST_QUERY_KEYS.includes(query.queryKey[0] as string) },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts?.map(patch),
          comments: page.comments?.map(patch),
        })),
      };
    },
  );

  queryClient.setQueryData<SocialPost>(["social-post", postId], (post) => (post ? patch(post) : post));
}

export function useLikePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => socialFetch<{ ok: true }>(`/api/social/posts/${postId}/like`, { method: "POST" }),
    onMutate: (postId: string) => {
      patchPostEverywhere(queryClient, postId, (post) =>
        post.viewerHasLiked ? post : { ...post, viewerHasLiked: true, likeCount: post.likeCount + 1 },
      );
    },
    onError: (_err, postId) => {
      // Best-effort rollback — invalidating would also work but costs a round trip; a wrong
      // optimistic count here self-heals on the next natural refetch either way.
      patchPostEverywhere(queryClient, postId, (post) => ({
        ...post,
        viewerHasLiked: false,
        likeCount: Math.max(0, post.likeCount - 1),
      }));
    },
  });
}

export function useUnlikePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => socialFetch<{ ok: true }>(`/api/social/posts/${postId}/like`, { method: "DELETE" }),
    onMutate: (postId: string) => {
      patchPostEverywhere(queryClient, postId, (post) =>
        post.viewerHasLiked === false ? post : { ...post, viewerHasLiked: false, likeCount: Math.max(0, post.likeCount - 1) },
      );
    },
    onError: (_err, postId) => {
      patchPostEverywhere(queryClient, postId, (post) => ({ ...post, viewerHasLiked: true, likeCount: post.likeCount + 1 }));
    },
  });
}

// Follow targets are always agents ("follow other agents... be followed by agents and
// humans" — the follower can be either kind, but the followable subject is always an agent).
// The API route also accepts a raw profileId target for generality, but no UI in this app
// needs to follow a human profile, so the client hook only exposes the (chain, agentChainId)
// shape actually used by FollowButton on the agent page.
export type FollowTarget =
  | { chain: string; agentChainId: string; profileId?: never }
  | { profileId: string; chain?: never; agentChainId?: never };

export function useFollowProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: FollowTarget) => socialFetch<{ ok: true; followeeId: string }>("/api/social/follows", { method: "POST", body: JSON.stringify(target) }),
    onSuccess: (_data, target) => {
      if (target.chain && target.agentChainId) {
        queryClient.invalidateQueries({ queryKey: ["social-profile", "agent", target.chain, target.agentChainId] });
      }
      if (target.profileId) {
        queryClient.invalidateQueries({ queryKey: ["social-profile"] });
      }
    },
  });
}

export function useUnfollowProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: FollowTarget) => socialFetch<{ ok: true }>("/api/social/follows", { method: "DELETE", body: JSON.stringify(target) }),
    onSuccess: (_data, target) => {
      if (target.chain && target.agentChainId) {
        queryClient.invalidateQueries({ queryKey: ["social-profile", "agent", target.chain, target.agentChainId] });
      }
      if (target.profileId) {
        queryClient.invalidateQueries({ queryKey: ["social-profile"] });
      }
    },
  });
}
