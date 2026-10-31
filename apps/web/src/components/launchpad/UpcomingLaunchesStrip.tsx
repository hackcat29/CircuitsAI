"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { useLaunches } from "@/hooks";
import { LaunchCountdown } from "./LaunchCountdown";

/** Real scheduled-launch data (see packages/marketplace-db's ScheduledLaunch), replacing what
 * used to be a hardcoded fake "Upcoming Agents" array on /dashboard and /marketplace. Scoped
 * to the active chain, same as useLaunches() itself and everything else in this app that
 * reads "my"/"current chain" data rather than aggregating across all five chains. */
export function UpcomingLaunchesStrip() {
  const { loading, launches } = useLaunches();
  // Lazy initializer, not a bare Date.now() in the filter below — calling an impure function
  // directly during render breaks React's purity rules. A per-second tick isn't needed here
  // (individual LaunchCountdown badges already tick); this only needs a "roughly now" cutoff
  // for which launches are still upcoming at all.
  const [now] = useState(() => Date.now());
  const upcoming = launches.filter((l) => l.scheduledAt && new Date(l.scheduledAt).getTime() > now);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-31 w-full rounded-[14px]" />
        ))}
      </div>
    );
  }

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-5.5">
      {upcoming.map((launch) => (
        <Link
          key={launch.id}
          href="/launchpad"
          className="rounded-[14px] border border-border-subtle bg-bg-elevated p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-border-hover"
        >
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-bg-surface3 border border-border-strong text-accent-violet">
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-text-primary">{launch.name}</div>
                <div className="text-[10.5px] font-mono text-text-quaternary">${launch.symbol}</div>
              </div>
            </div>
          </div>
          <LaunchCountdown scheduledAt={launch.scheduledAt as string} className="text-[11.5px] font-bold text-amber" />
        </Link>
      ))}
    </div>
  );
}
