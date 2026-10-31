"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useSocialSession } from "./useSocialSession";

export interface NotificationItem {
  id: string;
  type: "FOLLOWED_USER_OPERATION" | "NEW_FOLLOWER" | "AGENT_BROADCAST";
  actor: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string | null;
  };
  title: string;
  description: string;
  timestamp: string;
  href: string | null;
  chain?: string | null;
  agentName?: string | null;
  operationType?: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  totalCount: number;
}

import { SESSION_LOGOUT_EVENT } from "@/lib/sessionCleanup";

const STORAGE_PREFIX = "circuits_notifications_last_read";

function getNotificationStorageKey(profileId: string): string {
  return `${STORAGE_PREFIX}_${profileId}`;
}

export function useNotifications() {
  const { profile } = useSocialSession();
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !profile?.id) {
      setLastReadTimestamp(0);
      return;
    }
    const stored = localStorage.getItem(getNotificationStorageKey(profile.id));
    setLastReadTimestamp(stored ? Number(stored) || 0 : 0);
  }, [profile?.id]);

  useEffect(() => {
    function onLogout() {
      setLastReadTimestamp(0);
    }
    window.addEventListener(SESSION_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(SESSION_LOGOUT_EVENT, onLogout);
  }, []);

  const query = useQuery({
    queryKey: ["social-notifications", profile?.id],
    queryFn: async (): Promise<NotificationsResponse> => {
      const res = await fetch("/api/social/notifications");
      if (!res.ok) {
        throw new Error("Failed to load notifications");
      }
      return res.json();
    },
    enabled: Boolean(profile),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const notifications = profile ? (query.data?.notifications ?? []) : [];

  const unreadCount = notifications.filter(
    (n) => new Date(n.timestamp).getTime() > lastReadTimestamp
  ).length;

  const markAllAsRead = useCallback(() => {
    if (!profile?.id) return;
    const now = Date.now();
    setLastReadTimestamp(now);
    if (typeof window !== "undefined") {
      localStorage.setItem(getNotificationStorageKey(profile.id), String(now));
    }
  }, [profile?.id]);

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markAllAsRead,
  };
}
