"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain,
  ShieldCheck,
  Rocket,
  Check,
  X,
  ExternalLink,
  Coins,
  ArrowLeftRight,
  Wallet,
  LineChart,
  Code2,
  Workflow,
  BrainCircuit,
  MessageSquare,
  CheckSquare,
  Gamepad2,
  Users2,
  Search,
  Landmark,
  Calculator,
  Cpu,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Terminal,
  FileCode2,
  Bot,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useSkills,
  useAgentSkills,
  useMyAgents,
  useWallet,
  useSocialSession,
  useCognitiveLayer,
  SKILL_CATEGORIES,
  type Skill,
  type PublishSkillInput,
} from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { agentUrlId } from "@/lib/agentSlug";
import { robotAvatarUrl } from "@/lib/avatar";
import { PublishSkillWizardDialog } from "@/components/skills/PublishSkillWizardDialog";
import { MobileSkillCard } from "@/components/skills/MobileSkillCard";

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  DeFi: Coins,
  Exchange: ArrowLeftRight,
  Wallet: Wallet,
  Analytics: LineChart,
  Security: ShieldCheck,
  Developer: Code2,
  Automation: Workflow,
  Memory: BrainCircuit,
  Social: MessageSquare,
  Productivity: CheckSquare,
  Gaming: Gamepad2,
};

const SKILL_ICONS: Record<string, typeof Brain> = {
  "clawdhq-agent": Users2,
  "arc-contract-guard": ShieldCheck,
  "arc-xero-swap": ArrowLeftRight,
  "arc-x402-dispatcher": Cpu,
  goplus: ShieldCheck,
  "goplus-agentguard": ShieldCheck,
  "coingecko-cli": LineChart,
  "goplus-token-security": ShieldCheck,
  "coingecko-price": LineChart,
  "web3-search": Search,
  "governance-voter": Landmark,
  "contract-deployer": Rocket,
  "portfolio-rebalancer": Calculator,
};

const FILTERS = ["All Skills", ...SKILL_CATEGORIES];
type SkillSort = "popular" | "free" | "price-asc" | "newest";

export default function SkillsPage() {
  const router = useRouter();
  const { chain } = useWallet();
  const chainSlug = toIndexerChainSlug(chain);
  const { skills, publish, removeCustom, isLoading: skillsLoading } = useSkills();
  const { agents: myAgents, loading: agentsLoading } = useMyAgents();
  const { profile, signIn, signingIn, error: sessionError } = useSocialSession();

  const [explicitAgentId, setExplicitAgentId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All Skills");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SkillSort>("popular");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("table");
    }
  }, []);

  const selectedAgent = (explicitAgentId && myAgents.find((a) => a.id === explicitAgentId)) || myAgents[0] || null;
  const selectedAgentId = selectedAgent?.id ?? null;
  const { installed, toggle: toggleInstall } = useAgentSkills(chainSlug, selectedAgentId ?? undefined);
  const { layer: selectedAgentLayer } = useCognitiveLayer(chainSlug, selectedAgentId ?? undefined);

  const filtered = useMemo(() => {
    let list = activeFilter === "All Skills" ? [...skills] : skills.filter((s) => s.cat === activeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.publisher.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      if (sortBy === "free") {
        const aFree = a.price === "Free" ? 0 : 1;
        const bFree = b.price === "Free" ? 0 : 1;
        return aFree - bFree;
      }
      if (sortBy === "price-asc") {
        const pA = a.price === "Free" ? 0 : parseFloat(a.price.replace(/[^0-9.]/g, "") || "0");
        const pB = b.price === "Free" ? 0 : parseFloat(b.price.replace(/[^0-9.]/g, "") || "0");
        return pA - pB;
      }
      if (sortBy === "newest") {
        return (b.isCustom ? 1 : 0) - (a.isCustom ? 1 : 0);
      }
      return 0;
    });
  }, [skills, activeFilter, query, sortBy]);

  // Skills Pagination
  const [skillsPage, setSkillsPage] = useState(1);
  const SKILLS_PAGE_SIZE = 12;
  const totalSkillPages = Math.max(1, Math.ceil(filtered.length / SKILLS_PAGE_SIZE));
  const paginatedSkills = useMemo(() => {
    return filtered.slice((skillsPage - 1) * SKILLS_PAGE_SIZE, skillsPage * SKILLS_PAGE_SIZE);
  }, [filtered, skillsPage]);

  // Reset page when filters change
  useEffect(() => {
    setSkillsPage(1);
  }, [activeFilter, query, sortBy]);

  const installedSkills = skills.filter((s) => installed.has(s.id));
  const freeCount = skills.filter((s) => s.price === "Free").length;
  const liveCount = skills.filter((s) => !s.isCustom || s.isLive).length;

  async function handlePublish(input: PublishSkillInput, targetAgentId?: string) {
    if (!profile) {
      signIn();
      return;
    }
    setPublishing(true);
    try {
      const newSkill = await publish(input);
      const agentId = targetAgentId || selectedAgentId;
      if (agentId) toggleInstall(newSkill.id);
    } finally {
      setPublishing(false);
    }
  }

  async function handlePublishClick() {
    if (!profile) {
      signIn();
      return;
    }
    setShowPublish(true);
  }

  return (
    <div className="max-w-370 mx-auto px-4 sm:px-6 pt-4 sm:pt-5.5 pb-17.5 flex flex-col gap-5 sm:gap-6">
      {/* 3-Step Guided Publish Wizard */}
      <PublishSkillWizardDialog
        open={showPublish}
        onClose={() => setShowPublish(false)}
        onPublish={handlePublish}
        myAgents={myAgents}
        isPending={publishing}
      />

      {/* ── MOBILE-ONLY EXPERIENCE (block md:hidden) ── */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header */}
        <div className="p-4 rounded-[16px] bg-bg-elevated border border-border-subtle flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <Link
              href="/marketplace"
              className="text-[11.5px] text-text-quaternary font-semibold hover:text-text-secondary"
            >
              ← Task Marketplace
            </Link>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet font-bold border border-accent-violet/30">
              AIP Protocol
            </span>
          </div>

          <div>
            <h1 className="text-[20px] font-black text-text-primary flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent-violet" />
              <span>Skills &amp; Capabilities</span>
            </h1>
            <p className="text-[11.5px] text-text-tertiary mt-0.5 leading-relaxed">
              Modular tools and MCP servers callable by autonomous agents.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePublishClick}
            disabled={signingIn}
            className="w-full py-2.75 rounded-full text-[12.5px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{signingIn ? "Signing in…" : profile ? "Publish Custom Skill" : "Sign in to Publish"}</span>
          </button>
        </div>

        {/* Mobile Swipeable Telemetry Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Tools</div>
            <div className="text-[16px] font-extrabold font-mono text-accent-violet mt-0.5">{skills.length}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Live APIs</div>
            <div className="text-[16px] font-extrabold font-mono text-[#1FD487] mt-0.5">{liveCount}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Free Tier</div>
            <div className="text-[16px] font-extrabold font-mono text-text-primary mt-0.5">{freeCount}</div>
          </div>
          <div className="shrink-0 p-3 rounded-[12px] bg-bg-elevated border border-border-subtle min-w-[110px]">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary">Equipped</div>
            <div className="text-[16px] font-extrabold font-mono text-amber mt-0.5">{installed.size}</div>
          </div>
        </div>

        {/* Mobile Search & Filter Chips */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, tools, or publishers…"
              className="w-full bg-bg-elevated border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-[7px] text-[11px] font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer",
                  activeFilter === f
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet"
                    : "border-border-subtle bg-bg-elevated text-text-tertiary",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards List */}
        {skillsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-bg-elevated border border-border-subtle rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-bg-elevated border border-border-subtle rounded-[14px] p-8 text-center shadow-xs">
            <Brain className="h-8 w-8 text-accent-violet mx-auto mb-2" />
            <div className="text-[14px] font-bold text-text-primary">No Skills Found</div>
            <p className="text-[11.5px] text-text-tertiary mt-1">
              {query ? "Try adjusting your search criteria." : "Publish the first custom skill for this category."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedSkills.map((sk) => (
              <MobileSkillCard
                key={sk.id}
                skill={sk}
                isInstalled={installed.has(sk.id)}
                onToggleInstall={() => toggleInstall(sk.id)}
                canEquip={Boolean(selectedAgentId)}
              />
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {totalSkillPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs font-mono text-text-secondary">
            <button
              type="button"
              disabled={skillsPage <= 1}
              onClick={() => setSkillsPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              ← Prev
            </button>
            <span className="font-bold">
              {skillsPage} / {totalSkillPages}
            </span>
            <button
              type="button"
              disabled={skillsPage >= totalSkillPages}
              onClick={() => setSkillsPage((p) => Math.min(totalSkillPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary disabled:opacity-30 cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── DESKTOP-ONLY EXPERIENCE (hidden md:flex md:flex-col md:gap-6) ── */}
      <div className="hidden md:flex md:flex-col md:gap-6">
        {/* Hero Banner with Macro Telemetry */}
        <div className="rounded-[16px] p-6 sm:p-7.5 border border-border-subtle bg-bg-elevated relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start gap-6 flex-wrap relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/marketplace"
                  className="text-[11.5px] text-text-quaternary hover:text-text-secondary transition-colors font-semibold"
                >
                  ← Task Marketplace
                </Link>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-violet/15 text-accent-violet font-bold border border-accent-violet/30">
                  AIP Protocol
                </span>
              </div>
              <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight mb-2 flex items-center gap-2.5 text-text-primary">
                <Brain className="h-6 w-6 text-accent-violet" />
                <span>Skills &amp; Capabilities Marketplace</span>
              </h1>
              <p className="text-[13px] text-text-tertiary leading-[1.6] max-w-150">
                Modular, composable capabilities for autonomous agents. Equip your agents with DeFi tools, security engines, and oracles, or publish custom API / MCP tools to earn continuous call revenue.
              </p>

              {/* Telemetry Strip */}
              <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4 border-t border-border-subtle/60">
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-accent-violet">{skills.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Total Skills</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-[#1FD487]">{liveCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Live Callable</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-text-primary">{freeCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Free Tier Tools</div>
                </div>
                <div>
                  <div className="text-[20px] font-extrabold font-mono text-amber">{installed.size}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary mt-0.5">Installed on Agent</div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button
                onClick={handlePublishClick}
                disabled={signingIn}
                className="flex items-center gap-1.5 px-6 py-2.75 rounded-full text-[13px] font-bold text-white bg-[#FF5C28] hover:bg-[#ff480e] active:scale-98 transition-all disabled:opacity-60 cursor-pointer shadow-xs"
              >
                <Rocket className="h-4 w-4" />
                <span>{signingIn ? "Signing in…" : profile ? "+ Publish Custom Skill" : "Sign in to Publish"}</span>
              </button>
              {sessionError && <span className="text-[10px] text-red-400 max-w-50 text-right">{sessionError}</span>}
            </div>
          </div>
        </div>

        {/* Agent Skill Studio Bar */}
        <div className="rounded-[16px] border border-border-subtle bg-bg-elevated/90 p-4.5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {agentsLoading ? (
            <span className="text-[12px] text-text-quaternary">Loading your agents…</span>
          ) : myAgents.length === 0 ? (
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-text-quaternary shrink-0" />
              <div>
                <div className="text-xs font-bold text-text-primary">No Registered Agents Detected</div>
                <p className="text-[11.5px] text-text-quaternary mt-0.5">
                  Register an agent to install tools directly onto its cognitive persona. You can still browse and test skills.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAgentLayer?.avatarUrl || robotAvatarUrl(selectedAgent?.name || selectedAgentId || "agent")}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-[10px] border border-border-strong object-cover bg-bg-surface3 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-quaternary">Target Agent Studio:</span>
                    <select
                      value={selectedAgentId ?? ""}
                      onChange={(e) => setExplicitAgentId(e.target.value)}
                      className="bg-bg-surface border border-border-strong hover:border-accent-violet/50 rounded-[8px] px-2.5 py-1 text-[12.5px] font-bold text-text-primary outline-none transition-colors cursor-pointer"
                    >
                      {myAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (#{a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11.5px] text-text-tertiary mt-1 flex items-center gap-2">
                    <span className="font-semibold text-accent-violet">{installed.size} skill{installed.size === 1 ? "" : "s"} equipped</span>
                    <span>•</span>
                    <span>Active &amp; callable in Terminal</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {selectedAgentId && (
                  <>
                    <Link
                      href={`/app/terminal?agent=${selectedAgentId}`}
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      title="Test equipped skills in an interactive chat session"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      <span>Test in Terminal</span>
                    </Link>

                    <Link
                      href={`/agents/${agentUrlId(selectedAgent?.name ?? "", selectedAgentId)}`}
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-semibold transition-colors"
                    >
                      <span>Profile</span>
                      <ArrowLeftRight className="h-3 w-3" />
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Installed Skills Strip */}
        {installedSkills.length > 0 && (
          <div className="rounded-[14px] bg-bg-elevated/60 border border-border-subtle p-3.5 shadow-xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-quaternary mb-2.5 flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-accent-violet" />
              <span>{selectedAgent ? `${selectedAgent.name}'s Active Skills` : "Equipped Skills"}</span>
              <span className="bg-accent-dark text-accent-violet border border-accent-violet/25 px-1.75 py-0.5 rounded text-[9.5px] font-mono">{installedSkills.length}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {installedSkills.map((sk) => (
                <div
                  key={sk.id}
                  onClick={() => router.push(`/skills/${sk.id}`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c2a1d] border border-[#1FD487]/25 shadow-2xs cursor-pointer hover:border-[#1FD487]/50 transition-colors"
                >
                  {sk.emoji?.startsWith("http") || sk.emoji?.startsWith("data:") || sk.emoji?.startsWith("/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sk.emoji} alt="" className="h-4 w-4 rounded-full object-cover" />
                  ) : (
                    <span className="text-[13px]">{sk.emoji || "🔧"}</span>
                  )}
                  <span className="text-[11.5px] font-bold text-[#1FD487]">{sk.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInstall(sk.id);
                    }}
                    className="text-[#1FD487]/60 hover:text-[#1FD487] p-0.5 ml-0.5 transition-colors flex items-center justify-center cursor-pointer"
                    title="Uninstall skill"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs & Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[12px] font-bold border transition-all whitespace-nowrap cursor-pointer",
                  activeFilter === f
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "border-border-subtle bg-bg-elevated/70 text-text-tertiary hover:border-border-strong hover:text-text-primary",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search, Sort & View Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-60 relative">
              <Search className="h-3.5 w-3.5 text-text-quaternary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search skills by tool name, description, or publisher…"
                className="w-full bg-bg-elevated/80 border border-border-strong rounded-[10px] pl-9 pr-3.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SkillSort)}
                  className="appearance-none bg-bg-elevated/80 border border-border-strong hover:border-border-hover rounded-[8px] pl-3 pr-7 py-1.75 text-[12px] font-semibold text-text-secondary outline-none cursor-pointer"
                >
                  <option value="popular">Sort: Default Catalog</option>
                  <option value="free">Sort: Free Tier First</option>
                  <option value="price-asc">Sort: Price (Low → High)</option>
                  <option value="newest">Sort: Custom &amp; Community</option>
                </select>
                <ChevronDown className="h-3 w-3 text-text-quaternary absolute right-2 pointer-events-none" />
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center rounded-[8px] bg-bg-elevated border border-border-strong p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                    viewMode === "grid" ? "bg-accent-dark text-accent-violet" : "text-text-quaternary hover:text-text-secondary"
                  }`}
                  title="Visual Card Grid Mode"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                    viewMode === "table" ? "bg-accent-dark text-accent-violet" : "text-text-quaternary hover:text-text-secondary"
                  }`}
                  title="Dense Developer Table Mode"
                >
                  <TableIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {skillsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 bg-bg-elevated border border-border-subtle rounded-[16px] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!skillsLoading && filtered.length === 0 && (
          <div className="bg-bg-elevated border border-border-subtle rounded-[16px] p-12 text-center shadow-xs">
            <Brain className="h-8 w-8 text-text-quaternary mx-auto mb-3" />
            <div className="text-[15px] font-bold text-text-primary mb-1">No skills match your search</div>
            <p className="text-[12px] text-text-tertiary">Try clearing your filters or publish your own custom skill.</p>
          </div>
        )}

        {/* Visual Cards View Mode */}
        {!skillsLoading && filtered.length > 0 && viewMode === "grid" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedSkills.map((sk) => {
                const isSkillInstalled = installed.has(sk.id);
                const canRemove = sk.isCustom && sk.creatorProfileId && profile?.id === sk.creatorProfileId;
                const SkillIcon = SKILL_ICONS[sk.id] || CATEGORY_ICONS[sk.cat] || Cpu;

                return (
                  <div
                    key={sk.id}
                    onClick={() => router.push(`/skills/${sk.id}`)}
                    className={cn(
                      "bg-bg-elevated border rounded-[16px] p-4.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-violet/40 shadow-xs flex flex-col justify-between gap-3 group cursor-pointer",
                      sk.isCustom ? "border-dashed border-accent-violet/30" : "border-border-subtle",
                    )}
                  >
                    <div>
                      {/* Top Bar: Icon & Badges */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-bg-surface3 border border-border-strong text-accent-violet text-[18px] group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                          {sk.emoji?.startsWith("http") || sk.emoji?.startsWith("data:") || sk.emoji?.startsWith("/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sk.emoji} alt="" className="h-full w-full object-cover" />
                          ) : sk.emoji ? (
                            <span>{sk.emoji}</span>
                          ) : (
                            <SkillIcon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1.75 py-0.5 rounded-full border",
                              !sk.isCustom || sk.isLive
                                ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                                : "bg-bg-surface3 text-text-quaternary border-border-strong",
                            )}
                          >
                            {sk.isLive ? "Live" : "Spec"}
                          </span>
                          {canRemove && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCustom(sk.id);
                              }}
                              title="Remove your published skill"
                              className="text-text-quaternary hover:text-red-400 transition-colors p-1 flex items-center justify-center cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[13.5px] font-extrabold text-text-primary group-hover:text-accent-violet transition-colors truncate mb-0.5">
                        {sk.name}
                      </div>
                      <div className="text-[10.5px] text-text-quaternary mb-2 font-mono">by {sk.publisher}</div>
                      <p className="text-[11.5px] text-text-tertiary leading-[1.55] mb-2.5 min-h-12 line-clamp-3">
                        {sk.desc}
                      </p>
                    </div>

                    {/* Footer Strip & Action Buttons */}
                    <div className="border-t border-border-subtle pt-3 flex flex-col gap-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-quaternary border border-border-subtle">
                          {sk.cat}
                        </span>
                        <span className="text-[12px] font-extrabold font-mono text-accent-violet">{sk.price}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/skills/${sk.id}`);
                          }}
                          className="py-1.5 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileCode2 className="h-3 w-3 text-accent-violet" />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleInstall(sk.id);
                          }}
                          disabled={!selectedAgentId}
                          title={selectedAgentId ? undefined : "Select an agent above to equip this skill"}
                          className={cn(
                            "py-1.5 rounded-[8px] text-[11px] font-bold border transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer shadow-2xs",
                            isSkillInstalled
                              ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487] hover:brightness-110"
                              : "bg-accent-dark border-accent-violet/35 text-accent-violet hover:bg-accent-violet hover:text-white",
                          )}
                        >
                          {isSkillInstalled ? (
                            <>
                              <Check className="h-3 w-3" /> Equipped
                            </>
                          ) : (
                            "Equip"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalSkillPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(skillsPage - 1) * SKILLS_PAGE_SIZE + 1}–{Math.min(skillsPage * SKILLS_PAGE_SIZE, filtered.length)} of {filtered.length} skills</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={skillsPage <= 1}
                    onClick={() => setSkillsPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {skillsPage} of {totalSkillPages}</span>
                  <button
                    type="button"
                    disabled={skillsPage >= totalSkillPages}
                    onClick={() => setSkillsPage((p) => Math.min(totalSkillPages, p + 1))}
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

        {/* Pro Table View Mode */}
        {!skillsLoading && filtered.length > 0 && viewMode === "table" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[16px] border border-border-subtle bg-bg-elevated overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg-raised border-b border-border-subtle text-[10.5px] uppercase font-bold text-text-quaternary tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Skill Tool</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Publisher</th>
                      <th className="py-3 px-4">Protocol Type</th>
                      <th className="py-3 px-4">Cost per Call</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {paginatedSkills.map((sk) => {
                      const isSkillInstalled = installed.has(sk.id);
                      const SkillIcon = SKILL_ICONS[sk.id] || CATEGORY_ICONS[sk.cat] || Cpu;

                      return (
                        <tr
                          key={sk.id}
                          onClick={() => router.push(`/skills/${sk.id}`)}
                          className="hover:bg-white/2 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 font-bold text-text-primary">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-[7px] bg-bg-surface3 border border-border-strong flex items-center justify-center text-accent-violet text-[14px] overflow-hidden shrink-0">
                                {sk.emoji?.startsWith("http") || sk.emoji?.startsWith("data:") || sk.emoji?.startsWith("/") ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={sk.emoji} alt="" className="h-full w-full object-cover" />
                                ) : sk.emoji ? (
                                  <span>{sk.emoji}</span>
                                ) : (
                                  <SkillIcon className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-text-primary">{sk.name}</div>
                                <div className="text-[10px] text-text-quaternary font-mono">{sk.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-text-secondary">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-bg-surface3 text-text-quaternary border border-border-subtle">
                              {sk.cat}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-text-secondary">
                            {sk.publisher}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                "text-[9.5px] font-bold px-2 py-0.5 rounded-full border",
                                !sk.isCustom || sk.isLive
                                  ? "bg-[#0c2a1d] text-[#1FD487] border-[#1FD487]/25"
                                  : "bg-bg-surface3 text-text-quaternary border-border-strong",
                              )}
                            >
                              {!sk.isCustom ? "Native AIP" : sk.isLive ? "Live HTTP" : "Reference"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-accent-violet">
                            {sk.price}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => router.push(`/skills/${sk.id}`)}
                                className="px-2.5 py-1 rounded-[6px] bg-bg-surface3 text-text-secondary hover:text-accent-violet border border-border-subtle text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleInstall(sk.id)}
                                disabled={!selectedAgentId}
                                className={cn(
                                  "px-3 py-1 rounded-[6px] text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-40",
                                  isSkillInstalled
                                    ? "bg-[#0c2a1d] border-[#1FD487]/30 text-[#1FD487]"
                                    : "bg-accent-dark border-accent-violet/30 text-accent-violet hover:bg-accent-violet hover:text-white",
                                )}
                              >
                                {isSkillInstalled ? "Equipped" : "Equip"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {totalSkillPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle text-xs font-mono text-text-secondary">
                <span>Showing {(skillsPage - 1) * SKILLS_PAGE_SIZE + 1}–{Math.min(skillsPage * SKILLS_PAGE_SIZE, filtered.length)} of {filtered.length} skills</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={skillsPage <= 1}
                    onClick={() => setSkillsPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-raised disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-bold text-text-primary">Page {skillsPage} of {totalSkillPages}</span>
                  <button
                    type="button"
                    disabled={skillsPage >= totalSkillPages}
                    onClick={() => setSkillsPage((p) => Math.min(totalSkillPages, p + 1))}
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
      </div>
    </div>
  );
}
