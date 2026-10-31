import {
  fetchGuarded as guardedFetch,
  fetchPublicJson as guardedFetchPublicJson,
  GuardedFetchError,
  type FetchGuardedOptions,
  type FetchGuardedResult,
} from "@clawdhq/custody-core";
import { ApiError } from "./socialErrors";

export type { FetchGuardedOptions, FetchGuardedResult };

// The actual SSRF/size/time-guarded fetch implementation lives in @clawdhq/custody-core
// (guardedFetch.ts) so packages/custody-core's other consumers — specifically
// agentSkillActions.ts's HTTP-kind skill calls — share exactly one guard implementation with
// this route-facing wrapper, instead of a second copy drifting out of sync. This file's only
// job now is translating that package's portable `GuardedFetchError` into this app's route-level
// `ApiError`, so every existing caller here (agent-import, service-call, agent-call) keeps its
// exact prior behavior.

export async function fetchGuarded(rawUrl: string, options?: FetchGuardedOptions): Promise<FetchGuardedResult> {
  try {
    return await guardedFetch(rawUrl, options);
  } catch (error) {
    if (error instanceof GuardedFetchError) throw new ApiError(error.status, error.message);
    throw error;
  }
}

/** Thin GET wrapper — kept for existing callers (agent-import) so they don't need to know
 * about the more general POST-capable options. */
export async function fetchPublicJson(rawUrl: string): Promise<unknown> {
  try {
    return await guardedFetchPublicJson(rawUrl);
  } catch (error) {
    if (error instanceof GuardedFetchError) throw new ApiError(error.status, error.message);
    throw error;
  }
}
