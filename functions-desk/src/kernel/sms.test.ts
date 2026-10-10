import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSmsForm, cleanSmsText, SMS_MAX_LENGTH, smsResponseFailed } from "./sms.js";

const creds = { userid: "u", password: "p", apikey: "k", senderid: "SAMUHIA" };

test("SMS text strips emoji and collapses whitespace", () => {
  assert.equal(cleanSmsText("Your code  is 123456 \u{1F600}\n valid 5 min"), "Your code is 123456 valid 5 min");
});
test("SMS text is capped at the provider limit", () => {
  const t = cleanSmsText("a".repeat(1000));
  assert.equal(t.length, SMS_MAX_LENGTH);
  assert.ok(t.endsWith("..."));
});
test("form is provider-shaped, strips the + and refuses empty text", () => {
  const f = buildSmsForm(creds, "+254712345678", "Hello");
  assert.equal(f.get("mobile"), "254712345678");
  assert.equal(f.get("sendMethod"), "quick");
  assert.equal(f.get("output"), "json");
  assert.equal(f.get("senderid"), "SAMUHIA");
  assert.throws(() => buildSmsForm(creds, "+254712345678", " \u{1F600} "));
});
test("explicit provider failures are detected; unknown shapes are accepted", () => {
  assert.equal(smsResponseFailed({ status: "error" }), true);
  assert.equal(smsResponseFailed({ status: "FAILED" }), true);
  assert.equal(smsResponseFailed({ status: "success" }), false);
  assert.equal(smsResponseFailed({ foo: 1 }), false);
  assert.equal(smsResponseFailed("ok"), false);
});
