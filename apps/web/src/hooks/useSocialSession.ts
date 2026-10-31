"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import type { SocialProfile } from "@/lib/social/types";

import { clearAppUserSession } from "@/lib/sessionCleanup";

export const SOCIAL_SESSION_QUERY_KEY = ["social-session"];

async function fetchSessionProfile(): Promise<SocialProfile | null> {
  const res = await fetch("/api/social/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
  const data = (await res.json()) as { profile: SocialProfile | null };
  return data.profile;
}

/** Human sign-in for the social layer via Privy Email login. */
export function useSocialSession() {
  const { login: privyLogin, logout: privyLogout, authenticated, ready } = usePrivy();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: SOCIAL_SESSION_QUERY_KEY,
    queryFn: fetchSessionProfile,
    // Privy confirms auth client-side almost immediately, but our own session cookie lands a beat
    // later (PrivyAppProvider's SessionSyncer has to mint+verify an identity token first) — poll
    // until a profile shows up instead of leaving callers stuck on a stale null in between.
    refetchInterval: (query) => (authenticated && !query.state.data ? 2000 : false),
  });

  const profile = sessionQuery.data ?? null;
  // True in the gap between Privy confirming auth and our own session cookie landing. Privy's own
  // login() silently no-ops with just a console warning once the user is already authenticated
  // (see PrivyAppProvider's SessionSyncer), so callers use this to disable the sign-in button
  // instead of letting a second click hit that no-op and look like nothing is happening.
  const signingIn = authenticated && !profile;

  const signIn = useCallback(() => {
    if (!ready || authenticated) return;
    setError(null);
    try {
      privyLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }, [privyLogin, ready, authenticated]);

  const signOut = useCallback(async () => {
    await clearAppUserSession(queryClient);
    await privyLogout();
  }, [queryClient, privyLogout]);

  return {
    profile,
    loading: sessionQuery.isLoading,
    ready,
    signingIn,
    authenticated,
    error,
    signIn,
    signOut,
  };
}
