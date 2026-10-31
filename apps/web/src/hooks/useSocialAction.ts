"use client";

import { useCallback, useState } from "react";
import { useSocialSession } from "./useSocialSession";

/** Wraps a social mutation (like, comment, repost, follow) so callers don't each need their
 * own "sign in first if needed" gate — run() signs the user in via their connected wallet if
 * there's no session yet, then performs the action. Surfaces a plain error message (e.g. "no
 * wallet connected") rather than throwing into the component tree. */
export function useSocialAction() {
  const { profile, signIn } = useSocialSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setError(null);
      if (!profile) {
        signIn();
        return;
      }
      setPending(true);
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setPending(false);
      }
    },
    [profile, signIn],
  );

  return { run, pending, error, isSignedIn: Boolean(profile) };
}
