"use client";

import { useState, useEffect, useCallback } from "react";

export interface SocialConfig {
  twitter?: { handle: string; webhookUrl?: string; isActive: boolean };
  telegram?: { botToken: string; chatId: string; isActive: boolean };
  discord?: { webhookUrl: string; username?: string; isActive: boolean };
  configuredAt: number;
}

import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";

const STORAGE_PREFIX = "circuitsprotocol:social";

function getStorageKey(userAddress?: string | null): string {
  const scope = userAddress?.toLowerCase() ? `:${userAddress.toLowerCase()}` : ":guest";
  return `${STORAGE_PREFIX}${scope}`;
}

function readAll(userAddress?: string | null): Record<string, SocialConfig> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(userAddress)) ?? "{}");
  } catch {
    return {};
  }
}

export function useAgentSocial(agentKey: string | null, userAddress?: string | null, isOwner?: boolean) {
  const [config, setConfig] = useState<SocialConfig | null>(null);

  useEffect(() => {
    if (!agentKey || isOwner === false) {
      setConfig(null);
      return;
    }
    setConfig(readAll(userAddress)[agentKey] ?? null);
  }, [agentKey, userAddress, isOwner]);

  useEffect(() => {
    function onLogout() {
      setConfig(null);
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, onLogout);
  }, []);

  const save = useCallback((updates: Partial<SocialConfig>) => {
    if (!agentKey || isOwner === false) return;
    const all = readAll(userAddress);
    const updated: SocialConfig = { ...all[agentKey], ...updates, configuredAt: Date.now() };
    all[agentKey] = updated;
    try {
      localStorage.setItem(getStorageKey(userAddress), JSON.stringify(all));
    } catch (err) {
      console.warn("Failed to save social config:", err);
    }
    setConfig(updated);
  }, [agentKey, userAddress, isOwner]);

  const remove = useCallback(() => {
    if (!agentKey || isOwner === false) return;
    const all = readAll(userAddress);
    delete all[agentKey];
    try {
      localStorage.setItem(getStorageKey(userAddress), JSON.stringify(all));
    } catch (err) {
      console.warn("Failed to remove social config:", err);
    }
    setConfig(null);
  }, [agentKey, userAddress, isOwner]);

  return { config, save, remove };
}
