import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryTopPayout, summaryTopRank, summaryTopStatus, type AgentStatus } from "../contract.js";
import { DeskError } from "../errors.js";
import { evaluateTopOtp, throwForVerdict } from "./otp.js";
import {
  checkStatusMove, checkTopSummary, deskCodeInput, kesTextToMinor, matchesSearch, rankInput, reasonInput, statusInput, topOtpSmsText,
} from "./pure.js";
import { hashOtp } from "../otp/core.js";
import type { TopOtpDoc } from "../types.js";

test("summaries round-trip through the contract builders", () => {
  assert.ok(checkTopSummary("set_desk_status", summaryTopStatus("COG-0007", "suspended")).ok);
  assert.ok(checkTopSummary("set_rank", summaryTopRank("COG-0007", "senior")).ok);
  assert.ok(checkTopSummary("payout", summaryTopPayout(200000, 1)).ok);
  assert.ok(checkTopSummary("payout", summaryTopPayout(123456, 12)).ok);
});
test("anything that does not round-trip is refused", () => {
  const no = (a: Parameters<typeof checkTopSummary>[0], s: unknown) => assert.equal(checkTopSummary(a, s).ok, false, String(s));
  no("set_desk_status", "Set desk COG-0007 to applied"); no("set_desk_status", "Set desk COG-0000 to closed"); no("set_desk_status", "Set desk cog-0007 to closed");
  no("set_desk_status", "Set desk COG-0007 to closed now"); no("set_rank", "Set desk COG-0007 rank to boss"); no("set_rank", "Set desk COG-0000 rank to lead");
  no("payout", "Pay KES 20.00 to 0 desks"); no("payout", "Pay KES 0.00 to 1 desks"); no("payout", "Pay KES 20 to 1 desks"); no("payout", "Pay KES 1,000.00 to 2 desks");
  no("payout", "Pay KES 20.0 to 1 desks"); no("payout", 5); no("set_rank", undefined);
  no("set_rank", summaryTopStatus("COG-0007", "active")); // right text, wrong action
});
test("KES text to minor is exact", () => { assert.equal(kesTextToMinor("1234.50"), 123450); assert.equal(kesTextToMinor("0.05"), 5); assert.equal(kesTextToMinor("50000.00"), 5_000_000); });
test("input narrowing", () => {
  assert.equal(deskCodeInput(" cog-0012 "), "COG-0012");
  for (const f of [() => deskCodeInput("AGT-0001"), () => deskCodeInput(5), () => statusInput("applied"), () => rankInput("boss"), () => reasonInput("no"), () => reasonInput("x".repeat(301))])
    assert.throws(f, (e: unknown) => e instanceof DeskError && e.code === "invalid_argument");
  assert.equal(reasonInput("  fraud report  "), "fraud report"); assert.equal(statusInput("suspended"), "suspended"); assert.equal(rankInput("lead"), "lead");
});
test("status moves: closed final, suspended only from active, active needs a non-active desk", () => {
  const ok = (a: AgentStatus, b: AgentStatus) => checkStatusMove(a, b).ok;
  assert.ok(ok("applied", "active") && ok("training", "active") && ok("certified", "active") && ok("suspended", "active"));
  assert.ok(ok("active", "suspended")); assert.ok(ok("active", "closed") && ok("suspended", "closed") && ok("applied", "closed"));
  assert.ok(!ok("applied", "suspended") && !ok("certified", "suspended") && !ok("active", "active") && !ok("suspended", "suspended"));
  for (const to of ["active", "suspended", "closed"] as const) assert.equal(ok("closed", to), false);
});
test("search matches code, name, email and phone digits", () => {
  const a = { agentCode: "COG-0042", name: "Wanjiru Kamau", phone: "+254722000111", email: "w@x.co" };
  for (const t of ["", "0042", "wanjiru", "KAMAU", "w@x", "0722 000", "254722000111"]) assert.ok(matchesSearch(a, t), t);
  for (const t of ["COG-0043", "otieno", "0799"]) assert.ok(!matchesSearch(a, t), t);
});
test("OTP SMS repeats the summary and the code", () => { const t = topOtpSmsText("Set desk COG-0001 to closed", "123456"); assert.match(t, /COG-0001 to closed/); assert.match(t, /Code 123456/); });

const NOW = 1_000_000;
const doc = (o: Partial<TopOtpDoc> = {}): TopOtpDoc => ({
  actionId: "a1", uid: "top", action: "payout", summary: "S", otpHash: hashOtp("123456", "a1"), otpAttempts: 0, otpExpiresAt: NOW + 1000, createdAt: NOW - 1, ...o,
});
const args = (o = {}) => ({ uid: "top", action: "payout" as const, expectedSummary: "S", otp: "123456", actionId: "a1", ...o });
test("top OTP verdicts", () => {
  assert.equal(evaluateTopOtp(doc(), args(), NOW).kind, "ok");
  assert.equal(evaluateTopOtp(undefined, args(), NOW).kind, "missing");
  assert.equal(evaluateTopOtp(doc({ uid: "other" }), args(), NOW).kind, "foreign");
  assert.equal(evaluateTopOtp(doc(), args({ expectedSummary: "T" }), NOW).kind, "mismatch");
  assert.equal(evaluateTopOtp(doc(), args({ action: "set_rank" }), NOW).kind, "mismatch");
  assert.equal(evaluateTopOtp(doc({ consumedAt: 1 }), args(), NOW).kind, "used");
  assert.equal(evaluateTopOtp(doc({ otpExpiresAt: NOW }), args(), NOW).kind, "expired");
  assert.equal(evaluateTopOtp(doc({ otpAttempts: 5 }), args(), NOW).kind, "locked");
  const w = evaluateTopOtp(doc(), args({ otp: "000000" }), NOW);
  assert.equal(w.kind, "wrong"); if (w.kind === "wrong") { assert.equal(w.attempts, 1); assert.equal(w.locked, false); }
  const last = evaluateTopOtp(doc({ otpAttempts: 4 }), args({ otp: "000000" }), NOW);
  assert.ok(last.kind === "wrong" && last.locked);
  assert.equal(evaluateTopOtp(doc({ otpAttempts: 4 }), args(), NOW).kind, "ok"); // a right code on the 5th try still counts
});
test("verdicts map to the right error codes", () => {
  const code = (v: Parameters<typeof throwForVerdict>[0]) => { try { throwForVerdict(v); } catch (e) { return (e as DeskError).code; } return ""; };
  assert.equal(code({ kind: "missing" }), "otp_required"); assert.equal(code({ kind: "used" }), "otp_required");
  assert.equal(code({ kind: "foreign" }), "permission_denied"); assert.equal(code({ kind: "mismatch" }), "permission_denied");
  assert.equal(code({ kind: "expired" }), "otp_invalid"); assert.equal(code({ kind: "locked" }), "otp_invalid"); assert.equal(code({ kind: "wrong", attempts: 1, locked: false }), "otp_invalid");
});
