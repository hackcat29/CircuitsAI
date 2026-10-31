"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CookiesProvider } from "react-cookie";
import { wagmiConfig } from "@/lib/wagmi";

// Human authentication and user EVM wallets use Privy (Email Login). WagmiProvider stays
// because usePublicClient (plain RPC reads, no wallet needed) is still used throughout.
//
// { ssr: false }, not a static import: @privy-io/react-auth bundles support for every wallet
// connector/login method it offers regardless of this app's loginMethods: ["email"] config (the
// SDK can't statically tree-shake around a runtime config value), which alone pushed the
// Cloudflare Worker bundle from ~11.5MB to over 21MB — past even the paid-plan 10MB hard limit.
// Next.js SSRs "use client" components on the initial server render by default, which is why a
// heavy client-only package still counts against the *server* Worker's bundle size; ssr:false is
// the documented way to keep a browser-only-relevant dependency out of that server bundle
// entirely, at the cost of this provider (and anything nested under it) only mounting after
// client JS loads instead of appearing in the initial server-rendered HTML. Acceptable here since
// every /app/* page already relies on client-side data-fetching for its actual content — there's
// no server-rendered content under this provider that SSR was doing useful work for regardless.
const PrivyAppProvider = dynamic(() => import("@/lib/privy/PrivyAppProvider").then((m) => m.PrivyAppProvider), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <CookiesProvider defaultSetOptions={{ path: "/" }}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <PrivyAppProvider>{children}</PrivyAppProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </CookiesProvider>
  );
}
