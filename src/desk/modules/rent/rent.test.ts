/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TENANTS, mergePage, selectMany, summariseBatch, toggleTenant, type Tenant } from "./rentLogic.ts";

const t = (n: number): Tenant => ({ tenantId: `t${n}`, name: `T${n}`, unit: `U${n}`, phoneMasked: "•••" });

test("toggling adds and removes a tenant", () => {
  const a = toggleTenant(new Map(), t(1));
  assert.deepEqual([...a.selection.keys()], ["t1"]);
  const b = toggleTenant(a.selection, t(1));
  assert.equal(b.selection.size, 0);
  assert.equal(b.limited, false);
});
test("a batch holds at most 200 tenants", () => {
  const full = selectMany(new Map(), Array.from({ length: MAX_TENANTS }, (_, i) => t(i))).selection;
  assert.equal(full.size, MAX_TENANTS);
  const over = toggleTenant(full, t(999));
  assert.equal(over.limited, true);
  assert.equal(over.selection.size, MAX_TENANTS);
  assert.equal(toggleTenant(full, t(5)).selection.size, MAX_TENANTS - 1);
});
test("select-all stops at the cap and reports what was left out", () => {
  const first = selectMany(new Map(), Array.from({ length: 150 }, (_, i) => t(i)));
  assert.deepEqual([first.selection.size, first.skipped], [150, 0]);
  // t100–t229: 50 are already selected, 80 are new, but only 50 more fit under the cap of 200.
  const second = selectMany(first.selection, Array.from({ length: 130 }, (_, i) => t(100 + i)));
  assert.equal(second.selection.size, MAX_TENANTS);
  assert.equal(second.skipped, 30);
});
test("pages merge without duplicates", () => {
  assert.deepEqual(mergePage([t(1), t(2)], [t(2), t(3)]).map((x) => x.tenantId), ["t1", "t2", "t3"]);
});
test("a batch reads per tenant: sent, failed, waiting, or honestly missing once finished", () => {
  const ids = ["t1", "t2", "t3"];
  const results = [{ tenantId: "t1", status: "sent" as const, reference: "R1" }, { tenantId: "t2", status: "failed" as const, error: "No phone" }];
  const live = summariseBatch(ids, results, "processing");
  assert.deepEqual([live.sent, live.failed, live.waiting, live.noResult, live.finished], [1, 1, 1, 0, false]);
  assert.equal(live.rows[1].error, "No phone");
  const done = summariseBatch(ids, results, "done");
  assert.deepEqual([done.waiting, done.noResult, done.finished], [0, 1, true]);
  assert.equal(summariseBatch(["t9"], [], "requested").rows[0].state, "waiting");
});
