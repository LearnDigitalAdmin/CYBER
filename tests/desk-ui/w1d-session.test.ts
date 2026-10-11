import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Test double for the browser (lives only in this test file).
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } },
};

const mod = await import("../../src/desk/access/sessionStore");
const sample = { sessionId: "s1", entityKey: "chama:SMC-0042", displayName: "Umoja Chama", scopes: ["read", "import"] as const, expiresAt: Date.now() + 3_600_000 };

beforeEach(() => { store.clear(); mod.clearStoredSession(); });

test("store: set, read back, stable snapshot until it changes", () => {
  assert.equal(mod.getStoredSession(), null);
  mod.setStoredSession({ ...sample, scopes: [...sample.scopes] });
  const a = mod.getStoredSession(); const b = mod.getStoredSession();
  assert.equal(a?.sessionId, "s1");
  assert.equal(a, b); // useSyncExternalStore needs a referentially stable snapshot
});
test("store: subscribers are told on set and clear", () => {
  let n = 0; const off = mod.subscribeStoredSession(() => { n++; });
  mod.setStoredSession({ ...sample, scopes: [...sample.scopes] });
  mod.clearStoredSession();
  off(); mod.setStoredSession({ ...sample, scopes: [...sample.scopes] });
  assert.equal(n, 2);
});
test("store: clearing with another session's id leaves the current one alone", () => {
  mod.setStoredSession({ ...sample, scopes: [...sample.scopes] });
  mod.clearStoredSession("someone-else");
  assert.equal(mod.getStoredSession()?.sessionId, "s1");
  mod.clearStoredSession("s1");
  assert.equal(mod.getStoredSession(), null);
});
test("store: tampered or malformed storage is ignored", () => {
  store.set("desk.activeSession.v1", "{not json");
  assert.equal(mod.getStoredSession(), null);
  store.set("desk.activeSession.v1", JSON.stringify({ sessionId: "x" }));
  assert.equal(mod.getStoredSession(), null);
  assert.equal(mod.isStoredSession({ ...sample, scopes: ["read"] }), true);
  assert.equal(mod.isStoredSession({ ...sample, expiresAt: "soon" }), false);
});
