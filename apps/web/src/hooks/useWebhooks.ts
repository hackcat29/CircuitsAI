"use client";

import { useState, useCallback, useEffect } from "react";

export interface WebhookDelivery {
  timestamp: number;
  event: string;
  status: "success" | "failed";
  responseCode?: number;
}

export interface WebhookConfig {
  id: string;
  agentKey: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  deliveries: WebhookDelivery[];
  createdAt: number;
}

export const WEBHOOK_EVENTS = [
  "task.assigned",
  "task.completed",
  "task.disputed",
  "task.cancelled",
  "agent.activated",
  "agent.deactivated",
  "launch.graduated",
] as const;

import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";

const STORAGE_PREFIX = "circuitsprotocol:webhooks";

function getStorageKey(userAddress?: string | null): string {
  const scope = userAddress?.toLowerCase() ? `:${userAddress.toLowerCase()}` : ":guest";
  return `${STORAGE_PREFIX}${scope}`;
}

function readAll(userAddress?: string | null): Record<string, WebhookConfig> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(userAddress)) ?? "{}");
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, WebhookConfig>, userAddress?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userAddress), JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save webhooks:", err);
  }
}

export function useWebhooks(agentKey?: string, userAddress?: string | null, isOwner?: boolean) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(() => {
    if (typeof window === "undefined" || isOwner === false) return [];
    const all = Object.values(readAll(userAddress));
    return agentKey ? all.filter((w) => w.agentKey === agentKey) : all;
  });

  const refresh = useCallback(() => {
    if (isOwner === false) {
      setWebhooks([]);
      return;
    }
    const all = Object.values(readAll(userAddress));
    setWebhooks(agentKey ? all.filter((w) => w.agentKey === agentKey) : all);
  }, [agentKey, userAddress, isOwner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onLogout() {
      setWebhooks([]);
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, onLogout);
  }, []);

  const create = useCallback(
    (data: Omit<WebhookConfig, "id" | "createdAt" | "deliveries">): WebhookConfig => {
      if (isOwner === false) throw new Error("Only the agent owner can configure webhooks");
      const webhook: WebhookConfig = {
        ...data,
        id: crypto.randomUUID(),
        deliveries: [],
        createdAt: Date.now(),
      };
      const all = readAll(userAddress);
      all[webhook.id] = webhook;
      writeAll(all, userAddress);
      refresh();
      return webhook;
    },
    [refresh, userAddress, isOwner],
  );

  const toggle = useCallback(
    (id: string) => {
      if (isOwner === false) return;
      const all = readAll(userAddress);
      if (!all[id]) return;
      all[id].isActive = !all[id].isActive;
      writeAll(all, userAddress);
      refresh();
    },
    [refresh, userAddress, isOwner],
  );

  const testDelivery = useCallback(
    async (id: string): Promise<boolean> => {
      if (isOwner === false) return false;
      const all = readAll(userAddress);
      const webhook = all[id];
      if (!webhook) return false;
      let statusOk = false;
      let responseCode: number | undefined;
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CircuitsProtocol-Event": "ping",
            "X-CircuitsProtocol-Signature": webhook.secret,
          },
          body: JSON.stringify({ event: "ping", timestamp: Date.now(), agentKey: webhook.agentKey }),
          signal: AbortSignal.timeout(5000),
        });
        statusOk = res.ok;
        responseCode = res.status;
      } catch {
        /* network error or timeout */
      }
      const delivery: WebhookDelivery = {
        timestamp: Date.now(),
        event: "ping",
        status: statusOk ? "success" : "failed",
        responseCode,
      };
      webhook.deliveries.unshift(delivery);
      if (webhook.deliveries.length > 20) webhook.deliveries = webhook.deliveries.slice(0, 20);
      writeAll(all, userAddress);
      refresh();
      return statusOk;
    },
    [refresh, userAddress, isOwner],
  );

  const remove = useCallback(
    (id: string) => {
      if (isOwner === false) return;
      const all = readAll(userAddress);
      delete all[id];
      writeAll(all, userAddress);
      refresh();
    },
    [refresh, userAddress, isOwner],
  );

  return { webhooks, create, toggle, testDelivery, remove, refresh };
}
