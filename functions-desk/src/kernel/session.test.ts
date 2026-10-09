import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_OTP_FRESH_MS, evaluateActionOtp, evaluateSession } from "./session.js";
import type { ActionOtpDoc, SessionDoc } from "../types.js";

const NOW = 1_700_000_000_000;
const session = (o: Partial<SessionDoc> = {}): SessionDoc => ({
  sessionId: "s1", agentId: "u1", entityKey: "chama:SMC-0001", scopes: ["read", "import"], status: "active",
  otpAttempts: 0, otpExpiresAt: NOW, otpVerifiedAt: NOW - 1000, expiresAt: NOW + 60_000, createdAt: NOW - 5000, ...o,
});
const otp = (o: Partial<ActionOtpDoc> = {}): ActionOtpDoc => ({
  actionId: "a1", sessionId: "s1", agentId: "u1", action: "bulk_sms", summary: "x", otpHash: "h", otpAttempts: 0,
  otpExpiresAt: NOW, verifiedAt: NOW - 1000, createdAt: NOW - 5000, ...o,
});
const code = (c: ReturnType<typeof evaluateSession>) => (c.ok ? "ok" : c.code);

test("valid session passes", () => assert.equal(code(evaluateSession(session(), { uid: "u1", scope: "import" }, NOW)), "ok"));
test("missing session fails", () => assert.equal(code(evaluateSession(undefined, { uid: "u1", scope: "read" }, NOW)), "session_invalid"));
test("another agent's session is refused", () => assert.equal(code(evaluateSession(session(), { uid: "u2", scope: "read" }, NOW)), "permission_denied"));
test("unverified customer OTP is refused", () => assert.equal(code(evaluateSession(session({ otpVerifiedAt: undefined }), { uid: "u1", scope: "read" }, NOW)), "otp_required"));
test("expired session is refused", () => assert.equal(code(evaluateSession(session({ expiresAt: NOW }), { uid: "u1", scope: "read" }, NOW)), "session_invalid"));
test("ended session is refused", () => assert.equal(code(evaluateSession(session({ status: "ended" }), { uid: "u1", scope: "read" }, NOW)), "session_invalid"));
test("scope outside the grant is refused", () => assert.equal(code(evaluateSession(session(), { uid: "u1", scope: "bulk_sms" }, NOW)), "permission_denied"));

const A = { sessionId: "s1", uid: "u1", action: "bulk_sms" as const };
test("fresh verified action OTP passes", () => assert.equal(code(evaluateActionOtp(otp(), A, NOW)), "ok"));
test("action OTP missing", () => assert.equal(code(evaluateActionOtp(undefined, A, NOW)), "otp_required"));
test("action OTP for a different action is refused", () => assert.equal(code(evaluateActionOtp(otp({ action: "export" }), A, NOW)), "permission_denied"));
test("action OTP for a different session is refused", () => assert.equal(code(evaluateActionOtp(otp({ sessionId: "s2" }), A, NOW)), "permission_denied"));
test("unverified action OTP is refused", () => assert.equal(code(evaluateActionOtp(otp({ verifiedAt: undefined }), A, NOW)), "otp_required"));
test("action OTP can be used once", () => assert.equal(code(evaluateActionOtp(otp({ consumedAt: NOW - 1 }), A, NOW)), "otp_required"));
test("stale action OTP is refused", () => assert.equal(code(evaluateActionOtp(otp({ verifiedAt: NOW - ACTION_OTP_FRESH_MS - 1 }), A, NOW)), "otp_required"));
