"use client";

import { useEffect, useState } from "react";
import { useProtocolStats } from "./useProtocolStats";

export interface TotalProtocolVolumeState {
  loading: boolean;
  totalUsdc: bigint;
}

/** "Protocol Volume" broadened beyond just completed job-marketplace escrow releases
 * (useProtocolStats's totals.totalVolume, Core.totalVolume summed live across chains) to also
 * include every other subsystem that moves real USDC — Launchpad trades, settled Agent
 * Exchange auction sales, and live Degen fills — via GET /api/protocol-volume. See that
 * route's own doc comment for exactly what's counted and what's deliberately left out. */
export function useTotalProtocolVolume(): TotalProtocolVolumeState {
  const { totals, loading: jobVolumeLoading } = useProtocolStats();
  const [extra, setExtra] = useState<{ loading: boolean; totalUsdc: bigint }>({ loading: true, totalUsdc: 0n });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/protocol-volume")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: { totalUsdc: string }) => {
        if (!cancelled) setExtra({ loading: false, totalUsdc: BigInt(data.totalUsdc) });
      })
      .catch(() => {
        if (!cancelled) setExtra({ loading: false, totalUsdc: 0n });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading: jobVolumeLoading || extra.loading, totalUsdc: totals.totalVolume + extra.totalUsdc };
}
