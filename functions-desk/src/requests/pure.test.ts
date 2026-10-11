import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import {
  buildPublicConfig, canTransition, cleanText, hashPublicConfig, hasProductOutbox, normaliseDeskCodes, parseLimit, replySmsText,
  requestDocId, sanitiseOutboxItem, smsAllowed, toMillis,
} from "./pure.js";

const good = {
  kind: "support", status: "new", entityCode: "smc-0042", entityName: "Umoja Chama", requesterName: "Jane", requesterPhone: "0722 000 111",
  category: "sms", subject: "Credits missing", message: "I paid but see none", targetDeskCodes: ["cog-0003"], createdAt: 1_700_000_000_000,
};

test("a valid item is cleaned: code upper-cased, phone normalised, desk code upper-cased", () => {
  const r = sanitiseOutboxItem(good, 5);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.item.entityCode, "SMC-0042"); assert.equal(r.item.requesterPhone, "+254722000111");
    assert.deepEqual(r.item.targetDeskCodes, ["COG-0003"]); assert.equal(r.item.createdAt, 1_700_000_000_000); assert.equal(r.item.category, "sms");
  }
});
test("subject and message are cut to 120 / 2000, control characters removed", () => {
  const r = sanitiseOutboxItem({ ...good, subject: "s".repeat(500), message: "m\u0000\u0007".repeat(1500) }, 5);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.item.subject.length, 120); assert.ok(r.item.message.length <= 2000); assert.ok(!/[\u0000-\u0008]/.test(r.item.message)); }
});
test("malformed items are rejected with a reason", () => {
  const bad = (o: Record<string, unknown>) => sanitiseOutboxItem({ ...good, ...o }, 5);
  for (const o of [{ kind: "payment" }, { entityCode: "x" }, { entityCode: "a/b/c" }, { subject: "   " }, { message: "" }, { requesterPhone: "12345" },
    { requesterPhone: undefined }, { requesterName: "" }]) assert.equal(bad(o).ok, false, JSON.stringify(o));
  assert.equal(sanitiseOutboxItem(null, 5).ok, false); assert.equal(sanitiseOutboxItem([], 5).ok, false);
});
test("unknown category becomes other; missing createdAt uses now; Timestamp-like createdAt is read", () => {
  const r = sanitiseOutboxItem({ ...good, category: "refunds", createdAt: undefined }, 777);
  assert.ok(r.ok); if (r.ok) { assert.equal(r.item.category, "other"); assert.equal(r.item.createdAt, 777); }
  assert.equal(toMillis({ toMillis: () => 42 }), 42); assert.equal(toMillis("x"), undefined); assert.equal(toMillis(-1), undefined);
});
test("desk codes: 1–3 valid, de-duplicated, invalid dropped, none -> COG-0000", () => {
  assert.deepEqual(normaliseDeskCodes(["COG-0001", "cog-0001", "bad", 5, "COG-0002", "COG-0003", "COG-0004"]), ["COG-0001", "COG-0002", "COG-0003"]);
  assert.deepEqual(normaliseDeskCodes([]), ["COG-0000"]); assert.deepEqual(normaliseDeskCodes(["nope"]), ["COG-0000"]);
  assert.deepEqual(normaliseDeskCodes(undefined), ["COG-0000"]); assert.deepEqual(normaliseDeskCodes("COG-0001"), ["COG-0000"]);
});
test("document id is deterministic so a re-pull hits the same document", () => {
  assert.equal(requestDocId("chama", "SMC-0042", "abc"), "chama_SMC-0042_abc");
});
test("request state machine", () => {
  assert.ok(canTransition("new", "open") && canTransition("new", "answered") && canTransition("new", "closed"));
  assert.ok(canTransition("open", "answered") && canTransition("open", "closed") && !canTransition("open", "new") && !canTransition("open", "open"));
  assert.ok(canTransition("answered", "answered") && canTransition("answered", "closed") && !canTransition("answered", "open"));
  for (const to of ["new", "open", "answered", "closed"] as const) assert.equal(canTransition("closed", to), false);
});
test("SMS throttle: once per hour per request", () => {
  assert.equal(smsAllowed(undefined, 1), true);
  assert.equal(smsAllowed(1_000, 1_000 + 3_599_999), false); assert.equal(smsAllowed(1_000, 1_000 + 3_600_000), true);
});
test("reply SMS is bounded and mentions no money", () => {
  const t = replySmsText("s".repeat(120), "r".repeat(1000));
  assert.ok(t.length < 300); assert.doesNotMatch(t, /KES|bonus|commission/i);
});
test("public config hash ignores updatedAt and changes with a rate", () => {
  const a = buildPublicConfig(DEFAULT_DESK_CONFIG, 1); const b = buildPublicConfig(DEFAULT_DESK_CONFIG, 999);
  assert.equal(hashPublicConfig(a), hashPublicConfig(b));
  assert.notEqual(hashPublicConfig(a), hashPublicConfig(buildPublicConfig({ ...DEFAULT_DESK_CONFIG, smsShareOfMarginPct: 41 }, 1)));
  assert.notEqual(hashPublicConfig(a), hashPublicConfig(buildPublicConfig({ ...DEFAULT_DESK_CONFIG, subShareByRank: { ...DEFAULT_DESK_CONFIG.subShareByRank, clerk: 26 } }, 1)));
});
test("helpers", () => {
  assert.equal(cleanText("  a \t b\u0000 "), "a b"); assert.equal(parseLimit(999), 50); assert.equal(parseLimit(0), 1); assert.equal(parseLimit("x"), 50);
  assert.ok(hasProductOutbox("chama") && hasProductOutbox("school") && !hasProductOutbox("pms") && !hasProductOutbox("desk"));
});
