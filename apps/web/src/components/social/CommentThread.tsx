"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeTime, truncateAddress } from "@/lib/format";
import { useComments, useCreatePost, useLikePost, useSocialAction, useUnlikePost } from "@/hooks";
import type { SocialProfile } from "@/lib/social/types";

function authorLabel(author: SocialProfile): string {
  if (author.kind === "AGENT") return author.displayName ?? `Agent #${author.agentChainId}`;
  if (author.displayName) return author.displayName;
  if (author.username) return `@${author.username}`;
  return author.walletAddress ? truncateAddress(author.walletAddress) : "Unknown";
}

/** Flat, one-level comment list under a post — not a recursive PostCard (comments don't get
 * their own reply-composer/repost affordances here), which also sidesteps a circular import
 * between PostCard and this component. */
export function CommentThread({ postId }: { postId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useComments(postId);
  const { run, pending, error } = useSocialAction();
  const createComment = useCreatePost();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const [draft, setDraft] = useState("");

  const comments = data?.pages.flatMap((page) => page.comments) ?? [];

  function submitComment() {
    const body = draft.trim();
    if (!body) return;
    void run(async () => {
      await createComment.mutateAsync({ parentId: postId, body });
      setDraft("");
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3">
      <div className="flex items-start gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          maxLength={500}
          className="min-h-16 flex-1 text-[12.5px]"
        />
        <Button size="sm" disabled={pending || !draft.trim()} onClick={submitComment}>
          Reply
        </Button>
      </div>
      {error && <p className="text-xs text-red">{error}</p>}

      {isLoading && <p className="text-xs text-text-quaternary">Loading comments…</p>}

      {comments.map((comment) => (
        <div key={comment.id} className="flex flex-col gap-1 rounded-lg bg-white/2 p-2.5">
          <div className="flex items-center gap-1.5 text-[11.5px]">
            {(() => {
              const profileHref =
                comment.author.kind === "HUMAN"
                  ? comment.author.username
                    ? `/${comment.author.username}`
                    : comment.author.walletAddress
                    ? `/${comment.author.walletAddress}`
                    : null
                  : null;
              return profileHref ? (
                <Link href={profileHref} className="font-bold text-text-primary hover:underline hover:text-accent-violet transition-colors">
                  {authorLabel(comment.author)}
                </Link>
              ) : (
                <span className="font-bold text-text-primary">{authorLabel(comment.author)}</span>
              );
            })()}
            <span className="text-text-quaternary">· {formatRelativeTime(comment.createdAt)}</span>
          </div>
          {comment.body && <p className="whitespace-pre-wrap text-[12.5px] text-text-secondary">{comment.body}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                if (comment.viewerHasLiked) await unlikePost.mutateAsync(comment.id);
                else await likePost.mutateAsync(comment.id);
              })
            }
            className={cn(
              "w-fit text-[11px] text-text-quaternary hover:text-text-primary flex items-center gap-1",
              comment.viewerHasLiked && "text-red hover:text-red",
            )}
          >
            <Heart className={cn("h-3 w-3", comment.viewerHasLiked ? "fill-red text-red" : "text-text-tertiary")} />
            <span>{comment.likeCount}</span>
          </button>
        </div>
      ))}

      {hasNextPage && (
        <Button variant="ghost" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          Load more comments
        </Button>
      )}
    </div>
  );
}
