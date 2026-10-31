/** Hashes arbitrary task/deliverable text into the 32-byte digest the contracts expect
 * in place of a real IPFS CID hash. There's no IPFS pinning flow wired up yet, so this
 * hashes the raw text directly — good enough to produce a stable on-chain reference,
 * not a substitute for actually storing the content somewhere retrievable. */
export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded as BufferSource);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<`0x${string}`> {
  const bytes = await sha256Bytes(input);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
