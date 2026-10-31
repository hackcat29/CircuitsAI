import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClawMem } from "./client.js";
import type { ClawDbLike } from "./types.js";

/** In-memory stand-in for `@clawdb/sdk`'s `ClawDB` client, scoped to a single agent
 * the same way a real client is — tests never touch a gRPC connection. */
class FakeClawDb implements ClawDbLike {
  private readonly store = new Map<string, { content: string; type: string; tags: string[] }>();
  private nextId = 0;

  async rememberTyped(content: string, opts: { type?: string; tags?: string[] } = {}): Promise<string> {
    const id = `mem_${this.nextId++}`;
    this.store.set(id, { content, type: opts.type ?? "default", tags: opts.tags ?? [] });
    return id;
  }

  async updateMemory(memoryId: string, content: string): Promise<boolean> {
    const existing = this.store.get(memoryId);
    if (!existing) return false;
    existing.content = content;
    return true;
  }

  async recall(memoryIds: string[]) {
    return memoryIds.flatMap((id) => {
      const entry = this.store.get(id);
      return entry ? [{ id, content: entry.content, memoryType: entry.type, tags: entry.tags }] : [];
    });
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    return this.store.delete(memoryId);
  }

  async search(query: string, opts: { topK?: number } = {}) {
    const topK = opts.topK ?? 5;
    return [...this.store.entries()]
      .filter(([, entry]) => entry.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, topK)
      .map(([id, entry]) => ({
        id,
        content: entry.content,
        score: 1,
        memoryType: entry.type,
        tags: entry.tags,
        metadata: {},
        createdAt: new Date(),
      }));
  }

  close(): void {}
}

describe("ClawMem", () => {
  let mem: ClawMem;

  beforeEach(() => {
    mem = new ClawMem({ databaseUrl: ":memory:" }, () => new FakeClawDb());
  });

  afterEach(() => {
    mem.close();
  });

  it("remembers and recalls a value scoped by agent and namespace", async () => {
    mem.registerAgent("agent-1", "Agent One");
    await mem.remember("agent-1", "conversation", "greeting", { text: "hello" });

    expect(await mem.recall("agent-1", "conversation", "greeting")).toEqual({ text: "hello" });
    expect(await mem.recall("agent-1", "conversation", "missing")).toBeUndefined();
    expect(await mem.recall("agent-2", "conversation", "greeting")).toBeUndefined();
  });

  it("overwrites an existing key on remember and updates updatedAt", async () => {
    await mem.remember("agent-1", "task", "status", "pending");
    const [first] = await mem.list("agent-1", "task");

    await mem.remember("agent-1", "task", "status", "done");
    const [second] = await mem.list("agent-1", "task");

    expect(await mem.recall("agent-1", "task", "status")).toBe("done");
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
  });

  it("forgets a key", async () => {
    await mem.remember("agent-1", "note", "draft", "v1");
    await mem.forget("agent-1", "note", "draft");
    expect(await mem.recall("agent-1", "note", "draft")).toBeUndefined();
  });

  it("lists memories scoped by namespace", async () => {
    await mem.remember("agent-1", "task", "a", 1);
    await mem.remember("agent-1", "task", "b", 2);
    await mem.remember("agent-1", "note", "c", 3);

    expect(await mem.list("agent-1", "task")).toHaveLength(2);
    expect(await mem.list("agent-1")).toHaveLength(3);
  });

  it("searches by content within a namespace via the ClawDB client", async () => {
    await mem.remember("agent-1", "task", "a", "deploy at 3pm");
    await mem.remember("agent-1", "task", "b", "review pull request");
    await mem.remember("agent-1", "note", "c", "deploy notes");

    const results = await mem.search("agent-1", "task", "deploy");
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe("a");
  });

  it("links and resolves cross-chain identities", () => {
    mem.registerAgent("agent-1", "Agent One");
    mem.linkChainIdentity("agent-1", "bsc", "42", "0xabc");
    mem.linkChainIdentity("agent-1", "solana", "7", "SoLanaAddr");

    expect(mem.resolveAgentKey("bsc", "42")).toBe("agent-1");
    expect(mem.resolveAgentKey("solana", "7")).toBe("agent-1");
    expect(mem.resolveAgentKey("sui", "99")).toBeUndefined();

    const identities = mem.getChainIdentities("agent-1");
    expect(identities).toHaveLength(2);
    expect(identities.map((i) => i.chain).sort()).toEqual(["bsc", "solana"]);
  });

  it("re-linking the same (chain, chainAgentId) pair repoints to the new agent", () => {
    mem.linkChainIdentity("agent-1", "bsc", "42", "0xabc");
    mem.linkChainIdentity("agent-2", "bsc", "42", "0xdef");

    expect(mem.resolveAgentKey("bsc", "42")).toBe("agent-2");
  });

  it("clearAgent removes memories, identities, and the agent row", async () => {
    mem.registerAgent("agent-1", "Agent One");
    mem.linkChainIdentity("agent-1", "bsc", "42", "0xabc");
    await mem.remember("agent-1", "task", "a", 1);

    await mem.clearAgent("agent-1");

    expect(await mem.list("agent-1")).toHaveLength(0);
    expect(mem.getChainIdentities("agent-1")).toHaveLength(0);
    expect(mem.resolveAgentKey("bsc", "42")).toBeUndefined();
  });
});
