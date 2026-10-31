/**
 * Test Suite: Form Draft Persistence & Session Logout Purge
 */
import {
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  clearAllFormDrafts,
  getFormDraftKey,
  FORM_DRAFT_PREFIX,
} from "../src/lib/formDraftStorage";
import { clearAppUserSession, SESSION_LOGOUT_EVENT } from "../src/lib/sessionCleanup";

// Mock localStorage and window
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const mockStorage = new MockStorage();
let eventDispatched = false;

const mockWindow = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (event: { type: string }) => {
    if (event.type === SESSION_LOGOUT_EVENT) {
      eventDispatched = true;
    }
    return true;
  },
};

(globalThis as any).window = mockWindow;
(globalThis as any).localStorage = mockStorage;
(globalThis as any).CustomEvent = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log("=== Running Form Draft Persistence & Security Tests ===\n");

// 1. Test key generation
assert(
  getFormDraftKey("agent_registration", "0xAbCd") === "circuits_form_draft_0xabcd_agent_registration",
  "Keys are correctly formatted and case-normalized"
);
assert(
  getFormDraftKey("agent_registration", null) === "circuits_form_draft_anon_agent_registration",
  "Anonymous draft key defaults to anon scope"
);

// 2. Test saving and loading anonymous draft
saveFormDraft("agent_registration", { name: "Agent Zero", step: 2 }, null);
assert(
  mockStorage.getItem("circuits_form_draft_anon_agent_registration") !== null,
  "Anonymous draft saved into localStorage"
);

// 3. Test migration of anonymous draft when user logs in
const migrated = loadFormDraft<{ name: string; step: number }>("agent_registration", "0xUser1");
assert(migrated?.name === "Agent Zero" && migrated?.step === 2, "Draft migrated to authenticated user scope");
assert(
  mockStorage.getItem("circuits_form_draft_anon_agent_registration") === null,
  "Anonymous draft removed after migration"
);
assert(
  mockStorage.getItem("circuits_form_draft_0xuser1_agent_registration") !== null,
  "Draft now stored under authenticated user key"
);

// 4. Test user isolation
const user2Draft = loadFormDraft("agent_registration", "0xUser2");
assert(user2Draft === null, "User 2 cannot see User 1's draft");

// 5. Test multiple distinct form drafts
saveFormDraft("token_launch", { symbol: "CIRCUIT", buybackBps: 2000 }, "0xUser1");
saveFormDraft("marketplace_post_job", { budgetUsdc: "100", taskDescription: "Build auditor" }, "0xUser1");
saveFormDraft("register_x402_service", { endpoint: "https://api.example.com", priceUsdc: "0.10" }, "0xUser1");
saveFormDraft("publish_skill", { name: "Web Scraping Skill", cat: "Analytics" }, "0xUser1");

assert(loadFormDraft<any>("token_launch", "0xUser1")?.symbol === "CIRCUIT", "Token launch draft persisted");
assert(loadFormDraft<any>("marketplace_post_job", "0xUser1")?.budgetUsdc === "100", "Marketplace job draft persisted");
assert(loadFormDraft<any>("register_x402_service", "0xUser1")?.endpoint === "https://api.example.com", "x402 service draft persisted");
assert(loadFormDraft<any>("publish_skill", "0xUser1")?.name === "Web Scraping Skill", "Publish skill draft persisted");

// 6. Test specific form clearing
clearFormDraft("token_launch", "0xUser1");
assert(loadFormDraft("token_launch", "0xUser1") === null, "Single form draft cleared on submit/reset");
assert(loadFormDraft("marketplace_post_job", "0xUser1") !== null, "Other form drafts untouched");

// 7. CRUCIAL TEST: Purge on Logout
console.log("\n--- Testing Session Logout Purge Guarantee ---");
mockStorage.setItem("circuits_session_user", JSON.stringify({ id: "0xUser1" }));
mockStorage.setItem("privy:token", "fake-jwt");

assert(mockStorage.length > 0, "Storage has active session and form drafts before logout");

// Perform logout
clearAppUserSession();

assert(eventDispatched, "SESSION_LOGOUT_EVENT dispatched to notify active components");
assert(loadFormDraft("agent_registration", "0xUser1") === null, "Agent registration draft purged after logout");
assert(loadFormDraft("marketplace_post_job", "0xUser1") === null, "Marketplace draft purged after logout");
assert(loadFormDraft("register_x402_service", "0xUser1") === null, "x402 draft purged after logout");
assert(loadFormDraft("publish_skill", "0xUser1") === null, "Publish skill draft purged after logout");

// Verify zero draft keys in storage
let draftKeyFound = false;
for (let i = 0; i < mockStorage.length; i++) {
  const k = mockStorage.key(i);
  if (k && k.startsWith(FORM_DRAFT_PREFIX)) {
    draftKeyFound = true;
  }
}
assert(!draftKeyFound, "NO form draft keys remain in storage after clearAppUserSession()");

console.log("\n🎉 ALL TESTS PASSED: Form drafts persist across refresh and are strictly purged upon logout!");
