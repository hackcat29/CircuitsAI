import type { QueryClient } from "@tanstack/react-query";
import { clearAllStoredTerminalMessages, TERMINAL_LOGOUT_EVENT } from "./terminalStorage";
import { clearAllFormDrafts, FORM_DRAFT_PREFIX } from "./formDraftStorage";

export const SESSION_LOGOUT_EVENT = "circuits_session_logout_reset";

/**
 * Completely purges all user-scoped and sensitive data from the browser upon sign out or wallet disconnect:
 * 1. Terminal conversation history
 * 2. Form drafts across registration, token launches, job posts, etc.
 * 3. Notification last-read timestamps
 * 4. Evaluator commit-reveal salts
 * 5. Stored agent social credentials (Telegram bot tokens, Discord webhooks)
 * 6. Stored webhook secrets and delivery logs
 * 7. TanStack Query cache (balances, subscriptions, private knowledge, notifications, degen orders, etc.)
 * 8. Server-side session HTTP-only cookie
 */
export async function clearAppUserSession(queryClient?: QueryClient | null): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      // 1. Terminal history
      clearAllStoredTerminalMessages();

      // 2. Form drafts
      clearAllFormDrafts();

      // 3. Clear other user-scoped localStorage keys
      const prefixesToRemove = [
        "circuits_notifications_last_read",
        "circuitsprotocol:evaluator-salt:",
        "circuitsprotocol:social",
        "circuitsprotocol:webhooks",
        FORM_DRAFT_PREFIX,
      ];

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixesToRemove.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }

      // Broadcast events
      window.dispatchEvent(new CustomEvent(SESSION_LOGOUT_EVENT));
      window.dispatchEvent(new CustomEvent(TERMINAL_LOGOUT_EVENT));
    } catch (err) {
      console.warn("Failed to clear local storage on logout:", err);
    }
  }

  // Clear query cache to immediately evict cached user queries from memory
  if (queryClient) {
    try {
      queryClient.clear();
    } catch (err) {
      console.warn("Failed to clear QueryClient cache:", err);
    }
  }

  // Clear server session cookie
  try {
    await fetch("/api/social/auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("Failed to clear server session cookie:", err);
  }
}
