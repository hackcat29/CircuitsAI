"use client";

import { useEffect, useRef, useState } from "react";
import { PrivyProvider, usePrivy, useWallets, useIdentityToken, getIdentityToken, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { SOCIAL_SESSION_QUERY_KEY } from "@/hooks/useSocialSession";
import { ALL_CHAINS, MONAD_MAINNET } from "@/lib/chains";
import { clearAppUserSession } from "@/lib/sessionCleanup";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cm00000000000000000000000";

// Sends Privy's identity token, never a client-derived wallet address — the backend verifies
// this token's signature against Privy's own JWKS and only ever trusts the wallet address Privy
// itself reports for the verified user (see privy-verify/route.ts). A raw `walletAddress` in the
// request body would be a client-claimed value with nothing backing it: anyone could POST an
// arbitrary address and get a session minted for it.
//
// Retries are deliberately cheap: getIdentityToken() below is a real call to Privy's own API
// (auth.privy.io). Calling it on every retry tick was observed making a rate-limit situation
// worse (each retry added another request against the endpoint Privy was already 429-ing), but
// calling it at most ONCE per sign-in attempt (the previous version of this fix) turned out to
// have its own failure mode: getIdentityToken() can resolve with no token and no thrown error at
// all (confirmed from Privy's own SDK source — it awaits an internal refresh and just returns
// whatever ended up in local storage, empty or not), and with only one attempt allowed, that
// single empty result meant every remaining retry just polled a passive value that could never
// change, silently, for the rest of the window. ACTIVE_FETCH_MAX_ATTEMPTS allows a few real
// attempts (still far short of one per tick) so a single premature/empty call doesn't permanently
// starve the sync — and every attempt now logs explicitly, so a stuck sign-in is diagnosable from
// the console instead of failing silently.
const SYNC_MAX_ATTEMPTS = 10;
const SYNC_RETRY_DELAY_MS = 6000;
const ACTIVE_FETCH_MAX_ATTEMPTS = 3;

function SessionSyncer() {
  const { authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { identityToken } = useIdentityToken();
  const queryClient = useQueryClient();
  const syncedAddressRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const activeFetchAttemptsRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  // Only used to decide *whether* to (re-)sync — the address actually trusted for the session is
  // whatever the server derives from the verified identityToken below, not this value. Resolved
  // from the embedded wallet specifically (never `wallets[0]`/`user.wallet`, which can resolve to
  // an externally-linked wallet — see usePrivyWalletClient.ts) so this never triggers a sync loop
  // keyed off an address the rest of the app doesn't actually sign with.
  const activeAddress = getEmbeddedConnectedWallet(wallets)?.address;

  useEffect(() => {
    if (!authenticated || !activeAddress) {
      if (syncedAddressRef.current) {
        syncedAddressRef.current = null;
        attemptRef.current = 0;
        activeFetchAttemptsRef.current = 0;
        void clearAppUserSession(queryClient);
      } else if (attemptRef.current || activeFetchAttemptsRef.current) {
        attemptRef.current = 0;
        activeFetchAttemptsRef.current = 0;
      }
      return;
    }

    if (syncedAddressRef.current === activeAddress) return;

    let cancelled = false;

    const scheduleRetryOrGiveUp = () => {
      if (attemptRef.current < SYNC_MAX_ATTEMPTS) {
        attemptRef.current += 1;
        console.warn(`Privy session sync: not ready yet, retrying (${attemptRef.current}/${SYNC_MAX_ATTEMPTS}) in ${SYNC_RETRY_DELAY_MS}ms`);
        setTimeout(() => {
          if (!cancelled) setRetryTick((t) => t + 1);
        }, SYNC_RETRY_DELAY_MS);
      } else {
        // Privy says authenticated (e.g. a stale/lingering session from an earlier attempt) but
        // we never got a usable identity token or a successful privy-verify call — observed
        // causes in practice: Privy's own API rate-limiting, nothing under our control. Leaving
        // `authenticated` true here strands the sign-in button permanently on a disabled "Signing
        // in…" with no way out, since Privy's own login() silently no-ops while already
        // authenticated (see useSocialSession's signIn guard). Signing out of Privy's local state
        // resets the button to a normal, clickable "Sign in with Email" so the user isn't stuck.
        console.error(`Giving up on Privy session sync after ${SYNC_MAX_ATTEMPTS} attempts. Signing out locally`);
        void logout();
      }
    };

    (async () => {
      let token = identityToken;
      if (!token && activeFetchAttemptsRef.current < ACTIVE_FETCH_MAX_ATTEMPTS) {
        activeFetchAttemptsRef.current += 1;
        const n = activeFetchAttemptsRef.current;
        try {
          token = await getIdentityToken();
          if (!token) console.warn(`getIdentityToken() returned no token (active attempt ${n}/${ACTIVE_FETCH_MAX_ATTEMPTS})`);
        } catch (err) {
          console.error(`getIdentityToken() threw (active attempt ${n}/${ACTIVE_FETCH_MAX_ATTEMPTS}):`, err);
        }
      }
      if (cancelled) return;

      if (!token) {
        scheduleRetryOrGiveUp();
        return;
      }

      try {
        const res = await fetch("/api/social/auth/privy-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identityToken: token }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`privy-verify failed (${res.status})`);
        // Only mark this address "done" on success. Marking it before the request resolves (the
        // previous approach) meant a single transient failure permanently wedged sign-in for the
        // rest of the tab's life, since the effect would never attempt this address again.
        syncedAddressRef.current = activeAddress;
        attemptRef.current = 0;
        await queryClient.invalidateQueries({ queryKey: SOCIAL_SESSION_QUERY_KEY });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to sync Privy session (privy-verify request):", err);
        scheduleRetryOrGiveUp();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, activeAddress, identityToken, queryClient, logout, retryTick]);

  return null;
}

export function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSecure(window.isSecureContext);
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set. Set your Privy App ID in .env from dashboard.privy.io.");
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            // "all-users" (not "users-without-wallets"): login is email-only and every custody
            // assumption in this app is built around the embedded wallet existing, so an account
            // that happens to have an externally-linked wallet (e.g. a MetaMask extension linked
            // during earlier testing, before login was locked to email) must still get its own
            // embedded wallet — otherwise usePrivyWalletClient.ts has nothing to resolve to and
            // signing silently has no wallet to work with, for that account specifically.
            createOnLogin: isSecure ? "all-users" : "off",
          },
        },
        // Without these, Privy defaults an embedded wallet to Ethereum mainnet (chain id 1) and
        // has no notion of this app's own testnets — usePrivyWalletClient.ts's switchChain() call
        // would itself fail for any chain not listed here. defaultChain is the chain a freshly
        // created embedded wallet starts on; keep it in sync with SELECTABLE_CHAINS in
        // lib/chains.ts (Monad Mainnet only, for now).
        defaultChain: MONAD_MAINNET.viemChain,
        supportedChains: ALL_CHAINS.map((c) => c.viemChain),
      }}
    >
      <SessionSyncer />
      {children}
    </PrivyProvider>
  );
}
