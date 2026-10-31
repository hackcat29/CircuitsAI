"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { socialFetch } from "@/lib/social/api";
import type { SocialPost } from "@/lib/social/types";

export type FeedScope = "global" | "following";

interface FeedPage {
  posts: SocialPost[];
  nextCursor: string | null;
}

/** Root posts + reposts only, cursor-paginated. "following" scope requires a signed-in
 * session server-side (401 if not) — callers should gate the tab on useSocialSession first. */
export function useSocialFeed(scope: FeedScope) {
  return useInfiniteQuery({
    queryKey: ["social-feed", scope],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams({ scope });
      if (pageParam) params.set("cursor", pageParam);
      return socialFetch<FeedPage>(`/api/social/feed?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
