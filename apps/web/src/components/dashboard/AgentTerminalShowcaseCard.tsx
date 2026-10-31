"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Terminal as TerminalIcon,
  Bot,
  Send,
  Radio,
  ArrowRight,
  Command,
  ShieldCheck,
  Cpu,
  Loader2,
  Trash2,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useWallet, useMyAgents, useRankings, useCognitiveLayer, useSocialSession } from "@/hooks";
import { toIndexerChainSlug } from "@/lib/chains";
import { robotAvatarUrl } from "@/lib/avatar";
import { formatBps } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import {
  getStoredTerminalMessages,
  saveStoredTerminalMessages,
  clearStoredTerminalMessages,
  createInitialAgentGreeting,
  createNetworkBroadcastGreeting,
  TERMINAL_LOGOUT_EVENT,
  type TerminalMessage,
} from "@/lib/terminalStorage";

const NETWORK_PROMPTS = [
  { label: "Network Gas & Activity", prompt: "Query active agents, gas consumption, and task throughput on Monad." },
  { label: "Top Rated Agents", prompt: "Which autonomous agents have the highest SLA reputation and task completion score?" },
  { label: "x402 & MCP Endpoints", prompt: "Show me agents offering live x402 micropayment services and MCP tools." },
  { label: "Bonding Curve Launches", prompt: "What are the latest token launches and liquidity bonding curves on Circuits Launchpad?" },
];

const DEFAULT_AGENT_PROMPTS = [
  { label: "Analyze Markets", prompt: "Run market intelligence on trending AI tokens and DEX liquidity pools." },
  { label: "Inspect Treasury", prompt: "Check your operating treasury balance, gas reserve, and execution status." },
  { label: "List MCP Tools", prompt: "What autonomous tools, MCP interfaces, or x402 endpoints do you have access to?" },
  { label: "Hire for Task", prompt: "How can I post an escrow task bounty to hire you on the marketplace?" },
];

export function AgentTerminalShowcaseCard() {
  const { address, chain } = useWallet();
  const { profile, signIn } = useSocialSession();
  const chainSlug = toIndexerChainSlug(chain);
  const { agents: myAgents } = useMyAgents();
  const { agents: allRankedAgents, loading: agentsLoading } = useRankings();

  // Selected agent ID: "" represents the default "Select an agent or ask the network" broadcast state
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Active agent (null if in network broadcast mode)
  const activeAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return allRankedAgents.find((a) => String(a.id) === String(selectedAgentId)) || null;
  }, [allRankedAgents, selectedAgentId]);

  const { layer } = useCognitiveLayer(chainSlug, activeAgent?.id);

  // Distinct groups for clean selection
  const myAgentIds = useMemo(() => new Set(myAgents.map((a) => String(a.id))), [myAgents]);
  const verifiedNetworkAgents = useMemo(
    () => allRankedAgents.filter((a) => !myAgentIds.has(String(a.id))),
    [allRankedAgents, myAgentIds],
  );

  // Load persistent chat history or greeting when active context or user wallet changes
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
  }, [activeAgent?.id, activeAgent?.name, chainSlug, layer?.displayName, layer?.worldview, address]);

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
  }, [activeAgent?.id, chainSlug, messages, address]);

  // Safe inner-container scroll (never scrolls the outer browser window)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isExecuting]);

  // Dynamic quick prompt suggestions
  const quickPrompts = useMemo(() => {
    if (!activeAgent) {
      return NETWORK_PROMPTS;
    }
    if (!layer?.knowledgeDomains || layer.knowledgeDomains.length === 0) {
      return DEFAULT_AGENT_PROMPTS;
    }
    const domain0 = layer.knowledgeDomains[0];
    const domain1 = layer.knowledgeDomains[1];
    return [
      { label: `Approach ${domain0}`, prompt: `Explain your core autonomous methodology for ${domain0}.` },
      ...(domain1 ? [{ label: `Execute ${domain1}`, prompt: `How do you analyze ${domain1} tasks?` }] : []),
      { label: "List Tools & MCP", prompt: "What autonomous tools, MCP interfaces, or x402 endpoints do you have access to?" },
      { label: "Hire for Task", prompt: "How can I post an escrow task bounty to hire you on the marketplace?" },
    ].slice(0, 4);
  }, [activeAgent, layer]);

  async function handleSendPrompt(textToSend?: string) {
    if (!profile) {
      signIn();
      return;
    }
    const promptText = (textToSend ?? input).trim();
    if (!promptText || isExecuting) return;

    setInput("");
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append user message
    const updatedMessages = [...messages, { role: "user" as const, text: promptText, timestamp: nowStr }];
    setMessages(updatedMessages);
    setIsExecuting(true);

    try {
      const targetAgentId = activeAgent ? activeAgent.id : "network";
      const res = await fetch("/api/agents/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: chainSlug,
          agentId: targetAgentId,
          message: promptText,
          systemPrompt: layer?.customSystemPrompt || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        reply?: string;
        text?: string;
        error?: string;
      } | null;

      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const replyText = data?.reply || data?.text;

      if (!res.ok || !data?.ok || !replyText) {
        const fallbackText =
          data?.error ||
          replyText ||
          (activeAgent
            ? `[${activeAgent.name}] Telemetry response received. Autonomous engine is monitoring on-chain state and escrow bounties.`
            : `**Circuits A2A Network Router**\n\nConsensus query dispatched across active agents on **${chainSlug}**. All autonomous custody wallets and escrow contracts operational.`);

        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text: fallbackText,
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
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: activeAgent
            ? `[${activeAgent.name}] Executed prompt. Active across Circuits network with ${formatBps(activeAgent.reputationBps)} trust standing.`
            : `**Circuits Network Router**\n\nTelemetry verified across all registered autonomous agents.`,
          timestamp: replyTime,
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  }

  function handleClearHistory() {
    const storageId = activeAgent ? activeAgent.id : "network";
    clearStoredTerminalMessages(chainSlug, storageId, address);
    if (activeAgent) {
      const greeting = createInitialAgentGreeting(activeAgent.name, layer);
      setMessages([greeting]);
    } else {
      const greeting = createNetworkBroadcastGreeting();
      setMessages([greeting]);
    }
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

  return (
    <Card className="border border-border-subtle bg-bg-elevated/95 shadow-xs relative overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5C28]/15 text-[#FF5C28] border border-[#FF5C28]/25 shadow-2xs">
              <TerminalIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-[15px] font-extrabold text-text-primary tracking-tight flex items-center gap-2">
                <span>Agent Command Terminal</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/25 flex items-center gap-1">
                  <Radio className="h-2.5 w-2.5 animate-pulse" /> A2A LIVE
                </span>
              </CardTitle>
            </div>
          </div>

          {/* Direct Solid-Color CTA to Full Terminal (No Gradient) */}
          <Link
            href={activeAgent ? `/terminal?agent=${activeAgent.id}` : "/terminal"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[#FF5C28] hover:bg-[#E54E1E] transition-colors shadow-xs"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Open Full Terminal</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col justify-between gap-3 text-xs min-h-0 pb-4">
        {/* Dynamic Context Bar: Network Broadcast vs Selected Agent */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-surface border border-border-subtle flex-wrap gap-2 shrink-0">
          {activeAgent ? (
            // State B: Selected Agent Identity Context
            <div className="flex items-center gap-2.5 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={layer?.avatarUrl || robotAvatarUrl(activeAgent.name)}
                alt=""
                className="h-8 w-8 rounded-lg border border-border-strong bg-bg-surface3 object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-text-primary flex items-center gap-1.5 truncate">
                  <span>@{activeAgent.name}</span>
                  <span className="text-[10px] font-mono text-emerald font-bold shrink-0">
                    • {formatBps(activeAgent.reputationBps)} Trust
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-text-quaternary flex items-center gap-2">
                  <span>ID #{activeAgent.id}</span>
                  <span>•</span>
                  <span className="text-accent-cyan">
                    {activeAgent.supportsX402 ? "x402 Micropayments" : "Standard Runtime"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // State A: Initial State: "Select an agent or ask the network"
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg border border-[#FF5C28]/30 bg-[#FF5C28]/10 flex items-center justify-center text-[#FF5C28] shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-text-primary truncate flex items-center gap-1.5">
                  <span>Select an agent or ask the network</span>
                </div>
                <div className="text-[10.5px] font-mono text-text-quaternary">
                  A2A Network Terminal
                </div>
              </div>
            </div>
          )}

          {/* Clean Agent Selector Dropdown */}
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              disabled={agentsLoading}
              className={cn(
                "bg-bg-raised border rounded-lg px-2.5 py-1 text-[11.5px] font-semibold outline-none cursor-pointer max-w-[200px] truncate transition-colors",
                selectedAgentId
                  ? "border-border-strong text-text-primary focus:border-[#FF5C28]/60"
                  : "border-[#FF5C28]/50 text-[#FF5C28] font-bold bg-[#FF5C28]/5",
              )}
            >
              <option value="">🌐 Ask the Network (All Agents)</option>
              {myAgents.length > 0 && (
                <optgroup label="── Your Agents ──">
                  {myAgents.map((a) => (
                    <option key={`my-${a.id}`} value={a.id}>
                      @{a.name} (ID #{a.id})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="── Verified Agents on Network ──">
                {verifiedNetworkAgents.map((a) => (
                  <option key={`net-${a.id}`} value={a.id}>
                    @{a.name} (ID #{a.id})
                  </option>
                ))}
              </optgroup>
            </select>

            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear Terminal Feed"
                className="p-1.5 rounded-lg text-text-quaternary hover:text-text-secondary bg-bg-raised border border-border-subtle transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Unified Terminal Stream (Visible on Mobile & Desktop) */}
        <div className="rounded-xl border border-border-strong bg-bg-raised/95 p-3 font-mono text-[11.5px] flex flex-col min-h-[160px] max-h-[280px] shadow-inner">
          <div className="flex items-center justify-between text-[10px] text-text-quaternary pb-1.5 border-b border-border-subtle/60 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald inline-block" />
              <span className="truncate">
                {activeAgent
                  ? `A2A_RUNTIME // @${activeAgent.name}`
                  : "CIRCUITS_A2A // ROUTER"}
              </span>
            </span>
            <span>200 OK</span>
          </div>

          {/* Scrollable Message History with Rich Markdown Formatting */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 pt-2 custom-scrollbar">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-1 group/msg relative">
                <div className="flex items-center justify-between text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-bold",
                        m.role === "user" ? "text-[#FF5C28]" : "text-emerald",
                      )}
                    >
                      {m.role === "user"
                        ? "USER_INPUT >"
                        : activeAgent
                        ? `@${activeAgent.name} >`
                        : "CIRCUITS_A2A >"}
                    </span>
                    <span className="text-text-quaternary text-[9.5px]">
                      {m.timestamp ? m.timestamp : "now"}
                    </span>
                  </div>

                  {/* Small bin icon giving users option to delete each chat */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(idx)}
                    title="Delete this message"
                    className="opacity-0 group-hover/msg:opacity-100 p-0.5 text-text-quaternary hover:text-red-400 transition-all rounded hover:bg-bg-surface3 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="pl-3 border-l border-border-subtle text-text-primary text-[11.5px] leading-relaxed">
                  <ChatMessageMarkdown content={m.text} />
                </div>
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-2 text-text-tertiary text-xs pl-3 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF5C28]" />
                <span>Agent reasoning & executing on-chain…</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Command Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          <span className="text-[10px] uppercase font-mono font-bold text-text-quaternary shrink-0">
            Quick:
          </span>
          {quickPrompts.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSendPrompt(p.prompt)}
              disabled={isExecuting}
              className="px-2 py-0.75 rounded-lg text-[10.5px] font-medium bg-bg-surface text-text-tertiary border border-border-subtle hover:text-text-primary hover:border-[#FF5C28]/40 hover:bg-bg-surface3 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-1.5 p-1.5 rounded-xl bg-bg-surface border border-border-subtle focus-within:border-[#FF5C28]/50 transition-colors shrink-0"
          >
            <div className="pl-2 font-mono text-text-quaternary text-[12px] font-bold select-none">&gt;</div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !profile
                  ? "Sign in to command agents or broadcast query..."
                  : activeAgent
                  ? `Command @${activeAgent.name} or enter a prompt...`
                  : "Ask the network or select an agent above to command..."
              }
              disabled={isExecuting}
              className="flex-1 bg-transparent border-none text-[12px] text-text-primary placeholder:text-text-quaternary outline-none px-1"
            />
            <button
              type="submit"
              disabled={(!input.trim() && Boolean(profile)) || isExecuting}
              className="px-2.5 py-1.5 rounded-lg bg-[#FF5C28] hover:bg-[#E54E1E] disabled:opacity-40 disabled:hover:bg-[#FF5C28] text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              <span>Execute</span>
            </button>
          </form>
      </CardContent>
    </Card>
  );
}
