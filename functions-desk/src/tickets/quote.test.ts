import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESK_CONFIG } from "../config.js";
import { parseParams, parseQuoteEnvelope, priceService } from "./quote.js";

const cfg = DEFAULT_DESK_CONFIG;

test("envelope: needs a session, a known service and object params", () => {
  assert.throws(() => parseQuoteEnvelope(null), /Invalid request/);
  assert.throws(() => parseQuoteEnvelope({ sessionId: "", serviceType: "import_excel" }), /session/);
  assert.throws(() => parseQuoteEnvelope({ sessionId: "a/b", serviceType: "import_excel" }), /session/);
  assert.throws(() => parseQuoteEnvelope({ sessionId: "s", serviceType: "free_money" }), /Unknown service/);
  assert.throws(() => parseQuoteEnvelope({ sessionId: "s", serviceType: "import_excel", params: [] }), /Invalid service details/);
  assert.equal(parseQuoteEnvelope({ sessionId: "s", serviceType: "schedule_setup" }).serviceType, "schedule_setup");
});

test("counts must be positive integers up to 100000", () => {
  for (const bad of [0, -1, 1.5, 100001, "5", NaN, null, undefined, Infinity]) {
    assert.throws(() => parseParams("import_excel", { rowCount: bad }), /Row count/);
    assert.throws(() => parseParams("manual_entry", { recordCount: bad }), /Record count/);
  }
  assert.deepEqual(parseParams("import_excel", { rowCount: 100000 }), { rowCount: 100000 });
  assert.deepEqual(parseParams("manual_entry", { recordCount: 1 }), { recordCount: 1 });
});

test("unknown parameters are rejected, schedule_setup takes none", () => {
  assert.throws(() => parseParams("import_excel", { rowCount: 5, price: 1 }), /"price"/);
  assert.throws(() => parseParams("schedule_setup", { x: 1 }), /"x"/);
  assert.deepEqual(parseParams("schedule_setup", {}), {});
});

test("bulk_reminder needs an audience and a 1-385 character message", () => {
  assert.throws(() => parseParams("bulk_reminder", { message: "hi" }), /who/);
  assert.throws(() => parseParams("bulk_reminder", { audience: "all", message: "   " }), /between 1 and 385/);
  assert.throws(() => parseParams("bulk_reminder", { audience: "all", message: "x".repeat(386) }), /between 1 and 385/);
  assert.deepEqual(parseParams("bulk_reminder", { audience: " all ", message: "x".repeat(385) }), { audience: "all", message: "x".repeat(385) });
});

test("prices come from config: import 200, manual tier + 200 fee (<= 1,000 + 200), comms 100", () => {
  assert.equal(priceService("import_excel", { rowCount: 9999 }, cfg).amountMinor, 20000);
  assert.equal(priceService("schedule_setup", {}, cfg).amountMinor, 10000);
  const small = priceService("manual_entry", { recordCount: 10 }, cfg);
  assert.equal(small.amountMinor, 20000 + 20000);
  assert.equal(small.lines.length, 2);
  const big = priceService("manual_entry", { recordCount: 100000 }, cfg);
  assert.equal(big.amountMinor, 100000 + 20000);
  assert.equal(big.lines.reduce((s, l) => s + l.amountMinor, 0), big.amountMinor);
  const bulk = priceService("bulk_reminder", { audience: "a", message: "m" }, cfg, { recipients: 12, credits: 12 });
  assert.equal(bulk.amountMinor, 10000);
  assert.match(bulk.lines[0].label, /12 recipients/);
  assert.throws(() => priceService("bulk_reminder", { audience: "a", message: "m" }, cfg), /Recipient count/);
});

test("a config that prices a service at zero is refused", () => {
  assert.throws(() => priceService("import_excel", { rowCount: 1 }, { ...cfg, prices: { ...cfg.prices, importMinor: 0 } }), /no valid price/);
});
