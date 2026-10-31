"use client";

import Link from "next/link";
import { Globe, MessageCircle, Bot, MessageSquare, ShieldCheck, User, Coins, Percent } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { isEvmChain } from "@/lib/chains";
import { useWallet } from "@/hooks";
import type { LaunchDetail } from "@/hooks";
import { UserAddressLink } from "@/components/profile";

interface TeamMember {
  name?: string;
  role?: string;
}

function isTeamMemberArray(value: unknown): value is TeamMember[] {
  return Array.isArray(value);
}

export function TeamPanel({ launch }: { launch: LaunchDetail }) {
  const { chain } = useWallet();
  const explorerUrl = isEvmChain(chain) ? chain.explorerUrl : null;
  const creatorExplorerHref = explorerUrl ? `${explorerUrl}/address/${launch.creator}` : undefined;

  const metadata = launch.metadata;
  const team = isTeamMemberArray(metadata?.team) ? metadata.team : [];
  const hasSocials = Boolean(metadata?.websiteUrl || metadata?.twitterUrl || metadata?.telegramUrl);

  return (
    <Card className="border border-border-subtle bg-bg-elevated/75 backdrop-blur-sm shadow-xs overflow-hidden">
      <CardHeader className="pb-2.5 pt-3.5 px-4 border-b border-border-subtle/50 flex flex-row items-center justify-between">
        <CardTitle className="text-[13px] font-extrabold text-text-primary flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-accent-violet" />
          <span>Agent &amp; Creator Details</span>
        </CardTitle>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-dark text-accent-violet border border-accent-violet/25 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Verified On-Chain
        </span>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Assigned Agent */}
          <div className="p-3 rounded-[10px] bg-bg-surface3/40 border border-border-subtle/50 flex flex-col justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1">
                <Bot className="h-3 w-3 text-accent-violet" />
                <span>Assigned Agent</span>
              </div>
              <div className="text-xs font-bold text-text-primary mt-1">
                @{launch.agentName || `Agent #${launch.agentChainId}`}
              </div>
              <p className="text-[11px] text-text-quaternary mt-0.5 leading-snug">
                Receives 20% of trading fees to fund agent operations and token buybacks.
              </p>
            </div>
            {launch.agentChainId && (
              <Link
                href={`/app/terminal?agent=${launch.agentChainId}`}
                className="w-full py-1 rounded-[7px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <MessageSquare className="h-3 w-3" />
                <span>Chat in Terminal</span>
              </Link>
            )}
          </div>

          {/* Creator */}
          <div className="p-3 rounded-[10px] bg-bg-surface3/40 border border-border-subtle/50 flex flex-col justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1">
                <User className="h-3 w-3 text-amber-400" />
                <span>Creator</span>
              </div>
              <div className="text-xs font-bold mt-1">
                <UserAddressLink address={launch.creator} badge />
              </div>
              <p className="text-[11px] text-text-quaternary mt-0.5 leading-snug">
                Receives <strong>30% royalties</strong> on trading swap volume.
              </p>
            </div>
            <div className="text-[10px] font-mono text-amber-400/90 font-bold px-2 py-0.75 rounded bg-amber-500/10 border border-amber-500/20 text-center">
              30% Creator Royalties
            </div>
          </div>
        </div>

        {/* Fee Split Banner */}
        <div className="rounded-[9px] bg-bg-surface3/20 border border-border-subtle/40 p-2.5 flex items-center justify-between text-[11px] flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-text-tertiary">
            <Percent className="h-3.5 w-3.5 text-accent-violet" />
            <span className="font-semibold text-text-secondary">Fee Split:</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10.5px]">
            <span className="px-1.5 py-0.5 rounded bg-bg-surface3 text-text-secondary">50% Protocol</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">30% Creator</span>
            <span className="px-1.5 py-0.5 rounded bg-accent-dark text-accent-violet">20% Agent Treasury</span>
          </div>
        </div>

        {metadata?.description && (
          <p className="text-xs text-text-secondary leading-relaxed pt-1">
            {metadata.description}
          </p>
        )}

        {hasSocials && (
          <div className="flex items-center gap-3 pt-1 border-t border-border-subtle/40">
            {metadata?.websiteUrl && (
              <a
                href={metadata.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Website</span>
              </a>
            )}
            {metadata?.twitterUrl && (
              <a
                href={metadata.twitterUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                <span className="font-bold">𝕏</span>
                <span>Twitter</span>
              </a>
            )}
            {metadata?.telegramUrl && (
              <a
                href={metadata.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Telegram</span>
              </a>
            )}
          </div>
        )}

        {team.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border-subtle/40">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Contributors</span>
            {team.map((member, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-text-primary font-semibold">{member.name ?? "Unnamed"}</span>
                <span className="text-text-tertiary font-mono text-[11px]">{member.role ?? "Contributor"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


