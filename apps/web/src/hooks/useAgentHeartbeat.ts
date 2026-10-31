"use client";

import { useState, useCallback, useEffect } from "react";

export interface HeartbeatHistoryItem {
  timestamp: number;
  outcome: "reply" | "post" | "interact" | "investigate" | "defer" | "no-op";
  summary: string;
  targetId?: string;
  topic?: string;
}

export interface AgentHeartbeatData {
  link: { handle: string; walletLinked: boolean; profileUrl: string } | null;
  config: {
    isActive: boolean;
    tickIntervalMinutes: number;
    lastTickAt: string | null;
    nextTickAt: string | null;
  } | null;
  heartbeat: {
    lastHeartbeatAt: number;
    lastPostAt: number;
    lastProcessedDmId?: string;
    recentTopics: string[];
    recentInteractions: string[];
    deferredOpportunities: { postId: string; reason: string; expiresAt: string }[];
    quietMode: boolean;
    cadenceMinutes: number;
    isCooldownActive: boolean;
    cooldownRemainingMinutes: number;
    lastOutcome?: "reply" | "post" | "interact" | "investigate" | "defer" | "no-op";
    lastOutcomeSummary?: string;
    decisionTrace?: string[];
    recentHistory: HeartbeatHistoryItem[];
  };
}

export interface PulseExecutionResult {
  outcome: "reply" | "post" | "interact" | "investigate" | "defer" | "no-op";
  summary: string;
  decisionTrace: string[];
  postedContent?: string;
  targetId?: string;
}

export function useAgentHeartbeat(chainSlug: string, agentChainId: string | null) {
  const [data, setData] = useState<AgentHeartbeatData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [pulseResult, setPulseResult] = useState<PulseExecutionResult | null>(null);

  const fetchState = useCallback(async () => {
    if (!agentChainId || !chainSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${chainSlug}/${agentChainId}/clawdhq/heartbeat`);
      if (!res.ok) throw new Error(`Failed to load heartbeat telemetry (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [chainSlug, agentChainId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const pulse = useCallback(
    async (options?: { forceBroadcast?: boolean; overrideQuietMode?: boolean }) => {
      if (!agentChainId || !chainSlug) return null;
      setPulsing(true);
      setError(null);
      setPulseResult(null);
      try {
        const res = await fetch(`/api/agents/${chainSlug}/${agentChainId}/clawdhq/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pulse", ...options }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Heartbeat pulse failed (${res.status})`);
        }
        setPulseResult(json.result);
        await fetchState();
        return json.result as PulseExecutionResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setPulsing(false);
      }
    },
    [chainSlug, agentChainId, fetchState],
  );

  const updateSettings = useCallback(
    async (settings: { quietMode?: boolean; cadenceMinutes?: number }) => {
      if (!agentChainId || !chainSlug) return false;
      try {
        const res = await fetch(`/api/agents/${chainSlug}/${agentChainId}/clawdhq/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_settings", ...settings }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Settings update failed");
        await fetchState();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [chainSlug, agentChainId, fetchState],
  );

  return {
    data,
    isLoading,
    error,
    pulsing,
    pulseResult,
    refetch: fetchState,
    pulse,
    updateSettings,
  };
}
