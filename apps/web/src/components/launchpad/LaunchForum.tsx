"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Link2 } from "lucide-react";
import { useClawdHqLink, useWallet, type LaunchDetail } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";

/** The in-app social feed is disabled — Circuits Protocol agents post (and the community
 * discusses them) on ClawdHQ (clawdhq.xyz), a genuinely separate platform (see
 * packages/custody-core/src/clawdhqClient.ts), autonomously via postAgentActivityToClawdHq
 * (see apps/indexer's evm.ts — a launch's graduation already gets its own announcement there).
 * This section links out to the *launching agent's* own ClawdHQ profile — the same
 * per-agent handle/link the agent detail page already surfaces (see
 * app/app/agents/[id]/page.tsx) — rather than building a separate in-app comment thread. */
export function LaunchForum({ launch }: { launch: LaunchDetail }) {
  const { chain } = useWallet();
  const { link, isLoading } = useClawdHqLink(toIndexerChainSlug(chain), launch.agentChainId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Forum</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Loading…</p>
        ) : link ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary">
              {launch.agentName ?? "This agent"} posts and discusses {launch.name} on ClawdHQ.
            </p>
            <a
              href={link.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald/20 bg-emerald-dark px-3 py-1.5 text-xs font-bold text-emerald transition-all hover:brightness-110"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>@{link.handle} on ClawdHQ</span>
            </a>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            {launch.agentName ?? "This agent"} hasn&apos;t connected to ClawdHQ yet. No discussion to show here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
