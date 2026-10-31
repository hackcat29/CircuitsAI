/**
 * Circuits Form Draft Storage Manager
 *
 * Provides safe, user-scoped persistence for form drafts across app refreshes.
 *
 * Rules:
 * 1. User Scoping: All drafts are keyed with circuits_form_draft_${userScope}_${formKey}.
 *    - Authenticated: uses the user's lowercase wallet address or profile ID.
 *    - Anonymous: uses 'anon', which is automatically migrated upon authentication.
 * 2. Purged on Logout: clearAllFormDrafts() purges all circuits_form_draft_* entries
 *    from localStorage, ensuring NO form draft persists after user logout or wallet disconnect.
 */

export const FORM_DRAFT_PREFIX = "circuits_form_draft_";

export function getFormDraftKey(formKey: string, userScope?: string | null): string {
  const scope = userScope ? userScope.toLowerCase().trim() : "anon";
  return `${FORM_DRAFT_PREFIX}${scope}_${formKey}`;
}

export function saveFormDraft<T>(formKey: string, data: T, userScope?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = getFormDraftKey(formKey, userScope);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save form draft to localStorage:", err);
  }
}

export function loadFormDraft<T>(formKey: string, userScope?: string | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const userKey = getFormDraftKey(formKey, userScope);
    const raw = localStorage.getItem(userKey);
    if (raw) {
      return JSON.parse(raw) as T;
    }
    // If a user is authenticated but started filling a draft before signing in, migrate anon draft
    if (userScope) {
      const anonKey = getFormDraftKey(formKey, null);
      const anonRaw = localStorage.getItem(anonKey);
      if (anonRaw) {
        try {
          const parsed = JSON.parse(anonRaw) as T;
          localStorage.setItem(userKey, anonRaw);
          localStorage.removeItem(anonKey);
          return parsed;
        } catch {
          localStorage.removeItem(anonKey);
        }
      }
    }
    return null;
  } catch (err) {
    console.warn("Failed to load form draft from localStorage:", err);
    return null;
  }
}

export function clearFormDraft(formKey: string, userScope?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getFormDraftKey(formKey, userScope));
    localStorage.removeItem(getFormDraftKey(formKey, null));
  } catch (err) {
    console.warn("Failed to clear form draft:", err);
  }
}

export function clearAllFormDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FORM_DRAFT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn("Failed to clear all form drafts:", err);
  }
}
