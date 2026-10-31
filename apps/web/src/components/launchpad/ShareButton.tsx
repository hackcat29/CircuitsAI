"use client";

import { useEffect, useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui";
import { robotAvatarUrl } from "@/lib/avatar";

export function ShareButton({ name, symbol, token }: { name: string; symbol: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Starts empty and fills in client-side only (not `window.location.href` read directly in the
  // render body) — this component renders during SSR too, where `window` doesn't exist, and
  // reading it directly would make the server- and client-rendered markup disagree (a hydration
  // mismatch) the moment this component mounts.
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shareText = `${name} ($${symbol}) on Circuits Protocol`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share {name}</DialogTitle>
            <DialogDescription>Anyone with this link can view {name}&apos;s live price and trade.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-raised/40 p-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- deterministic per-token DiceBear URL */}
            <img src={robotAvatarUrl(token)} alt="" className="h-12 w-12 shrink-0 rounded-[10px] border border-border-strong object-cover bg-bg-surface3" />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-text-primary">{name}</span>
              <span className="font-mono text-xs text-text-tertiary">${symbol}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              placeholder="Loading link…"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border-subtle bg-white/5 px-3 text-xs text-text-secondary outline-none"
            />
            <Button type="button" size="sm" onClick={handleCopy} disabled={!url} className="shrink-0 gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
            <a href={twitterUrl} target="_blank" rel="noreferrer">
              𝕏 Share on X
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
