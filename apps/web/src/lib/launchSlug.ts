/** Builds a URL-friendly identifier for a launch's detail page: the token symbol, slugified,
 * with the real on-chain launchChainId appended as a suffix — e.g. "chad-2". The numeric suffix
 * is what actually resolves the launch (see parseLaunchSlug); the symbol prefix is purely
 * cosmetic/readable. Appending the id (rather than relying on the symbol alone) sidesteps any
 * need to enforce symbol uniqueness, which ClawdHQLaunchpad.sol doesn't do — two launches can
 * legitimately share a symbol. */
export function launchSlug(symbol: string, launchChainId: string): string {
  const base = symbol
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${launchChainId}` : launchChainId;
}

/** Inverse of launchSlug — extracts the real launchChainId from a "symbol-123" slug. Also
 * accepts a bare numeric id directly, so an old bookmarked/shared link (from before slugs
 * existed) or a caller with no symbol handy keeps working unchanged. */
export function parseLaunchSlug(slugOrId: string): string {
  if (/^\d+$/.test(slugOrId)) return slugOrId;
  const match = slugOrId.match(/-(\d+)$/);
  return match ? match[1] : slugOrId;
}
