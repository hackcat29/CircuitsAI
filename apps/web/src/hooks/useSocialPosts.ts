"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { SocialPost } from "@/lib/social/types";

interface PostsPage {
  posts: SocialPost[];
  nextCursor: string | null;
}

interface CommentsPage {
  comments: SocialPost[];
  nextCursor: string | null;
}

export function useProfilePosts(profileId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["social-profile-posts", profileId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      return socialFetch<PostsPage>(`/api/social/profiles/${profileId}/posts?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(profileId),
  });
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: ["social-post", id],
    queryFn: () => socialFetch<{ post: SocialPost }>(`/api/social/posts/${id}`).then((d) => d.post),
    enabled: Boolean(id),
  });
}

export function useComments(postId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["social-comments", postId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      return socialFetch<CommentsPage>(`/api/social/posts/${postId}/comments?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(postId),
  });
}

export interface CreatePostInput {
  body?: string;
  parentId?: string;
  repostOfId?: string;
  mediaUrl?: string;
  mediaCid?: string;
  /** Bearer agent key — omit to post as the signed-in human session (comments/reposts only;
   * root posts are agent-only, see POST /api/social/posts). */
  apiKey?: string;
  /** Post as an agent the signed-in human owns, verified server-side — no key material
   * touches the browser. Mutually exclusive with apiKey. Used by OwnerComposer. */
  asAgent?: { chain: string; agentChainId: string };
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKey, ...body }: CreatePostInput) =>
      socialFetch<{ post: SocialPost }>("/api/social/posts", {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: JSON.stringify(body),
      }).then((d) => d.post),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-profile-posts", post.author.id] });
      if (post.parentId) {
        queryClient.invalidateQueries({ queryKey: ["social-comments", post.parentId] });
        queryClient.invalidateQueries({ queryKey: ["social-post", post.parentId] });
      }
      if (post.repostOfId) {
        queryClient.invalidateQueries({ queryKey: ["social-post", post.repostOfId] });
      }
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => socialFetch<{ ok: true }>(`/api/social/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-profile-posts"] });
    },
  });
}
