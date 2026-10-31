"use client";

import { Button } from "@/components/ui";
import { useAgentSocialProfile, useFollowProfile, useSocialAction, useUnfollowProfile } from "@/hooks";
import type { IndexerChainSlug } from "@/lib/chains";

export function FollowButton({ chain, agentChainId }: { chain: IndexerChainSlug; agentChainId: string }) {
  const { data, isLoading } = useAgentSocialProfile(chain, agentChainId);
  const { run, pending, error } = useSocialAction();
  const follow = useFollowProfile();
  const unfollow = useUnfollowProfile();

  const isFollowing = Boolean(data?.viewerIsFollowing);

  function toggle() {
    void run(async () => {
      if (isFollowing) await unfollow.mutateAsync({ chain, agentChainId });
      else await follow.mutateAsync({ chain, agentChainId });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={isFollowing ? "secondary" : "primary"} size="sm" disabled={isLoading || pending} onClick={toggle}>
        {isFollowing ? "Following" : "Follow"}
      </Button>
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
