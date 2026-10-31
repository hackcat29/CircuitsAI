"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Repeat, Bot, User } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRelativeTime, truncateAddress } from "@/lib/format";
import { agentUrlId } from "@/lib/agentSlug";
import { useCreatePost, useDeletePost, useLikePost, useSocialAction, useUnlikePost } from "@/hooks";
import type { SocialPost, SocialProfile } from "@/lib/social/types";
import { CommentThread } from "./CommentThread";

function authorLabel(author: SocialProfile): string {
  if (author.kind === "AGENT") return author.displayName ?? `Agent #${author.agentChainId}`;
  if (author.displayName) return author.displayName;
  if (author.username) return `@${author.username}`;
  return author.walletAddress ? truncateAddress(author.walletAddress) : "Unknown";
}

function authorHref(author: SocialProfile): string | null {
  if (author.kind === "AGENT" && author.agentChainId) {
    return `/agents/${agentUrlId(author.displayName ?? "", author.agentChainId)}`;
  }
  if (author.kind === "HUMAN") {
    // Always link to public profile — by username if set, by wallet address as fallback
    if (author.username) return `/${author.username}`;
    if (author.walletAddress) return `/${author.walletAddress}`;
  }
  return null;
}


function AuthorHeader({ author, createdAt }: { author: SocialProfile; createdAt: string }) {
  const href = authorHref(author);

  const identity = (
    <div className="flex items-center gap-2">
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar can be an arbitrary uploaded/IPFS/DiceBear URL
        <img src={author.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border-strong object-cover bg-bg-surface3" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-surface3 text-[15px]">
          {author.kind === "AGENT" ? <Bot className="h-4 w-4 text-accent-violet" /> : <User className="h-4 w-4 text-text-tertiary" />}
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-text-primary">{authorLabel(author)}</span>
          {author.kind === "HUMAN" && author.username && author.displayName && (
            <span className="text-[11px] font-mono text-accent-violet/80">@{author.username}</span>
          )}
        </div>
        <span className="text-[10.5px] text-text-quaternary">{formatRelativeTime(createdAt)}</span>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-2">
      {href ? (
        <Link href={href} className="hover:opacity-80">
          {identity}
        </Link>
      ) : (
        identity
      )}
    </div>
  );
}

function PostMedia({ url, className }: { url: string; className?: string }) {
  const isVideo = /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
  if (isVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        className={cn("mt-2 rounded-lg max-h-96 w-full bg-black/40 border border-border-subtle", className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("mt-2 rounded-lg max-h-96 w-full object-cover border border-border-subtle", className)}
    />
  );
}

/** A repost's referenced original, shown inline and one level deep only (see
 * lib/server/socialValidate.ts's serializePost doc comment). */
function QuotedPost({ post }: { post: SocialPost }) {
  return (
    <div className="mt-2 rounded-xl border border-border-subtle bg-white/2 p-3">
      <AuthorHeader author={post.author} createdAt={post.createdAt} />
      {post.body && <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-text-secondary">{post.body}</p>}
      {post.mediaUrl && <PostMedia url={post.mediaUrl} className="max-h-64" />}
    </div>
  );
}

export function PostCard({ post, viewerProfileId }: { post: SocialPost; viewerProfileId?: string }) {
  const [showComments, setShowComments] = useState(false);
  const { run, pending, error } = useSocialAction();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useCreatePost();
  const deletePost = useDeletePost();

  const canDelete = viewerProfileId && viewerProfileId === post.author.id;

  function toggleLike() {
    void run(async () => {
      if (post.viewerHasLiked) await unlikePost.mutateAsync(post.id);
      else await likePost.mutateAsync(post.id);
    });
  }

  function doRepost() {
    void run(async () => {
      await repost.mutateAsync({ repostOfId: post.id });
    });
  }

  return (
    <Card className="p-4">
      <AuthorHeader author={post.author} createdAt={post.createdAt} />

      {post.body && <p className="mt-3 whitespace-pre-wrap text-[13.5px] text-text-primary">{post.body}</p>}
      {post.mediaUrl && <PostMedia url={post.mediaUrl} className="mt-3" />}
      {post.repostOf && <QuotedPost post={post.repostOf} />}

      <div className="mt-3 flex items-center gap-1 border-t border-border-subtle pt-2.5">
        <Button variant="ghost" size="sm" disabled={pending} onClick={toggleLike} className={cn(post.viewerHasLiked && "text-red")}>
          <Heart className={cn("h-3.5 w-3.5 mr-1", post.viewerHasLiked ? "fill-red text-red" : "text-text-tertiary")} />
          <span>{post.likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((v) => !v)}>
          <MessageSquare className="h-3.5 w-3.5 mr-1 text-text-tertiary" />
          <span>{post.commentCount}</span>
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={doRepost}>
          <Repeat className="h-3.5 w-3.5 mr-1 text-text-tertiary" />
          <span>{post.repostCount}</span>
        </Button>
        {canDelete && (
          <Button variant="ghost" size="sm" className="ml-auto text-text-quaternary hover:text-red" onClick={() => deletePost.mutate(post.id)}>
            Delete
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red">{error}</p>}

      {showComments && <CommentThread postId={post.id} />}
    </Card>
  );
}
