import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { ClawDB } from "@clawdb/sdk";
import { openDatabase } from "./db.js";
import type { ChainId, ChainIdentity, ClawDbLike, ClawMemConfig, MemoryEntry } from "./types.js";

export class ClawMem {
  private readonly db: Database.Database;
  private readonly clawdbConfig: { endpoint?: string; apiKey?: string; workspaceId?: string };
  private readonly clawDbFactory: (agentId: string) => ClawDbLike;
  private readonly clawDbClients = new Map<string, ClawDbLike>();

  /** `clawDbFactory` is an injection seam for tests — production code should leave it unset. */
  constructor(config: ClawMemConfig = {}, clawDbFactory?: (agentId: string) => ClawDbLike) {
    this.db = openDatabase(config.databaseUrl);
    this.clawdbConfig = {
      endpoint: config.clawdb?.endpoint ?? process.env.CLAWDB_ENDPOINT,
      apiKey: config.clawdb?.apiKey ?? process.env.CLAWDB_API_KEY,
      workspaceId: config.clawdb?.workspaceId ?? process.env.CLAWDB_WORKSPACE_ID,
    };
    this.clawDbFactory = clawDbFactory ?? ((agentId) => this.createClawDbClient(agentId));
  }

  private createClawDbClient(agentId: string): ClawDbLike {
    if (!this.clawdbConfig.apiKey) {
      const localStore = new Map<string, { id: string; content: string; memoryType: string; tags: string[] }>();
      return {
        rememberTyped: async (content: string, opts?: { type?: string; tags?: string[]; metadata?: Record<string, unknown> }) => {
          const id = randomUUID();
          localStore.set(id, { id, content, memoryType: opts?.type ?? "default", tags: opts?.tags ?? [] });
          return id;
        },
        updateMemory: async (memoryId: string, content: string) => {
          const existing = localStore.get(memoryId);
          if (existing) {
            existing.content = content;
          } else {
            localStore.set(memoryId, { id: memoryId, content, memoryType: "default", tags: [] });
          }
          return true;
        },
        recall: async (memoryIds: string[]) => {
          return memoryIds.map((id) => localStore.get(id)).filter(Boolean) as any[];
        },
        deleteMemory: async (memoryId: string) => {
          return localStore.delete(memoryId);
        },
        search: async (query: string) => {
          const q = query.toLowerCase();
          const hits: any[] = [];
          for (const rec of localStore.values()) {
            if (rec.content.toLowerCase().includes(q)) {
              hits.push({ ...rec, score: 1.0, metadata: {}, createdAt: new Date() });
            }
          }
          return hits;
        },
        close: () => {
          localStore.clear();
        },
      };
    }
    const client = new ClawDB({ ...this.clawdbConfig, agentId });
    // ClawDB extends EventEmitter and emits "error" on gRPC connectivity failures;
    // an unhandled listener would crash the process.
    client.on("error", (error: Error) => {
      console.warn(`[clawmem] ClawDB connectivity error for agent ${agentId}: ${error.message}`);
    });
    return client;
  }

  close(): void {
    for (const client of this.clawDbClients.values()) client.close();
    this.clawDbClients.clear();
    this.db.close();
  }

  // === agent identity (local — never delegated to ClawDB) ===

  registerAgent(agentKey: string, name?: string): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO agents (agent_key, name, created_at) VALUES (?, ?, ?)`)
      .run(agentKey, name ?? null, Date.now());
  }

  linkChainIdentity(agentKey: string, chain: ChainId, chainAgentId: string, address: string): void {
    this.registerAgent(agentKey);
    this.db
      .prepare(
        `INSERT INTO chain_identities (agent_key, chain, chain_agent_id, address, linked_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chain, chain_agent_id) DO UPDATE SET agent_key = excluded.agent_key, address = excluded.address`,
      )
      .run(agentKey, chain, chainAgentId, address, Date.now());
  }

  resolveAgentKey(chain: ChainId, chainAgentId: string): string | undefined {
    const row = this.db
      .prepare(`SELECT agent_key FROM chain_identities WHERE chain = ? AND chain_agent_id = ?`)
      .get(chain, chainAgentId) as { agent_key: string } | undefined;
    return row?.agent_key;
  }

  getChainIdentities(agentKey: string): ChainIdentity[] {
    const rows = this.db
      .prepare(`SELECT chain, chain_agent_id, address, linked_at FROM chain_identities WHERE agent_key = ?`)
      .all(agentKey) as { chain: ChainId; chain_agent_id: string; address: string; linked_at: number }[];
    return rows.map((row) => ({
      chain: row.chain,
      chainAgentId: row.chain_agent_id,
      address: row.address,
      linkedAt: row.linked_at,
    }));
  }

  // === memory (content lives in ClawDB; sqlite only keeps a (namespace, key) -> memoryId pointer) ===

  private getClawDbAgentId(agentKey: string): string {
    this.registerAgent(agentKey);
    const row = this.db.prepare(`SELECT clawdb_agent_id FROM agents WHERE agent_key = ?`).get(agentKey) as
      | { clawdb_agent_id: string | null }
      | undefined;
    if (row?.clawdb_agent_id) return row.clawdb_agent_id;

    const clawdbAgentId = randomUUID();
    this.db.prepare(`UPDATE agents SET clawdb_agent_id = ? WHERE agent_key = ?`).run(clawdbAgentId, agentKey);
    return clawdbAgentId;
  }

  private getClawDbClient(agentKey: string): ClawDbLike {
    const existing = this.clawDbClients.get(agentKey);
    if (existing) return existing;

    const client = this.clawDbFactory(this.getClawDbAgentId(agentKey));
    this.clawDbClients.set(agentKey, client);
    return client;
  }

  private getPointer(agentKey: string, namespace: string, key: string): PointerRow | undefined {
    return this.db
      .prepare(`SELECT * FROM memory_pointers WHERE agent_key = ? AND namespace = ? AND key = ?`)
      .get(agentKey, namespace, key) as PointerRow | undefined;
  }

  async remember<T>(agentKey: string, namespace: string, key: string, value: T): Promise<void> {
    const client = this.getClawDbClient(agentKey);
    const serialized = JSON.stringify(value);
    const now = Date.now();
    const existing = this.getPointer(agentKey, namespace, key);

    if (existing) {
      await client.updateMemory(existing.clawdb_memory_id, serialized);
      this.db
        .prepare(`UPDATE memory_pointers SET updated_at = ? WHERE agent_key = ? AND namespace = ? AND key = ?`)
        .run(now, agentKey, namespace, key);
      return;
    }

    const memoryId = await client.rememberTyped(serialized, { type: namespace, metadata: { key } });
    this.db
      .prepare(
        `INSERT INTO memory_pointers (agent_key, namespace, key, clawdb_memory_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(agentKey, namespace, key, memoryId, now, now);
  }

  async recall<T>(agentKey: string, namespace: string, key: string): Promise<T | undefined> {
    const pointer = this.getPointer(agentKey, namespace, key);
    if (!pointer) return undefined;

    const client = this.getClawDbClient(agentKey);
    const [record] = await client.recall([pointer.clawdb_memory_id]);
    return record ? (JSON.parse(record.content) as T) : undefined;
  }

  async forget(agentKey: string, namespace: string, key: string): Promise<void> {
    const pointer = this.getPointer(agentKey, namespace, key);
    if (!pointer) return;

    const client = this.getClawDbClient(agentKey);
    await client.deleteMemory(pointer.clawdb_memory_id);
    this.db
      .prepare(`DELETE FROM memory_pointers WHERE agent_key = ? AND namespace = ? AND key = ?`)
      .run(agentKey, namespace, key);
  }

  async list(agentKey: string, namespace?: string): Promise<MemoryEntry[]> {
    const rows = namespace
      ? (this.db
          .prepare(`SELECT * FROM memory_pointers WHERE agent_key = ? AND namespace = ? ORDER BY updated_at DESC`)
          .all(agentKey, namespace) as PointerRow[])
      : (this.db
          .prepare(`SELECT * FROM memory_pointers WHERE agent_key = ? ORDER BY updated_at DESC`)
          .all(agentKey) as PointerRow[]);

    if (!rows.length) return [];

    const client = this.getClawDbClient(agentKey);
    const records = await client.recall(rows.map((row) => row.clawdb_memory_id));
    const contentById = new Map(records.map((record) => [record.id, record.content]));

    const entries: MemoryEntry[] = [];
    for (const row of rows) {
      const content = contentById.get(row.clawdb_memory_id);
      if (content === undefined) continue; // deleted upstream out of band
      entries.push(toMemoryEntry(row, content));
    }
    return entries;
  }

  /** Real semantic search via ClawDB, scoped to this agent's namespace. ClawDB has no
   * first-class concept of our namespace, so it's stored as `memoryType` on write and
   * filtered client-side here (overfetching to absorb hits from other namespaces). */
  async search(agentKey: string, namespace: string, query: string, topK = 5): Promise<MemoryEntry[]> {
    const client = this.getClawDbClient(agentKey);
    const hits = await client.search(query, { topK: Math.min(topK * 4, 50), semantic: true });
    const matches = hits.filter((hit) => hit.memoryType === namespace).slice(0, topK);
    if (!matches.length) return [];

    const pointersByMemoryId = new Map(
      (
        this.db
          .prepare(`SELECT * FROM memory_pointers WHERE agent_key = ? AND namespace = ?`)
          .all(agentKey, namespace) as PointerRow[]
      ).map((row) => [row.clawdb_memory_id, row]),
    );

    const entries: MemoryEntry[] = [];
    for (const hit of matches) {
      const pointer = pointersByMemoryId.get(hit.id);
      if (!pointer) continue; // pointer row missing/stale relative to ClawDB
      entries.push(toMemoryEntry(pointer, hit.content));
    }
    return entries;
  }

  async clearAgent(agentKey: string): Promise<void> {
    const pointers = this.db
      .prepare(`SELECT clawdb_memory_id FROM memory_pointers WHERE agent_key = ?`)
      .all(agentKey) as { clawdb_memory_id: string }[];

    if (pointers.length) {
      const client = this.getClawDbClient(agentKey);
      await Promise.all(pointers.map((pointer) => client.deleteMemory(pointer.clawdb_memory_id)));
    }

    this.clawDbClients.get(agentKey)?.close();
    this.clawDbClients.delete(agentKey);

    this.db.prepare(`DELETE FROM memory_pointers WHERE agent_key = ?`).run(agentKey);
    this.db.prepare(`DELETE FROM chain_identities WHERE agent_key = ?`).run(agentKey);
    this.db.prepare(`DELETE FROM agents WHERE agent_key = ?`).run(agentKey);
  }
}

interface PointerRow {
  agent_key: string;
  namespace: string;
  key: string;
  clawdb_memory_id: string;
  created_at: number;
  updated_at: number;
}

function toMemoryEntry(row: PointerRow, content: string): MemoryEntry {
  return {
    agentKey: row.agent_key,
    namespace: row.namespace,
    key: row.key,
    value: JSON.parse(content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
