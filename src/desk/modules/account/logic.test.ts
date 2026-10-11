/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { authErrorMessage, checkDocFile, clearPending, cooldownLeft, readPending, sniffContentType, validateEmailChange, validatePasswordChange, writePending } from "./logic";
import type { KeyValueStore } from "./logic";

const bytes = (...b: number[]) => new Uint8Array(b);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);

test("sniffing identifies real types and rejects others", () => {
  assert.equal(sniffContentType(JPEG), "image/jpeg");
  assert.equal(sniffContentType(PNG), "image/png");
  assert.equal(sniffContentType(WEBP), "image/webp");
  assert.equal(sniffContentType(PDF), "application/pdf");
  assert.equal(sniffContentType(bytes(0x4d, 0x5a, 0x90, 0)), null); // an .exe renamed to .jpg
  assert.equal(sniffContentType(bytes()), null);
});

test("document checks: size, type, selfie must be a photo", () => {
  assert.equal(checkDocFile("id_front", 0, JPEG).ok, false);
  assert.equal(checkDocFile("id_front", 4 * 1024 * 1024 + 1, JPEG).ok, false);
  assert.equal(checkDocFile("id_front", 4 * 1024 * 1024, JPEG).ok, true);
  assert.equal(checkDocFile("id_back", 1000, PDF).ok, true);
  assert.equal(checkDocFile("selfie", 1000, PDF).ok, false);
  assert.equal(checkDocFile("selfie", 1000, bytes(1, 2, 3)).ok, false);
});

test("email change validation", () => {
  assert.equal(validateEmailChange({ currentEmail: "a@x.com", newEmail: "nope", password: "p" }).errors.email !== undefined, true);
  assert.equal(validateEmailChange({ currentEmail: "a@x.com", newEmail: " A@X.com ", password: "p" }).errors.email !== undefined, true);
  assert.equal(validateEmailChange({ currentEmail: "a@x.com", newEmail: "b@x.com", password: "" }).errors.password !== undefined, true);
  const ok = validateEmailChange({ currentEmail: "a@x.com", newEmail: " B@X.com ", password: "p" });
  assert.ok(ok.ok); assert.equal(ok.email, "b@x.com");
});

test("password change validation", () => {
  assert.equal(validatePasswordChange({ current: "", next: "longenough", confirm: "longenough" }).errors.current !== undefined, true);
  assert.equal(validatePasswordChange({ current: "old", next: "short", confirm: "short" }).errors.next !== undefined, true);
  assert.equal(validatePasswordChange({ current: "samesame1", next: "samesame1", confirm: "samesame1" }).errors.next !== undefined, true);
  assert.equal(validatePasswordChange({ current: "old", next: "longenough", confirm: "different1" }).errors.confirm !== undefined, true);
  assert.equal(validatePasswordChange({ current: "old", next: "longenough", confirm: "longenough" }).ok, true);
});

test("cooldown", () => {
  assert.equal(cooldownLeft(null, 100), 0);
  assert.equal(cooldownLeft(1000, 1500, 60_000), 59_500);
  assert.equal(cooldownLeft(1000, 100_000, 60_000), 0);
});

test("auth errors map to readable text", () => {
  assert.match(authErrorMessage("auth/invalid-credential"), /password/i);
  assert.match(authErrorMessage("auth/email-already-in-use"), /already/i);
  assert.match(authErrorMessage(undefined), /try again/i);
});

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}
test("pending email marker is per user, validated and clearable", () => {
  const s = memoryStore();
  assert.equal(readPending(s, "u1"), null);
  writePending(s, "u1", { email: "new@x.com", sentAt: 5 });
  assert.deepEqual(readPending(s, "u1"), { email: "new@x.com", sentAt: 5 });
  assert.equal(readPending(s, "u2"), null);
  s.map.set("desk.pendingEmail.u3", "{not json");
  assert.equal(readPending(s, "u3"), null);
  s.map.set("desk.pendingEmail.u4", JSON.stringify({ email: "bad", sentAt: 1 }));
  assert.equal(readPending(s, "u4"), null);
  clearPending(s, "u1");
  assert.equal(readPending(s, "u1"), null);
  assert.equal(readPending(null, "u1"), null);
});
