import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateOtpAttempt, hashOtp, isOtpShape, otpMatches, wrongCodeMessage } from "./core.js";
import { accessSmsText, actionSmsText, checkActionSummary, supportSmsText } from "./messages.js";
import { summaryBulkSms, summaryExport, summaryRentStk, EXPORT_KINDS } from "../contract.js";
import { SMS_MAX_LENGTH } from "../kernel/sms.js";
import { randomOtp } from "../connectors/deps.js";

const NOW = 1_700_000_000_000;
const state = (o = {}) => ({ hash: hashOtp("123456", "id1"), attempts: 0, expiresAt: NOW + 1000, ...o });

test("otp shape is exactly six digits", () => {
  assert.ok(isOtpShape("012345")); assert.ok(!isOtpShape("12345")); assert.ok(!isOtpShape("1234567")); assert.ok(!isOtpShape(123456)); assert.ok(!isOtpShape("12345a"));
});
test("randomOtp is six digits", () => { for (let i = 0; i < 200; i++) assert.match(randomOtp(), /^\d{6}$/); });
test("hash binds the id and matches in constant time", () => {
  assert.ok(otpMatches(hashOtp("123456", "id1"), "123456", "id1"));
  assert.ok(!otpMatches(hashOtp("123456", "id1"), "123456", "id2"));
  assert.ok(!otpMatches(hashOtp("123456", "id1"), "654321", "id1"));
  assert.ok(!otpMatches(undefined, "123456", "id1"));
  assert.ok(!otpMatches("short", "123456", "id1"));
});
test("correct code succeeds and counts the attempt", () => assert.deepEqual(evaluateOtpAttempt(state(), "123456", "id1", NOW), { kind: "ok", attempts: 1 }));
test("wrong code counts; the 5th wrong locks", () => {
  assert.deepEqual(evaluateOtpAttempt(state(), "000000", "id1", NOW), { kind: "wrong", attempts: 1, locked: false });
  assert.deepEqual(evaluateOtpAttempt(state({ attempts: 4 }), "000000", "id1", NOW), { kind: "wrong", attempts: 5, locked: true });
});
test("a correct code on the 5th try still works; after 5 it is locked", () => {
  assert.equal(evaluateOtpAttempt(state({ attempts: 4 }), "123456", "id1", NOW).kind, "ok");
  assert.equal(evaluateOtpAttempt(state({ attempts: 5 }), "123456", "id1", NOW).kind, "locked");
});
test("expired code is refused", () => assert.equal(evaluateOtpAttempt(state({ expiresAt: NOW }), "123456", "id1", NOW).kind, "expired"));
test("wrong-code message counts tries left", () => {
  assert.match(wrongCodeMessage({ kind: "wrong", attempts: 4, locked: false }, "access code"), /1 try left/);
  assert.match(wrongCodeMessage({ kind: "wrong", attempts: 5, locked: true }, "access code"), /new access code/);
});

test("action summaries must equal the contract builders exactly", () => {
  assert.ok(checkActionSummary("bulk_sms", summaryBulkSms(25)).ok);
  assert.ok(checkActionSummary("rent_stk", summaryRentStk(200)).ok);
  for (const k of EXPORT_KINDS) assert.ok(checkActionSummary("export", summaryExport(k)).ok);
  assert.ok(!checkActionSummary("bulk_sms", "SMS to 007 recipients").ok);
  assert.ok(!checkActionSummary("bulk_sms", "SMS to 0 recipients").ok);
  assert.ok(!checkActionSummary("bulk_sms", summaryBulkSms(5) + " ").ok);
  assert.ok(!checkActionSummary("rent_stk", summaryRentStk(201)).ok);
  assert.ok(!checkActionSummary("rent_stk", summaryBulkSms(5)).ok);
  assert.ok(!checkActionSummary("export", "Export everything").ok);
  assert.ok(!checkActionSummary("export", 5).ok);
});

test("access SMS has the agreed wording and the code survives very long names", () => {
  const m = accessSmsText("Jane W", "COG-0001", "Umoja Chama", "482913");
  assert.equal(m, "Samuhia Desk: Jane W (COG-0001) asks to access Umoja Chama. Code 482913, valid 5 min. Share it ONLY if you asked for help.");
  const long = accessSmsText("A".repeat(80), "COG-12345", "B".repeat(400), "482913");
  assert.ok(long.length <= SMS_MAX_LENGTH);
  assert.ok(long.includes("Code 482913, valid 5 min. Share it ONLY if you asked for help."));
});
test("action SMS repeats the summary", () => {
  const m = actionSmsText("Jane", "COG-0001", summaryBulkSms(25), "111222");
  assert.ok(m.includes(summaryBulkSms(25)) && m.includes("Code 111222"));
  assert.ok(m.length <= SMS_MAX_LENGTH);
});
test("support SMS never mentions rewards or money", () => {
  const m = supportSmsText("Jane", "COG-0001", "Umoja Chama", "training", "333444");
  assert.ok(m.includes("333444"));
  assert.doesNotMatch(m, /reward|bonus|commission|earn|pay|KES|ksh/i);
});
