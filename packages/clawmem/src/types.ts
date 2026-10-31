export type ChainId = "bsc" | "base" | "eth" | "solana" | "sui";

export interface ChainIdentity {
  chain: ChainId;
  chainAgentId: string;
  address: string;
  linkedAt: number;
}

export interface MemoryEntry<T = unknown> {
  agentKey: string;
  namespace: string;
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
}

interface ClawDbRecord {
  id: string;
  content: string;
  memoryType: string;
  tags: string[];
}

interface ClawDbSearchHit extends ClawDbRecord {
  score: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** The subset of `@clawdb/sdk`'s `ClawDB` client that `ClawMem` actually calls.
 * Lets tests inject a fake in place of a real gRPC connection. */
export interface ClawDbLike {
  rememberTyped(
    content: string,
    opts?: { type?: string; tags?: string[]; metadata?: Record<string, unknown> },
  ): Promise<string>;
  updateMemory(memoryId: string, content: string): Promise<boolean>;
  recall(memoryIds: string[]): Promise<ClawDbRecord[]>;
  deleteMemory(memoryId: string): Promise<boolean>;
  search(query: string, opts?: { topK?: number; semantic?: boolean }): Promise<ClawDbSearchHit[]>;
  close(): void;
}

export interface ClawMemConfig {
  /** Defaults to `CLAWMEM_DATABASE_URL`, e.g. `file:./data/clawmem.db`. */
  databaseUrl?: string;
  /** Connection settings for the ClawDB instance backing `remember`/`recall`/`search`.
   * Chain-identity resolution stays local to this package regardless of these settings. */
  clawdb?: {
    /** Defaults to `CLAWDB_ENDPOINT`. */
    endpoint?: string;
    /** Defaults to `CLAWDB_API_KEY`. */
    apiKey?: string;
    /** Defaults to `CLAWDB_WORKSPACE_ID`. */
    workspaceId?: string;
  };
}
