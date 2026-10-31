"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Trash2, Terminal as TerminalIcon, Send, CornerDownLeft } from "lucide-react";
import { useWallet, useEvmAdapter, useEvmLaunchpadAdapter } from "@/hooks";
import { isEvmChain, MONAD_MAINNET } from "@/lib/chains";
import { runTerminalCommand, type TerminalContext } from "@/lib/terminal-commands";
import { cn } from "@/lib/cn";

interface Line {
  kind: "input" | "output" | "error" | "system";
  text: string;
}

const WELCOME: Line[] = [
  { kind: "system", text: "Circuits Protocol CLI Terminal [v1.2.0]" },
  { kind: "system", text: 'Type "help" or click any shortcut below to query live on-chain state, perps, and agents.' },
];

const SHORTCUT_COMMANDS = [
  { label: "help", cmd: "help" },
  { label: "whoami", cmd: "whoami" },
  { label: "stats", cmd: "stats" },
  { label: "perps", cmd: "perps" },
  { label: "predictions", cmd: "predictions" },
  { label: "margin 1", cmd: "margin 1" },
  { label: "agent 1", cmd: "agent 1" },
  { label: "clear", cmd: "clear" },
];

export function Terminal() {
  const { chain, address, isConnected } = useWallet();
  const evmAdapter = useEvmAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);
  const evmLaunchpadAdapter = useEvmLaunchpadAdapter(isEvmChain(chain) ? chain : MONAD_MAINNET);

  const [lines, setLines] = useState<Line[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  async function executeCommand(cmdToRun: string) {
    const command = cmdToRun.trim();
    if (!command || busy) return;

    setInput("");
    setHistory((h) => [...h, command]);
    setHistoryIndex(null);
    setLines((prev) => [...prev, { kind: "input", text: command }]);

    if (command.toLowerCase() === "clear") {
      setLines([]);
      return;
    }

    setBusy(true);
    try {
      const ctx: TerminalContext = { chain, address, isConnected, evmAdapter, evmLaunchpadAdapter };
      const output = await runTerminalCommand(command, ctx);
      setLines((prev) => [
        ...prev,
        ...(output.length > 0 ? output : ["(no output)"]).map((text): Line => ({
          kind: text.startsWith("Error:") ? "error" : "output",
          text,
        })),
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await executeCommand(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? "");
      }
    }
  }

  async function handleCopyLog() {
    const logText = lines.map((l) => (l.kind === "input" ? `> ${l.text}` : l.text)).join("\n");
    await navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-bg-surface1 text-xs font-mono select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Shell Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-raised border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
          </div>
          <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1.5">
            <TerminalIcon className="h-3.5 w-3.5 text-accent-violet" />
            <span>circuits-cli · bash</span>
          </span>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-bg-surface3 text-text-tertiary border border-border-subtle">
            {chain.chainName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyLog}
            className="p-1 rounded-[6px] hover:bg-white/10 text-text-quaternary hover:text-text-secondary transition-colors"
            title="Copy Console Output"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#1FD487]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            className="p-1 rounded-[6px] hover:bg-white/10 text-text-quaternary hover:text-text-secondary transition-colors"
            title="Clear Console"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "whitespace-pre-wrap break-all",
              line.kind === "input" && "text-accent-violet font-bold flex items-center gap-1.5",
              line.kind === "output" && "text-text-secondary",
              line.kind === "system" && "text-text-tertiary italic",
              line.kind === "error" && "text-red-400 font-semibold",
            )}
          >
            {line.kind === "input" && (
              <span className="text-[#1FD487] select-none font-black mr-1">circuits@arc:~$</span>
            )}
            <span>{line.text}</span>
          </div>
        ))}

        {busy && (
          <div className="text-accent-violet font-bold animate-pulse flex items-center gap-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-violet animate-ping" />
            <span>Executing command on-chain...</span>
          </div>
        )}
      </div>

      {/* Quick Action Shortcut Pills */}
      <div className="px-4 py-2 border-t border-border-subtle bg-bg-surface3/30 flex items-center gap-1.5 overflow-x-auto shrink-0">
        <span className="text-[10px] uppercase font-bold text-text-quaternary flex items-center gap-1 mr-1 shrink-0">
          <TerminalIcon className="h-3 w-3 text-accent-violet" />
          <span>Quick:</span>
        </span>
        {SHORTCUT_COMMANDS.map((sc) => (
          <button
            key={sc.cmd}
            type="button"
            onClick={() => executeCommand(sc.cmd)}
            disabled={busy}
            className="px-2 py-0.5 rounded-[6px] bg-bg-raised hover:bg-accent-violet/20 hover:text-accent-violet text-text-tertiary border border-border-subtle text-[10.5px] transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer"
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Shell Input Prompt */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-2.5 bg-bg-raised border-t border-border-strong shrink-0"
      >
        <span className="text-[#1FD487] font-bold select-none shrink-0">circuits@arc:~$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          placeholder='Type a command (e.g. "help", "perps", "margin 1", "stats")...'
          className="flex-1 bg-transparent text-xs font-mono text-text-primary placeholder:text-text-quaternary outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="p-1 rounded-[6px] bg-accent-violet text-white hover:brightness-110 disabled:opacity-30 transition-all shrink-0 cursor-pointer"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
