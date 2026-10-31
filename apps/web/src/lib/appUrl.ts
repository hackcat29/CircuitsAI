// The authenticated app moved to its own subdomain (app.circuitsprotocol.com) while marketing
// pages stayed on the bare domain (circuitsprotocol.com) — see next.config.ts's host-conditional
// redirect and middleware.ts's host-based rewrite. A relative Next Link from a marketing page
// can't reach it: the path either 404s (no route exists at the bare path on this host, e.g.
// "/dashboard") or, worse, silently resolves to the marketing page for that same slug instead
// (e.g. "/marketplace" hits (marketing)/[slug]/page.tsx, not the real app). Every marketing CTA
// that's meant to launch into the real app needs this absolute cross-subdomain link instead.
//
// Always the real public domain, never request-derived — same reasoning as the
// CIRCUITS_PROTOCOL_APP_URL constant in the clawdhq API route.
const APP_ORIGIN = "https://app.circuitsprotocol.com";

export function appUrl(path: string): string {
  return `${APP_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
