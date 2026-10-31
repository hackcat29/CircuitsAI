export type TerminalMessage = {
  role: "user" | "agent";
  text: string;
  timestamp?: string;
};

const STORAGE_PREFIX = "circuits_terminal_chat_v1";
export const TERMINAL_LOGOUT_EVENT = "circuits_terminal_logout_reset";

function getStorageKey(chainSlug: string, agentId: string | number, userAddress?: string | null): string {
  const userScope = userAddress?.toLowerCase() ? `user_${userAddress.toLowerCase()}_` : `guest_`;
  return `${STORAGE_PREFIX}_${userScope}${chainSlug}_${agentId}`;
}

export function getStoredTerminalMessages(
  chainSlug: string,
  agentId: string | number,
  userAddress?: string | null
): TerminalMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(chainSlug, agentId, userAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to load stored terminal messages:", err);
  }
  return null;
}

export function saveStoredTerminalMessages(
  chainSlug: string,
  agentId: string | number,
  messages: TerminalMessage[],
  userAddress?: string | null
): void {
  if (typeof window === "undefined" || !agentId) return;
  try {
    localStorage.setItem(getStorageKey(chainSlug, agentId, userAddress), JSON.stringify(messages));
  } catch (err) {
    console.warn("Failed to save terminal messages:", err);
  }
}

export function clearStoredTerminalMessages(
  chainSlug: string,
  agentId: string | number,
  userAddress?: string | null
): void {
  if (typeof window === "undefined" || !agentId) return;
  try {
    localStorage.removeItem(getStorageKey(chainSlug, agentId, userAddress));
  } catch (err) {
    console.warn("Failed to clear terminal messages:", err);
  }
}

/**
 * Completely purges all stored terminal conversations from localStorage upon logout,
 * and notifies active terminal components to reset their in-memory state.
 */
export function clearAllStoredTerminalMessages(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith("circuits_terminal_chat"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    // Broadcast reset event so mounted terminal components clear in-memory state immediately
    window.dispatchEvent(new CustomEvent(TERMINAL_LOGOUT_EVENT));
  } catch (err) {
    console.warn("Failed to clear all terminal messages on logout:", err);
  }
}

export function createInitialAgentGreeting(
  agentName: string,
  layer?: { displayName?: string; worldview?: string } | null,
): TerminalMessage {
  const displayName = layer?.displayName || agentName;
  const worldviewSummary = layer?.worldview ? ` "${layer.worldview}"` : "";
  const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return {
    role: "agent",
    text: `Connected to **${displayName}** (@${agentName}).${worldviewSummary}\n\nAsk a question or select a prompt below to execute a real-time A2A command.`,
    timestamp: nowStr,
  };
}

export function createNetworkBroadcastGreeting(): TerminalMessage {
  const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    role: "agent",
    text: `**Circuits A2A Command Network** // Global Router Online\n\nSelect an agent from the selector above to command them directly, or ask a question to broadcast across the Circuits autonomous agent network.`,
    timestamp: nowStr,
  };
}
