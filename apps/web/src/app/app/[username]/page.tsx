"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Calendar,
  Wallet,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Settings,
  Bot,
  Users,
  Rocket,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Activity,
  ArrowRightLeft,
  Coins,
  ShoppingBag,
  History,
  Radio,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import {
  useSocialSession,
  useUsernameSocialProfile,
  useUserOperations,
  useFollowProfile,
  useUnfollowProfile,
  useSocialAction,
} from "@/hooks";
import { truncateAddress, formatRelativeTime } from "@/lib/format";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { agentUrlId } from "@/lib/agentSlug";

interface UserAgentSummary {
  agentId: string;
  name: string;
  active: boolean;
  tier: number;
  jobsCompleted: number;
  reputationBps: number;
  usdcRevenue: string;
  createdAtChain: string;
}

const ITEMS_PER_PAGE = 8;

const SYSTEM_RESERVED_ROUTES = new Set([
  "build",
  "terminal",
  "marketplace",
  "orchestrate",
  "bundles",
  "skills",
  "knowledge",
  "x402-services",
  "launchpad",
  "agents",
  "wallet",
  "dashboard",
  "negotiations",
  "disputes",
  "governance",
  "exchange",
  "degen",
  "social",
]);

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = use(params);
  const rawUsername = resolvedParams.username;
  const username = decodeURIComponent(rawUsername).replace(/^@/, "").trim().toLowerCase();

  // If a system route accidentally matches the [username] dynamic segment, redirect immediately
  if (SYSTEM_RESERVED_ROUTES.has(username)) {
    if (typeof window !== "undefined") {
      window.location.replace(`/${username}`);
    }
  }

  const { profile: currentProfile } = useSocialSession();
  const { data, isLoading, error, refetch } = useUsernameSocialProfile(SYSTEM_RESERVED_ROUTES.has(username) ? "" : username);
  const profile = data?.profile;

  const { data: operationsData, isLoading: operationsLoading } = useUserOperations(
    profile?.username || username
  );
  const operations = operationsData?.operations ?? [];

  const [activeTab, setActiveTab] = useState<"agents" | "operations">("agents");
  const [opFilter, setOpFilter] = useState<"ALL" | "AGENTS" | "LAUNCHPAD" | "MARKET" | "BROADCAST">("ALL");
  const [opPage, setOpPage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Follow/unfollow actions
  const followMutation = useFollowProfile();
  const unfollowMutation = useUnfollowProfile();
  const { run: runSocialAction, pending: followPending } = useSocialAction();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (data?.viewerIsFollowing !== undefined) {
      setIsFollowing(data.viewerIsFollowing);
    }
  }, [data?.viewerIsFollowing]);

  // Reset pagination on filter change
  const handleFilterChange = (filter: "ALL" | "AGENTS" | "LAUNCHPAD" | "MARKET" | "BROADCAST") => {
    setOpFilter(filter);
    setOpPage(1);
  };

  // Query user's created agents on Circuits Protocol
  const [userAgents, setUserAgents] = useState<UserAgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  useEffect(() => {
    if (profile?.walletAddress) {
      setAgentsLoading(true);
      fetch(`/api/agents/monad-mainnet?owner=${encodeURIComponent(profile.walletAddress)}`)
        .then((res) => (res.ok ? res.json() : { agents: [] }))
        .then((res) => {
          const list = Array.isArray(res) ? res : res.agents || [];
          setUserAgents(list);
        })
        .catch(() => setUserAgents([]))
        .finally(() => setAgentsLoading(false));
    }
  }, [profile?.walletAddress]);

  const isOwner = Boolean(
    currentProfile &&
      profile &&
      (currentProfile.id === profile.id ||
        (currentProfile.walletAddress &&
          profile.walletAddress &&
          currentProfile.walletAddress.toLowerCase() === profile.walletAddress.toLowerCase())),
  );

  const copyAddress = () => {
    if (profile?.walletAddress) {
      navigator.clipboard.writeText(profile.walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const shareProfile = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleFollowToggle = () => {
    if (!profile) return;
    void runSocialAction(async () => {
      if (isFollowing) {
        await unfollowMutation.mutateAsync({ profileId: profile.id });
        setIsFollowing(false);
      } else {
        await followMutation.mutateAsync({ profileId: profile.id });
        setIsFollowing(true);
      }
      refetch();
    });
  };

  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      if (opFilter === "AGENTS") return op.type === "AGENT_REGISTERED";
      if (opFilter === "LAUNCHPAD") return op.type === "TOKEN_LAUNCH_CREATED" || op.type === "TOKEN_SWAP";
      if (opFilter === "MARKET") return op.type === "EXCHANGE_LISTED" || op.type === "BID_PLACED" || op.type === "SERVICE_PUBLISHED";
      if (opFilter === "BROADCAST") return op.type === "AGENT_BROADCAST";
      return true;
    });
  }, [operations, opFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOperations.length / ITEMS_PER_PAGE));
  const paginatedOperations = useMemo(() => {
    const start = (opPage - 1) * ITEMS_PER_PAGE;
    return filteredOperations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOperations, opPage]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-accent-violet mb-3" />
        <p className="text-sm text-text-tertiary">Loading profile for @{username}…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-bg-raised border border-border-strong flex items-center justify-center mx-auto mb-4 text-text-tertiary">
          <User className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">User Not Found</h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
          No profile was found for <span className="font-mono text-accent-violet">@{username}</span>.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            ← Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recent";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center gap-2 text-xs text-text-quaternary mb-4">
        <Link href="/dashboard" className="hover:text-text-secondary transition-colors">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-secondary font-mono">@{profile.username || username}</span>
      </div>

      <div className="relative rounded-3xl overflow-hidden border border-border-strong bg-bg-surface shadow-xl">
        <div className="h-32 sm:h-40 w-full bg-bg-surface3 relative overflow-hidden border-b border-border-subtle" />

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            <div className="relative">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl sm:rounded-3xl bg-bg-surface2 border-4 border-bg-surface overflow-hidden shadow-2xl flex items-center justify-center text-text-primary font-bold text-3xl">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName || profile.username || "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-bg-elevated flex items-center justify-center text-accent-violet">
                    <User className="h-10 w-10 sm:h-12 sm:w-12" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isOwner ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)} className="text-xs font-semibold gap-1.5 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </Button>
                  <Link href="/register">
                    <Button size="sm" className="text-xs font-semibold gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Register Agent</span>
                    </Button>
                  </Link>
                </>
              ) : currentProfile ? (
                <Button size="sm" variant={isFollowing ? "outline" : "primary"} disabled={followPending} onClick={handleFollowToggle} className="text-xs font-semibold gap-1.5 cursor-pointer">
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              ) : null}

              <Button variant="ghost" size="sm" onClick={shareProfile} className="text-xs gap-1.5 cursor-pointer">
                {copiedShare ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                <span>{copiedShare ? "Link Copied!" : "Share"}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary">{profile.displayName || `@${profile.username}`}</h1>
            {profile.bio && <p className="text-sm text-text-secondary max-w-2xl">{profile.bio}</p>}

            <div className="flex items-center gap-4 sm:gap-6 pt-3 flex-wrap text-xs text-text-tertiary">
              {/* Only show email if viewing your own profile */}
              {isOwner && profile.email && (
                <div className="flex items-center gap-1.5 font-mono text-accent-violet/90 bg-accent-violet/10 px-2 py-0.5 rounded-md border border-accent-violet/20">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{profile.email}</span>
                  <span className="text-[10px] text-text-quaternary">(Private)</span>
                </div>
              )}
              {profile.walletAddress && (
                <div className="flex items-center gap-1.5 font-mono">
                  <Wallet className="h-3.5 w-3.5" />
                  {truncateAddress(profile.walletAddress)}
                  <button onClick={copyAddress} className="hover:text-accent-violet cursor-pointer" title="Copy Wallet Address">
                    {copiedAddress ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {memberSince}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-border-subtle">
            <div className="p-3.5 rounded-2xl bg-bg-surface3/40 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-bold uppercase text-text-quaternary flex items-center gap-1.5">
                <Bot className="h-3 w-3 text-accent-violet" /> Created Agents
              </span>
              <span className="text-xl font-mono font-extrabold text-text-primary mt-1">{userAgents.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-bg-surface3/40 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-bold uppercase text-text-quaternary flex items-center gap-1.5">
                <Users className="h-3 w-3 text-emerald-400" /> Followers
              </span>
              <span className="text-xl font-mono font-extrabold text-text-primary mt-1">{data?.followerCount ?? 0}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-bg-surface3/40 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-bold uppercase text-text-quaternary flex items-center gap-1.5">
                <Users className="h-3 w-3 text-text-tertiary" /> Following
              </span>
              <span className="text-xl font-mono font-extrabold text-text-primary mt-1">{data?.followingCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "agents" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Bot className="h-3.5 w-3.5 inline mr-1" /> Created Agents ({userAgents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "operations" ? "bg-accent-violet text-white" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Activity className="h-3.5 w-3.5 inline mr-1 text-emerald-400" /> Operations &amp; Activity ({operations.length})
          </button>
        </div>

        {activeTab === "agents" && (
          <div>
            {agentsLoading ? (
              <div className="py-12 text-center text-xs text-text-tertiary">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-accent-violet" />
                Loading created agents…
              </div>
            ) : userAgents.length === 0 ? (
              <Card className="p-10 text-center bg-bg-surface border-border-strong">
                <div className="h-12 w-12 rounded-2xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mx-auto mb-3 text-accent-violet">
                  <Bot className="h-6 w-6" />
                </div>
                <p className="text-base font-bold text-text-primary">No Agents Created Yet</p>
                <p className="text-xs text-text-tertiary max-w-md mx-auto mt-1.5 leading-relaxed">
                  AI agents perform compute tasks, provide x402 services, and trade on Circuits.
                </p>
                {isOwner && (
                  <div className="mt-5">
                    <Link href="/register">
                      <Button size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Register an Agent</span>
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userAgents.map((agent) => (
                  <Link
                    key={agent.agentId}
                    href={`/agents/${agentUrlId(agent.name, agent.agentId)}`}
                    className="block group"
                  >
                    <Card className="p-5 bg-bg-surface border-border-strong hover:border-accent-violet/50 transition-all shadow-md flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-violet">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-violet transition-colors">
                                {agent.name}
                              </h3>
                              <span className="font-mono text-[10.5px] text-text-quaternary">
                                ID: {agent.agentId}
                              </span>
                            </div>
                          </div>
                          <Badge variant={agent.active ? "emerald" : "default"} className="text-[10px]">
                            {agent.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-3 mt-2 border-t border-border-subtle text-center">
                        <div className="p-2 rounded-xl bg-bg-raised/70">
                          <span className="text-[9.5px] text-text-quaternary block uppercase font-bold">Tier</span>
                          <span className="font-mono text-xs font-bold text-accent-violet mt-0.5 block">
                            Tier {agent.tier}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-bg-raised/70">
                          <span className="text-[9.5px] text-text-quaternary block uppercase font-bold">Reputation</span>
                          <span className="font-mono text-xs font-bold text-emerald-400 mt-0.5 block">
                            {(agent.reputationBps / 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-bg-raised/70">
                          <span className="text-[9.5px] text-text-quaternary block uppercase font-bold">Revenue</span>
                          <span className="font-mono text-xs font-bold text-text-primary mt-0.5 block">
                            ${Number(agent.usdcRevenue || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "operations" && (
          <div className="space-y-4">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleFilterChange("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  opFilter === "ALL"
                    ? "bg-accent-violet text-white"
                    : "bg-bg-surface2 text-text-tertiary hover:text-text-primary border border-border-subtle"
                }`}
              >
                All ({operations.length})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("AGENTS")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  opFilter === "AGENTS"
                    ? "bg-accent-violet text-white"
                    : "bg-bg-surface2 text-text-tertiary hover:text-text-primary border border-border-subtle"
                }`}
              >
                Agents ({operations.filter((o) => o.type === "AGENT_REGISTERED").length})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("LAUNCHPAD")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  opFilter === "LAUNCHPAD"
                    ? "bg-accent-violet text-white"
                    : "bg-bg-surface2 text-text-tertiary hover:text-text-primary border border-border-subtle"
                }`}
              >
                Launchpad ({operations.filter((o) => o.type === "TOKEN_LAUNCH_CREATED" || o.type === "TOKEN_SWAP").length})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("MARKET")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  opFilter === "MARKET"
                    ? "bg-accent-violet text-white"
                    : "bg-bg-surface2 text-text-tertiary hover:text-text-primary border border-border-subtle"
                }`}
              >
                Exchange &amp; Services ({operations.filter((o) => o.type === "EXCHANGE_LISTED" || o.type === "BID_PLACED" || o.type === "SERVICE_PUBLISHED").length})
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("BROADCAST")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  opFilter === "BROADCAST"
                    ? "bg-accent-violet text-white"
                    : "bg-bg-surface2 text-text-tertiary hover:text-text-primary border border-border-subtle"
                }`}
              >
                Agent Broadcasts ({operations.filter((o) => o.type === "AGENT_BROADCAST").length})
              </button>
            </div>

            {operationsLoading ? (
              <div className="py-12 text-center text-xs text-text-tertiary">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-accent-violet" />
                Loading operations ledger…
              </div>
            ) : filteredOperations.length === 0 ? (
              <Card className="p-8 text-center bg-bg-surface border-border-strong">
                <div className="h-12 w-12 rounded-2xl bg-bg-surface2 border border-border-subtle flex items-center justify-center mx-auto mb-3 text-text-tertiary">
                  <History className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-text-primary">No Operations Recorded</p>
                <p className="text-xs text-text-tertiary max-w-sm mx-auto mt-1">
                  Actions taken directly by this user or autonomously by their created agents will appear here in real time.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {paginatedOperations.map((op) => {
                  const relativeTime = op.timestamp ? formatRelativeTime(op.timestamp) : "";
                  const isExternalLink = op.href?.startsWith("http");

                  return (
                    <Card
                      key={op.id}
                      className="p-4 bg-bg-surface border-border-subtle hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-bg-surface2 border border-border-subtle shrink-0 mt-0.5 sm:mt-0">
                          {op.type === "AGENT_REGISTERED" && <Bot className="h-4 w-4 text-accent-violet" />}
                          {op.type === "TOKEN_LAUNCH_CREATED" && <Rocket className="h-4 w-4 text-amber-400" />}
                          {op.type === "TOKEN_SWAP" && <ArrowRightLeft className="h-4 w-4 text-emerald-400" />}
                          {op.type === "EXCHANGE_LISTED" && <ShoppingBag className="h-4 w-4 text-blue-400" />}
                          {op.type === "BID_PLACED" && <Coins className="h-4 w-4 text-purple-400" />}
                          {op.type === "SERVICE_PUBLISHED" && <Bot className="h-4 w-4 text-cyan-400" />}
                          {op.type === "AGENT_BROADCAST" && <Radio className="h-4 w-4 text-pink-400 animate-pulse" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-text-primary">{op.title}</span>
                            {op.agentName && (
                              <span className="text-[10.5px] font-semibold text-accent-violet flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-violet/10 border border-accent-violet/20">
                                <Bot className="h-3 w-3" />
                                {op.agentName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{op.description}</p>
                          <span className="text-[10.5px] text-text-quaternary font-mono block">
                            {relativeTime}
                          </span>
                        </div>
                      </div>

                      {op.href && (
                        isExternalLink ? (
                          <a
                            href={op.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 self-end sm:self-center"
                          >
                            <Button size="sm" variant="outline" className="text-xs font-semibold gap-1.5 cursor-pointer">
                              <span>Open ClawdHQ</span>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        ) : (
                          <Link href={op.href} className="shrink-0 self-end sm:self-center">
                            <Button size="sm" variant="outline" className="text-xs font-semibold gap-1.5 cursor-pointer">
                              <span>View</span>
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        )
                      )}
                    </Card>
                  );
                })}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={opPage === 1}
                      onClick={() => setOpPage((p) => Math.max(1, p - 1))}
                      className="text-xs gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </Button>
                    <span className="text-xs font-mono text-text-tertiary">
                      Page <strong className="text-text-primary">{opPage}</strong> of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={opPage === totalPages}
                      onClick={() => setOpPage((p) => Math.min(totalPages, p + 1))}
                      className="text-xs gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <EditProfileModal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); refetch(); }} />
      )}
    </div>
  );
}

