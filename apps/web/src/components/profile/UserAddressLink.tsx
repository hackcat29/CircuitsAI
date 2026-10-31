"use client";

import Link from "next/link";
import { useWalletSocialProfile } from "@/hooks";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

interface UserAddressLinkProps {
  address?: string | null;
  className?: string;
  prefix?: string;
  showAtPrefix?: boolean;
  fallback?: string;
  badge?: boolean;
  asSpan?: boolean;
}

export function UserAddressLink({
  address,
  className,
  prefix = "",
  showAtPrefix = true,
  fallback = "Anonymous",
  badge = false,
  asSpan = false,
}: UserAddressLinkProps) {
  const { data } = useWalletSocialProfile(address ?? undefined);
  const profile = data?.profile;

  if (!address) {
    return <span className={cn("text-text-quaternary font-mono text-xs", className)}>{fallback}</span>;
  }

  const username = profile?.username;
  const displayName = profile?.displayName;
  const label = username
    ? `${showAtPrefix ? "@" : ""}${username}`
    : displayName || truncateAddress(address);

  if (asSpan) {
    return (
      <span
        className={cn("font-mono text-text-secondary inline-flex items-center gap-1", className)}
        title={username ? `@${username} (${address})` : address}
      >
        {prefix && <span className="text-text-quaternary select-none">{prefix}</span>}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  // Link directly to the public profile route
  const href = username ? `/${username}` : `/${address}`;

  return (
    <Link
      href={href}
      className={cn(
        "font-mono text-text-secondary hover:text-accent-violet transition-colors inline-flex items-center gap-1 group/user",
        badge && "px-2 py-0.5 rounded-md bg-bg-surface2 border border-border-subtle hover:border-accent-violet/40 text-xs",
        className
      )}
      title={username ? `@${username} (${address})` : address}
    >
      {prefix && <span className="text-text-quaternary select-none">{prefix}</span>}
      <span className="group-hover/user:underline truncate">{label}</span>
    </Link>
  );
}
