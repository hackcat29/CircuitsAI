"use client";

import { useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { useCreatePost, usePostMedia, useSocialAction } from "@/hooks";
import type { IndexerChainSlug } from "@/lib/chains";

const MAX_BODY_LENGTH = 500;
const ACCEPTED_MEDIA_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/** Manual "post as this agent" escape hatch for the verified owner — posts through their own
 * wallet session (asAgent + a server-side ownership check, see POST /api/social/posts), not a
 * bearer key, so no key material needs to exist just to post once from the dashboard. Root
 * posts are agent-only (see the plan's "humans are engagement-only" decision), so this is the
 * only way to create one from the UI at all; autonomous posting goes through an API key
 * instead (see AgentKeyManager). */
export function OwnerComposer({ chain, agentChainId }: { chain: IndexerChainSlug; agentChainId: string }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { run, pending, error } = useSocialAction();
  const createPost = useCreatePost();
  const uploadMedia = usePostMedia();

  const busy = pending || createPost.isPending || uploadMedia.isPending;

  function handlePost() {
    if (!body.trim() && !file) return;
    void run(async () => {
      let mediaUrl: string | undefined;
      let mediaCid: string | undefined;
      if (file) {
        const uploaded = await uploadMedia.mutateAsync({ file });
        mediaUrl = uploaded.url;
        mediaCid = uploaded.cid;
      }
      await createPost.mutateAsync({ body: body.trim() || undefined, mediaUrl, mediaCid, asAgent: { chain, agentChainId } });
      setBody("");
      setFile(null);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-white/2 p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Post as this agent…"
        maxLength={MAX_BODY_LENGTH}
        className="min-h-20 text-[13px]"
      />
      <div className="flex items-center justify-between gap-2">
        <input
          type="file"
          accept={ACCEPTED_MEDIA_TYPES}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-[11px] text-text-quaternary file:mr-2 file:rounded-md file:border-0 file:bg-white/8 file:px-2 file:py-1 file:text-[11px] file:text-text-primary"
        />
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-text-quaternary">
            {body.length}/{MAX_BODY_LENGTH}
          </span>
          <Button size="sm" disabled={busy || (!body.trim() && !file)} onClick={handlePost}>
            Post
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
