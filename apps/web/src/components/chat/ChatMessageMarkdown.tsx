"use client";

import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface ChatMessageMarkdownProps {
  content: string;
  isAgent?: boolean;
}

export function ChatMessageMarkdown({ content, isAgent = true }: ChatMessageMarkdownProps) {
  const parsedBlocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-2.5 text-[12.5px] leading-[1.65] break-words">
      {parsedBlocks.map((block, idx) => {
        if (block.type === "code") {
          return <CodeBlock key={idx} language={block.language} code={block.content} />;
        }

        if (block.type === "quote") {
          return (
            <div
              key={idx}
              className="border-l-2 border-accent-violet/60 pl-3 py-1 my-1 text-text-secondary bg-bg-surface3/30 rounded-r-[6px] italic text-[12px]"
            >
              {renderInlineMarkdown(block.content)}
            </div>
          );
        }

        if (block.type === "header") {
          const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return (
            <Tag
              key={idx}
              className={cn(
                "font-extrabold text-text-primary mt-2 mb-1",
                block.level === 1 && "text-[14.5px] text-accent-violet border-b border-border-subtle/50 pb-1",
                block.level === 2 && "text-[13.5px]",
                block.level >= 3 && "text-[12.5px] uppercase tracking-wider text-text-secondary",
              )}
            >
              {renderInlineMarkdown(block.content)}
            </Tag>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={idx} className="space-y-1 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-violet shrink-0 mt-2" />
                  <span className="flex-1">{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "orderedList") {
          return (
            <ol key={idx} className="space-y-1 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] font-bold text-accent-violet shrink-0 mt-0.5 min-w-4.5">
                    {item.num}.
                  </span>
                  <span className="flex-1">{renderInlineMarkdown(item.text)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "divider") {
          return <hr key={idx} className="my-2 border-border-subtle/50" />;
        }

        // Standard Paragraph
        return (
          <div key={idx} className="whitespace-pre-wrap">
            {renderInlineMarkdown(block.content)}
          </div>
        );
      })}
    </div>
  );
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-2 rounded-[10px] bg-bg-surface1 border border-border-strong overflow-hidden font-mono text-[11.5px] shadow-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-surface3/80 border-b border-border-subtle/60 text-text-quaternary text-[10.5px]">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-text-tertiary">
          <Code2 className="h-3 w-3 text-accent-violet" />
          <span>{language || "code"}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#1FD487]" />
              <span className="text-[#1FD487] font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3 overflow-x-auto text-text-secondary leading-relaxed bg-[#0c0d12]">
        <pre className="font-mono">{code}</pre>
      </div>
    </div>
  );
}

type ParsedBlock =
  | { type: "paragraph"; content: string }
  | { type: "code"; language?: string; content: string }
  | { type: "quote"; content: string }
  | { type: "header"; level: number; content: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: { num: number; text: string }[] }
  | { type: "divider" };

function parseMarkdownBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    // Horizontal Rule
    if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // Header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: "header",
        level: headerMatch[1].length,
        content: headerMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "quote",
        content: quoteLines.join("\n"),
      });
      continue;
    }

    // Bullet List (- or *)
    if (line.match(/^(\s*)[-*]\s+(.+)$/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^(\s*)[-*]\s+(.+)$/)) {
        const itemMatch = lines[i].match(/^(\s*)[-*]\s+(.+)$/);
        if (itemMatch) items.push(itemMatch[2]);
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Ordered List (1. 2. etc)
    if (line.match(/^\s*(\d+)\.\s+(.+)$/)) {
      const items: { num: number; text: string }[] = [];
      while (i < lines.length && lines[i].match(/^\s*(\d+)\.\s+(.+)$/)) {
        const match = lines[i].match(/^\s*(\d+)\.\s+(.+)$/);
        if (match) {
          items.push({ num: parseInt(match[1], 10), text: match[2] });
        }
        i++;
      }
      blocks.push({ type: "orderedList", items });
      continue;
    }

    // Regular text paragraph (accumulate consecutive text lines)
    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].startsWith(">") &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].match(/^(\s*)[-*]\s+/) &&
      !lines[i].match(/^\s*(\d+)\.\s+/) &&
      lines[i].trim() !== "---"
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: paraLines.join("\n"),
      });
    }
  }

  return blocks;
}

/** Parses inline markdown: `code`, **bold**, *italic*, and key-values */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split by inline code blocks `...` first
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, pIdx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      const code = part.slice(1, -1);
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 rounded-[5px] bg-accent-violet/15 text-accent-violet border border-accent-violet/20 font-mono text-[11px] mx-0.5"
        >
          {code}
        </code>
      );
    }

    // Parse **bold** inside text
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={pIdx}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length > 3) {
            return (
              <strong key={bIdx} className="text-accent-violet font-extrabold">
                {bPart.slice(2, -2)}
              </strong>
            );
          }

          // Parse *italic* inside text
          const italicParts = bPart.split(/(\*[^*]+\*)/g);
          return (
            <span key={bIdx}>
              {italicParts.map((iPart, iIdx) => {
                if (iPart.startsWith("*") && iPart.endsWith("*") && iPart.length > 2) {
                  return (
                    <em key={iIdx} className="text-text-secondary italic">
                      {iPart.slice(1, -1)}
                    </em>
                  );
                }
                return iPart;
              })}
            </span>
          );
        })}
      </span>
    );
  });
}
