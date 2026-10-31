/** Turns a thrown action error into UI-safe text. Monad's public RPC caps at 1
 * request/second and routinely rejects reads/writes with "request limit reached" — left
 * unhandled, that surfaces as viem's full multi-paragraph "RPC Request failed... Contract
 * Call:... Details:..." dump, which reads as a crash even when it's just a transient rate
 * limit. Collapses that into one honest, actionable sentence; for every other error, prefers
 * viem's short `shortMessage` over the full `message` (also usually a technical dump not meant
 * for end users), falling back to the caller's own default when nothing usable is present. */
export function describeActionError(err: unknown, fallback = "Something went wrong."): string {
  const message = err instanceof Error ? err.message : undefined;
  if (message && /request limit reached/i.test(message)) {
    return "The RPC didn't respond in time. Monad's public endpoint rate-limits aggressively. Try again in a moment.";
  }
  const shortMessage = (err as { shortMessage?: unknown } | null)?.shortMessage;
  if (typeof shortMessage === "string" && shortMessage) return shortMessage;
  return message ?? fallback;
}
