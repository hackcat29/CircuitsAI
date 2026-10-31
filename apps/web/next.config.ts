import type { NextConfig } from "next";
import * as dotenv from "dotenv";
import path from "node:path";

// ClawdHQ uses a single root-level .env shared across all packages and apps.
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Pin the workspace root to the ClawdHQ monorepo (pnpm-workspace.yaml lives
  // here) rather than letting Next.js infer it from the home directory's
  // unrelated package-lock.json.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // @prisma/client is auto-externalized by Next.js's built-in list, but a workspace package
  // wrapping a *custom-output* generated Prisma client (packages/social-db, packages/degen-db —
  // both use their own output dir instead of node_modules/@prisma/client, see either package's
  // prisma/schema.prisma) isn't, so Next's file tracer over-traces the whole project trying
  // to follow the generated client's dynamic native-binary lookup. Opting it out of bundling
  // and letting Node `require()` it directly, like @prisma/client itself, is the same fix
  // Next's own docs recommend for exactly this case.
  serverExternalPackages: ["@clawdhq/social-db", "@clawdhq/degen-db", "@clawdhq/custody-db", "@clawdhq/custody-core"],
  // /about's content moved to become the new marketing homepage (src/app/(marketing)/page.tsx) —
  // redirect rather than leave a stale/duplicate page, so existing inbound links keep working.
  //
  // The dashboard/app section moved from circuitsprotocol.com/app/* to its own subdomain,
  // app.circuitsprotocol.com/* (see middleware.ts for the matching rewrite that makes the
  // subdomain actually serve those routes). This sends old /app/* bookmarks/shared links on the
  // apex domain to their new home instead of 404ing — host-conditional so app.circuitsprotocol.com
  // itself (which legitimately serves /app/* internally, rewritten from clean paths) never
  // matches this rule and redirect-loops.
  async redirects() {
    return [
      { source: "/about", destination: "/", permanent: true },
      {
        source: "/social",
        has: [{ type: "host", value: "app.circuitsprotocol.com" }],
        destination: "https://www.clawdhq.xyz/home",
        permanent: false,
      },
      {
        source: "/app/social",
        destination: "https://www.clawdhq.xyz/home",
        permanent: false,
      },
      {
        source: "/app/:path*",
        has: [{ type: "host", value: "circuitsprotocol.com" }],
        destination: "https://app.circuitsprotocol.com/:path*",
        permanent: true,
      },
      // www.circuitsprotocol.com is bound to this same Worker (wrangler.jsonc) purely so it's
      // reachable at all (it had no DNS record before) — canonical host is the bare apex, so
      // every path gets sent straight there rather than silently duplicate-serving the app
      // under a second hostname. Two rules, not one `/:path*` (zero-or-more): this version's
      // redirects() leaves the `:path*` placeholder in `destination` un-substituted — literally
      // "https://circuitsprotocol.com/:path*" — when it matches zero segments (i.e. exactly
      // "/"), so the root itself needs its own non-templated rule; `:path+` (one-or-more) for
      // everything else never hits that empty-match case.
      {
        source: "/",
        has: [{ type: "host", value: "www.circuitsprotocol.com" }],
        destination: "https://circuitsprotocol.com/",
        permanent: true,
      },
      {
        source: "/:path+",
        has: [{ type: "host", value: "www.circuitsprotocol.com" }],
        destination: "https://circuitsprotocol.com/:path+",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
