import { randomUUID } from "node:crypto";

// A deliberately minimal twin of apps/web/src/lib/server/a2aClient.ts's message/send call —
// that one is built for a *human* calling an arbitrary third-party agent (SSRF-guarded fetch,
// x402 payment-pulling, Next.js session plumbing). This one is an owner's runtime calling their
// *own* agent's own endpoint to ask it to actually do the work it was just hired for — no
// payment negotiation applies (there's no one to pay; it's the same owner on both ends), and
// there's no untrusted third-party endpoint to guard against (the owner configured this
// endpoint themselves, on their own agent's on-chain record).

export interface A2aTextResult {
  ok: boolean;
  text: string;
}

/** POSTs `message` to the agent's own declared A2A endpoint and returns whatever text parts
 * come back joined together. Any failure — network error, non-2xx, a JSON-RPC error, an async
 * "task" response instead of an immediate message — comes back as `{ ok: false }` rather than
 * throwing, so a flaky owner-run agent server doesn't crash the whole poll loop; the caller
 * just leaves the job in `acceptedUndelivered` for the next tick to retry. */
export async function callAgent(endpoint: string, message: string, timeoutMs: number): Promise<A2aTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: randomUUID(),
        method: "message/send",
        params: { message: { role: "user", parts: [{ kind: "text", text: message }] } },
      }),
    });
    if (!res.ok) return { ok: false, text: `Agent endpoint returned HTTP ${res.status}.` };

    const body = (await res.json().catch(() => null)) as { error?: { message?: string }; result?: { kind?: string; parts?: unknown[] } } | null;
    if (body?.error) return { ok: false, text: `Agent returned a JSON-RPC error: ${body.error.message ?? "unknown"}.` };
    if (body?.result?.kind !== "message") return { ok: false, text: "Agent didn't reply with an immediate message." };

    const parts: unknown[] = Array.isArray(body.result.parts) ? body.result.parts : [];
    const text = parts
      .map((p) => (typeof p === "object" && p !== null && "text" in p && typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    return text ? { ok: true, text } : { ok: false, text: "Agent replied with no text content." };
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : "Network error calling agent endpoint." };
  } finally {
    clearTimeout(timeout);
  }
}
