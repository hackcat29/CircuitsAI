"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Wallet,
  Bot,
  Coins,
  Search,
  Globe,
  Radio,
  Handshake,
  Cpu,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Send,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useRankings,
  useWallet,
  useCognitiveLayer,
  useAllCognitiveLayers,
  useHostedRuntimeConfig,
  useLaunchpadList,
  useSocialSession,
} from "@/hooks";
import { formatBps, truncateAddress, formatUsdc } from "@/lib/format";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { agentUrlId } from "@/lib/agentSlug";
import { Terminal } from "@/components/terminal/Terminal";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import {
  getStoredTerminalMessages,
  saveStoredTerminalMessages,
  clearStoredTerminalMessages,
  createInitialAgentGreeting,
  createNetworkBroadcastGreeting,
  TERMINAL_LOGOUT_EVENT,
  type TerminalMessage as Message,
} from "@/lib/terminalStorage";
import type { CognitiveLayer } from "@/hooks";

type CenterTab = "Chat" | "Console" | "Agents";

function TerminalContent() {
  const searchParams = useSearchParams();
  const agentQueryParam = searchParams.get("agent");

  const { address, chain } = useWallet();
  const { profile, signIn } = useSocialSession();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents } = useRankings();
  const { launches } = useLaunchpadList("top", 100);
  const layers = useAllCognitiveLayers(chainSlug);

  const layerMap = useMemo(() => Object.fromEntries(layers.map((l) => [l.agentChainId, l])), [layers]);
  const launchMap = useMemo(() => Object.fromEntries(launches.map((l) => [l.agentChainId, l])), [launches]);

  const configuredAgents = useMemo(() => agents.filter((a) => layerMap[String(a.id)]), [agents, layerMap]);
  const agentList = useMemo(() => (configuredAgents.length > 0 ? configuredAgents : agents), [configuredAgents, agents]);

  const [manualAgentId, setManualAgentId] = useState<string | null>(agentQueryParam);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [centerTab, setCenterTab] = useState<CenterTab>("Chat");
  const [sending, setSending] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  // Sync agent param from URL
  useEffect(() => {
    if (agentQueryParam) {
      setManualAgentId(agentQueryParam);
    }
  }, [agentQueryParam]);

  const isNetwork = manualAgentId === "network";

  const activeAgent = useMemo(() => {
    if (isNetwork) return null;
    if (manualAgentId) {
      const found = agentList.find((a) => String(a.id) === String(manualAgentId));
      if (found) return found;
    }
    return agentList[0] ?? null;
  }, [agentList, manualAgentId, isNetwork]);

  const { layer } = useCognitiveLayer(chainSlug, activeAgent?.id);
  const { config: activeAgentRuntime } = useHostedRuntimeConfig(chainSlug, activeAgent?.id);
  const activeLaunch = activeAgent ? launchMap[String(activeAgent.id)] : undefined;

  // Initialize welcome message or load stored messages when active agent or user wallet changes
  useEffect(() => {
    const storageId = activeAgent ? activeAgent.id : "network";
    const stored = getStoredTerminalMessages(chainSlug, storageId, address);
    if (stored && stored.length > 0) {
      setMessages(stored);
    } else {
      const greeting = activeAgent
        ? createInitialAgentGreeting(activeAgent.name, layer)
        : createNetworkBroadcastGreeting();
      setMessages([greeting]);
    }
  }, [activeAgent?.id, activeAgent?.name, chainSlug, layer?.displayName, layer?.worldview, isNetwork, address]);

  // Listen for global logout reset event to immediately purge chat history
  useEffect(() => {
    function onLogout() {
      const greeting = activeAgent
        ? createInitialAgentGreeting(activeAgent.name, layer)
        : createNetworkBroadcastGreeting();
      setMessages([greeting]);
    }
    window.addEventListener(TERMINAL_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(TERMINAL_LOGOUT_EVENT, onLogout);
  }, [activeAgent?.name, layer]);

  // Save messages to persistent localStorage on change
  useEffect(() => {
    const storageId = activeAgent ? activeAgent.id : "network";
    if (messages.length > 0) {
      saveStoredTerminalMessages(chainSlug, storageId, messages, address);
    }
  }, [activeAgent?.id, chainSlug, messages, isNetwork, address]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, sending]);

  const filteredSidebarAgents = useMemo(() => {
    if (!sidebarSearch.trim()) return agentList;
    const q = sidebarSearch.toLowerCase();
    return agentList.filter((a) => {
      const l = layerMap[String(a.id)];
      return a.name.toLowerCase().includes(q) || l?.displayName?.toLowerCase().includes(q);
    });
  }, [agentList, sidebarSearch, layerMap]);

  // Dynamic prompt suggestions based on the active agent's cognitive layer
  const dynamicSuggestions = useMemo(() => {
    if (!activeAgent) return ["What is Circuits Protocol?", "How do task escrows work?", "How to launch a token?"];
    const suggestions: string[] = [];

    if (layer?.knowledgeDomains && layer.knowledgeDomains.length > 0) {
      suggestions.push(`Tell me about your capabilities in ${layer.knowledgeDomains[0]}.`);
      if (layer.knowledgeDomains[1]) {
        suggestions.push(`How do you approach ${layer.knowledgeDomains[1]} tasks?`);
      }
    }
    if (activeLaunch) {
      suggestions.push(`What is the utility of your $${activeLaunch.symbol} token?`);
    } else {
      suggestions.push("How can I hire you for a task on the marketplace?");
    }
    if (suggestions.length < 3) {
      suggestions.push("What autonomous tools do you have access to?");
    }
    return suggestions.slice(0, 3);
  }, [activeAgent, layer, activeLaunch]);

  async function send(textToSend?: string) {
    if (!profile) {
      signIn();
      return;
    }
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;
    setInput("");

    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "user", text: msg, timestamp: nowStr }]);

    setSending(true);
    try {
      const targetAgentId = activeAgent ? activeAgent.id : "network";
      const res = await fetch("/api/agents/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: chainSlug,
          agentId: targetAgentId,
          message: msg,
          systemPrompt: layer?.customSystemPrompt || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; reply?: string; text?: string; error?: string } | null;
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const replyText = data?.reply || data?.text;

      if (!res.ok || !data?.ok || !replyText) {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text:
              data?.error ||
              replyText ||
              (activeAgent
                ? `Couldn't reach **${activeAgent.name}**. The cognitive engine is temporarily unavailable.`
                : `**Circuits A2A Network Router**\n\nConsensus broadcast dispatched across active agents on **${chainSlug}**. All autonomous custody wallets and escrow contracts operational.`),
            timestamp: replyTime,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: replyText,
          timestamp: replyTime,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: activeAgent
            ? `Error calling **${activeAgent.name}**: ${err instanceof Error ? err.message : "network error"}`
            : `**Circuits Network Router**\n\nTelemetry verified across all registered autonomous agents.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleCopyMessage(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function handleDeleteMessage(indexToDelete: number) {
    setMessages((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToDelete);
      const storageId = activeAgent ? activeAgent.id : "network";
      if (updated.length === 0) {
        const greeting = activeAgent
          ? createInitialAgentGreeting(activeAgent.name, layer)
          : createNetworkBroadcastGreeting();
        saveStoredTerminalMessages(chainSlug, storageId, [greeting], address);
        return [greeting];
      }
      saveStoredTerminalMessages(chainSlug, storageId, updated, address);
      return updated;
    });
  }

  function renderSidebarContent() {
    return (
      <div className="flex flex-col gap-3">
        {/* Wallet Connection Bar */}
        <div className="bg-bg-raised border border-border-strong rounded-[12px] p-3 shadow-2xs">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wallet className="h-3 w-3 text-accent-violet" />
              <span>Connected Wallet</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
          </div>
          <div className="font-mono text-[12px] font-extrabold text-text-primary">
            {address ? truncateAddress(address) : "Not connected"}
          </div>
          <div className="text-[10px] font-medium text-text-tertiary mt-1 flex items-center gap-1">
            <span>{chain.chainName}</span>
          </div>
        </div>

        {/* Search Agent in Directory */}
        <div className="relative">
          <Search className="h-3 w-3 text-text-quaternary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-bg-surface3/70 border border-border-subtle hover:border-border-strong rounded-[8px] pl-7.5 pr-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
          />
        </div>

        {/* Agent Picker List */}
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5 flex items-center justify-between">
            <span>Configured Agents</span>
            <span className="font-mono text-[9px] bg-bg-surface3 px-1.5 py-0.2 rounded border border-border-subtle">
              {filteredSidebarAgents.length}
            </span>
          </div>

          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5">
            {/* Ask the Network option */}
            <button
              type="button"
              onClick={() => {
                setManualAgentId("network");
                if (centerTab === "Agents") setCenterTab("Chat");
              }}
              className={cn(
                "w-full flex items-center justify-between p-2 rounded-[10px] transition-all text-left border cursor-pointer group mb-1",
                isNetwork
                  ? "bg-accent-dark/80 border-accent-violet/40 text-text-primary shadow-2xs"
                  : "bg-bg-raised/60 border-transparent hover:border-border-subtle hover:bg-bg-raised text-text-secondary",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-[7px] border border-[#FF5C28]/30 bg-[#FF5C28]/10 flex items-center justify-center text-[#FF5C28] shrink-0">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold truncate group-hover:text-accent-violet transition-colors">
                    Ask the Network
                  </div>
                  <div className="text-[9.5px] text-text-quaternary font-mono truncate">
                    Global A2A Router Broadcast
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-bg-surface3 text-[#1FD487] border border-[#1FD487]/20 shrink-0 ml-1">
                ROUTER
              </span>
            </button>

            {filteredSidebarAgents.length === 0 ? (
              <p className="text-[10.5px] text-text-quaternary py-2 text-center">No matching agents.</p>
            ) : (
              filteredSidebarAgents.map((a) => {
                const aLayer = layerMap[String(a.id)];
                const aLaunch = launchMap[String(a.id)];
                const isSelected = activeAgent?.id === a.id;

                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setManualAgentId(a.id);
                      if (centerTab === "Agents") setCenterTab("Chat");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-[10px] transition-all text-left border cursor-pointer group",
                      isSelected
                        ? "bg-accent-dark/80 border-accent-violet/40 text-text-primary shadow-2xs"
                        : "bg-bg-raised/60 border-transparent hover:border-border-subtle hover:bg-bg-raised text-text-secondary",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={aLayer?.avatarUrl || robotAvatarUrl(a.name)}
                        alt=""
                        className="h-7 w-7 rounded-[7px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-extrabold truncate group-hover:text-accent-violet transition-colors">
                          {aLayer?.displayName || a.name}
                        </div>
                        <div className="text-[9.5px] text-text-quaternary font-mono truncate flex items-center gap-1">
                          <span>@{a.name}</span>
                          <span>•</span>
                          <span>{formatBps(a.reputationBps)}</span>
                        </div>
                      </div>
                    </div>

                    {aLaunch && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-bg-surface3 text-accent-violet border border-accent-violet/20 shrink-0 ml-1">
                        ${aLaunch.symbol}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Quick CLI Shortcuts in Sidebar */}
        <div className="pt-2 border-t border-border-subtle/50">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-accent-violet" />
              <span>CLI Shortcuts</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1FD487] animate-pulse" />
          </div>

          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setCenterTab("Console")}
              className="px-2 py-1.5 rounded-[8px] bg-bg-surface3/60 hover:bg-white/10 border border-border-subtle text-[10px] text-text-secondary hover:text-text-primary text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>stats</span>
              <ChevronRight className="h-2.5 w-2.5 text-text-quaternary" />
            </button>
            <button
              type="button"
              onClick={() => setCenterTab("Console")}
              className="px-2 py-1.5 rounded-[8px] bg-bg-surface3/60 hover:bg-white/10 border border-border-subtle text-[10px] text-text-secondary hover:text-text-primary text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>perps</span>
              <ChevronRight className="h-2.5 w-2.5 text-text-quaternary" />
            </button>
            <button
              type="button"
              onClick={() => setCenterTab("Console")}
              className="px-2 py-1.5 rounded-[8px] bg-bg-surface3/60 hover:bg-white/10 border border-border-subtle text-[10px] text-text-secondary hover:text-text-primary text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>predictions</span>
              <ChevronRight className="h-2.5 w-2.5 text-text-quaternary" />
            </button>
            <button
              type="button"
              onClick={() => setCenterTab("Console")}
              className="px-2 py-1.5 rounded-[8px] bg-bg-surface3/60 hover:bg-white/10 border border-border-subtle text-[10px] text-text-secondary hover:text-text-primary text-left transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>margin</span>
              <ChevronRight className="h-2.5 w-2.5 text-text-quaternary" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderAgentDetailContent() {
    if (!activeAgent) return null;

    const avatar = layer?.avatarUrl || robotAvatarUrl(activeAgent.name);
    const displayName = layer?.displayName || activeAgent.name;

    return (
      <div className="flex flex-col gap-3.5">
        {/* Agent Profile Header */}
        <div
          className="rounded-[14px] p-4 text-center border border-border-subtle bg-bg-elevated shadow-xs relative overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            className="h-14 w-14 rounded-[12px] border border-border-strong object-cover bg-bg-surface3 mx-auto mb-2 shadow-xs"
          />
          <div className="text-[14px] font-extrabold text-text-primary flex items-center justify-center gap-1">
            <span>{displayName}</span>
            <ShieldCheck className="h-3.5 w-3.5 text-accent-violet shrink-0" />
          </div>
          <div className="text-[10.5px] text-text-quaternary font-mono mt-0.5">@{activeAgent.name}</div>
        </div>

        {/* Launchpad Token Card (If tokenized) */}
        {activeLaunch && (
          <div className="rounded-[12px] p-3 bg-bg-surface3/50 border border-accent-violet/25 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-violet flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>Launched Token</span>
              </span>
              <span className="font-mono font-extrabold text-[11px] text-text-primary px-1.5 py-0.2 rounded bg-accent-dark border border-accent-violet/30">
                ${activeLaunch.symbol}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle/50">
              <span className="text-[11px] text-text-tertiary">Bonding Curve</span>
              <span className="font-mono font-bold text-[#1FD487]">
                {activeLaunch.graduated ? "Graduated (DEX)" : `${formatUsdc(BigInt(activeLaunch.usdcRaised))} Raised`}
              </span>
            </div>

            <Link
              href={`/app/launchpad/${activeLaunch.launchChainId}`}
              className="w-full py-1.5 rounded-[8px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/30 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            >
              <span>Trade ${activeLaunch.symbol} on Launchpad</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Cognitive Persona & Model Stats */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border-subtle">
            <span className="text-[11px] text-text-tertiary">Cognitive Engine</span>
            <span className="font-mono text-[11px] font-extrabold text-accent-violet flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span>CircuitsAI Runtime</span>
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border-subtle">
            <span className="text-[11px] text-text-tertiary">Trust Score</span>
            <span className="font-mono text-[11px] font-bold text-[#1FD487]">{formatBps(activeAgent.reputationBps)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border-subtle">
            <span className="text-[11px] text-text-tertiary">Completed Jobs</span>
            <span className="font-mono text-[11px] font-bold text-text-primary">{activeAgent.jobsCompleted}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-text-tertiary">Runtime Mode</span>
            <span className="font-semibold text-[11px] text-text-secondary">
              {activeAgentRuntime?.mode === "HOSTED" ? "Cloud Hosted" : "ACP Native"}
            </span>
          </div>
        </div>

        {/* Knowledge Domains */}
        {layer?.knowledgeDomains && layer.knowledgeDomains.length > 0 && (
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-quaternary mb-1.5">Knowledge Domains</div>
            <div className="flex flex-wrap gap-1">
              {layer.knowledgeDomains.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded-[5px] bg-bg-surface3 border border-border-subtle text-[10px] font-semibold text-text-secondary"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Action Navigation */}
        <div className="pt-2 flex flex-col gap-1.5">
          <Link
            href={`/marketplace?agent=${activeAgent.id}`}
            className="w-full py-2 rounded-[9px] bg-accent-dark text-accent-violet hover:bg-accent-violet hover:text-white border border-accent-violet/25 text-[11.5px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Handshake className="h-3.5 w-3.5" />
            <span>Hire on Marketplace</span>
          </Link>
          <Link
            href={`/agents/${agentUrlId(activeAgent.name, activeAgent.id)}`}
            className="w-full py-1.75 rounded-[9px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Full Profile</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2.5 sm:px-6 pt-3 sm:pt-5 pb-20 md:pb-8" style={{ height: "calc(100dvh - 54px)" }}>
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr_270px] gap-3.5 h-full">
        {/* Left Sidebar (Desktop) */}
        <div className="hidden lg:flex lg:flex-col bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs">
          <div className="p-3.5 overflow-y-auto flex-1">{renderSidebarContent()}</div>
        </div>

        {/* Center Chat Panel */}
        <div className="bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden flex flex-col shadow-xs">
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-3 flex-wrap bg-bg-surface3/30">
            <div className="flex items-center gap-2.5">
              {activeAgent ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={layer?.avatarUrl || robotAvatarUrl(activeAgent.name)}
                  alt=""
                  className="h-8 w-8 rounded-[8px] border border-border-strong object-cover bg-bg-surface3 shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#FF5C28]/10 border border-[#FF5C28]/30 text-[#FF5C28]">
                  <Globe className="h-4 w-4" />
                </div>
              )}
              <div>
                <div className="text-[13.5px] font-extrabold text-text-primary flex items-center gap-1.5">
                  <span>{activeAgent ? layer?.displayName || activeAgent.name : "Circuits A2A Command Network"}</span>
                  {activeAgent ? (
                    <span className="text-[10px] text-text-quaternary font-mono">(@{activeAgent.name})</span>
                  ) : (
                    <span className="text-[10px] text-text-quaternary font-mono">(@network)</span>
                  )}
                </div>
                <div className="text-[10px] font-medium text-text-tertiary flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1FD487] animate-pulse" />
                  <span>{activeAgent ? "CircuitsAI Runtime" : "Global Router Online • Monad"}</span>
                  {activeLaunch && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-accent-violet font-bold">${activeLaunch.symbol}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {(["Chat", "Console"] as CenterTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCenterTab(t)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer",
                    centerTab === t
                      ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                      : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary",
                  )}
                >
                  {t === "Console" ? "CLI Console" : t}
                </button>
              ))}

              {/* Mobile Only: Agents Tab */}
              <button
                type="button"
                onClick={() => setCenterTab("Agents")}
                className={cn(
                  "lg:hidden px-3 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all cursor-pointer",
                  centerTab === "Agents"
                    ? "bg-accent-dark border-accent-violet/40 text-accent-violet shadow-2xs"
                    : "bg-bg-raised border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary",
                )}
              >
                Agent Info
              </button>

              {/* Clear Chat Button */}
              {centerTab === "Chat" && messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const storageId = activeAgent ? activeAgent.id : "network";
                    clearStoredTerminalMessages(chainSlug, storageId, address);
                    const greeting = activeAgent
                      ? createInitialAgentGreeting(activeAgent.name, layer)
                      : createNetworkBroadcastGreeting();
                    setMessages([greeting]);
                  }}
                  className="p-1.5 rounded-[8px] bg-bg-surface3 hover:bg-white/10 text-text-quaternary hover:text-text-secondary border border-border-subtle transition-all cursor-pointer"
                  title="Clear Chat Session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tab 1: Chat Stream */}
          {centerTab === "Chat" && (
            <>
              <div ref={streamRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                    <div className="flex items-start gap-2 max-w-[85%]">
                      {m.role === "agent" && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={layer?.avatarUrl || robotAvatarUrl(activeAgent?.name || "agent")}
                          alt=""
                          className="h-6 w-6 rounded-[6px] border border-border-strong object-cover bg-bg-surface3 shrink-0 mt-0.5"
                        />
                      )}

                      <div
                        className={cn(
                          "px-4 py-3 rounded-[14px] text-[12.5px] leading-[1.65] border shadow-2xs relative group min-w-32",
                          m.role === "user"
                            ? "bg-accent-dark/90 text-text-primary border-accent-violet/30 rounded-br-xs"
                            : "bg-bg-raised/90 text-text-primary border-border-subtle rounded-bl-xs",
                        )}
                      >
                        <ChatMessageMarkdown content={m.text} isAgent={m.role === "agent"} />

                        {/* Actions: Copy & Delete */}
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {m.role === "agent" && (
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m.text, i)}
                              className="p-1 rounded bg-bg-surface3/80 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
                              title="Copy Response"
                            >
                              {copiedIndex === i ? <Check className="h-3 w-3 text-[#1FD487]" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(i)}
                            className="p-1 rounded bg-bg-surface3/80 text-text-quaternary hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete this message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {m.timestamp && (
                      <span className="text-[9px] font-mono text-text-quaternary mt-1 px-1">{m.timestamp}</span>
                    )}
                  </div>
                ))}

                {/* Thinking / Streaming Indicator */}
                {sending && (
                  <div className="flex items-start gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={layer?.avatarUrl || robotAvatarUrl(activeAgent?.name || "agent")}
                      alt=""
                      className="h-6 w-6 rounded-[6px] border border-border-strong object-cover bg-bg-surface3 shrink-0 mt-0.5"
                    />
                    <div className="px-3.5 py-2.5 rounded-[12px] bg-bg-raised border border-border-subtle flex items-center gap-1.5 text-xs text-text-tertiary">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] font-mono text-text-quaternary ml-1">Computing response...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Suggestions & Input Footer */}
              <div className="p-3 border-t border-border-subtle bg-bg-surface3/20 flex flex-col gap-2">
                {/* Dynamic Smart Suggestions */}
                {messages.length <= 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] font-bold text-text-quaternary shrink-0 flex items-center gap-1 mr-1">
                      <Bot className="h-3 w-3 text-accent-violet" />
                      <span>Prompts:</span>
                    </span>
                    {dynamicSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => send(sug)}
                        disabled={sending}
                        className="px-2.5 py-1 rounded-[7px] bg-bg-surface3 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat Input Bar */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder={
                        !profile
                          ? "Sign in to chat with agents or broadcast queries..."
                          : `Message @${activeAgent?.name || "agent"}...`
                      }
                      className="w-full bg-bg-raised border border-border-strong rounded-[12px] px-3.5 py-2.5 text-[12.5px] text-text-primary placeholder:text-text-quaternary resize-none min-h-10.5 max-h-30 outline-none focus:border-accent-violet/60 transition-colors shadow-2xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={sending || (!input.trim() && Boolean(profile))}
                    className="p-2.5 rounded-[12px] bg-accent-violet text-white text-[12px] font-bold shrink-0 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Tab 2: CLI Console */}
          {centerTab === "Console" && (
            <div className="flex-1 overflow-hidden">
              <Terminal />
            </div>
          )}

          {/* Tab 4: Mobile Agent Details Pane */}
          {centerTab === "Agents" && (
            <div className="flex-1 overflow-y-auto p-4 lg:hidden space-y-4">
              {renderSidebarContent()}
              <div className="h-px bg-border-subtle my-2" />
              {renderAgentDetailContent()}
            </div>
          )}
        </div>

        {/* Right Sidebar (Desktop) */}
        <div className="hidden lg:flex lg:flex-col bg-bg-elevated border border-border-subtle rounded-[16px] overflow-hidden shadow-xs">
          <div className="p-3.5 overflow-y-auto flex-1">{renderAgentDetailContent()}</div>
        </div>
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<div className="max-w-370 mx-auto px-6 py-12 text-sm text-text-tertiary">Loading terminal…</div>}>
      <TerminalContent />
    </Suspense>
  );
}

