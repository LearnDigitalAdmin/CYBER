import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKenyaPhone } from "../../src/desk/access/phone";
import { formatClock } from "../../src/desk/access/time";
import { PRODUCT_LABEL, scopesForProduct, splitEntityKey } from "../../src/desk/access/scopes";
import { buildDraft, payloadBytes, payloadProblem, MAX_PAYLOAD_BYTES } from "../../src/desk/access/service/payload";
import { cleanApplication, validateApplication } from "../../src/desk/onboarding/validation";
import { JOURNEY, journeyIndex, nextSteps } from "../../src/desk/onboarding/steps";
import { AGENT_TERMS } from "../../src/desk/onboarding/terms";

test("phone: same cases as the server's normalizeKenyaPhone", () => {
  assert.equal(normalizeKenyaPhone("0712 345 678"), "+254712345678");
  assert.equal(normalizeKenyaPhone("+254 712-345-678"), "+254712345678");
  assert.equal(normalizeKenyaPhone("254112345678"), "+254112345678");
  assert.equal(normalizeKenyaPhone("712345678"), "+254712345678");
  assert.equal(normalizeKenyaPhone("(0722) 345678"), "+254722345678");
  assert.equal(normalizeKenyaPhone("0812345678"), null);
  assert.equal(normalizeKenyaPhone("07123"), null);
  assert.equal(normalizeKenyaPhone(""), null);
  assert.equal(normalizeKenyaPhone("abc"), null);
});

test("formatClock", () => {
  assert.equal(formatClock(125_000), "2:05");
  assert.equal(formatClock(3_725_000), "1:02:05");
  assert.equal(formatClock(-5), "0:00");
  assert.equal(formatClock(59_001), "1:00");
});

test("scopes: rent prompts only for Plot Yangu; entity keys parse", () => {
  assert.ok(scopesForProduct("pms").includes("rent_stk"));
  assert.ok(!scopesForProduct("chama").includes("rent_stk"));
  assert.ok(!scopesForProduct("school").includes("rent_stk"));
  assert.deepEqual(splitEntityKey("chama:SMC-0042"), { product: "chama", code: "SMC-0042" });
  assert.equal(splitEntityKey("bogus:1"), null);
  assert.equal(splitEntityKey("nocolon"), null);
  assert.equal(PRODUCT_LABEL.pms, "Plot Yangu");
});

test("payload: draft shape and size guard", () => {
  assert.deepEqual(buildDraft([{ a: "1" }], "excel"), { rows: [{ a: "1" }], source: "excel" });
  assert.equal(payloadProblem(buildDraft([{ a: "1" }], "manual")), null);
  const big = buildDraft([{ blob: "x".repeat(MAX_PAYLOAD_BYTES) }], "excel");
  assert.ok(payloadBytes(big) > MAX_PAYLOAD_BYTES);
  assert.match(payloadProblem(big) ?? "", /too much data/);
  assert.equal(payloadBytes({ n: "é" }), JSON.stringify({ n: "é" }).length + 1); // multi-byte characters count as bytes
});

test("application: the server's limits are enforced client-side too", () => {
  const ok = { name: "Mary Wanjiku", phone: "0712 345 678", idNumber: "12345678", ward: "Karen" };
  assert.deepEqual(validateApplication(ok), {});
  assert.ok(validateApplication({ ...ok, name: "A" }).name);
  assert.ok(validateApplication({ ...ok, name: "x".repeat(81) }).name);
  assert.ok(validateApplication({ ...ok, phone: "12345" }).phone);
  assert.ok(validateApplication({ ...ok, idNumber: "12345" }).idNumber);
  assert.ok(validateApplication({ ...ok, idNumber: "1234567890123" }).idNumber);
  assert.ok(validateApplication({ ...ok, idNumber: "12345a78" }).idNumber);
  assert.ok(validateApplication({ ...ok, ward: "  " }).ward);
  assert.ok(validateApplication({ ...ok, ward: "w".repeat(41) }).ward);
  assert.deepEqual(cleanApplication({ ...ok, name: "  Mary   Wanjiku ", ward: " Karen " }),
    { name: "Mary Wanjiku", phone: "+254712345678", idNumber: "12345678", wardId: "Karen" });
});

test("journey: every status has next steps; suspended/closed sit outside the path", () => {
  assert.equal(JOURNEY.length, 4);
  assert.equal(journeyIndex("applied"), 0);
  assert.equal(journeyIndex("active"), 3);
  assert.equal(journeyIndex("suspended"), -1);
  for (const s of ["applied", "training", "certified", "active", "suspended", "closed"] as const) {
    const n = nextSteps(s);
    assert.ok(n.headline && n.lines.length > 0, s);
  }
  assert.equal(nextSteps("active").tone, "green");
  assert.ok(AGENT_TERMS.length > 0);
});
