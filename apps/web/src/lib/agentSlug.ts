/** URL identifier for an agent: a human-readable name slug plus the numeric agentChainId as a
 * disambiguating suffix (e.g. "research-analyst-4"). The numeric id is the only thing that's
 * actually authoritative — names are unique per-chain on-chain (ClawdHQCore.sol's
 * agentIdByNameHash) but NOT unique across chains, and have zero charset validation beyond byte
 * length (case-sensitive, no trim, can contain anything), so a raw name alone can't safely be
 * the whole URL. The slug is purely cosmetic/readable; parsing only ever trusts the trailing id.
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Builds the URL segment for an agent, e.g. agentUrlId("Research Analyst", "4") -> "research-analyst-4". */
export function agentUrlId(name: string, agentChainId: string): string {
  const slug = slugify(name);
  return slug ? `${slug}-${agentChainId}` : agentChainId;
}

/** Recovers the numeric agentChainId from a URL segment produced by agentUrlId, or from a bare
 * legacy numeric id (old links/bookmarks from before names were added to the URL) — always
 * trusts only the trailing digits, ignoring the human-readable prefix entirely. */
export function parseAgentUrlId(param: string): string {
  const match = param.match(/(\d+)$/);
  return match ? match[1] : param;
}
