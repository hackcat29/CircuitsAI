import { createHash } from "node:crypto";

/** Same convention as apps/web/src/lib/hash.ts's sha256Hex and
 * packages/custody-core/src/subscriptionRunJob.ts's local copy — reimplemented with
 * node:crypto rather than imported, since this package has no browser-facing code and no
 * dependency on apps/web. */
export function sha256Hex(input: string): `0x${string}` {
  return `0x${createHash("sha256").update(input, "utf8").digest("hex")}`;
}
