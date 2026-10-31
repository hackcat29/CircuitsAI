import { NextResponse, type NextRequest } from "next/server";

// The Cloudflare-deployed build ships frontend routes only — its Cloudflare build
// (scripts/build-cf.mjs) strips src/app/api entirely to stay under the Workers size
// limit. API_PROXY_TARGET points /api/* at the real backend (apps/web running on EC2)
// instead. Reading it here (at request time) rather than baking a destination into
// next.config.ts's rewrites() means setting/changing the Cloudflare env var takes
// effect immediately, no rebuild needed — matching the "deploy frontend now, point it
// at EC2 once that's up" rollout plan. Unset in local dev and in the EC2 deployment
// itself, where the real src/app/api routes handle these requests directly.
//
// Also handles app.circuitsprotocol.com: every internal link points at clean paths like
// /dashboard or /agents/foo-4 (see lib/nav.ts, lib/agentSlug.ts), but the actual Next.js
// routes still physically live under src/app/app/* — moving ~50 files just to drop one path
// segment would churn history for no functional gain, so this transparently adds the /app
// prefix back on the way in for that subdomain only. circuitsprotocol.com's own old /app/*
// links (bookmarks from before this subdomain existed) get a real redirect instead, handled
// host-conditionally in next.config.ts's redirects(), which runs before this.
//
// Deliberately still named/exported as "middleware", not the newer "proxy" convention Next.js
// 16 nudges toward (cosmetic deprecation warning in local dev only): "proxy" doesn't allow
// declaring `runtime: "edge"` in this Next.js version, and always compiles to what
// @opennextjs/cloudflare calls "Node.js middleware" — which its Cloudflare Workers build
// hard-rejects outright (real ecosystem gap, not a config mistake). "middleware" still
// defaults to Edge and is still fully supported, just soft-deprecated — reassess this if/when
// @opennextjs/cloudflare adds proxy support.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let retiredPath: string;
  try { retiredPath = decodeURIComponent(pathname); } catch { return new NextResponse("Invalid path", { status: 400 }); }
  const retainedSafetyAction = /^\/api\/degen\/agents\/[^/]+\/[^/]+\/(?:kill|wallets\/[^/]+\/withdraw)$/.test(retiredPath);
  if (!retainedSafetyAction && (/^\/(?:app\/)?(?:launchpad|degen)(?:\/|$)/.test(retiredPath) || /^\/api\/(?:launchpad|degen)(?:\/|$)/.test(retiredPath))) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (pathname.startsWith("/api/")) {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return NextResponse.next();
    return NextResponse.rewrite(new URL(pathname + search, target));
  }

  const hostname = request.headers.get("host") ?? "";
  if ((hostname.startsWith("app.") || hostname.startsWith("monad.")) && !pathname.startsWith("/app")) {
    return NextResponse.rewrite(new URL(`/app${pathname}${search}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/|favicon.ico|logo.png|icon.png|apple-icon.png|robots.txt).*)"],
};
