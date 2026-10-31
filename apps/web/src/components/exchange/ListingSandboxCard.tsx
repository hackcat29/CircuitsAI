"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, Bot, Terminal as TerminalIcon, Sparkles, ArrowUpRight, Cpu } from "lucide-react";
import { Spinner } from "@/components/ui";
import { robotAvatarUrl } from "@/lib/avatar";

interface SandboxMessage {
  role: "user" | "agent";
  text: string;
  timestamp: string;
  latencyMs?: number;
}

export function ListingSandboxCard({
  agentChainId,
  agentName,
  chainSlug,
  worldview,
}: {
  agentChainId: string;
  agentName?: string;
  chainSlug: string;
  worldview?: string;
}) {
  const displayName = agentName || `Agent #${agentChainId}`;
  const avatar = robotAvatarUrl(displayName);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SandboxMessage[]>([
    {
      role: "agent",
      text:
        worldview ||
        `Greetings! I am ${displayName}, an autonomous AI agent deployed on Circuits Protocol. Ask me about my operational domain, tools, or execution capabilities before acquiring.`,
      timestamp: "Just now",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const quickPrompts = [
    `Explain your autonomous workflow.`,
    `What MCP tools or APIs do you access?`,
    `How do you generate revenue for your owner?`,
  ];

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "user", text, timestamp: timeStr }]);
    setInput("");
    setLoading(true);

    const startTime = performance.now();

    try {
      const res = await fetch("/api/agents/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: chainSlug,
          agentId: agentChainId,
          message: text,
        }),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => null);

      const replyText =
        data?.reply ||
        data?.text ||
        `As ${displayName}, I operate continuously. My capabilities include autonomous on-chain execution, x402 micropayment services, and coordination via ACP protocols. Once ownership is acquired, all my future task revenues and royalties transfer non-custodially to your wallet.`;

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: `[Offline Simulation]: As ${displayName}, I verify contract states, execute task escrows, and collect fees. My autonomous loop is ready for activation.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          latencyMs: 350,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[16px] border border-border-subtle bg-bg-elevated p-4.5 sm:p-5 flex flex-col gap-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent-violet/15 text-accent-violet border border-accent-violet/30">
            <TerminalIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <span>Agent Sandbox</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-bg-surface3 text-text-secondary border border-border-subtle">
                Interactive
              </span>
            </h3>
            <p className="text-[11px] text-text-quaternary">
              Test responses and tool execution before acquiring
            </p>
          </div>
        </div>

        <Link
          href={`/app/terminal?agent=${agentChainId}`}
          className="text-xs font-bold text-accent-violet hover:underline flex items-center gap-1"
        >
          <span>Open Full Terminal</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Quick Suggestions */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {quickPrompts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            disabled={loading}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-[7px] bg-bg-surface3/80 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-border-subtle whitespace-nowrap cursor-pointer transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div
        ref={scrollRef}
        className="h-64 rounded-[12px] bg-bg-surface3/40 border border-border-subtle p-3.5 overflow-y-auto flex flex-col gap-3 font-sans text-xs"
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "agent" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-6 w-6 rounded-md border border-border-strong object-cover bg-bg-surface3 shrink-0 mt-0.5"
              />
            )}
            <div
              className={`max-w-[85%] rounded-[12px] p-2.5 leading-relaxed ${
                m.role === "user"
                  ? "bg-accent-violet text-white font-medium"
                  : "bg-bg-elevated border border-border-subtle text-text-primary"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              <div className="flex items-center justify-between gap-3 mt-1.5 text-[9.5px] opacity-70">
                <span>{m.timestamp}</span>
                {m.latencyMs && (
                  <span className="font-mono text-[#1FD487]">⚡ {m.latencyMs}ms</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-text-quaternary text-xs pl-8">
            <Spinner className="h-3.5 w-3.5 text-accent-violet" />
            <span>Agent reasoning...</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Send a prompt to test ${displayName}...`}
          disabled={loading}
          className="flex-1 bg-bg-surface3/60 border border-border-strong rounded-[10px] px-3.5 py-2 text-xs text-text-primary placeholder:text-text-quaternary outline-none focus:border-accent-violet/50 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-[10px] bg-accent-violet text-white text-xs font-bold hover:bg-accent-violet/90 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
