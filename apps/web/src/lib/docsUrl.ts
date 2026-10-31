// The GitBook-hosted documentation site, kept in its own repo (circuits-protocol-docs) separate
// from this app. Always the real public docs domain, never request-derived — same reasoning as
// APP_ORIGIN in appUrl.ts.
const DOCS_ORIGIN = "https://docs.circuitsprotocol.com";

export const DOCS_URL = DOCS_ORIGIN;

export function docsUrl(path: string = ""): string {
  if (!path) return DOCS_ORIGIN;
  return `${DOCS_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
