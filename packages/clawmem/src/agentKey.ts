/** The canonical way to derive a ClawMem `agentKey` for a Circuits agent identified by
 * `(chain, chainAgentId)`, without going through `linkChainIdentity`/`resolveAgentKey` — that
 * machinery is for resolving an *unknown* chain identity down to a canonical agent, but a
 * `(chain, chainAgentId)` pair is already unique on its own. Every writer and reader of a given
 * agent's memory must derive the same key through this function — duplicating this string
 * concatenation independently in each caller risks the two sides silently drifting apart, which
 * would make every read return empty with no error. */
export function memoryAgentKey(chain: string, chainAgentId: string): string {
  return `${chain}:${chainAgentId}`;
}
