"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, Mail, Wallet, LogOut } from "lucide-react";
import { useSocialSession } from "@/hooks";
import { truncateAddress } from "@/lib/format";
import { Button } from "@/components/ui";

/** Sign-in uses Privy (Email Login). The profile dropdown shows avatar, display name, email,
 * direct link to public profile page, link to wallet, and sign out button. */
export function WalletButton() {
  const { profile, signOut, signIn, ready, signingIn } = useSocialSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (profile) {
    const buttonLabel = profile.username
      ? `@${profile.username}`
      : profile.displayName ?? truncateAddress(profile.walletAddress ?? "");

    const profilePath = profile.username ? `/${profile.username}` : "/wallet";

    return (
      <div className="relative" ref={ref}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11.5px] sm:text-xs gap-1.5 cursor-pointer max-w-32 sm:max-w-40 xl:max-w-48 px-2 sm:px-2.5 h-8 shrink-0"
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
          ) : (
            <User className="h-3.5 w-3.5 text-accent-violet shrink-0" />
          )}
          <span className="truncate max-w-22 sm:max-w-28 xl:max-w-36">{buttonLabel}</span>
        </Button>

        {open && (
          <div className="absolute top-[calc(100%+8px)] right-0 z-20 w-64 rounded-[14px] border border-border-strong bg-bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-3 animate-fadeIn">
            {/* Header Identity */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-bg-surface3">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-text-tertiary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-text-primary truncate">
                  {profile.displayName || (profile.username ? `@${profile.username}` : truncateAddress(profile.walletAddress ?? ""))}
                </div>
                {profile.email && (
                  <div className="font-mono text-[10.5px] text-text-tertiary truncate flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3 w-3 text-accent-violet shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                )}
              </div>
            </div>

            {profile.bio && <p className="text-[11px] text-text-secondary mb-2.5 px-1 line-clamp-2">{profile.bio}</p>}

            {/* Quick Actions */}
            <div className="space-y-0.5 border-t border-border-subtle pt-2">
              <Link
                href={profilePath}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.75 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors cursor-pointer"
              >
                <User className="h-3.5 w-3.5 text-accent-violet" />
                <span>View Profile</span>
              </Link>

              <Link
                href="/wallet"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.75 rounded-lg text-[12px] font-semibold text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5 text-text-tertiary" />
                <span>View Wallet →</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="w-full flex items-center gap-2 text-left px-2.5 py-1.75 rounded-lg text-[12px] font-bold text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <Button
        size="sm"
        disabled={!ready || signingIn}
        onClick={signIn}
        className="px-2.5 sm:px-3 text-xs cursor-pointer"
      >
        <Mail className="h-3.5 w-3.5 mr-1 text-accent-violet" />
        <span>{signingIn ? "Signing in…" : "Sign In"}</span>
      </Button>
    </div>
  );
}
