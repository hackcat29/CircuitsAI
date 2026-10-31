"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Live now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `Launching in ${days}d ${hours}h`;
  if (hours > 0) return `Launching in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Launching in ${minutes}m ${seconds}s`;
  return `Launching in ${seconds}s`;
}

/** Same ticking pattern as components/exchange/AuctionCountdown.tsx, with launch-appropriate
 * copy — that component's "Auction ended" wording doesn't fit a not-yet-live launch. Purely a
 * client-side timestamp comparison: once `scheduledAt` passes, callers should stop treating
 * the launch as scheduled (see LaunchActionsBar/UpcomingLaunchesStrip) — there's no separate
 * "activate" step. */
export function LaunchCountdown({ scheduledAt, className }: { scheduledAt: string; className?: string }) {
  const target = new Date(scheduledAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRemaining(target - now)}
    </span>
  );
}
