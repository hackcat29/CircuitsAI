import { randomUUID } from "node:crypto";
import { ClawMem, memoryAgentKey } from "@clawdhq/clawmem";
import type { Chain } from "@clawdhq/custody-db";
import type { AgentAction } from "./llmClient.js";

// Backs both the write side (recordTickMemory) and read side (summarizeRecentMemory) of a hosted
// agent's own tick history — the prerequisite for the knowledge marketplace's MEMORY contribution
// type to have anything real to sell: nothing in this codebase wrote to ClawMem before this file
// existed. Both sides key off memoryAgentKey(chain, agentChainId) — the same helper the knowledge
// resolve route (apps/web) reads through, so a paid MEMORY resolve actually finds what a tick wrote.
const clawMem = new ClawMem();

const RECENT_MEMORY_LIMIT = 5;

/** Persists one tick's decided action + outcome into the agent's own ClawMem-backed memory,
 * namespaced by action kind — so an owner can later publish one namespace (e.g. "use_knowledge") as
 * a paid MEMORY knowledge contribution without exposing everything (e.g. "x402_payment"). Each write
 * uses a fresh key: `remember` upserts on (agentKey, namespace, key), so a fixed key per namespace
 * would silently overwrite the previous tick's memory instead of accumulating a history.
 * NO_ACTION ticks are the common case (most ticks do nothing) and carry nothing worth remembering,
 * so they're skipped — writing one every tick interval would flood the store with noise. Never
 * throws: a ClawDB hiccup must not fail an otherwise-successful tick whose real action (job posted,
 * payment sent, ...) has already happened by the time this is called. */
export async function recordTickMemory(chain: Chain, agentChainId: string, action: AgentAction, summary: string): Promise<void> {
  if (action.kind === "NO_ACTION" && (!action.postContent || !action.postContent.trim())) return;
  try {
    const namespace = action.kind !== "NO_ACTION" ? action.kind.toLowerCase() : "post";
    await clawMem.remember(memoryAgentKey(chain, agentChainId), namespace, randomUUID(), {
      summary,
      postContent: action.postContent?.trim(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn(`[tickMemory] failed to record tick memory for ${chain}:${agentChainId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Reads an agent's own most-recent tick memories back as prompt text for decideAgentAction — the
 * read-back counterpart to recordTickMemory, so an agent's future decisions are informed by what it
 * actually did, not just its spend log (summarizeRecentActivity, tick.ts). Same never-throws
 * discipline as recordTickMemory: a ClawDB outage means this tick's decision has less context, not
 * that the tick fails outright. */
export async function summarizeRecentMemory(chain: Chain, agentChainId: string): Promise<string> {
  try {
    const entries = await clawMem.list(memoryAgentKey(chain, agentChainId));
    if (!entries.length) return "";

    return entries
      .slice(0, RECENT_MEMORY_LIMIT)
      .map((entry) => {
        const value = entry.value as { summary?: string };
        return `- ${new Date(entry.updatedAt).toISOString()} [${entry.namespace}]: ${value?.summary ?? JSON.stringify(entry.value)}`;
      })
      .join("\n");
  } catch (error) {
    console.warn(`[tickMemory] failed to load recent memory for ${chain}:${agentChainId}: ${error instanceof Error ? error.message : String(error)}`);
    return "";
  }
}
