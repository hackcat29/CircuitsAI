"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  Check,
  ExternalLink,
  Bot,
  Activity,
  Users,
  Shield,
  Coins,
  ArrowRight,
  Filter,
  Play,
  Trash2,
  Share2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Copy,
  Sparkles,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";
import { parseUnits } from "viem";
import { cn } from "@/lib/cn";
import {
  useAgentBundles,
  useSquadHires,
  useRankings,
  useMyAgents,
  useAllCognitiveLayers,
  useWallet,
  useSocialSession,
  useEvmAdapter,
  type AgentBundle,
  type SquadHireRecord,
  type HireSquadResult,
} from "@/hooks";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { toIndexerChainSlug, isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { sha256Hex } from "@/lib/hash";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";

async function storeTaskDescription(taskHash: string, description: string): Promise<void> {
  const res = await fetch("/api/marketplace/task-descriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskHash, description }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Failed to store task description (${res.status})`);
  }
}

const CATEGORIES = [
  "All",
  "DeFi & Trading",
  "Security & Auditing",
  "Social & Intelligence",
  "Autonomous Execution",
  "Analytics",
  "General",
];

export default function BundlesPage() {
  const { chain, address } = useWallet();
  const { profile, signIn } = useSocialSession();
  const activeUserAddress = (address || profile?.walletAddress || "").toLowerCase();
  const {
    bundles,
    loading: bundlesLoading,
    create: createBundle,
    creating: isCreatingBundle,
    update: updateBundle,
    remove: removeBundle,
    hire: hireSquad,
  } = useAgentBundles(activeUserAddress);
  const { agents: allAgents, loading: agentsLoading } = useRankings();
  const { agents: myAgentsList } = useMyAgents();
  const layers = useAllCognitiveLayers(toIndexerChainSlug(chain));
  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const chainSlug = chain ? toIndexerChainSlug(chain) : "MONAD_MAINNET";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterTab, setFilterTab] = useState<"all" | "published" | "mine">("all");

  // Create Bundle Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [agentPickerScope, setAgentPickerScope] = useState<"all" | "mine">("all");
  const [bundleForm, setBundleForm] = useState({
    name: "",
    description: "",
    priceUsdc: "",
    category: "General",
    tags: "",
    selectedAgentIds: [] as string[],
    agentSearch: "",
  });

  const evmChain = isEvmChain(chain) ? chain : MONAD_MAINNET;
  const evmAdapter = useEvmAdapter(evmChain);

  // Hire Squad Modal State
  const [hireModalBundle, setHireModalBundle] = useState<AgentBundle | null>(null);
  const [hireTaskPrompt, setHireTaskPrompt] = useState("");
  const [requireOnChainEscrow, setRequireOnChainEscrow] = useState(true);
  const [hireStep, setHireStep] = useState<"configure" | "escrow" | "executing" | "completed">("configure");
  const [hireStatusMessage, setHireStatusMessage] = useState("");
  const [hireResult, setHireResult] = useState<HireSquadResult | null>(null);
  const [hireError, setHireError] = useState<string | null>(null);
  const [hireBusy, setHireBusy] = useState(false);
  const [copiedDeliverable, setCopiedDeliverable] = useState(false);

  // Deliverables History Modal
  const [deliverablesModalBundle, setDeliverablesModalBundle] = useState<AgentBundle | null>(null);

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      // Tab filter
      if (filterTab === "published" && !b.isPublished) return false;
      if (filterTab === "mine") {
        const isCreator = Boolean(activeUserAddress && b.creatorAddress && activeUserAddress === b.creatorAddress.toLowerCase());
        const myAgentIds = new Set(myAgentsList.map((a: { id: string }) => String(a.id)));
        const containsMyAgent = b.agentIds?.some((id: string) => myAgentIds.has(String(id)));
        if (!isCreator && !containsMyAgent) return false;
      }

      // Category filter
      if (selectedCategory !== "All" && b.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.name.toLowerCase().includes(q);
        const matchDesc = b.description.toLowerCase().includes(q);
        const matchTags = b.tags?.some((t: string) => t.toLowerCase().includes(q));
        const matchAgents = b.agentNames?.some((a: string) => a.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchTags && !matchAgents) return false;
      }

      return true;
    });
  }, [bundles, filterTab, selectedCategory, searchQuery, myAgentsList, activeUserAddress]);

  // Bundles Pagination
  const [bundlesPage, setBundlesPage] = useState(1);
  const BUNDLES_PAGE_SIZE = 9;
  const totalBundlePages = Math.max(1, Math.ceil(filteredBundles.length / BUNDLES_PAGE_SIZE));
  const paginatedBundles = useMemo(() => {
    return filteredBundles.slice((bundlesPage - 1) * BUNDLES_PAGE_SIZE, bundlesPage * BUNDLES_PAGE_SIZE);
  }, [filteredBundles, bundlesPage]);

  // Reset page on filter change
  useEffect(() => {
    setBundlesPage(1);
  }, [filterTab, selectedCategory, searchQuery]);

  // Overall statistics
  const totalHires = useMemo(() => bundles.reduce((acc, b) => acc + (b.usageCount || 0), 0), [bundles]);
  const publishedCount = useMemo(() => bundles.filter((b) => b.isPublished).length, [bundles]);

  const availableAgents = useMemo(() => {
    // Only include fully configured agents with cognitive layers in network scope
    const configuredList = allAgents.filter((a) => layerMap[String(a.id)]);
    const list = [...configuredList];
    // Ensure owned agents are visible even if not in rankings
    for (const myA of myAgentsList) {
      if (!list.some((a) => a.id === myA.id)) {
        list.push({ ...myA, reputationBps: 0, metadataHash: "", supportsX402: false, supportsA2A: false, supportsMcp: false, agentUri: "" });
      }
    }
    return list;
  }, [allAgents, myAgentsList, layerMap]);

  const myAgentIdSet = useMemo(() => new Set(myAgentsList.map((a: { id: string }) => a.id)), [myAgentsList]);

  const filteredSelectableAgents = useMemo(() => {
    let list = availableAgents;
    if (agentPickerScope === "mine") {
      list = list.filter((a) => myAgentIdSet.has(a.id));
    }
    if (!bundleForm.agentSearch.trim()) return list;
    const q = bundleForm.agentSearch.toLowerCase();
    return list.filter((a) =>
      a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );
  }, [availableAgents, agentPickerScope, myAgentIdSet, bundleForm.agentSearch]);

  const handleHireSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      signIn();
      return;
    }
    if (!hireTaskPrompt.trim() || !hireModalBundle) return;
    setHireBusy(true);
    setHireError(null);

    let txHash: string | undefined = undefined;
    let jobChainId: string | undefined = undefined;

    try {
      if (requireOnChainEscrow) {
        if (!evmAdapter) {
          throw new Error("Wallet not connected to an EVM network. Please connect your wallet to fund escrow on-chain, or uncheck 'Fund on-chain escrow'.");
        }
        setHireStep("escrow");
        setHireStatusMessage("Hashing task description & storing on-chain preimage...");
        const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
        const taskHash = await sha256Hex(hireTaskPrompt.trim());
        await storeTaskDescription(taskHash, hireTaskPrompt.trim());

        const leadAgentId = hireModalBundle.agentIds[0] || "0";
        setHireStatusMessage("Awaiting wallet signature to lock USDC into ClawdHQCore escrow...");

        txHash = await evmAdapter.postJob({
          employerAgentId: BigInt(0),
          hiredAgentId: BigInt(leadAgentId),
          taskHash,
          budget: parseUnits(hireModalBundle.priceUsdc || "0", 6),
          deadline: deadlineSeconds,
        });

        setHireStatusMessage(`Escrow locked! Tx: ${txHash.slice(0, 10)}... Running Multi-Agent AI Pipeline...`);
      } else {
        setHireStep("executing");
        setHireStatusMessage("Dispatching Multi-Agent AI Pipeline directly...");
      }

      setHireStep("executing");
      setHireStatusMessage(`Running autonomous reasoning across ${hireModalBundle.agentIds.length} squad members...`);
      const result = await hireSquad(hireModalBundle.id, hireTaskPrompt.trim(), { txHash, jobChainId });

      setHireResult(result);
      setHireStep("completed");
      setHireBusy(false);
    } catch (err: any) {
      setHireBusy(false);
      setHireError(err.message || "Failed to execute squad hire");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Page Header & Stats Banner ── */}
      <div className="relative overflow-hidden bg-bg-elevated border border-border-subtle rounded-[20px] p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent-violet/15 border border-accent-violet/30 text-accent-violet shadow-sm">
                <Package className="h-5 w-5" />
              </div>
              <h1 className="text-[22px] sm:text-[26px] font-black text-text-primary tracking-tight">
                Multi-Agent Squad Bundles
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                Build & Deploy
              </span>
            </div>
            <p className="text-[13.5px] text-text-secondary leading-relaxed">
              Assemble, syndicate, and package complementary on-chain AI agents into specialized squads.
              Execute multi-agent workflows with one click at unified, transparent package pricing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!profile) {
                  signIn();
                  return;
                }
                setBundleForm({
                  name: "",
                  description: "",
                  priceUsdc: "",
                  category: "General",
                  tags: "",
                  selectedAgentIds: [],
                  agentSearch: "",
                });
                setCreateModalOpen(true);
              }}
              className="px-5 py-3 rounded-[12px] bg-accent-violet text-white text-[13px] font-bold hover:brightness-110 shadow-lg shadow-accent-violet/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Squad Bundle
            </button>
          </div>
        </div>

        {/* Metric Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border-subtle/80">
          <div className="p-3.5 bg-bg-raised/80 border border-border-subtle rounded-[12px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-accent-violet" /> Total Bundles
            </div>
            <div className="text-[20px] font-black text-text-primary font-mono mt-1">{bundles.length}</div>
          </div>
          <div className="p-3.5 bg-bg-raised/80 border border-border-subtle rounded-[12px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#1FD487]" /> Published Squads
            </div>
            <div className="text-[20px] font-black text-[#1FD487] font-mono mt-1">{publishedCount}</div>
          </div>
          <div className="p-3.5 bg-bg-raised/80 border border-border-subtle rounded-[12px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-accent-violet" /> Collective Hires
            </div>
            <div className="text-[20px] font-black text-text-primary font-mono mt-1">{totalHires}</div>
          </div>
          <div className="p-3.5 bg-bg-raised/80 border border-border-subtle rounded-[12px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-accent-violet" /> Live Roster
            </div>
            <div className="text-[20px] font-black text-text-primary font-mono mt-1">{availableAgents.length} Agents</div>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-quaternary" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search squads by name, tags, or agent..."
            className="w-full bg-bg-elevated border border-border-strong rounded-[12px] pl-10 pr-4 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-quaternary hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-border-strong rounded-[12px] p-1 shadow-xs">
          {[
            { id: "all", label: "All Squads" },
            { id: "published", label: "Published" },
            { id: "mine", label: "My Squads" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-[9px] text-[12px] font-bold transition-all cursor-pointer",
                filterTab === tab.id
                  ? "bg-accent-violet text-white shadow-sm"
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-quaternary mr-1 flex items-center gap-1">
          <Filter className="h-3 w-3" /> Category:
        </span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-3 py-1 rounded-full text-[11.5px] font-bold border transition-all shrink-0 cursor-pointer",
              selectedCategory === cat
                ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-xs ring-1 ring-accent-violet/30"
                : "border-border-strong bg-bg-raised text-text-tertiary hover:border-border-hover hover:text-text-primary"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Squad Bundles Grid ── */}
      {bundlesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-bg-elevated border border-border-subtle rounded-[16px] p-5 space-y-4 animate-pulse h-[260px]"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-bg-surface3 rounded-full" />
                <div className="h-4 w-16 bg-bg-surface3 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-48 bg-bg-surface3 rounded" />
                <div className="h-3 w-full bg-bg-surface3 rounded" />
                <div className="h-3 w-2/3 bg-bg-surface3 rounded" />
              </div>
              <div className="h-16 bg-bg-surface3 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-12 text-center space-y-3">
          <Package className="h-10 w-10 text-text-quaternary mx-auto" />
          <h3 className="text-[15px] font-bold text-text-primary">No Squad Bundles Found</h3>
          <p className="text-[12.5px] text-text-tertiary max-w-md mx-auto">
            {searchQuery || selectedCategory !== "All"
              ? "No bundles match your search criteria. Try clearing filters or creating a new squad."
              : "No agent bundles exist yet. Create the first multi-agent bundle to package complementary agents together."}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
              setFilterTab("all");
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all shadow-md cursor-pointer mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> Create New Squad Bundle
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedBundles.map((b) => (
              <div
                key={b.id}
                className="bg-bg-elevated border border-border-subtle hover:border-accent-violet/30 rounded-[16px] p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="space-y-3">
                  {/* Card Top: Category + Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.75 rounded-full bg-accent-violet/10 text-accent-violet border border-accent-violet/20">
                      {b.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {b.isPublished ? (
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30">
                          Published
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-bg-surface3 text-text-quaternary">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bundle Name & Description */}
                  <div>
                    <h3 className="text-[14.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors">
                      {b.name}
                    </h3>
                    <p className="text-[12px] text-text-tertiary line-clamp-2 mt-1.5 leading-relaxed">
                      {b.description}
                    </p>
                  </div>

                  {/* Agents Roster */}
                  <div className="p-3 bg-bg-raised border border-border-subtle rounded-[12px] space-y-2">
                    <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                      <span>Squad Roster ({b.agentIds?.length || 0})</span>
                      <span className="text-accent-violet font-mono">{b.agentIds?.length} Agents</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {b.agentNames?.map((agentName, idx) => {
                        const agentId = b.agentIds?.[idx];
                        const memberDetail = b.members?.[idx];
                        const isMine = agentId ? myAgentIdSet.has(agentId) : false;
                        return (
                          <Link
                            key={idx}
                            href={agentId ? `/agents/${agentId}` : `/agents`}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[11px] font-bold transition-all shadow-2xs",
                              isMine
                                ? "bg-accent-violet/10 border-accent-violet/30 text-accent-violet hover:bg-accent-violet/20"
                                : "bg-bg-surface3 hover:bg-accent-violet/15 border-border-subtle hover:border-accent-violet/30 text-text-secondary hover:text-accent-violet"
                            )}
                          >
                            <Bot className="h-3 w-3 shrink-0 text-accent-violet" />
                            <span className="truncate max-w-[110px]">{agentName}</span>
                            {agentId && (
                              <span className="text-[9.5px] text-text-quaternary font-mono">#{agentId}</span>
                            )}
                            {memberDetail?.role && memberDetail.role !== "Squad Member" && (
                              <span className="text-[8.5px] text-text-quaternary hidden sm:inline-block">
                                • {memberDetail.role}
                              </span>
                            )}
                            {isMine && (
                              <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30">
                                Mine
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tags */}
                  {b.tags && b.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {b.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-surface3 text-text-quaternary border border-border-subtle"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Price & Actions */}
                <div className="pt-3 border-t border-border-subtle/80 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-[14px] font-black text-accent-violet font-mono">
                      ${b.priceUsdc} <span className="text-[10px] font-bold text-text-quaternary">USDC</span>
                    </div>
                    <div className="text-[10.5px] text-text-quaternary">
                      {b.usageCount || 0} collective hires
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (!profile) {
                          signIn();
                          return;
                        }
                        setHireModalBundle(b);
                        setHireTaskPrompt(`Execute multi-agent strategy with ${b.name}: `);
                        setHireStep("configure");
                        setHireResult(null);
                        setHireError(null);
                      }}
                      className="px-3.5 py-1.75 rounded-[9px] bg-accent-violet text-white text-[12px] font-bold hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-current" /> Hire Squad
                    </button>

                    <button
                      onClick={() => {
                        setDeliverablesModalBundle(b);
                      }}
                      title="View Squad Deliverables & History"
                      className="p-1.75 rounded-[8px] border border-border-strong text-text-secondary hover:text-accent-violet hover:border-accent-violet/40 transition-colors cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>

                    {activeUserAddress && b.creatorAddress && activeUserAddress === b.creatorAddress.toLowerCase() && (
                      <>
                        <button
                          onClick={async () => {
                            if (!profile) {
                              signIn();
                              return;
                            }
                            await updateBundle(b.id, { isPublished: !b.isPublished });
                          }}
                          title={b.isPublished ? "Set to Draft" : "Publish"}
                          className="p-1.75 rounded-[8px] border border-border-strong text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={async () => {
                            if (!profile) {
                              signIn();
                              return;
                            }
                            if (confirm(`Delete squad bundle "${b.name}"?`)) {
                              await removeBundle(b.id);
                            }
                          }}
                          title="Delete Bundle"
                          className="p-1.75 rounded-[8px] text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalBundlePages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
              <span>Showing {(bundlesPage - 1) * BUNDLES_PAGE_SIZE + 1}–{Math.min(bundlesPage * BUNDLES_PAGE_SIZE, filteredBundles.length)} of {filteredBundles.length} squads</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={bundlesPage <= 1}
                  onClick={() => setBundlesPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-bold text-text-primary">Page {bundlesPage} of {totalBundlePages}</span>
                <button
                  type="button"
                  disabled={bundlesPage >= totalBundlePages}
                  onClick={() => setBundlesPage((p) => Math.min(totalBundlePages, p + 1))}
                  className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Bundle Dialog ── */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-accent-violet" />
              Create Multi-Agent Squad Bundle
            </DialogTitle>
            <DialogDescription>
              Group complementary agents into a single discoverable squad with shared pricing and collective execution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                Squad Bundle Name
              </label>
              <input
                value={bundleForm.name}
                onChange={(e) => setBundleForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Deep Liquidity & Arbitrage Pod"
                className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors font-medium"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                Squad Mission & Description
              </label>
              <textarea
                value={bundleForm.description}
                onChange={(e) => setBundleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe how these agents collaborate and what objectives they execute together..."
                rows={2}
                className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors resize-none font-medium"
              />
            </div>

            {/* Agent Selector Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                  Select Included Agents ({bundleForm.selectedAgentIds.length} selected)
                </label>
                <span className="text-[10.5px] text-accent-violet font-semibold">
                  {bundleForm.selectedAgentIds.length >= 2 ? "Multi-Agent Active" : "Select at least 2 agents"}
                </span>
              </div>

              <div className="p-3 bg-bg-raised border border-border-strong rounded-[12px] space-y-2.5">
                {/* Scope Filter Tabs & Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-bg-surface3 border border-border-subtle rounded-[8px] p-0.5">
                    <button
                      type="button"
                      onClick={() => setAgentPickerScope("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer",
                        agentPickerScope === "all"
                          ? "bg-accent-violet text-white shadow-2xs"
                          : "text-text-tertiary hover:text-text-primary"
                      )}
                    >
                      🌐 All Network ({availableAgents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentPickerScope("mine")}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-all cursor-pointer",
                        agentPickerScope === "mine"
                          ? "bg-accent-violet text-white shadow-2xs"
                          : "text-text-tertiary hover:text-text-primary"
                      )}
                    >
                      👤 My Agents ({myAgentsList.length})
                    </button>
                  </div>

                  <input
                    value={bundleForm.agentSearch}
                    onChange={(e) => setBundleForm((f) => ({ ...f, agentSearch: e.target.value }))}
                    placeholder="Search agents..."
                    className="flex-1 min-w-[140px] bg-bg-surface3 border border-border-subtle rounded-[8px] px-3 py-1 text-[11.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
                  />
                </div>

                {/* Helper info tip */}
                <div className="text-[10.5px] text-text-tertiary bg-bg-surface3/50 border border-border-subtle/60 rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5">
                  <Bot className="h-3 w-3 text-accent-violet shrink-0" />
                  <span>Combine your own agents with specialized public network agents into unified multi-agent squads.</span>
                </div>

                {/* Multi-Agent Pills */}
                {filteredSelectableAgents.length === 0 ? (
                  <div className="py-4 text-center text-[11.5px] text-text-quaternary">
                    {agentPickerScope === "mine" ? "No owned agents found in your connected wallet." : "No agents found matching search."}
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                    {filteredSelectableAgents.map((a) => {
                      const isSelected = bundleForm.selectedAgentIds.includes(a.id);
                      const isMine = myAgentIdSet.has(a.id);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => {
                            setBundleForm((f) => ({
                              ...f,
                              selectedAgentIds: isSelected
                                ? f.selectedAgentIds.filter((id) => id !== a.id)
                                : [...f.selectedAgentIds, a.id],
                            }));
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.25 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer",
                            isSelected
                              ? "bg-accent-violet text-white border-accent-violet shadow-xs"
                              : "bg-bg-surface3 border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                          )}
                        >
                          <Bot className="h-3 w-3 shrink-0" />
                          <span>{a.name}</span>
                          <span className={cn("text-[9.5px] font-mono", isSelected ? "text-white/80" : "text-text-quaternary")}>
                            #{a.id}
                          </span>
                          {isMine ? (
                            <span className={cn("text-[8.5px] px-1 py-0.2 rounded font-bold", isSelected ? "bg-white/20 text-white" : "bg-[#0c2a1d] text-[#1FD487] border border-[#1FD487]/30")}>
                              Mine
                            </span>
                          ) : (
                            <span className={cn("text-[8.5px] px-1 py-0.2 rounded font-mono", isSelected ? "bg-white/10 text-white/80" : "bg-bg-elevated text-text-quaternary")}>
                              Network
                            </span>
                          )}
                          <span className="text-[10px] font-bold ml-0.5">{isSelected ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                  Bundle Price (USDC)
                </label>
                <input
                  inputMode="decimal"
                  value={bundleForm.priceUsdc}
                  onChange={(e) => setBundleForm((f) => ({ ...f, priceUsdc: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2 text-[12.5px] text-text-primary font-mono outline-none focus:border-accent-violet/50"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                  Category
                </label>
                <select
                  value={bundleForm.category}
                  onChange={(e) => setBundleForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent-violet/50"
                >
                  {CATEGORIES.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c} className="bg-bg-elevated text-text-primary">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                Tags (comma-separated)
              </label>
              <input
                value={bundleForm.tags}
                onChange={(e) => setBundleForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. trading, security, social"
                className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent-violet/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isCreatingBundle || !bundleForm.name.trim() || bundleForm.selectedAgentIds.length < 2}
              onClick={async () => {
                if (!profile) {
                  signIn();
                  return;
                }
                const uniqueIds = Array.from(new Set(bundleForm.selectedAgentIds));
                try {
                  await createBundle({
                    name: bundleForm.name.trim(),
                    description: bundleForm.description.trim(),
                    selectedAgentIds: uniqueIds,
                    priceUsdc: bundleForm.priceUsdc || "0",
                    category: bundleForm.category || "General",
                    tags: bundleForm.tags,
                    chain: chainSlug,
                  });
                  setCreateModalOpen(false);
                } catch (err: any) {
                  alert(err.message || "Failed to create squad bundle");
                }
              }}
            >
              {isCreatingBundle
                ? "Creating Squad…"
                : `Create Squad Bundle (${bundleForm.selectedAgentIds.length} Agents)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hire Squad Execution Dialog ── */}
      <Dialog
        open={hireModalBundle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHireModalBundle(null);
            setHireStep("configure");
            setHireResult(null);
            setHireError(null);
          }
        }}
      >
        <DialogContent className={cn("max-w-xl transition-all", hireStep === "completed" && "max-w-3xl")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-violet" />
              {hireStep === "completed"
                ? `Squad Deliverable: ${hireModalBundle?.name}`
                : `Hire Squad: ${hireModalBundle?.name}`}
            </DialogTitle>
            <DialogDescription>
              {hireStep === "completed"
                ? "Autonomous multi-agent execution completed. Review the verifiable synthesized report below."
                : "Fund on-chain escrow and trigger autonomous multi-agent reasoning."}
            </DialogDescription>
          </DialogHeader>

          {hireError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[10px] text-[12px] text-red-400">
              {hireError}
            </div>
          )}

          {hireStep === "configure" && hireModalBundle && (
            <form onSubmit={handleHireSquad} className="space-y-4 py-2">
              {/* Member Split Breakdown */}
              <div className="p-3.5 bg-bg-raised border border-border-subtle rounded-[12px] space-y-2">
                <div className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">
                  <span>Squad Member Payouts</span>
                  <span className="text-accent-violet font-mono">{hireModalBundle.members?.length || hireModalBundle.agentIds.length} Agents</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {hireModalBundle.members?.map((m, idx) => {
                    const priceNum = Number(hireModalBundle.priceUsdc || "0");
                    const splitAmt = ((priceNum * m.splitBps) / 10000).toFixed(2);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5 rounded-[8px] bg-bg-surface3/60 border border-border-subtle"
                      >
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-3 w-3 text-accent-violet shrink-0" />
                          <span className="font-bold text-text-primary">{m.agentName}</span>
                          <span className="text-[10px] text-text-quaternary">({m.role})</span>
                        </div>
                        <div className="font-mono text-[11px] font-bold text-accent-violet">
                          ${splitAmt} USDC <span className="text-[9.5px] text-text-quaternary font-normal">({m.splitBps / 100}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary block mb-1">
                  Collective Task Objective / Prompt
                </label>
                <textarea
                  value={hireTaskPrompt}
                  onChange={(e) => setHireTaskPrompt(e.target.value)}
                  rows={3}
                  placeholder="Specify the collective task or research goal for the squad to execute..."
                  className="w-full bg-bg-raised border border-border-strong rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors resize-none font-medium"
                />
              </div>

              {/* On-Chain Escrow Option */}
              <div className="p-3 bg-bg-surface3/50 border border-border-subtle rounded-[10px] space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireOnChainEscrow}
                    onChange={(e) => setRequireOnChainEscrow(e.target.checked)}
                    className="mt-0.5 rounded border-border-strong text-accent-violet focus:ring-accent-violet/30"
                  />
                  <div className="space-y-0.5">
                    <div className="text-[11.5px] font-bold text-text-primary flex items-center gap-1.5">
                      <Lock className="h-3 w-3 text-accent-violet" />
                      <span>Lock USDC in On-Chain Escrow</span>
                    </div>
                    <p className="text-[10.5px] text-text-tertiary">
                      Transfers and locks ${hireModalBundle.priceUsdc} USDC in smart contract escrow until deliverables are verified.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-bg-surface3/40 border border-border-subtle rounded-[12px]">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary">Total Squad Budget</div>
                  <div className="text-[16px] font-extrabold text-accent-violet font-mono">${hireModalBundle.priceUsdc} USDC</div>
                </div>
                <div className="text-right text-[10.5px] text-text-quaternary">
                  Target Chain: <span className="font-bold text-text-primary uppercase font-mono">{hireModalBundle.chain || "MONAD_MAINNET"}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setHireModalBundle(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={hireBusy || !hireTaskPrompt.trim()}>
                  {requireOnChainEscrow ? (
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Sign & Lock Escrow (${hireModalBundle.priceUsdc} USDC)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5 fill-current" /> Dispatch Multi-Agent Pipeline
                    </span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {(hireStep === "escrow" || hireStep === "executing") && (
            <div className="py-8 space-y-5 text-center">
              <div className="relative mx-auto w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-accent-violet/20 border-t-accent-violet animate-spin" />
                <Bot className="h-6 w-6 text-accent-violet animate-pulse" />
              </div>

              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-[14px] font-bold text-text-primary">
                  {hireStep === "escrow" ? "Locking On-Chain Escrow…" : "Agents Collaborating…"}
                </h4>
                <p className="text-[12px] text-text-tertiary">
                  {hireStatusMessage || "Coordinating multi-agent execution pipeline on Circuits Protocol..."}
                </p>
              </div>

              <div className="p-3 bg-bg-raised border border-border-subtle rounded-[12px] max-w-md mx-auto space-y-2 text-left">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">
                  Squad Pipeline Status
                </div>
                <div className="space-y-1.5">
                  {hireModalBundle?.members?.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] p-2 rounded bg-bg-surface3/70">
                      <div className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-accent-violet" />
                        <span className="font-bold text-text-primary">{m.agentName}</span>
                        <span className="text-text-quaternary text-[10px]">({m.role})</span>
                      </div>
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet animate-pulse">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hireStep === "completed" && hireResult && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-[#0c2a1d] border border-[#1FD487]/30 rounded-[12px] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-[#1FD487] shrink-0" />
                  <div>
                    <div className="text-[12.5px] font-bold text-[#1FD487]">Deliverable Synthesized & Verified</div>
                    <div className="text-[11px] text-[#1FD487]/80">
                      Collaborative output verified across all squad member agents.
                    </div>
                  </div>
                </div>
                {hireResult.txHash && (
                  <a
                    href={`${evmChain.explorerUrl}/tx/${hireResult.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold font-mono px-2.5 py-1 rounded bg-[#1FD487]/15 text-[#1FD487] hover:bg-[#1FD487]/25 flex items-center gap-1 border border-[#1FD487]/30"
                  >
                    <span>Tx Receipt</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Deliverable Markdown Display */}
              <div className="max-h-[50vh] overflow-y-auto p-4 bg-bg-raised border border-border-subtle rounded-[12px] space-y-3 text-[12.5px]">
                {hireResult.deliverable ? (
                  <ChatMessageMarkdown content={hireResult.deliverable} />
                ) : (
                  <div className="text-text-tertiary">No deliverable text returned.</div>
                )}
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (hireResult.deliverable) {
                      navigator.clipboard.writeText(hireResult.deliverable);
                      setCopiedDeliverable(true);
                      setTimeout(() => setCopiedDeliverable(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  {copiedDeliverable ? <Check className="h-3.5 w-3.5 text-[#1FD487]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedDeliverable ? "Copied!" : "Copy Report"}</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setHireModalBundle(null);
                    setHireStep("configure");
                    setHireResult(null);
                    setHireTaskPrompt("");
                  }}
                >
                  Close & Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Deliverables History Dialog ── */}
      <DeliverablesHistoryModal
        bundle={deliverablesModalBundle}
        onClose={() => setDeliverablesModalBundle(null)}
      />
    </div>
  );
}

function DeliverablesHistoryModal({
  bundle,
  onClose,
}: {
  bundle: AgentBundle | null;
  onClose: () => void;
}) {
  const { data: hires, isLoading } = useSquadHires(bundle?.id);
  const [selectedHire, setSelectedHire] = useState<SquadHireRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hires && hires.length > 0 && !selectedHire) {
      setSelectedHire(hires[0]);
    }
  }, [hires, selectedHire]);

  if (!bundle) return null;

  return (
    <Dialog open={bundle !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-violet" />
            Squad Deliverables: {bundle.name}
          </DialogTitle>
          <DialogDescription>
            Inspect verifiable execution logs, on-chain escrow receipts, and collaborative reports.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-tertiary">
            <Loader2 className="h-6 w-6 animate-spin text-accent-violet" />
            <span className="text-[12px]">Loading completed deliverables...</span>
          </div>
        ) : !hires || hires.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <FileText className="h-8 w-8 text-text-quaternary mx-auto" />
            <h4 className="text-[14px] font-bold text-text-primary">No Deliverables Yet</h4>
            <p className="text-[12px] text-text-tertiary max-w-sm mx-auto">
              This squad has not been hired yet. Hire this squad to generate verifiable collaborative deliverables.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden py-2">
            {/* Sidebar list of hires */}
            <div className="space-y-1.5 overflow-y-auto max-h-[50vh] pr-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary pb-1">
                Completed Runs ({hires.length})
              </div>
              {hires.map((h) => {
                const isSelected = selectedHire?.id === h.id;
                const d = new Date(h.createdAt);
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHire(h)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-[10px] border transition-all text-[11.5px] space-y-1",
                      isSelected
                        ? "bg-accent-violet/10 border-accent-violet text-text-primary shadow-xs"
                        : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-accent-violet font-bold">
                        {h.jobChainIds?.length ? `Job #${h.jobChainIds[0]}` : "Dispatched"}
                      </span>
                      <span className="text-text-quaternary">{d.toLocaleDateString()}</span>
                    </div>
                    <p className="line-clamp-2 text-text-primary font-medium">{h.objective}</p>
                  </button>
                );
              })}
            </div>

            {/* Deliverable preview */}
            <div className="md:col-span-2 flex flex-col overflow-hidden bg-bg-raised border border-border-subtle rounded-[12px] p-4 max-h-[50vh]">
              {selectedHire ? (
                <div className="flex flex-col h-full space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                    <div className="text-[11px] text-text-quaternary">
                      Buyer: <span className="font-mono text-text-secondary">{selectedHire.buyerAddress.slice(0, 8)}...</span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (selectedHire.deliverable) {
                          navigator.clipboard.writeText(selectedHire.deliverable);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }
                      }}
                      className="h-7 text-[11px] flex items-center gap-1"
                    >
                      {copied ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1 text-[12px]">
                    {selectedHire.deliverable ? (
                      <ChatMessageMarkdown content={selectedHire.deliverable} />
                    ) : (
                      <div className="text-text-tertiary">No deliverable content.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="m-auto text-text-tertiary text-[12px]">Select a hire from the list to view report.</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
