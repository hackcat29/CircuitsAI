import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fetchGuarded } from "@clawdhq/custody-core";
import { SkillEndpointKind, SkillHttpMethod, type PublishedSkill, type Profile } from "@clawdhq/social-db";
import { ApiError } from "@/lib/server/socialErrors";
import { serializeProfile } from "@/lib/server/socialValidate";

export interface PublishedSkillParam {
  name: string;
  description: string;
  required: boolean;
}

const MAX_PARAMS = 10;
const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Validates the publisher-submitted `{name, description, required}[]` list — same shape
 * hosted-agent-runtime's persona.ts turns into this skill's JSON-Schema tool contract at resolve
 * time (see publishedSkillToInvocation there). `name` is restricted to a valid identifier since
 * it becomes both a JSON-Schema property key and (if referenced as `{name}` in the endpoint URL)
 * a path-substitution token — see agentSkillActions.ts's substitutePathParams. */
export function parsePublishedSkillParams(raw: unknown): PublishedSkillParam[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, "params must be an array");
  if (raw.length > MAX_PARAMS) throw new ApiError(400, `A skill can describe at most ${MAX_PARAMS} parameters`);

  const seen = new Set<string>();
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== "object") throw new ApiError(400, `params[${i}] must be an object`);
    const name = (entry as Record<string, unknown>).name;
    const description = (entry as Record<string, unknown>).description;
    const required = (entry as Record<string, unknown>).required;
    if (typeof name !== "string" || !NAME_RE.test(name)) {
      throw new ApiError(400, `params[${i}].name must be a valid identifier (letters, numbers, underscore; can't start with a number)`);
    }
    if (seen.has(name)) throw new ApiError(400, `Duplicate parameter name "${name}"`);
    seen.add(name);
    if (typeof description !== "string" || !description.trim()) {
      throw new ApiError(400, `params[${i}].description is required. The LLM uses it to know what to pass`);
    }
    return { name, description: description.trim(), required: required !== false };
  });
}

/** Best-effort liveness probe for an http-kind endpoint before it's accepted into the catalog —
 * deliberately loose (any actual HTTP response counts as "reachable," even a 404/405, since the
 * endpoint may require path params this check can't supply, or only accept POST). Only a
 * network-level failure (SSRF-blocked private host, DNS failure, connection refused, timeout,
 * bad URL) — fetchGuarded's own throw cases with throwOnError left at its default — counts as
 * unreachable. This confirms the URL is real and safe to call, not that it does what the
 * publisher's description claims; there's no way to verify semantic correctness of arbitrary
 * third-party content. Exported for knowledgeContributions.ts's DATASET/MODEL verification, which
 * needs the identical "is this URL real" check for a contentUrl instead of a skill endpoint. */
export async function verifyHttpReachable(url: string): Promise<boolean> {
  try {
    await fetchGuarded(url, { method: "GET", throwOnError: false, timeoutMs: 8000 });
    return true;
  } catch {
    return false;
  }
}

/** Same idea for an mcp-kind endpoint, but a stronger check: a real listTools() round-trip
 * rather than just "did something answer." Runs fetchGuarded's SSRF/private-host guard first
 * (via a throwaway GET to the same URL) since the MCP SDK's own StreamableHTTPClientTransport
 * has no such guard — the DNS-rebind gap between that pre-check and the real connect below is
 * the same accepted residual gap guardedFetch.ts's own doc comment already flags for every other
 * caller-supplied URL this codebase fetches, not a new risk class. */
async function verifyMcpReachable(url: string): Promise<boolean> {
  try {
    await fetchGuarded(url, { method: "GET", throwOnError: false, timeoutMs: 5000 });
  } catch {
    return false;
  }
  try {
    const client = new Client({ name: "circuitsprotocol-skill-publish-verify", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);
    try {
      await client.listTools();
      return true;
    } finally {
      await client.close();
    }
  } catch {
    return false;
  }
}

export interface PublishedSkillEndpointInput {
  kind: SkillEndpointKind;
  url: string;
  method?: SkillHttpMethod;
}

/** Validates and live-verifies a publisher-submitted endpoint. Throws (rejects the publish
 * outright) rather than silently storing an endpoint that failed verification — see
 * PublishedSkill's own schema doc comment for why there's no partial "unverified" state to store
 * instead: a broken listing would be indistinguishable from a working one in the catalog. */
export async function verifyPublishedSkillEndpoint(input: PublishedSkillEndpointInput): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new ApiError(400, "endpointUrl must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ApiError(400, "endpointUrl must be http(s)");
  }

  if (input.kind === SkillEndpointKind.HTTP) {
    if (!input.method) throw new ApiError(400, "httpMethod is required for an HTTP endpoint");
    const reachable = await verifyHttpReachable(input.url);
    if (!reachable) throw new ApiError(422, "Couldn't reach that endpoint. Check the URL and that it's publicly accessible (not localhost or a private network).");
    return;
  }

  const reachable = await verifyMcpReachable(input.url);
  if (!reachable) throw new ApiError(422, "Couldn't reach that MCP server, or it didn't respond to a tools/list request. Check the URL.");
}

export interface SerializedPublishedSkill {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  cat: string;
  priceUsdc: string;
  price: string;
  isLive: boolean;
  endpointKind: SkillEndpointKind | null;
  endpointUrl: string | null;
  httpMethod: SkillHttpMethod | null;
  params: PublishedSkillParam[];
  creator: ReturnType<typeof serializeProfile>;
  createdAt: string;
}

export function serializePublishedSkill(skill: PublishedSkill & { creator: Profile }): SerializedPublishedSkill {
  const priceUsdc = skill.priceUsdc;
  return {
    id: skill.id,
    emoji: skill.emoji,
    name: skill.name,
    desc: skill.desc,
    cat: skill.cat,
    priceUsdc,
    price: Number(priceUsdc) > 0 ? `$${priceUsdc}` : "Free",
    isLive: Boolean(skill.endpointUrl && skill.verifiedAt),
    endpointKind: skill.endpointKind,
    endpointUrl: skill.endpointUrl,
    httpMethod: skill.httpMethod,
    params: (skill.paramsJson as unknown as PublishedSkillParam[] | null) ?? [],
    creator: serializeProfile(skill.creator),
    createdAt: skill.createdAt.toISOString(),
  };
}
