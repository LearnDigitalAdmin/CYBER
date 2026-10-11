/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deskLedgerCsv, describeReconciliation, inRange, kesToMinor, milestoneView, payoutGroups, rangeFor, reconcileDeskPayments, splitStatuses,
  type CyberIncomeRow, type LedgerRow,
} from "./model.ts";

const row = (o: Partial<LedgerRow> & Pick<LedgerRow, "entryId" | "kind" | "status" | "amountMinor">): LedgerRow => ({ createdAt: 1000, ...o });

test("milestone progress is accounts toward the next block of ten", () => {
  const bp = { qualifyingAccounts: 23, blocksPaid: 2, bankedMinor: 400000, capMinor: 1000000 };
  const m = milestoneView(bp);
  assert.deepEqual([m.toward, m.blockSize, m.capReached], [3, 10, false]);
  assert.equal(m.towardFraction, 0.3);
  assert.equal(m.capFraction, 0.4);
  assert.equal(milestoneView({ ...bp, qualifyingAccounts: 20 }).toward, 0);
  assert.equal(milestoneView({ ...bp, qualifyingAccounts: 0, blocksPaid: 0, bankedMinor: 0 }).toward, 0);
});
test("at the lifetime cap there is no next block", () => {
  const m = milestoneView({ qualifyingAccounts: 57, blocksPaid: 5, bankedMinor: 1000000, capMinor: 1000000 });
  assert.deepEqual([m.capReached, m.toward, m.capFraction], [true, 0, 1]);
  assert.equal(milestoneView({ qualifyingAccounts: 5, blocksPaid: 0, bankedMinor: 0, capMinor: 0 }).capFraction, 0);
});

test("processing money is carved out of the server's payable figure", () => {
  const rows = [
    row({ entryId: "a", kind: "bonus", status: "processing", amountMinor: 200000 }),
    row({ entryId: "b", kind: "bonus", status: "payable", amountMinor: 200000 }),
    row({ entryId: "c", kind: "service", status: "settled", amountMinor: 5000 }),
  ];
  assert.deepEqual(splitStatuses({ settledMinor: 5000, payableMinor: 400000, paidMinor: 100000 }, rows),
    { settledMinor: 5000, payableMinor: 200000, processingMinor: 200000, paidMinor: 100000 });
  // a truncated window can never produce a negative payable figure
  assert.deepEqual(splitStatuses({ settledMinor: 0, payableMinor: 100000, paidMinor: 0 }, rows),
    { settledMinor: 0, payableMinor: 0, processingMinor: 100000, paidMinor: 0 });
  assert.equal(splitStatuses({ settledMinor: 0, payableMinor: 0, paidMinor: 0 }, []).processingMinor, 0);
});
test("bonuses and support payouts are grouped by payout stage; void counts nowhere", () => {
  const g = payoutGroups([
    row({ entryId: "1", kind: "bonus", status: "payable", amountMinor: 200000 }),
    row({ entryId: "2", kind: "bonus", status: "paid", amountMinor: 200000 }),
    row({ entryId: "3", kind: "bonus", status: "void", amountMinor: 200000 }),
    row({ entryId: "4", kind: "support", status: "processing", amountMinor: 1500 }),
    row({ entryId: "5", kind: "support", status: "paid", amountMinor: 500 }),
    row({ entryId: "6", kind: "service", status: "settled", amountMinor: 9999 }),
  ]);
  assert.deepEqual(g.bonus, { payableMinor: 200000, processingMinor: 0, paidMinor: 200000 });
  assert.deepEqual(g.support, { payableMinor: 0, processingMinor: 1500, paidMinor: 500 });
});

test("ranges stay inside the server's 13 months and include today's new entries", () => {
  const now = Date.UTC(2026, 9, 11, 12, 0);
  for (const k of ["today", "7d", "month", "30d", "90d", "year"] as const) {
    const r = rangeFor(k, now);
    assert.ok(r.from < now && r.to > now, k);
    assert.ok(r.to - r.from <= 400 * 86_400_000, k);
  }
  assert.equal(new Date(rangeFor("month", now).from).getDate(), 1);
  assert.deepEqual(inRange([{ createdAt: 5 }, { createdAt: 15 }, { createdAt: 25 }], 10, 20), [{ createdAt: 15 }]);
});

const pay = (reference: string, kes: number, paidAt = 5000): CyberIncomeRow => ({ reference, service: "schedule_setup", agentNetIncomeKes: kes, paidAt });
const led = (ref: string, minor: number, createdAt = 5000): LedgerRow => row({ entryId: `l_${ref}`, kind: "service", status: "settled", amountMinor: minor, paystackRef: ref, createdAt });
const OPEN = { cyberTruncated: false, ledgerTruncated: false };

test("PAY income (KES) and the ledger (minor units) agree when the same payment has the same amount", () => {
  assert.equal(kesToMinor(194.5), 19450);
  assert.equal(kesToMinor(0.1 + 0.2), 30); // float noise never leaks into the comparison
  const r = reconcileDeskPayments([pay("CYBER_DSK_1", 194.5), pay("CYBER_DSK_2", 97.25)], [led("CYBER_DSK_1", 19450), led("CYBER_DSK_2", 9725)], OPEN);
  assert.deepEqual([r.checked, r.agree, r.differ.length, r.notInLedger.length, r.notInPay.length, r.partial], [2, 2, 0, 0, 0, false]);
});
test("differences and one-sided payments are reported, not hidden", () => {
  const r = reconcileDeskPayments(
    [pay("CYBER_DSK_1", 100), pay("CYBER_DSK_2", 50), pay("CYBER_DSK_3", 10)],
    [led("CYBER_DSK_1", 9900), led("CYBER_DSK_2", 5000), led("CYBER_DSK_4", 700)], OPEN);
  assert.deepEqual(r.differ, [{ reference: "CYBER_DSK_1", ledgerMinor: 9900, payMinor: 10000 }]);
  assert.deepEqual(r.notInLedger, ["CYBER_DSK_3"]);
  assert.deepEqual(r.notInPay, ["CYBER_DSK_4"]);
  assert.deepEqual([r.checked, r.agree], [4, 1]);
});
test("only desk payments are compared; void and non-service rows are ignored", () => {
  const r = reconcileDeskPayments(
    [pay("CYBER_OTHER_1", 40), pay("CYBER_DSK_1", 10)],
    [led("CYBER_OTHER_1", 1), row({ entryId: "v", kind: "service", status: "void", amountMinor: 1000, paystackRef: "CYBER_DSK_1" }),
      row({ entryId: "c", kind: "commission", status: "settled", amountMinor: 1000, paystackRef: "CYBER_DSK_1" })], OPEN);
  assert.deepEqual([r.checked, r.agree, r.notInLedger], [1, 0, ["CYBER_DSK_1"]]);
});
test("when a list was cut off, payments older than its edge are not compared", () => {
  // the ledger window only reaches back to t=4000: the t=1000 payment is simply too old to match, not missing
  const r = reconcileDeskPayments(
    [pay("CYBER_DSK_OLD", 10, 1000), pay("CYBER_DSK_NEW", 10, 5000)],
    [led("CYBER_DSK_NEW", 1000, 5000), led("CYBER_DSK_EDGE", 1, 4000)], { cyberTruncated: false, ledgerTruncated: true });
  assert.deepEqual([r.partial, r.agree, r.notInLedger, r.notInPay], [true, 1, [], ["CYBER_DSK_EDGE"]]);
});

test("the reconciliation reads the same everywhere", () => {
  const ok = describeReconciliation(reconcileDeskPayments([pay("CYBER_DSK_1", 10)], [led("CYBER_DSK_1", 1000)], OPEN));
  assert.deepEqual(ok, { tone: "ok", lines: ["All 1 desk payment matches your ledger."] });
  assert.equal(describeReconciliation(reconcileDeskPayments([], [], OPEN)).tone, "none");
  const bad = describeReconciliation(reconcileDeskPayments([pay("CYBER_DSK_1", 10), pay("CYBER_DSK_2", 5)], [led("CYBER_DSK_1", 900)], OPEN));
  assert.equal(bad.tone, "error");
  assert.match(bad.lines[1], /1 differ in amount: CYBER_DSK_1 \(ledger KES 9\.00, payment KES 10\.00\)/);
  assert.match(bad.lines[2], /not in your ledger yet/);
  const partial = describeReconciliation(reconcileDeskPayments([pay("CYBER_DSK_1", 10)], [led("CYBER_DSK_1", 1000)], { cyberTruncated: true, ledgerTruncated: false }));
  assert.match(partial.lines[0], /recent payments only/);
});
test("the ledger CSV has one line per entry, KES with two decimals, and no spreadsheet formulas", () => {
  const csv = deskLedgerCsv([
    row({ entryId: "1", kind: "service", status: "settled", amountMinor: 19450, product: "chama", createdAt: Date.UTC(2026, 9, 11, 9, 0), paystackRef: "CYBER_DSK_1" }),
    row({ entryId: "2", kind: "bonus", status: "payable", amountMinor: 200000, createdAt: 0, paystackRef: "=HYPERLINK(\"x\")" }),
  ]).split("\n");
  assert.equal(csv[0], "Date,Kind,Product,Amount (KES),Status,Reference");
  assert.equal(csv[1], "2026-10-11T09:00:00.000Z,Desk service,MyChama,194.50,Auto-settled,CYBER_DSK_1");
  assert.match(csv[2], /^1970-01-01T00:00:00\.000Z,Milestone bonus,—,2000\.00,Payable,"'=HYPERLINK\(""x""\)"$/);
  assert.equal(csv.length, 3);
});
