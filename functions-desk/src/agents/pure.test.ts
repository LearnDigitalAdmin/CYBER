import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAgentCode, hashIdNumber, maskIdNumber, nextCounterValue, validateApplication } from "./pure.js";

const ok = { name: "Jane Wanjiru", phone: "0712345678", idNumber: "12345678", wardId: "ward-1" };
const bad = (o: Record<string, unknown>) => () => validateApplication({ ...ok, ...o });

test("valid application is normalised", () => {
  const a = validateApplication({ ...ok, name: "  Jane Wanjiru ", idNumber: "1234 5678" });
  assert.equal(a.name, "Jane Wanjiru");
  assert.equal(a.phone, "+254712345678");
  assert.equal(a.idNumber, "12345678");
});
test("name 2–80", () => { assert.throws(bad({ name: "J" })); assert.throws(bad({ name: "x".repeat(81) })); assert.doesNotThrow(bad({ name: "Jo" })); });
test("ID number 6–12 digits only", () => {
  assert.throws(bad({ idNumber: "12345" })); assert.throws(bad({ idNumber: "1".repeat(13) })); assert.throws(bad({ idNumber: "12345A78" }));
  assert.doesNotThrow(bad({ idNumber: "123456" })); assert.doesNotThrow(bad({ idNumber: "1".repeat(12) }));
});
test("ward 1–40", () => { assert.throws(bad({ wardId: "" })); assert.throws(bad({ wardId: "w".repeat(41) })); });
test("phone must be Kenyan", () => assert.throws(bad({ phone: "123" })));
test("non-object input is refused", () => assert.throws(() => validateApplication(null)));

test("agent code pads to 4 digits and never issues COG-0000", () => {
  assert.equal(formatAgentCode(1), "COG-0001");
  assert.equal(formatAgentCode(42), "COG-0042");
  assert.equal(formatAgentCode(12345), "COG-12345");
  assert.throws(() => formatAgentCode(0));
  assert.throws(() => formatAgentCode(-3));
  assert.throws(() => formatAgentCode(1.5));
});
test("counter starts at 1 and ignores damaged values", () => {
  assert.equal(nextCounterValue(undefined), 1);
  assert.equal(nextCounterValue(0), 1);
  assert.equal(nextCounterValue(7), 8);
  assert.equal(nextCounterValue(-5), 1);
  assert.equal(nextCounterValue("9"), 1);
});
test("id hash is salted, stable and not the number", () => {
  const h = hashIdNumber("12345678", "salt-a");
  assert.equal(h, hashIdNumber("12345678", "salt-a"));
  assert.notEqual(h, hashIdNumber("12345678", "salt-b"));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes("12345678"));
});
test("mask keeps last 4", () => assert.equal(maskIdNumber("12345678"), "****5678"));

test("v6 application: geography names become ids; codes and role are checked; phone must be Safaricom", () => {
  const base = { name: "Jane Wanjiku", phone: "0712345678", idNumber: "12345678" };
  const a = validateApplication({ ...base, wardId: "", county: "Nakuru", constituency: "Naivasha", ward: "Maiella", uplineCode: "cog-0042" });
  assert.equal(a.wardId, "nakuru/naivasha/maiella"); assert.equal(a.countyId, "nakuru"); assert.equal(a.constituencyId, "nakuru/naivasha"); assert.equal(a.uplineCode, "COG-0042");
  assert.throws(() => validateApplication({ ...base, wardId: "", county: "Nakuru", constituency: "Naivasha" }), /county, constituency and ward/);
  assert.throws(() => validateApplication({ ...base, wardId: "", county: "Nakuru", constituency: "Naivasha", ward: "Nowhere" }));
  assert.throws(() => validateApplication({ ...base, wardId: "x", uplineCode: "12" }), /agent code/);
  assert.throws(() => validateApplication({ ...base, wardId: "x", uplineCode: "COG-0042", inviteCode: "ABCDEFGH" }), /either an agent code or an invite code/);
  assert.throws(() => validateApplication({ ...base, wardId: "x", role: "admin" }), /clerk, senior or lead/);
  assert.equal(validateApplication({ ...base, wardId: "Legacy ward" }).wardId, "Legacy ward", "the legacy free-text ward still works");
  assert.throws(() => validateApplication({ ...base, phone: "0733123456", wardId: "x" }), /Safaricom/i);
});
