/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryLabel, confirmationState, isConfirmationCode, notesProblem, toSupportItem } from "./supportLogic.ts";

const base = { confirmedAt: undefined, codeExpiresAt: 1000, codeAttempts: 0 };

test("a visit is confirmed, waiting, expired or locked", () => {
  assert.equal(confirmationState({ ...base, confirmedAt: 5 }, 9999), "confirmed");
  assert.equal(confirmationState(base, 999), "awaiting");
  assert.equal(confirmationState(base, 1000), "expired");
  assert.equal(confirmationState({ ...base, codeAttempts: 5 }, 10), "locked");
  assert.equal(confirmationState({ ...base, codeAttempts: 4 }, 10), "awaiting");
  assert.equal(confirmationState({ ...base, codeAttempts: 5, confirmedAt: 1 }, 10), "confirmed");
});
test("notes need 5–1000 characters; codes are six digits", () => {
  assert.match(String(notesProblem("hi")), /at least 5/);
  assert.equal(notesProblem("Set up the chama"), null);
  assert.match(String(notesProblem("x".repeat(1001))), /too long/);
  assert.equal(isConfirmationCode(" 123456 "), true);
  assert.equal(isConfirmationCode("12345"), false);
  assert.equal(isConfirmationCode("12a456"), false);
  assert.equal(categoryLabel("sms"), "SMS");
  assert.equal(categoryLabel("zzz"), "zzz");
});
test("reading a support document never carries the code hash or anything about payment", () => {
  const item = toSupportItem("s1", {
    entityKey: "chama:SMC-0001", category: "sms", notes: "Fixed it", createdAt: 7, customerConfirmedAt: 9, codeExpiresAt: 99, codeAttempts: 2,
    codeHash: "deadbeef", paidMonth: "2026-10", agentId: "u1",
  });
  assert.deepEqual(item, { id: "s1", entityKey: "chama:SMC-0001", category: "sms", notes: "Fixed it", createdAt: 7, confirmedAt: 9, codeExpiresAt: 99, codeAttempts: 2 });
  const json = JSON.stringify(item);
  assert.ok(!json.includes("deadbeef") && !json.includes("paidMonth") && !json.includes("2026-10"));
  assert.deepEqual(toSupportItem("s2", {}), { id: "s2", entityKey: "", category: "other", notes: "", createdAt: 0, codeExpiresAt: 0, codeAttempts: 0 });
});
