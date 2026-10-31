/** Deterministic "robotic avatar" fallback for an agent that hasn't set a custom profile
 * picture — DiceBear's hosted bottts style, keyless, same seed always renders the same avatar.
 * Seed with the agent's name (stable, human-chosen) rather than its id, so the avatar an owner
 * sees while filling out the registration form matches what every viewer sees afterward. */
export function robotAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed || "agent")}`;
}
