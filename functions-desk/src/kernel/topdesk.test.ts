import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTopAccess, isSamuhiaEmail, TOP_RECENT_AUTH_SECONDS } from "./topdesk.js";
import type { AgentDoc } from "../types.js";

const NOW = 1_800_000_000;
const top = (o: Partial<AgentDoc> = {}): AgentDoc => ({
  agentId: "u1", agentCode: "COG-0000", name: "Top", phone: "+254712345678", email: "a@samuhia.co.ke", idHash: "h", idNumberMasked: "****1234",
  status: "active", rank: "lead", wardId: "hq", createdAt: 1, ...o,
});
const auth = (o: Partial<{ email: string; email_verified: boolean; auth_time: number; uid: string }> = {}) => ({
  uid: o.uid ?? "u1", token: { email: "boss@samuhia.co.ke", email_verified: true, auth_time: NOW - 60, ...o },
});
const code = (c: ReturnType<typeof evaluateTopAccess>) => (c.ok ? "ok" : c.code);

test("only the verified samuhia domain qualifies", () => {
  assert.equal(isSamuhiaEmail("boss@samuhia.co.ke"), true);
  assert.equal(isSamuhiaEmail("BOSS@Samuhia.CO.KE"), true);
  for (const bad of ["boss@gmail.com", "boss@samuhia.co.ke.evil.com", "boss@sub.samuhia.co.ke", "a@b@samuhia.co.ke", ""])
    assert.equal(isSamuhiaEmail(bad), false);
  assert.equal(isSamuhiaEmail("boss@gmail.com"), false);
  assert.equal(isSamuhiaEmail("boss@samuhia.co.ke.evil.com"), false);
  assert.equal(isSamuhiaEmail("boss@sub.samuhia.co.ke"), false);
  assert.equal(isSamuhiaEmail(undefined), false);
});
test("a valid, recent, verified top desk passes", () => assert.equal(code(evaluateTopAccess(top(), auth(), NOW)), "ok"));
test("any other desk code is refused", () => assert.equal(code(evaluateTopAccess(top({ agentCode: "COG-0007" }), auth(), NOW)), "permission_denied"));
test("a missing agent record or a uid mismatch is refused", () => {
  assert.equal(code(evaluateTopAccess(undefined, auth(), NOW)), "permission_denied");
  assert.equal(code(evaluateTopAccess(top(), auth({ uid: "other" }), NOW)), "permission_denied");
});
test("a suspended top desk is refused", () => assert.equal(code(evaluateTopAccess(top({ status: "suspended" }), auth(), NOW)), "permission_denied"));
test("a non-samuhia or unverified email is refused", () => {
  assert.equal(code(evaluateTopAccess(top(), auth({ email: "boss@gmail.com" }), NOW)), "permission_denied");
  assert.equal(code(evaluateTopAccess(top(), auth({ email_verified: false }), NOW)), "permission_denied");
});
test("a stale sign-in asks for a fresh one", () => {
  assert.equal(code(evaluateTopAccess(top(), auth({ auth_time: NOW - TOP_RECENT_AUTH_SECONDS - 1 }), NOW)), "unauthenticated");
  assert.equal(code(evaluateTopAccess(top(), { uid: "u1", token: { email: "boss@samuhia.co.ke", email_verified: true } }, NOW)), "unauthenticated");
});
